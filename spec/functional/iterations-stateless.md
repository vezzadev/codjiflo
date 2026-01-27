# Iteration Management Specification - Stateless Mode

This document covers the Stateless Mode implementation of iteration management, which uses GitHub's native APIs without requiring a GitHub Action. For shared concepts, see [iterations-common.md](./iterations-common.md).

---

## Overview

Stateless mode enables full iteration tracking without requiring the CodjiFlo GitHub Action. It uses GitHub's native APIs to detect iterations and compute diffs at runtime.

---

## Mode Selection

CodjiFlo operates in one of two modes:

| Mode | Trigger | Data Source |
|------|---------|-------------|
| **Stateful** | `<!-- codjiflo-data -->` comment found | SQLite artifact from GitHub Action |
| **Stateless** | No artifact comment OR `?mode=stateless` query param | GitHub Timeline + Compare APIs |

**Note:** The `?mode=stateless` query parameter forces stateless mode even when an artifact exists. Useful for testing and comparison.

---

## Timeline-Based Iteration Detection

Stateless mode builds iteration history from GitHub's Issues Timeline API:

```
GET /repos/{owner}/{repo}/issues/{pr_number}/timeline
```

### Timeline Events Used

| Event | Data Extracted | Iteration Impact |
|-------|----------------|------------------|
| `force_pushed` | `before` SHA, `after` SHA | Creates new iteration |
| `head_ref_deleted` | Branch name | Marks PR as abandoned |
| `merged` | Merge commit SHA | Marks final state |

### Iteration Building Algorithm

```typescript
function buildIterationsFromTimeline(timeline: TimelineEvent[], pr: PR): Iteration[] {
  const iterations: Iteration[] = [];
  let revision = 1;

  // Initial iteration: PR opened
  iterations.push({
    revision: revision++,
    headSha: getInitialHeadSha(timeline, pr),
    baseSha: pr.base.sha,
    beforeSha: null,
    eventType: 'initial',
  });

  // Force-push events create new iterations
  const forcePushes = timeline
    .filter(e => e.event === 'force_pushed')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  for (const event of forcePushes) {
    iterations.push({
      revision: revision++,
      headSha: event.after,
      baseSha: pr.base.sha,  // May need recalculation for rebases
      beforeSha: event.before,
      eventType: 'force_push',
    });
  }

  return iterations;
}
```

### Key Behaviors

- Regular pushes (non-force) do NOT create new iterations
- Each force-push preserves the `before` SHA for diffing
- Iterations are immutable once discovered
- Timeline is fetched once on PR open, not polled

---

## Diff Computation via Compare API

Stateless mode computes diffs using GitHub's Compare API:

| Comparison Type | API Call | Use Case |
|-----------------|----------|----------|
| 3-dot (merge-base) | `GET /compare/{base}...{head}` | Default PR diff |
| 2-dot (direct) | `GET /compare/{sha1}..{sha2}` | Iteration-to-iteration |

### Content Fetching

```
GET /repos/{owner}/{repo}/contents/{path}?ref={sha}
```

### Optimistic GC Assumption

GitHub typically retains unreferenced objects for extended periods. Stateless mode assumes commits remain accessible and handles 404/410 gracefully when they're not.

---

## Web Worker Diff Computation

Heavy computation runs in a Web Worker to keep the UI responsive.

### Worker Architecture

```
Main Thread                              Worker Thread
─────────────                            ─────────────
DiffScheduler ◄────── Comlink RPC ──────► DiffComputeWorker
     │                                         │
     ├─ schedule()                             ├─ computeDiff()
     ├─ prioritize()                           ├─ computeSpanTracker()
     ├─ cancel()                               └─ fetchContent()
     └─ getResult()
```

### Priority Queue

Tasks are processed in priority order:

| Priority | Level | Trigger |
|----------|-------|---------|
| Highest | 0 | User clicked on file |
| High | 1 | User selected iteration range |
| Medium | 2 | Current → latest iteration |
| Low | 3 | Other iterations (on-demand) |

**Secondary Ordering (within same priority):**
1. Comment count (descending) - files with more comments first
2. UI order (ascending) - order in file list
3. FIFO - first scheduled first

### Cancellation

When a higher-priority task arrives:
1. Cancel in-progress lower-priority task via AbortController
2. Return cancelled task to queue at original priority
3. Start higher-priority task immediately

### Task Interface

```typescript
interface DiffTask {
  taskId: string;           // Unique identifier
  type: 'compute_diff' | 'compute_span_tracker';
  payload: {
    owner: string;
    repo: string;
    filePath: string;
    leftRef: string;        // SHA or 'base'
    rightRef: string;       // SHA or 'head'
  };
}

interface DiffResult {
  taskId: string;
  status: 'completed' | 'cancelled' | 'error' | 'unavailable';
  diffLines?: ParsedDiffLine[];
  alignedLines?: AlignedDiffLine[];
  spanMappings?: LineMapping[];
  error?: string;
}
```

---

## Background SpanTracker Precomputation

SpanTrackers enable comment position tracking across iterations. In stateless mode, they're computed at runtime.

### Precomputation Strategy

After the selected file's diff completes, precompute SpanTrackers for comment-containing files:

