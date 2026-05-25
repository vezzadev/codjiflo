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

## SQLite Schema (Content Deduplication)

The schema uses content-addressable storage to deduplicate file contents:

```sql
-- Deduplicated content storage (each unique content stored once)
CREATE TABLE content_blobs (
  content_hash TEXT PRIMARY KEY,  -- SHA-1 hash (same as Git)
  content TEXT NOT NULL,
  size_bytes INTEGER NOT NULL
);

-- Artifact snapshots reference content by hash
CREATE TABLE artifact_snapshots (
  artifact_id INTEGER REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,
  file_path TEXT,
  content_hash TEXT REFERENCES content_blobs(content_hash),
  UNIQUE(artifact_id, snapshot_index)
);
```

**Benefits:**
- Same file unchanged across iterations → stored once
- Multiple files with identical content → stored once
- File reverted to previous state → reuses existing blob

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
| `codjiflo/action` | GitHub Action for iteration capture |
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
| Can't use on repos you don't control | Graceful degradation |
| Artifact download latency | Cache in IndexedDB |
