# Iteration Management Specification - Stateless Mode

This document covers the Stateless Mode implementation of iteration management, which uses GitHub's native APIs without requiring a GitHub Action. For shared concepts, see [iterations-common.md](./iterations-common.md).

---

## Overview

Stateless mode enables full iteration tracking without requiring the CodjiFlo GitHub Action. It uses GitHub's native APIs to detect iterations and compute diffs at runtime. **Each commit in the PR maps to one iteration**, providing per-commit granularity. Force-pushes produce collapsed iteration groups for discarded commits.

---

## Mode Selection

CodjiFlo operates in one of two modes:

| Mode | Trigger | Data Source |
|------|---------|-------------|
| **Stateful** | `<!-- codjiflo-data -->` comment found | SQLite artifact from GitHub Action |
| **Stateless** | No artifact comment OR `?mode=stateless` query param | GitHub Commits + Timeline + Compare APIs |

**Note:** The `?mode=stateless` query parameter forces stateless mode even when an artifact exists. Useful for testing and comparison.

---

## Commit-Based Iteration Detection

Stateless mode builds iteration history from GitHub's PR Commits API, supplemented by the Issues Timeline API for force-push detection:

```
GET /repos/{owner}/{repo}/pulls/{pr_number}/commits    # Current PR commits
GET /repos/{owner}/{repo}/issues/{pr_number}/timeline   # Force-push history
```

### Core Model

Each commit in the PR maps to one iteration. Iterations represent cumulative diffs from the PR base to that commit:

| Concept | Description |
|---------|-------------|
| **Live iteration** | A commit currently on the PR branch; diff is `base...commit_sha` |
| **Collapsed iteration** | A commit discarded by a force-push; may or may not be accessible |
| **Iteration number** | Sequential 1-based across ALL commits (live + discarded), ordered chronologically |

### Commit-Based Iteration Building Algorithm

```typescript
function buildIterationsFromCommits(
  commits: PRCommit[],
  timeline: TimelineEvent[],
  pr: PR
): { iterations: StatelessIteration[], collapsedGroups: CollapsedIterationGroup[] } {
  const iterations: StatelessIteration[] = [];
  const collapsedGroups: CollapsedIterationGroup[] = [];
  let revision = 1;

  // Step 1: Extract force-push events from timeline
  const forcePushes = timeline
    .filter(e => e.event === 'head_ref_force_pushed')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Step 2: For each force-push, discover discarded commits
  for (const event of forcePushes) {
    const discarded = await discoverDiscardedCommits(
      pr.owner, pr.repo, event.after_commit.sha, event.before_commit.sha
    );

    if (discarded.status === 'discovered') {
      // Add discarded commits as collapsed iterations
      const group: CollapsedIterationGroup = {
        forcePushEventId: event.id,
        discardedRevisions: [],
        commits: discarded.commits,
        reason: 'force_push',
        visibility: 'collapsed',
      };

      for (const commit of discarded.commits) {
        iterations.push({
          revision: revision,
          commitSha: commit.sha,
          baseSha: pr.base.sha,
          author: commit.author,
          createdAt: commit.date,
          status: 'collapsed',
          collapsedGroupId: event.id,
        });
        group.discardedRevisions.push(revision);
        revision++;
      }

      collapsedGroups.push(group);
    } else {
      // GC'd before SHA: record unknown discarded count
      collapsedGroups.push({
        forcePushEventId: event.id,
        discardedRevisions: [],
        commits: [],
        reason: 'force_push',
        visibility: 'collapsed',
        unknownCount: true,
      });
    }
  }

  // Step 3: Add current PR commits as live iterations
  for (const commit of commits) {
    iterations.push({
      revision: revision,
      commitSha: commit.sha,
      baseSha: pr.base.sha,
      author: commit.author,
      createdAt: commit.date,
      status: 'live',
    });
    revision++;
  }

  // Step 4: Sort all iterations chronologically (collapsed first, then live)
  iterations.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Step 5: Reassign sequential revision numbers after sorting
  iterations.forEach((iter, i) => { iter.revision = i + 1; });

  // Update collapsed group revision numbers after reassignment
  for (const group of collapsedGroups) {
    group.discardedRevisions = iterations
      .filter(i => i.collapsedGroupId === group.forcePushEventId)
      .map(i => i.revision);
  }

  return { iterations, collapsedGroups };
}
```

### Discovering Discarded Commits

```typescript
async function discoverDiscardedCommits(
  owner: string, repo: string, afterSha: string, beforeSha: string
): Promise<DiscoveryResult> {
  // Use Compare API to find commits reachable from `before` but not from `after`
  // GET /repos/{owner}/{repo}/compare/{after}...{before}
  try {
    const comparison = await github.compare(owner, repo, afterSha, beforeSha);
    return {
      status: 'discovered',
      commits: comparison.commits.map(c => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.author?.login ?? c.commit.author.name,
        status: 'available',
      })),
    };
  } catch (error) {
    if (error.status === 404 || error.status === 410) {
      // Before SHA has been garbage-collected
      return { status: 'gc', commits: [] };
    }
    throw error;
  }
}
```

### Timeline Events Used

