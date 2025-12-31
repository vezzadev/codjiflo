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

**Implementation Note:** As of the current implementation, only `iterationToRightSnapshot()` is exported in `src/features/iterations/types.ts`. The left snapshot conversion is typically not needed since most operations work with base (snapshot 0) or right snapshots. The snapshot-to-iteration conversion can be computed inline when needed.

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
-- Schema metadata table (for migration compatibility)
CREATE TABLE schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

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

-- Precomputed SpanTrackers (adjacent pairs + base→latest)
CREATE TABLE span_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER REFERENCES file_artifacts(id),
  left_snapshot_index INTEGER NOT NULL,
  right_snapshot_index INTEGER NOT NULL,
  UNIQUE(artifact_id, left_snapshot_index, right_snapshot_index)
);

-- Span mappings (normalized line-by-line mappings)
-- Stores the actual line mapping data for each SpanTracker
CREATE TABLE span_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER REFERENCES span_trackers(id),
  left_line_start INTEGER,             -- NULL for added lines
  left_line_end INTEGER,
  right_line_start INTEGER,            -- NULL for deleted lines
  right_line_end INTEGER,
  mapping_type TEXT NOT NULL CHECK(mapping_type IN ('unchanged', 'modified', 'deleted', 'added'))
);

-- Performance indexes
CREATE INDEX idx_artifact_snapshots_artifact ON artifact_snapshots(artifact_id);
CREATE INDEX idx_artifact_snapshots_hash ON artifact_snapshots(content_hash);
CREATE INDEX idx_span_trackers_artifact ON span_trackers(artifact_id);
CREATE INDEX idx_span_mappings_tracker ON span_mappings(tracker_id);
```

**Implementation Notes:**
- The `comment_anchors` table shown in earlier spec versions is not yet implemented. Comment position tracking is currently handled in-memory using the SpanTracker system.
- The span tracker data is stored in a normalized `span_mappings` table rather than as a BLOB. This provides better queryability and debuggability at the cost of slightly larger storage footprint.
- The `schema_meta` table enables database versioning for future migrations (currently at version 2).

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
- Line mappings stored in normalized `span_mappings` table with explicit mapping types (unchanged, modified, deleted, added)

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

### Core Functionality (Implemented)
- [x] Compare any two iterations (not just adjacent) - via `SpanTrackerService.buildChainedTracker()`
- [x] Comments track forward as code changes - via `ISpanTracker.trackSpanForward()`
- [x] Comments track backward for historical comparison - via `ISpanTracker.trackSpanBackward()`
- [x] Handle file renames (artifact ID persists) - `ReviewFileArtifact.changeTrackingId` tracks files across renames
- [x] Cache span trackers for performance - `SpanTrackerService` maintains in-memory cache
- [x] Platform abstraction (GitHub ready) - Backend interfaces in `src/api/types.ts`
- [x] Graceful degradation for repos without workflow - `isDegraded` flag and fallback to GitHub commits

### Partially Implemented
- [~] Handle deleted files (anchor to context) - `trackSpanForward` returns null for deleted spans; nearest-valid-span logic exists but may need refinement

### Not Yet Implemented
- [ ] Persistent comment anchors in SQLite - Currently tracked in-memory only
- [ ] Azure DevOps backend - Only GitHub implemented
- [ ] GitLab backend - Only GitHub implemented

---

## Acceptance Criteria

### AC-1: Cross-Iteration Comparison
**Given** a PR with 3 iterations  
**When** user selects "Compare iteration 1 → iteration 3"  
**Then** the system chains trackers (0→1, 2→3, 4→5) and displays correct diff

**Test:** Verify `SpanTrackerService.buildChainedTracker()` produces correct results

### AC-2: Force-Push Resilience  
**Given** a PR where commits are force-pushed  
**When** the workflow captures `before_sha` from the event  
**Then** iterations remain stable and comments don't get orphaned

**Test:** Check `iterations.before_sha` is populated correctly

### AC-3: Content Deduplication
**Given** a file that reverts to a previous state  
**When** the file content is identical to an earlier iteration  
**Then** the same `content_hash` is reused (no duplicate storage)

**Test:** Verify `content_blobs` table doesn't contain duplicate content

### AC-4: Graceful Degradation
**Given** a repository without the CodjiFlo workflow installed  
**When** user opens a PR in CodjiFlo  
**Then** the app displays a banner and falls back to GitHub commits API

**Test:** `useIterationStore.isDegraded === true` when no artifact comment found

### AC-5: SpanTracker Caching
**Given** multiple calls to get the same tracker  
**When** `getTracker(artifactId, left, right)` is called repeatedly  
**Then** only the first call queries the database; subsequent calls use cache

**Test:** Monitor SQLite queries with same parameters

### AC-6: Identity Optimization
**Given** a file that hasn't changed between snapshots  
**When** requesting a tracker for that file  
**Then** an `IdentitySpanTracker` is returned (no database lookup needed)

**Test:** Verify `areFilesIdentical()` is called and returns true

### AC-7: File Rename Tracking
**Given** a file is renamed from `old.ts` to `new.ts`  
**When** querying artifact snapshots  
**Then** the same `artifact_id` has different `file_path` values at different snapshots

**Test:** `ReviewFileArtifact.repoPaths` contains both old and new paths

---

## UI Integration

### Components (Implemented)

**IterationSelector** (`src/features/iterations/components/IterationSelector.tsx`)
- Provides preset buttons: "Full", "Latest", "Last Review"
- Dropdown selectors for custom snapshot ranges
- Uses `iterationToRightSnapshot()` to convert iteration numbers to snapshot indices
- Integrates with `useIterationStore.selectRange()` and `selectPreset()`

**DegradedModeBanner** (`src/features/iterations/components/DegradedModeBanner.tsx`)
- Displays when `useIterationStore.isDegraded === true`
- Informs users that iteration tracking is unavailable
- Provides link to workflow installation instructions
- Hidden during loading or when artifact is available

### State Management

**useIterationStore** (`src/features/iterations/stores/useIterationStore.ts`)
- Zustand store with persistence (only `selectedRange` is persisted)
- Manages iteration data, artifacts, and SpanTracker service
- Handles loading from artifact and graceful degradation
- Provides actions: `loadIterations()`, `selectRange()`, `selectPreset()`, `reset()`

### Service Layer

**SpanTrackerService** (`src/features/iterations/application/span-tracker-service.ts`)
- Orchestrates loading and caching of SpanTrackers
- Provides `getTracker()` for arbitrary snapshot ranges
- Supports `trackCommentForward()` and `trackCommentBackward()` for comment tracking
- Preloading capability for performance optimization

### Integration Points

The iteration system integrates with:
- **Diff View**: Uses `selectedRange` to determine which snapshots to compare
- **Comment System**: Uses SpanTracker to reposition comments across iterations (future)
- **File List**: Filters files based on iteration range (future)

**Current Limitations:**
- Comment position tracking is implemented in domain layer but not yet integrated with UI
- File filtering by iteration range is planned but not implemented
- Review history tracking ("Last Review" preset) uses fallback logic
