# Iteration Management Specification - Stateful Mode

This document covers the Stateful Mode implementation of iteration management, which uses a GitHub Action + Artifact approach. For shared concepts, see [iterations-common.md](./iterations-common.md).

---

## Overview

Stateful Mode uses a **GitHub Action + Artifact** approach to store iteration data. No backend server is required. The GitHub repository itself becomes the source of truth for iteration history.

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

---

## Why This Approach

1. **No backend costs**: GitHub hosts everything (Actions, Artifacts, Comments)
2. **Team sync**: PR comment is single source of truth for artifact reference
3. **Force-push resilient**: Workflow event payload includes `before` SHA
4. **Stateless fallback**: Repos without workflow get full iteration support via Timeline API (see [iterations-stateless.md](./iterations-stateless.md))

---

## Data Flow

### On PR Event (GitHub Action)

1. Workflow triggers on `pull_request` events (opened, synchronize, reopened)
2. Action downloads previous artifact (if exists)
3. Captures `head_sha`, `base_sha`, `before` (from event payload)
4. Fetches changed files content via GitHub API
5. Appends new iteration to SQLite database
6. Uploads updated SQLite as artifact
7. Posts/updates PR comment with artifact reference

### On Frontend Load

1. Fetch PR comments via GitHub API
2. Find comment with `<!-- codjiflo-data -->` marker
3. Download SQLite artifact
4. Load iterations from SQLite (client-side via SQL.js)
5. Load precomputed SpanTrackers from artifact (adjacent pairs + base→latest)
6. Compute cross-iteration SpanTrackers on-demand by chaining

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

---

## SQLite Schema

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

---

## Artifact Caching (IndexedDB)

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

---

## Trade-offs

| Trade-off | Mitigation |
|-----------|------------|
| 90-day artifact retention | Acceptable for active PRs |
| Requires workflow install | Clear onboarding, one-click install |
| Can't use on repos you don't control | Graceful degradation + future public repo hosting |
| Artifact download latency | Cache in IndexedDB after first load |

---

## Future: Public Repo Hosting

High-value public repos (react, kubernetes, etc.) will be indexed by CodjiFlo infrastructure and made available to all users without workflow installation.

---

## GitHub with CodjiFlo Workflow

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

---

## Behavioral Requirements Checklist

### Stateful Mode Specific

- [ ] Load iterations from SQLite artifact
- [ ] Use precomputed SpanTrackers from artifact
- [ ] Character-level comment precision
- [ ] GC-resilient (content stored in artifact)
- [ ] Download and cache artifact in IndexedDB
- [ ] Find artifact reference in PR comments (`<!-- codjiflo-data -->`)
- [ ] Handle artifact not found (fall back to stateless mode)
