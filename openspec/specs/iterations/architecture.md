# iterations — Architecture

> Implementation reference. The behavioral contract lives in [spec.md](spec.md).

CodjiFlo tracks PR iterations using a **GitHub Action + Artifact** approach with no backend server required.

## Architecture

```
┌─────────────────┐   on: pull_request   ┌──────────────────┐
│   GitHub Repo   │ ──────────────────►  │  GitHub Action   │
│   (with workflow)                      │  (codjiflo.yml)  │
└─────────────────┘                      └────────┬─────────┘
                                                  │
                     ┌────────────────────────────┼────────────────────────────┐
                     │                            │                            │
                     ▼                            ▼                            ▼
              ┌─────────────┐           ┌─────────────────┐           ┌───────────────┐
              │  Upload     │           │  Post/Update    │           │  Store file   │
              │  SQLite     │           │  PR Comment     │           │  contents in  │
              │  artifact   │           │  with artifact  │           │  artifact     │
              └─────────────┘           │  reference      │           └───────────────┘
                                        └─────────────────┘

┌─────────────────┐                     ┌──────────────────┐
│  CodjiFlo SPA   │ ─── reads ───────►  │  PR Comments     │
│  (React)        │                     │  (find pointer)  │
└────────┬────────┘                     └──────────────────┘
         │
         │ downloads
         ▼
┌─────────────────┐
│  SQLite artifact│
│  (iterations,   │
│   file contents)│
└─────────────────┘
```

## Data Flow

**On PR Event (GitHub Action):**
1. Workflow triggers on `pull_request` events (opened, synchronize, reopened)
2. Action downloads previous artifact if exists
3. Captures `head_sha`, `base_sha`, `before` (force-push tracking)
4. Fetches changed file contents via GitHub API
5. Appends new iteration to SQLite database
6. Computes SpanTrackers (adjacent iteration + base→latest)
7. Uploads SQLite as artifact (90-day retention)
8. Posts/updates PR comment with artifact reference

**On Frontend Load:**
1. Fetch PR comments via GitHub API
2. Find comment with `<!-- codjiflo-data -->` marker
3. Download SQLite artifact
4. Parse SQLite using SQL.js (WASM)
5. Load precomputed SpanTrackers (adjacent pairs + base→latest)
6. Cache artifact in IndexedDB

## Stateful Mode — Full SQLite Schema

The schema uses content-addressable storage to deduplicate file contents. All tables' CREATE statements:

```sql
-- Iteration snapshots
CREATE TABLE iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision INTEGER NOT NULL,           -- Sequential 1, 2, 3...
  head_sha TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  before_sha TEXT,                     -- For force-push tracking
  author TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(revision)
);

-- File artifacts (tracks files across renames)
CREATE TABLE file_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_tracking_id TEXT NOT NULL UNIQUE
);

-- Deduplicated content storage
-- Each unique file content is stored exactly once
CREATE TABLE content_blobs (
  content_hash TEXT PRIMARY KEY,       -- SHA-1 hash (same as Git)
  content TEXT NOT NULL,
  size_bytes INTEGER NOT NULL
);

-- Artifact snapshots (file state at each snapshot)
-- Combines path and content reference in one table
CREATE TABLE artifact_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,     -- Even=left, Odd=right
  file_path TEXT,                      -- NULL if file doesn't exist
  content_hash TEXT REFERENCES content_blobs(content_hash),  -- NULL if deleted
  UNIQUE(artifact_id, snapshot_index)
);

-- Comment anchors (character-level precision)
CREATE TABLE comment_anchors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER REFERENCES file_artifacts(id),
  left_snapshot_index INTEGER NOT NULL,
  right_snapshot_index INTEGER NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  column_start INTEGER,                -- Character-level (optional)
  column_end INTEGER,
  github_comment_id INTEGER,
  created_at TEXT NOT NULL
);

-- Precomputed SpanTrackers (adjacent pairs + base→latest)
CREATE TABLE span_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER REFERENCES file_artifacts(id),
  left_snapshot_index INTEGER NOT NULL,
  right_snapshot_index INTEGER NOT NULL,
  span_data BLOB NOT NULL,             -- Serialized SpanTracker data
  UNIQUE(artifact_id, left_snapshot_index, right_snapshot_index)
);
```

### Content Deduplication

- `content_blobs` stores each unique file content exactly once, keyed by SHA-1 hash
- `artifact_snapshots` references content by hash, enabling space savings when:
  - Same file unchanged across multiple iterations
  - Multiple files have identical content
  - File reverted to previous state

