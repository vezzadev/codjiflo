## ADDED Requirements

### Requirement: No backend — GitHub Action + Artifact pipeline

The system SHALL track PR iterations using a GitHub Action that writes a SQLite database, uploads it as a GitHub Actions artifact, and posts a PR comment pointer to it. The CodjiFlo frontend SHALL operate without any first-party backend server for iteration storage.

#### Scenario: PR event triggers the Action
- **WHEN** a `pull_request` event of type `opened`, `synchronize`, or `reopened` fires on a repository that has installed the CodjiFlo workflow
- **THEN** the Action runs, downloads the previous iteration artifact if one exists, captures `head_sha`, `base_sha`, and `before` (for force-push tracking), fetches changed-file contents via the GitHub API, appends a new iteration row to the SQLite database, recomputes SpanTrackers, uploads the artifact (90-day retention), and posts or updates a PR comment whose body contains the `<!-- codjiflo-data -->` marker

#### Scenario: Frontend resolves the artifact pointer
- **WHEN** the SPA opens a PR
- **THEN** it lists PR comments via the GitHub API, locates the comment containing `<!-- codjiflo-data -->`, downloads the referenced artifact, parses it with SQL.js (WASM), and caches the parsed result in IndexedDB

### Requirement: Force-push resilience

The system SHALL preserve the pre-force-push iteration history. Iteration N+1 SHALL record the `before` SHA captured by the GitHub Action so that diffs across force-pushed revisions remain navigable.

#### Scenario: Force push between iterations
- **WHEN** a contributor force-pushes a PR branch, rewriting commit SHAs
- **THEN** the next workflow run records the rewritten `head_sha` AND the prior `before` SHA, and the iteration list shows both points, allowing the reviewer to diff iteration N (old SHA) against iteration N+1 (new SHA) even though the old commit is no longer reachable from the branch

### Requirement: Content-addressable storage (deduplication)

Per-file content SHALL be stored content-addressably in a `content_blobs` table keyed by the file's SHA-1 hash (matching Git's hash). Iteration snapshots SHALL reference content via `content_hash`, never embed it inline.

```sql
CREATE TABLE content_blobs (
  content_hash TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL
);

CREATE TABLE artifact_snapshots (
  artifact_id     INTEGER REFERENCES file_artifacts(id),
  snapshot_index  INTEGER NOT NULL,
  file_path       TEXT,
  content_hash    TEXT REFERENCES content_blobs(content_hash),
  UNIQUE(artifact_id, snapshot_index)
);
```

#### Scenario: Unchanged file across iterations
- **WHEN** a file's content is identical in iteration N and N+1
- **THEN** only one row in `content_blobs` exists for that content, referenced by both snapshots

#### Scenario: File reverted to earlier content
- **WHEN** a file is changed and then reverted to a prior state
- **THEN** the snapshot for the reverted state reuses the existing `content_blobs` row rather than creating a duplicate

### Requirement: Iteration-aware file list

For a selected iteration range, the file list and per-file counters SHALL reflect that range only, not the cumulative PR diff.

#### Scenario: Files unchanged in the selected range are hidden
- **WHEN** a reviewer selects iteration range `i2..i3`
- **THEN** files whose `content_hash` is identical at both endpoints are omitted from the file list

#### Scenario: Status badges and line counters reflect the range
- **WHEN** a reviewer selects iteration range `i2..i3`
- **THEN** Added/Modified/Deleted/Renamed badges and `+N -M` counters are computed against `i2`→`i3`, not `base`→`head`

### Requirement: Stateless fallback for repos without the workflow

For repositories where the CodjiFlo workflow is not installed, the system SHALL provide near-parity iteration support using the GitHub Timeline API and on-the-fly diff computation in a Web Worker.

#### Scenario: Repo has no artifact
- **WHEN** the SPA opens a PR whose repository has no `<!-- codjiflo-data -->` comment
- **THEN** the app loads iterations from the Timeline API (using `force_pushed` events for force-push detection), runs diff computation in `src/features/diff/workers/diff-compute.worker.ts`, and persists "last seen iteration" per PR in IndexedDB

#### Scenario: No degraded-mode banner
- **WHEN** a repo is in stateless mode
- **THEN** the UI SHALL NOT display a "degraded mode" or "install workflow" banner (the term "degraded mode" is deprecated in favour of "stateless mode")

### Requirement: Artifact retention and cache strategy

Iteration artifacts SHALL inherit GitHub Actions' 90-day retention. The frontend SHALL cache downloaded artifacts in IndexedDB to amortise download latency across reviewer sessions.

#### Scenario: Cache hit
- **WHEN** a reviewer re-opens a PR whose artifact is already in IndexedDB and the artifact ID has not changed
- **THEN** no network download occurs and the parsed iteration data is read from cache

#### Scenario: Artifact expired
- **WHEN** an artifact older than 90 days is requested
- **THEN** the GitHub API returns a 404 for the artifact download URL and the frontend falls back to stateless mode for that PR

## Implementation Notes

| File | Purpose |
|------|---------|
| `src/features/iterations/artifact-loader.ts` | Download and parse SQLite artifact |
| `src/features/iterations/loaders/timeline-loader.ts` | Load iterations from Timeline API (stateless mode) |
| `src/features/iterations/storage/stateless-storage.ts` | IndexedDB "last seen iteration" persistence |
| `src/features/diff/workers/diff-compute.worker.ts` | Async diff computation for stateless mode |
| `src/features/diff/scheduler/diff-scheduler.ts` | Priority queue for diff tasks |
| `src/lib/sqlite-wasm.ts` | SQL.js wrapper for browser SQLite reading |

**External repositories:**

| Repository | Purpose |
|------------|---------|
| `codjiflo/action` | GitHub Action for iteration capture |
| `codjiflo/comment-action` | GitHub Action for PR comment updates |

**Terminology:**
- "stateful mode" — repo has the CodjiFlo workflow installed (artifact present).
- "stateless mode" — repo does not have the workflow; iterations derived from Timeline API.
- ❌ "degraded mode", "iteration mode" — deprecated terms; do not use.