| Event | Data Extracted | Purpose |
|-------|----------------|---------|
| `head_ref_force_pushed` | `before_commit.sha`, `after_commit.sha` | Identifies discarded commit ranges |
| `head_ref_deleted` | Branch name | Marks PR as abandoned |
| `merged` | Merge commit SHA | Marks final state |

### Key Behaviors

- Each PR commit maps to one iteration (per-commit granularity)
- Each iteration shows cumulative diff: `base...commit_sha`
- Force-push timeline events identify discarded history
- Discarded commits become collapsed iteration groups
- Iterations are immutable once discovered
- Timeline and commits are fetched once on PR open, not polled

---

## Collapsed Iterations

When a force-push occurs, the commits it replaces become "collapsed iterations" - iterations whose underlying commits were discarded.

### Data Model

```typescript
interface CollapsedIterationGroup {
  forcePushEventId: string;          // Timeline event identifier
  discardedRevisions: number[];      // Original revision numbers
  commits: DiscardedCommit[];        // Individual commit details (if discoverable)
  reason: 'force_push';
  visibility: 'collapsed' | 'expanded';  // User toggled to include in range
  unknownCount?: boolean;            // True if before SHA was GC'd
}

interface DiscardedCommit {
  sha: string;
  message: string;
  author: string;
  status: 'available' | 'unavailable';  // GC'd or not
}
```

### Collapsed Iterations UI

**Default display:**
- Single tab per collapsed group, grayed out
- Lucide `Eraser` icon
- Hover tooltip: "N iterations discarded"

**Click behavior:**
- Replaces diff area with history view showing:
  - Each discarded iteration with number and commit message
  - "Include discarded iterations" button

**When included (visibility = `expanded`):**
- Collapsed tab expands to full-size individual tabs
- Still grayed out visually (distinct from live iterations)
- Can participate in iteration range diffs
- Diffs use `base...discarded_commit_sha`
- If commit GC'd, unavailable iteration handling applies

**Range behavior:**
- By default, collapsed tabs are skipped in range selection
- When included, they participate normally in range diffs

**Unknown discarded count:**
- When compare API returns 404/410 for the `before` SHA, the collapsed group shows "Unknown iterations discarded" instead of individual commit details
- No expand capability (no commit details to show)

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

When GitHub garbage-collects commits, iterations become unavailable. This applies to both live and collapsed iterations.

### Detection

| Response | Meaning |
|----------|---------|
| 404 | Commit not found |
| 410 | Explicitly deleted |

### Scope

- **Live iterations**: Detected when fetching commit content or computing diffs
- **Collapsed iterations**: Detected during discovery (compare API fails) or when user expands collapsed group and attempts to view diffs
- **Unknown discarded**: When the compare API returns 404/410 for the force-push `before` SHA, the entire collapsed group is marked as having unknown count with no individual commit details

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

**Collapsed iterations:**
- When compare API fails for the `before` SHA, show "Unknown iterations discarded" (no individual commit details)
- When individual collapsed commits are GC'd after discovery, show as unavailable within expanded view

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
    commitSha: string;
    baseSha: string;
    status: 'live' | 'collapsed';
    collapsedGroupId?: string;
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
  commitSha: string;                    // Git commit SHA
  baseSha: string;                      // Base branch commit
  eventType: 'commit';                  // All iterations are commit-based
  status: 'live' | 'collapsed';        // Live or discarded by force-push
  collapsedGroupId?: string;            // Links to CollapsedIterationGroup
}
```

**Features:**
- Commit-based iteration detection via GitHub PR Commits API
- Force-push history captured via Timeline API
- Discarded commits discoverable via Compare API
- Collapsed iteration groups for force-push discards
- Diff computed via Compare API (2-dot and 3-dot)
- SpanTrackers computed at runtime in Web Worker
- Line-level comment precision (no character-level)

**Limitations:**
- Commits may be garbage-collected (no content preservation)
- Line-level only (no character-level comment anchors)
- Requires API calls for each diff computation
- Discarded commits may be undiscoverable if GC'd

---

## Behavioral Requirements Checklist

### Stateless Mode Specific

- [ ] Fetch PR commits via Commits API
- [ ] Map each commit to one iteration (per-commit granularity)
- [ ] Detect force-pushes via `head_ref_force_pushed` timeline events
- [ ] Discover discarded commits via Compare API
- [ ] Build collapsed iteration groups for force-push discards
- [ ] Handle GC'd before SHA (unknown discarded count)
- [ ] Render collapsed groups as single grayed-out tab with Eraser icon
- [ ] Support expanding collapsed groups to include in range diffs
- [ ] Compute diffs via Compare API (2-dot and 3-dot)
- [ ] Compute SpanTrackers at runtime in Web Worker
- [ ] Background precompute SpanTrackers for comment-containing files
- [ ] Priority queue with cancellation for responsive UI
- [ ] Mark unavailable iterations (GC'd commits) for both live and collapsed
- [ ] Persist last seen iteration in IndexedDB
- [ ] Support `?mode=stateless` query param for testing
- [ ] Show file list immediately (before diffs computed)
- [ ] Display "Computing diff..." loading state
