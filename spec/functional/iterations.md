# Iteration Management Specification

---

## Overview

Iteration management enables **comments to persist across code changes**. When code moves, is modified, or is deleted, comments automatically re-anchor to the correct location.

This a CodjiFlo's key differentiator - treating comment locations as a "continuous thread" across all code versions.

---

## Iteration Semantics

### What is an Iteration?

An iteration represents a **pull request revision** that authors would like reviewers to inspect. It can be interpreted as an augmented git tag with a snapshot of the before and after states of the codebase. It can then be analyzed and compared independently from the git history. Therefore, it is resilient to git force push - a diff between two iterations is constained to the union of files in them. Each iteration is immutable after creation. Users may diff any range of iterations they prefer. The latest iteration represents the desired state of the codebase once the pull request is closed.

```typescript
interface Iteration {
  id: number;                    // Server-assigned, immutable
  revision: number;              // Sequential 1-based number
  author: string;
  description: string;           // "Here's what changed..."
  comment: string;               // Author's notes
  submittedOn: Date;
  status: IterationStatus;       // Submitted, Deleted

  // Code changes
  changes: FileChange[];

  // Platform-specific metadata
  sourceCommitId?: string;       // For Git-based platforms
  targetCommitId?: string;
}

enum IterationStatus {
  Submitted = 'submitted',
  Deleted = 'deleted'
}
```

### The Snapshot Index System

Each iteration creates **TWO snapshots**:
- **Left snapshot** (even index) = state BEFORE this iteration
- **Right snapshot** (odd index) = state AFTER this iteration

```
Iteration 1:  Snapshot 0 (left)  ↔  Snapshot 1 (right)
Iteration 2:  Snapshot 2 (left)  ↔  Snapshot 3 (right)
Iteration 3:  Snapshot 4 (left)  ↔  Snapshot 5 (right)
```

### Index Conversion

- **Snapshot → Iteration:** `floor(snapshotIndex / 2) + 1`
- **Iteration → Left Snapshot:** `(iteration - 1) * 2`
- **Iteration → Right Snapshot:** `(iteration - 1) * 2 + 1`

**Examples:**
| Iteration | Index | Left Snapshot | Right Snapshot |
|-----------|-------|---------------|----------------|
| 1 | 0 | 0 | 1 |
| 2 | 1 | 2 | 3 |
| 3 | 2 | 4 | 5 |

---

## Iteration Comparison

### Comparing Any Two Iterations

CodjiFlo supports comparing **any two iterations**, not just adjacent ones:

```typescript
interface IterationComparison {
  leftSnapshot: ReviewSnapshot;   // "Before" state
  rightSnapshot: ReviewSnapshot;  // "After" state
  files: FileComparison[];        // Per-file diffs
  isCrossIteration: boolean;      // True if not adjacent
}
```

### "What Changed Since I Last Looked"

To compare "after iteration 1" to "after iteration 3", use the right snapshots: snapshot 1 (after iter 1) vs snapshot 5 (after iter 3).

### Cross-Iteration Detection

A comparison is "cross-iteration" when not comparing adjacent left/right snapshots of the same iteration. The UI may display this differently (e.g., showing combined changes).

### Base Equivalence Principle

**Without rebase**: All **left (even) snapshots** are fetched from the PR's `baseSha`, meaning they contain equivalent content:

```
Snapshot 0 content = Snapshot 2 content = Snapshot 4 content = ... = PR base
```

**After rebase**: When a PR is rebased, the base changes. Each iteration's `base_sha` may differ:

```
Before rebase:
  Iteration 1: base_sha = "abc123" → Snapshot 0 contains content from abc123

After rebase (new commits in base branch):
  Iteration 2: base_sha = "def456" → Snapshot 2 contains content from def456

  Snapshot 0 content ≠ Snapshot 2 content (base changed!)
```

This has important implications for file status determination:

1. **Files first modified in later iterations**: A file that existed in the PR base but wasn't modified until iteration 2+ should show as "Modified" (not "Added") when viewing that iteration.