### Precomputed SpanTrackers

- Adjacent pairs: 0→1, 2→3, 4→5 (each iteration's before/after)
- Base→latest: (latest left snapshot)→(latest right snapshot) for quick "full diff" view
  - Note: Uses latest iteration's left snapshot (not snapshot 0) to handle rebases correctly
  - See `iterations-common.md` Base Equivalence section for details
- Cross-iteration: computed client-side by chaining adjacent trackers

### PR Comment Format

The GitHub Action posts a comment with the following format:

```markdown
<!-- codjiflo-data -->
### CodjiFlo Iteration Tracking
**Iterations captured**: 3
**Last updated**: 2025-01-15T10:30:00Z
**Artifact**: `1234567890`
**Run ID**: 9876543210
```

**Pending State**: During workflow execution, the artifact ID may be `pending` while the upload is in progress:

```markdown
**Artifact**: `pending`
```

When the frontend detects `pending`, it falls back to stateless mode and will retry on next load.

### Artifact Caching (IndexedDB)

The frontend caches downloaded SQLite artifacts in IndexedDB to minimize repeated downloads:

| Property | Value |
|----------|-------|
| Database | `codjiflo-artifacts` |
| Store | `artifacts` |
| Key | `{owner}/{repo}/{prNumber}` |
| Value | `{ data: ArrayBuffer, timestamp: string }` |

**Cache Validation:**
- On load, the cached timestamp is compared against the PR comment's `Last updated` timestamp
- If timestamps match, the cached artifact is used directly
- If timestamps differ (new iteration captured), the artifact is re-downloaded

**Cache Eviction:**
- No automatic eviction; relies on browser storage limits
- User can clear via browser settings (IndexedDB data)

### GitHub with CodjiFlo Workflow

```typescript
interface GitHubStatefulIteration extends Iteration {
  commitSha: string;           // Git commit SHA
  baseSha: string;             // Base branch commit
  beforeSha?: string;          // SHA before force-push (from workflow event)
}
```

**Features:**
- Full iteration tracking via artifact storage
- Force-push resilient (before SHA captured)
- Character-level comment anchors (stored in artifact)
- Cross-iteration comparison
- GC-resilient (content stored in artifact, not just references)

**Iteration-Aware File List:**
- File list is filtered to show only files with actual changes in the selected iteration range
- Files with identical content at both snapshots are hidden from the list
- Lines added/removed counters (`+N -M`) reflect the iteration diff, not the full PR diff
- File status badges (Added, Modified, Deleted, Renamed) are computed per iteration range

## Key Files

| File | Purpose |
|------|---------|
| `src/features/iterations/artifact-loader.ts` | Download & parse SQLite artifact |
| `src/features/iterations/degraded-banner.tsx` | "Install workflow" prompt |
| `src/lib/sqlite-wasm.ts` | SQL.js wrapper for browser |

## External Repositories

| Repository | Purpose |
|------------|---------|
| `vezzadev/codjiflo-action` | GitHub Action for iteration capture |
| `codjiflo/comment-action` | GitHub Action for PR comment updates |

## Graceful Degradation

Repos without the CodjiFlo workflow installed:
- Commit range comparison via GitHub API (parity with GitHub native)
- User can select any two commits from PR commit list
- Show banner: "Install workflow for force-push resilience and comment tracking"
- No SpanTrackers (comments won't track across ranges)
- Force-push causes old commits to become unreachable

## Trade-offs

| Trade-off | Mitigation |
|-----------|------------|
| 90-day artifact retention | Acceptable for active PRs |
| Requires workflow install | Clear onboarding, one-click install |
| Can't use on repos you don't control | Graceful degradation + future public repo hosting |
| Artifact download latency | Cache in IndexedDB after first load |

### Future: Public Repo Hosting

High-value public repos (react, kubernetes, etc.) will be indexed by CodjiFlo infrastructure and made available to all users without workflow installation.

## Quick Reference

### Mode Selection

| Mode | Trigger | Data Source |
|------|---------|-------------|
| **Stateful** | `<!-- codjiflo-data -->` comment found | SQLite artifact from GitHub Action |
| **Stateless** | No artifact comment OR `?mode=stateless` query param | GitHub Timeline + Compare APIs |

### Capability Matrix

| Feature | Azure DevOps | GitHub + Workflow (stateful) | GitHub (stateless) |
|---------|--------------|------------------------------|-------------------|
| Iteration ID stability | ✓ Server-assigned | ✓ Artifact-stored | ✓ Timeline-based |
| Character-level comments | ✓ | ✓ (in artifact) | ✗ Line-level |
| Force-push handling | ✓ | ✓ (before SHA in artifact) | ✓ (timeline events) |
| Cross-iteration compare | ✓ | ✓ | ✓ |
| SpanTracker (comment tracking) | ✓ | ✓ (precomputed) | ✓ (runtime computed) |
| GC resilience | ✓ | ✓ (content in artifact) | ✗ (commits may be lost) |
| Requires setup | ✗ | Workflow install | ✗ |

## Stateless Mode — Algorithms

### Commit-Based Iteration Building Algorithm

```typescript
async function buildIterationsFromCommits(
  commits: PRCommit[],
  timeline: TimelineEvent[],
  pr: PR
): Promise<{ iterations: StatelessIteration[], collapsedGroups: CollapsedIterationGroup[] }> {
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

  // Step 4: Sort all iterations chronologically by createdAt
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
        date: c.commit.author.date,
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

## Stateless Mode — Web Worker

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

### SpanTracker Cache Strategy

| Storage | Scope | TTL |
|---------|-------|-----|
| Memory | Session | Until range change |
| IndexedDB | None | Not persisted |

**Cache Key:** `${filePath}:${leftSha}:${rightSha}`

## Complex Git Scenarios

This section documents behavior for advanced git operations that affect iteration tracking and comment persistence.

### Merge Commits

**Scenario:** PR branch contains merge commits from integrating the base branch.

```
Before merge:
  main:   A - B - C
  branch: A - B - D - E (PR changes)

After merging main into branch:
  main:   A - B - C
  branch: A - B - D - E - M (merge commit, 2 parents: E and C)
```

**Iteration Behavior:**
| Platform | Behavior |
|----------|----------|
| Azure DevOps | New iteration created with merge commit as head. File list shows union of changes from both parents relative to base. |
| GitHub + Workflow | Iteration captures post-merge state. Comments on pre-merge code track to new positions. |

**Comment Tracking:**
- Comments on code from the PR branch (D, E) track normally
- Comments on code introduced via merge (from C) may show as "new" in the iteration
- SpanTracker computes diff from iteration N-1 right snapshot to iteration N right snapshot

### Octopus Merges (3+ Parents)

**Scenario:** Merge commit with more than 2 parents (git merge branch1 branch2 branch3).

```
  branch: A - B - M (merge with 3+ parents)
```

**Iteration Behavior:**
- Treated similarly to 2-parent merge
- File list shows cumulative changes from all parent branches
- Conflict resolution captured in merge commit content

**Comment Tracking:**
- Comments track based on final merged content
- Original parent branch comments may become orphaned if conflicts resolved differently

### Rebase Operations

**Scenario:** PR branch rebased onto updated base branch.

```
Before rebase:
  main:   A - B - E - F (main advanced)
  branch: A - B - C - D (PR at C, D)

After rebase:
  main:   A - B - E - F
  branch: A - B - E - F - C' - D' (new commit SHAs)
```

**Iteration Behavior:**
| Platform | Behavior |
|----------|----------|
| Azure DevOps | New iteration created. `changeTrackingId` maintains file identity across rebase. Comments persist via artifact ID. |
| GitHub + Workflow | `before_sha` in workflow event captures pre-rebase HEAD. SpanTrackers recomputed for new commit range. |
| GitHub (stateless) | Timeline preserves force-push events. Old commits may be GC'd but iteration list persists. |

**Base Snapshot Handling After Rebase:**

When a PR is rebased, the base commit changes. The iteration tracking system captures this:

```
Iteration 1 (before rebase):
  base_sha: "old-base" → Snapshot 0 contains old base content
  head_sha: "C"        → Snapshot 1 contains head content

Iteration 2 (after rebase):
  base_sha: "new-base" → Snapshot 2 contains NEW base content (E, F included)
  head_sha: "D'"       → Snapshot 3 contains rebased head content
```

**Critical Implementation Detail:**
- The "full diff" preset and default range use the **latest iteration's left snapshot** as the base
- This ensures diffs are computed against the current (post-rebase) base
- Using snapshot 0 after a rebase would show stale diffs against the old base

**Example:**
```
File: config.txt
Old base (snapshot 0): line1, line2, line3, line4
Iteration 1 head:      line1, MODIFIED-line2, line3, line4
New base (snapshot 2): line1, line2, line3, NEW-line4  (line4 changed in E or F)
Iteration 2 head:      line1, MODIFIED-line2, line3, NEW-line4

Correct "full diff" (snapshot 2 → 3): Shows only line2 changed
Incorrect (snapshot 0 → 3): Would show both line2 AND line4 changed
```

**Comment Tracking Challenges:**
1. **Content changes:** If rebase introduces conflicts, resolved content may differ from original
2. **Line shifts:** New commits (E, F) before rebased commits shift line numbers
3. **SHA discontinuity:** Git history shows new SHAs (C', D') with no ancestry to old (C, D)

**Mitigation:**
- CodjiFlo artifacts track by `changeTrackingId`, not SHA
- SpanTracker chains recomputed: old snapshot → new snapshot
- Comments with tracking confidence < threshold show warning indicator

### Force Push

**Scenario:** Author force-pushes to rewrite history (amend, rebase, reset).

```
Before force push:
  branch: A - B - C - D (comment on line 10 of file.txt in D)

After force push (amend D):
  branch: A - B - C - D' (D' has different SHA, possibly different content)
```

**Iteration Behavior:**
| Platform | Behavior |
|----------|----------|
| Azure DevOps | New iteration with new head SHA. Previous iteration remains accessible. Comments persist via iteration ID. |
| GitHub + Workflow | `before` SHA from `pull_request.synchronize` event captures D. New iteration stores D' as head. Artifact preserves pre-force-push content. |
| GitHub (stateless) | Timeline preserves force-push events. Old commits may be GC'd but iteration list persists. |

**Force Push Types:**
| Type | Git Command | Impact |
|------|-------------|--------|
| Amend | `git commit --amend` | Last commit replaced, content may change |
| Rebase | `git rebase -i` | Multiple commits rewritten |
| Reset | `git reset --hard` | Commits removed entirely |
| Filter-branch | `git filter-branch` | Bulk history rewrite |

**Comment Preservation:**
- Comments tracked by (artifact_id, snapshot_index), not commit SHA
- SpanTracker recomputed from before_sha to new head
- If commented code deleted in force push, comment becomes orphaned

### Squash Merge to PR Branch

**Scenario:** Author squashes commits within PR branch before merge.

```
Before squash:
  branch: A - B - C - D - E (5 commits, comments on C and E)

After squash:
  branch: A - B - F (F = squashed C+D+E)
```

**Iteration Behavior:**
- New iteration created with squashed commit as head
- File content in F equals content in E (final state unchanged)
- Comments on intermediate commits (C, D) may need re-anchoring

**Comment Tracking:**
- Comments on code still present in F: track normally (content unchanged)
- Comments on code removed during squash: become orphaned

### Large File Handling

**Scenario:** PR contains files exceeding normal size thresholds.

**Size Thresholds:**
| Category | Size | Behavior |
|----------|------|----------|
| Normal | < 1 MB | Full diff computation, word-level highlighting |
| Large | 1-10 MB | Line-level diff only, no word highlighting |
| Very Large | 10-100 MB | Truncated diff view, "File too large" warning |
| Oversized | > 100 MB | Metadata only, no content display |

**Performance Mitigations:**
1. **Lazy loading:** Large file content fetched on-demand, not with PR metadata
2. **Virtualized rendering:** Only visible lines rendered
3. **Diff computation offload:** Worker thread for files > 500 KB
4. **Streaming:** Very large files streamed in chunks

**Comment Behavior:**
- Comments allowed on all file sizes
- Character-level precision may be degraded for very large files
- SpanTracker computation may timeout for oversized files (graceful fallback to line-level tracking)

### PRs with Many Files

**Scenario:** PR contains hundreds or thousands of changed files.

**Scale Thresholds:**
| File Count | Behavior |
|------------|----------|
| < 100 | All files loaded immediately |
| 100-500 | Paginated file list, lazy content loading |
| 500-1000 | File tree virtualized, content on-demand |
| > 1000 | Warning banner, potential truncation |

**Performance Mitigations:**
1. **File list virtualization:** Only visible file entries rendered
2. **On-demand content:** File diffs loaded when selected
3. **Batch API calls:** File metadata fetched in batches of 100
4. **IndexedDB caching:** Previously loaded files cached locally

**Iteration Impact:**
- Iteration artifact size grows with file count
- SpanTracker computation parallelized across files
- Cross-iteration comparison may be slower for many-file PRs

### PRs with Many Code Changes

**Scenario:** PR has extensive modifications (10,000+ lines changed).

**Change Volume Thresholds:**
| Lines Changed | Behavior |
|---------------|----------|
| < 1,000 | Full word-level diff |
| 1,000-10,000 | Word-level diff, may batch computation |
| 10,000-50,000 | Line-level diff preferred, word-level optional |
| > 50,000 | Summary view, detailed diff on-demand |

**UI Adaptations:**
1. **Overview first:** Show summary statistics before full diff
2. **File grouping:** Group files by directory or change type
3. **Diff sampling:** For very large PRs, show representative sample with "load more"
4. **Comment density warnings:** Alert if comment tracking may be affected

### Many Iterations

**Scenario:** PR with 50+ iterations (many revisions/updates).

**Scale Considerations:**
| Iteration Count | Behavior |
|-----------------|----------|
| < 20 | All iterations in dropdown |
| 20-50 | Grouped by date, collapsible |
| > 50 | Search/filter interface, recent iterations prioritized |

**Performance Mitigations:**
1. **Iteration metadata pagination:** Only recent iteration details loaded initially
2. **SpanTracker caching:** Adjacent pair trackers cached, cross-iteration computed on-demand
3. **Comment aggregation:** Comments grouped by iteration for efficient loading

### Git LFS (Large File Storage)

**Scenario:** PR contains files tracked by Git LFS.

**LFS File Handling:**
| File Type | Display Behavior |
|-----------|------------------|
| Binary (images, archives) | Metadata only: size, OID, type |
| Text-like (large JSON, logs) | Attempt content fetch if < threshold |
| Modified LFS file | Show size delta, OID change |

**Iteration Behavior:**
- LFS pointers stored in git, actual content in LFS server
- Artifact may store LFS pointers or actual content (configurable)
- Comments allowed at file-level only (no line-level for binary)

**Content Fetching:**
```typescript
interface LFSFile {
  oid: string;           // SHA-256 hash of content
  size: number;          // Actual file size
  pointer: string;       // Git-stored pointer content
  contentUrl?: string;   // URL to fetch actual content
}
```

**Platform Behavior:**
| Platform | LFS Support |
|----------|-------------|
| Azure DevOps | Native LFS hosting, transparent fetch |
| GitHub | LFS hosting, requires authentication for private repos |
| Self-hosted | Depends on LFS server configuration |

### Git Submodules

**Scenario:** PR modifies submodule references.

**Submodule Change Types:**
| Change | Git Representation | Display |
|--------|-------------------|---------|
| Add submodule | New gitlink + .gitmodules entry | "Submodule added: path → repo@commit" |
| Update commit | Gitlink SHA changes | "Submodule updated: old-sha → new-sha" |
| Change URL | .gitmodules modified | Show URL diff |
| Remove submodule | Delete gitlink + .gitmodules entry | "Submodule removed: path" |

**Iteration Behavior:**
- Submodule changes appear as special file entries (mode 160000)
- Content shows commit SHA, not file contents
- Cross-iteration tracking follows gitlink changes

**Display Considerations:**
```typescript
interface SubmoduleChange {
  path: string;
  oldCommit?: string;    // Previous commit SHA
  newCommit?: string;    // New commit SHA
  url?: string;          // Repository URL
  urlChanged?: boolean;  // True if URL modified
}
```

**Comment Behavior:**
- File-level comments allowed on submodule entries
- No line-level comments (submodules have no "lines")
- Comments track submodule path across iterations

### Unreachable Commits (Post-GC)

**Scenario:** Referenced commits become unavailable after remote garbage collection.

**Timeline:**
```
1. Iteration 1 created with commit A
2. Force push replaces with commit B (A becomes dangling)
3. Time passes, remote GC runs
4. Commit A deleted from remote
5. User attempts to view iteration 1
```

**Failure Modes:**
| Component | Without Artifact | With Artifact |
|-----------|------------------|---------------|
| Iteration list | Shows, commit fetch fails | Shows normally |
| File content | "Commit not found" error | Content from artifact |
| Diff computation | Fails | Works from artifact snapshots |
| Comment display | May fail if content needed | Works from artifact |

**Graceful Degradation:**
1. **Artifact-based recovery:** If artifact contains snapshot, use it
2. **Partial availability:** Show available iterations, warn about missing
3. **Metadata preservation:** Iteration entry visible even if content missing
4. **Error messaging:** "Commit X is no longer available on the remote"

**Mitigation Strategy:**
- CodjiFlo artifacts store file content, not just commit references
- SpanTrackers computed from artifact content, not live git
- Comments reference artifact snapshots, remain valid after GC

### Shallow Clones

**Scenario:** Repository cloned with limited history (CI environments, large repos).

**Shallow Clone Types:**
| Type | Command | Available Data |
|------|---------|----------------|
| Depth-limited | `git clone --depth=1` | Only recent commits |
| Treeless | `git clone --filter=tree:0` | Commits + root trees |
| Blobless | `git clone --filter=blob:none` | Commits + trees, fetch blobs on demand |

**Iteration Impact:**
| Scenario | Behavior |
|----------|----------|
| Base commit outside shallow | API fallback to fetch content |
| Old iteration commit missing | Use artifact or API |
| Diff requires missing blob | Fetch blob on-demand |

**Platform Considerations:**
| Platform | Shallow Clone Support |
|----------|----------------------|
| Azure DevOps | Full API fallback available |
| GitHub | API fallback, rate limits apply |
| GitLab | API fallback available |

**Performance Notes:**
- Shallow clones common in CI/CD pipelines
- CodjiFlo should not assume full git history available
- Artifact-based iteration storage bypasses shallow clone limitations

### Symlinks and Special File Modes

**Scenario:** PR contains symlinks or files with special git modes.

**Git File Modes:**
| Mode | Type | Description |
|------|------|-------------|
| 100644 | Regular file | Normal file (rw-r--r--) |
| 100755 | Executable | Executable file (rwxr-xr-x) |
| 120000 | Symlink | Symbolic link |
| 160000 | Gitlink | Submodule reference |
| 040000 | Tree | Directory (not in PR files) |

**Mode Change Handling:**
| Change | Display |
|--------|---------|
| 100644 → 100755 | "Mode changed to executable" |
| 100755 → 100644 | "Mode changed to non-executable" |
| 100644 → 120000 | "Converted to symlink → target" |
| 120000 → 100644 | "Converted from symlink to regular file" |

**Symlink Specifics:**
- Content shows link target path
- Diff shows target path changes
- Broken symlinks (target doesn't exist) display with warning
- Comments at file-level only

**Comment Behavior:**
- Mode-only changes: file-level comments allowed
- Symlinks: file-level comments on link entry
- Symlink target changes: comment tracks symlink path

## Caching

### SpanTracker Cache

Computing span trackers is expensive. Cache by snapshot pair key (e.g., `"2-3"`) and reuse.

**Identity Optimization:** When files are identical between snapshots, use a trivial tracker that returns spans unchanged.

### Iteration Range Selection Cache (Client-Side)

The frontend maintains a per-PR cache of user-selected iteration ranges:

| Property | Value |
|----------|-------|
| Storage | localStorage (persisted via Zustand middleware) |
| Max entries | 50 PRs (LRU eviction) |
| Key | GitHub PR URL (e.g., `https://github.com/owner/repo/pull/123`) |
| Value | `{ fromSnapshot, toSnapshot }` |

**Rebase-Aware Invalidation:**

When a PR is loaded, cached ranges are validated against the current iteration data. A cached range is invalidated if:
1. `fromSnapshot` or `toSnapshot` exceeds valid bounds
2. `fromSnapshot >= toSnapshot` (invalid range)
3. **Rebase detection:** `fromSnapshot === 0` but the latest iteration's left snapshot is > 0

The third rule ensures that after a rebase, users see the correct diff against the new base instead of a stale diff against the old base (snapshot 0).

**Example (rebase detection):**
```
Before rebase: User views PR, cached range = { fromSnapshot: 0, toSnapshot: 3 }
After rebase:
  - Latest iteration has leftSnapshot = 2 (new base)
  - Cached range invalidated because fromSnapshot:0 ≠ latestLeftSnapshot:2
  - New default range: { fromSnapshot: 2, toSnapshot: 3 }
```

## Implementation Notes

### Comment Thread Storage

```typescript
interface CommentThread {
  id: number;
  artifact: ReviewFileArtifact;

  // Immutable: where comment was originally created
  leftSnapshotIndex: number;
  rightSnapshotIndex: number;

  // Visual position (may differ from stored)
  displayLocation?: CommentLocation;

  isOfUncertainOrigin: boolean;  // If placed across changed region
}
```

### Invariants

1. **Left snapshot index is always even** (0, 2, 4, ...)
2. **Right snapshot index is always odd** (1, 3, 5, ...)
3. **Comments are immutable** - original location never changes
4. **Display location is computed** - derived from tracking
