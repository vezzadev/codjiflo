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

### File Matching Algorithm

Files are matched by artifact ID using a two-pointer merge:
- File only on left → deleted
- File only on right → added
- File on both → compare content to determine change type (edit, rename, unchanged)

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
5. SpanTrackers computed client-side

**On Repo Without Workflow (Graceful Degradation):**
1. No `<!-- codjiflo-data -->` comment found
2. Show banner: "Install CodjiFlo workflow for iteration tracking"
3. Fall back to GitHub API for current diff only

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

-- File paths per snapshot
CREATE TABLE artifact_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,     -- Even=left, Odd=right
  file_path TEXT,
  UNIQUE(artifact_id, snapshot_index)
);

-- File contents (the actual blobs)
CREATE TABLE file_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,
  content TEXT,                        -- Full file content (NULL if binary)
  content_hash TEXT,                   -- SHA256 for dedup
  size_bytes INTEGER,
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
```

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
- Current diff only
- No iteration history
- Standard GitHub comment anchoring (line-level)

### Capability Matrix

| Feature | Azure DevOps | GitHub + Workflow | GitHub (degraded) |
|---------|--------------|-------------------|-------------------|
| Iteration ID stability | ✓ Server-assigned | ✓ Artifact-stored | ✗ None |
| Character-level comments | ✓ | ✓ (in artifact) | ✗ Line-level |
| Force-push handling | ✓ | ✓ (before SHA) | ✗ Comments lost |
| Cross-iteration compare | ✓ | ✓ | ✗ |
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