2. **Content lookup optimization**: When looking for file content at any snapshot before the file's first modification, use the content from the first left snapshot where it appears.

3. **Range overlap requirement**: Base equivalence only applies when the file's artifact overlaps with the selected iteration range. This prevents files from appearing in ranges where they weren't actually modified.

4. **Rebase-aware default range**: When viewing "full diff" (base → latest), the system uses the **latest iteration's left snapshot** as the base, not snapshot 0. This ensures diffs are computed against the current base after any rebase operations.

**Example**: `action.yml` exists in PR base, unchanged in iteration 1, first modified in iteration 2:
- Iteration 1 only: `action.yml` should NOT appear (no changes)
- Iteration 2 only: `action.yml` shows as "M" (modified) because base content exists
- Iteration 1→2 range: `action.yml` shows as "M" (modified)

**Rebase Example**: Line 4 changed in base branch during rebase:
- Iteration 1: User changed line 2
- Rebase: Base branch now has line 4 changed
- Iteration 2: After rebase, new base includes line 4 change
- Full diff (base → iteration 2): Shows only line 2 changed (line 4 is already in new base)
- If we incorrectly used snapshot 0: Would show both lines 2 and 4 changed (stale base)

### File Matching Algorithm

Files are matched by artifact ID using a two-pointer merge:
- File only on left → deleted
- File only on right → added
- File on both → compare content to determine change type (edit, rename, unchanged)

### Iteration-Aware File List

The file list dynamically reflects the selected iteration range:

1. **File Visibility**: A file only appears in the list if it has **actual changes** between the selected snapshots. If the content is identical at both snapshots, the file is hidden.

2. **Lines Added/Removed Counters**: The `+N` and `-M` counters reflect the **iteration diff**, not the full PR diff:
   - When viewing "Full diff" (Base → Latest): Counters match GitHub's PR diff
   - When viewing a specific range (e.g., v5 → v6): Counters show only changes in that range
   - Files with no changes in the range are not displayed

3. **Example**:
   ```
   Full diff (Base → v6):
   ├── eslint.config.mjs  [M] +1 -1    ← Shows the ignores array change
   ├── action/action.yml  [+] +50 -0   ← New file added

   Latest (v5 → v6):
   ├── action/action.yml  [+] +50 -0   ← Added in v6
   └── (eslint.config.mjs not shown - no changes between v5 and v6)
   ```

4. **File Status Badges**: Status (Added `+`, Modified `M`, Deleted `-`, Renamed `R`) is computed from the iteration range, not the full PR.

---

## Comment Tracking Across Iterations

### The Core Problem

When code changes:
- Lines shift (insertions/deletions move line numbers)
- Content changes (same line, different text)
- Files rename/move
- Code is deleted entirely

Comments must **follow the code they reference**.

### The Three Snapshots (TripleSnapshot)

```typescript
interface TripleSnapshot {
  left: TextSnapshot;              // Original file content
  right: TextSnapshot;             // Modified file content
  both: ProjectionSnapshot;        // Merged view (for inline display)
  modifiedLinesInLeft: SpanCollection; // Which lines changed
}
```

The **projection snapshot** maps positions from both sides into a single coordinate space, enabling unified diff display.

### SpanTracker: Position Mapping

```typescript
interface ISpanTracker {
  leftSnapshotIndex: number;
  rightSnapshotIndex: number;

  // Map position from old version to new version
  trackSpanForward(span: TextSpan, matchFullReplacement: boolean): TextSpan;

  // Map position from new version to old version
  trackSpanBackward(span: TextSpan, matchFullReplacement: boolean): TextSpan;
}
```

### Comment Location Model

```typescript
interface CommentLocation {
  leftContribution: CommentFileLocation | null;   // Position in old version
  rightContribution: CommentFileLocation | null;  // Position in new version
  warning?: PlacementWarning;
}

interface CommentFileLocation {
  extent: TextSpan;        // Character position (start, length)
  startLineNumber: number; // 1-based line number
}
```

### The Core Algorithm: ComputeCommentLocation