1. **Identify files with comments** - query GitHub PR review comments
2. **Queue SpanTracker tasks** at Low priority
3. **Compute in background** - doesn't block user interaction
4. **Cache in memory** - reuse within session

### SpanTracker Computation

Uses the same algorithm as the GitHub Action:

```typescript
function computeSpanMappings(leftContent: string, rightContent: string): LineMapping[] {
  const diffLines = computeLineDiff(leftContent, rightContent);
  const mappings: LineMapping[] = [];

  let leftLine = 1, rightLine = 1;

  for (const line of diffLines) {
    switch (line.type) {
      case 'context':
        mappings.push({
          leftSpan: { startLine: leftLine, endLine: leftLine },
          rightSpan: { startLine: rightLine, endLine: rightLine },
          type: 'unchanged',
        });
        leftLine++; rightLine++;
        break;
      case 'deletion':
        mappings.push({
          leftSpan: { startLine: leftLine, endLine: leftLine },
          rightSpan: null,
          type: 'deleted',
        });
        leftLine++;
        break;
      case 'addition':
        mappings.push({
          leftSpan: null,
          rightSpan: { startLine: rightLine, endLine: rightLine },
          type: 'added',
        });
        rightLine++;
        break;
    }
  }

  return mappings;
}
```

### Cache Strategy

| Storage | Scope | TTL |
|---------|-------|-----|
| Memory | Session | Until range change |
| IndexedDB | None | Not persisted |

**Cache Key:** `${filePath}:${leftSha}:${rightSha}`

### Cross-Iteration Chaining

For non-adjacent comparisons, chain adjacent SpanTrackers:

```
Iteration 1 → 3 = (Iter 1 → 2) then (Iter 2 → 3)
```

---

## Unavailable Iterations

When GitHub garbage-collects commits, iterations become unavailable.

### Detection

| Response | Meaning |
|----------|---------|
| 404 | Commit not found |
| 410 | Explicitly deleted |

### UI Treatment

```typescript
interface IterationAvailability {
  revision: number;
  status: 'available' | 'unavailable';
  reason?: 'gc' | 'deleted' | 'access_denied';
}
```

**Iteration Selector:**
- Unavailable iterations show "Unavailable" badge
- Selection disabled for unavailable iterations
- Tooltip: "This iteration's commit data is no longer available on GitHub"
- Link to Stateful Mode documentation

### Persistence

Unavailable status persisted to IndexedDB to avoid repeated API calls:

```typescript
// Store: 'unavailable'
{
  key: `${owner}/${repo}/${prNumber}/${revision}`,
  value: {
    revision: number,
    reason: 'gc' | 'deleted',
    detectedAt: string,
  }
}
```

---

## IndexedDB Persistence

Minimal state persisted for returning users.

### Schema

```typescript
// Database: 'codjiflo-stateless'

// Store 1: Last seen iteration per PR
interface LastSeen {
  key: string;  // `${owner}/${repo}/${prNumber}`
  value: {
    iterationRevision: number;
    headSha: string;
    timestamp: string;
  };
}

// Store 2: Discovered iterations (immutable)
interface DiscoveredIteration {
  key: string;  // `${owner}/${repo}/${prNumber}/${revision}`
  value: {
    revision: number;
    headSha: string;
    baseSha: string;
    beforeSha: string | null;
    discoveredAt: string;
  };
}

// Store 3: Unavailable iterations
interface UnavailableIteration {
  key: string;  // `${owner}/${repo}/${prNumber}/${revision}`
  value: {
    revision: number;
    reason: 'gc' | 'deleted';
    detectedAt: string;
  };
}
```

### Default Range Selection

| User Type | Default Range |
|-----------|---------------|
| First visit | Base → Latest |
| Returning | Last seen → Latest |

---

## GitHub without Workflow (Stateless Mode)

```typescript
interface GitHubStatelessIteration extends Iteration {
  commitSha: string;           // Git commit SHA
  baseSha: string;             // Base branch commit
  beforeSha?: string;          // SHA before force-push (from timeline event)
  eventType: 'initial' | 'force_push';
}
```

**Features:**
- Timeline-based iteration detection via GitHub Issues Timeline API
- Force-push events captured with before/after SHAs
- Diff computed via Compare API (2-dot and 3-dot)
- SpanTrackers computed at runtime in Web Worker
- Line-level comment precision (no character-level)

**Limitations:**
- Commits may be garbage-collected (no content preservation)
- Line-level only (no character-level comment anchors)
- Requires API calls for each diff computation

---

## Behavioral Requirements Checklist

### Stateless Mode Specific

- [ ] Detect iterations from Timeline API
- [ ] Detect force-pushes via `force_pushed` events
- [ ] Compute diffs via Compare API (2-dot and 3-dot)
- [ ] Compute SpanTrackers at runtime in Web Worker
- [ ] Background precompute SpanTrackers for comment-containing files
- [ ] Priority queue with cancellation for responsive UI
- [ ] Mark unavailable iterations (GC'd commits)
- [ ] Persist last seen iteration in IndexedDB
- [ ] Support `?mode=stateless` query param for testing
- [ ] Show file list immediately (before diffs computed)
- [ ] Display "Computing diff..." loading state