Based on the comment's view context:
- **Left-only:** Comment was on deleted code; only left contribution exists
- **Right-only:** Comment was on added code; only right contribution exists
- **Both:** Comment on unchanged/context line; map through the projection to find contributions on each side. If it maps to only one side, treat as left-only or right-only.

### Tracking Through Multiple Iterations

To find a comment's position in a later iteration: chain span trackers from the original iteration through each subsequent iteration, tracking the span forward at each step. The final span is then used to compute the display location in the target iteration.

---

## Artifact Tracking

### File Lineage Across Iterations

Each file is tracked as an "artifact" with a consistent ID:

```typescript
interface ReviewFileArtifact {
  id: number;                          // Unique across review
  changeTrackingId: string;            // Platform-specific stable ID

  // Path at each snapshot (null if file doesn't exist)
  repoPaths: (string | null)[];

  // Existence range
  firstSnapshotIndex: number;
  lastSnapshotIndex: number;
}
```

### Handling Renames

When a file is renamed, the artifact stores both paths: the old path at the left snapshot index, the new path at the right snapshot index. This allows comments to follow files through renames.

---

## Storage Architecture

### Overview

CodjiFlo uses a **GitHub Action + Artifact** approach to store iteration data. No backend server is required. The GitHub repository itself becomes the source of truth for iteration history.

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

### Why This Approach

1. **No backend costs**: GitHub hosts everything (Actions, Artifacts, Comments)
2. **Team sync**: PR comment is single source of truth for artifact reference
3. **Force-push resilient**: Workflow event payload includes `before` SHA
4. **Graceful degradation**: Repos without workflow get standard GitHub experience

### Data Flow

**On PR Event (GitHub Action):**
1. Workflow triggers on `pull_request` events (opened, synchronize, reopened)
2. Action downloads previous artifact (if exists)
3. Captures `head_sha`, `base_sha`, `before` (from event payload)
4. Fetches changed files content via GitHub API
5. Appends new iteration to SQLite database
6. Uploads updated SQLite as artifact
7. Posts/updates PR comment with artifact reference

**On Frontend Load:**
1. Fetch PR comments via GitHub API
2. Find comment with `<!-- codjiflo-data -->` marker
3. Download SQLite artifact
4. Load iterations from SQLite (client-side via SQL.js)
5. Load precomputed SpanTrackers from artifact (adjacent pairs + base→latest)
6. Compute cross-iteration SpanTrackers on-demand by chaining

**On Repo Without Workflow (Graceful Degradation):**
1. No `<!-- codjiflo-data -->` comment found
2. Fetch PR commits via GitHub API (`/pulls/{number}/commits`)
3. Enable commit range comparison (parity with GitHub native UI)
4. Diff via `/compare/{base}...{head}` endpoint
5. Show banner: "Install workflow for force-push resilience and comment tracking"

### SQLite Schema

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

**Content Deduplication:**
- `content_blobs` stores each unique file content exactly once, keyed by SHA-1 hash
- `artifact_snapshots` references content by hash, enabling space savings when:
  - Same file unchanged across multiple iterations
  - Multiple files have identical content
  - File reverted to previous state

**Precomputed SpanTrackers:**
- Adjacent pairs: 0→1, 2→3, 4→5 (each iteration's before/after)
- Base→latest: 0→(latest right snapshot) for quick "full diff" view
- Cross-iteration: computed client-side by chaining adjacent trackers

### Trade-offs

| Trade-off | Mitigation |
|-----------|------------|
| 90-day artifact retention | Acceptable for active PRs |
| Requires workflow install | Clear onboarding, one-click install |
| Can't use on repos you don't control | Graceful degradation + future public repo hosting |
| Artifact download latency | Cache in IndexedDB after first load |

### Future: Public Repo Hosting

High-value public repos (react, kubernetes, etc.) will be indexed by CodjiFlo infrastructure and made available to all users without workflow installation.

---

## Platform Differences

### Azure DevOps (AzDO)

```typescript
interface AzDOIteration extends Iteration {
  // From AzDO API
  changeTrackingIds: Map<string, number>;  // Per-file tracking

  // Git-specific metadata
  sourceRefCommit?: string;    // PR source commit
  commonRefCommit?: string;    // Common ancestor

  // Features
  codeCoverage?: CoverageData;
}
```

**AzDO Advantages:**
- Character-level comment precision
- Explicit server-side iteration IDs
- Rich metadata per iteration
- Stable change tracking IDs

### GitHub

GitHub lacks native iteration support. CodjiFlo implements iterations via GitHub Action + Artifact (see Storage Architecture above).

```typescript
interface GitHubIteration extends Iteration {
  commitSha: string;           // Git commit SHA
  baseSha: string;             // Base branch commit
  beforeSha?: string;          // SHA before force-push (from workflow event)
}
```

**GitHub with CodjiFlo Workflow:**
- Full iteration tracking via artifact storage
- Force-push resilient (before SHA captured)
- Character-level comment anchors (stored in artifact)
- Cross-iteration comparison

**GitHub without Workflow (degraded):**
- Commit range comparison via GitHub API (`/compare/{base}...{head}`)
- User can select any two commits from PR commit list
- No force-push resilience (old commits become unreachable)
- Standard GitHub comment anchoring (line-level)
- No precomputed SpanTrackers (comments may not track correctly across ranges)

### Capability Matrix

| Feature | Azure DevOps | GitHub + Workflow | GitHub (degraded) |
|---------|--------------|-------------------|-------------------|
| Iteration ID stability | ✓ Server-assigned | ✓ Artifact-stored | ✗ Commit SHA |
| Character-level comments | ✓ | ✓ (in artifact) | ✗ Line-level |
| Force-push handling | ✓ | ✓ (before SHA) | ✗ Comments lost |
| Cross-iteration compare | ✓ | ✓ | ✓ (commit range) |
| SpanTracker (comment tracking) | ✓ | ✓ (precomputed) | ✗ None |
| Requires setup | ✗ | Workflow install | ✗ |

---

## Edge Cases

### Force-Pushed Commits

**Scenario:** User force-pushes, changing commit SHAs.

| Platform | Behavior |
|----------|----------|
| Azure DevOps | Comments persist (iteration IDs stable) |
| GitHub | Comments may be lost (reference old SHAs) |

### Rebased Branches

**Scenario:** Branch rebased onto new base.

```
Before rebase:
  main: A - B
  branch: A - B - C - D (comment on C)

After rebase:
  main: A - B - E
  branch: A - B - E - C' - D' (new SHAs)
```

**Behavior:**
- Azure DevOps: New iteration created, comments tracked via artifact ID
- GitHub: Comments reference old C commit, may fail to display

### Deleted Files with Comments

When the commented code is deleted:
1. Try to track the span forward (may return empty)
2. If empty, find the nearest unchanged region as an anchor
3. If no context remains, the comment becomes "orphaned" and floats to file level

### Squashed Commits

**Scenario:** Multiple commits squashed into one.

| Platform | Behavior |
|----------|----------|
| Azure DevOps | New iteration, comments tracked normally |
| GitHub | New commit SHA, old comments orphaned |

---

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
| GitHub (degraded) | Comments reference old C, D SHAs. May fail to display or show as orphaned. |

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
| GitHub (degraded) | Commits D unreachable. Comments anchored to D fail to resolve. |

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

---

## Caching

**SpanTracker Cache:** Computing span trackers is expensive. Cache by snapshot pair key (e.g., `"2-3"`) and reuse.

**Identity Optimization:** When files are identical between snapshots, use a trivial tracker that returns spans unchanged.

---

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

---

## Behavioral Requirements Checklist

- [ ] Compare any two iterations (not just adjacent)
- [ ] Comments track forward as code changes
- [ ] Comments track backward for historical comparison
- [ ] Handle file renames (artifact ID persists)
- [ ] Handle deleted files (anchor to context)
- [ ] Cache span trackers for performance
- [ ] Platform abstraction (AzDO, GitHub, GitLab)
- [ ] Graceful degradation for less-capable platforms
