# Milestone 4: Iteration Management - Implementation Plan

**Status**: Implementation Complete (Pending Integration)
**Approach**: Pragmatic Balance + Clean Architecture for SpanTracker
**Estimated Timeline**: 4 weeks

---

## Architecture Overview

### Approach Selection
- **General Architecture**: Pragmatic Balance (follows existing codebase patterns)
- **SpanTracker**: Clean Architecture (domain/application/infrastructure layers)

### Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Action location | Separate repo (`codjiflo/action`) | Independent versioning, reusable |
| Action structure | Single combined | Simpler workflow, atomic updates |
| SpanTracker storage | Normalized tables (line-level) | Queryable, debuggable |
| SQLite parsing | SQL.js (WASM) | Battle-tested, Next.js compatible |
| Artifact caching | IndexedDB | Supports binary data, no size limit |
| OAuth scope | Added `actions:read` | Required for artifact download |

---

## Phase 1: Producer (GitHub Action)

### Repository: `codjiflo/action`

```
codjiflo/action/
├── src/
│   ├── index.ts               # Entry point, orchestration
│   ├── db/
│   │   ├── schema.ts          # SQLite DDL
│   │   └── database.ts        # Query operations
│   ├── capture/
│   │   ├── iteration-capture.ts
│   │   └── file-fetcher.ts
│   ├── spantracker/
│   │   ├── tracker.ts         # Computation logic
│   │   └── diff-engine.ts     # Myers diff
│   └── comment/
│       └── comment-manager.ts # PR comment updates
├── action.yml
├── package.json
└── tsconfig.json
```

### SQLite Schema

```sql
-- iterations table
CREATE TABLE iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision INTEGER NOT NULL UNIQUE,
  head_sha TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  before_sha TEXT,
  author TEXT,
  created_at TEXT NOT NULL
);

-- file_artifacts table
CREATE TABLE file_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_tracking_id TEXT NOT NULL UNIQUE
);

-- artifact_snapshots table
CREATE TABLE artifact_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,
  file_path TEXT,
  UNIQUE(artifact_id, snapshot_index)
);

-- file_contents table (with deduplication)
CREATE TABLE file_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,
  content TEXT,
  content_hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  UNIQUE(artifact_id, snapshot_index)
);

-- span_trackers table
CREATE TABLE span_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  left_snapshot_index INTEGER NOT NULL,
  right_snapshot_index INTEGER NOT NULL,
  UNIQUE(artifact_id, left_snapshot_index, right_snapshot_index)
);

-- span_mappings table (normalized, not BLOB)
CREATE TABLE span_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL REFERENCES span_trackers(id),
  left_line_start INTEGER,
  left_line_end INTEGER,
  right_line_start INTEGER,
  right_line_end INTEGER,
  mapping_type TEXT NOT NULL CHECK(mapping_type IN ('unchanged', 'modified', 'deleted', 'added'))
);
```

### Stories
- **S-4.0**: GitHub Action Workflow Setup
- **S-4.1**: SQLite Schema & Database Management
- **S-4.2**: Iteration Snapshot Capture
- **S-4.3**: PR Comment Pointer Management
- **S-4.4**: Precomputed SpanTrackers

---

## Phase 2: Consumer (Frontend)

### Feature Structure: `src/features/iterations/`

```
src/features/iterations/
├── domain/                          # Clean Architecture - Domain Layer
│   ├── text-span.ts                 # Value objects
│   ├── span-mapping.ts              # Mapping types
│   ├── span-tracker.ts              # ISpanTracker interface + impls
│   └── index.ts
├── application/                     # Clean Architecture - Application Layer
│   └── span-tracker-service.ts      # Use cases, caching, chaining
├── infrastructure/                  # Clean Architecture - Infrastructure Layer
│   └── sqlite-span-tracker-reader.ts
├── components/
│   ├── IterationSelector.tsx
│   ├── IterationTimeline.tsx
│   └── DegradedModeBanner.tsx
├── stores/
│   └── useIterationStore.ts
├── artifact-loader.ts               # Artifact discovery & download
├── iteration-client.ts              # SQLite query interface
├── graceful-degradation.ts          # GitHub commits fallback
├── types.ts
└── index.ts
```

### SpanTracker Clean Architecture

**Domain Layer** (`domain/`):
- `TextSpan`, `LineSpan` - Value objects
- `LineMapping`, `SpanMappingData` - Mapping types
- `ISpanTracker` - Core interface
- `PrecomputedSpanTracker` - From SQLite data
- `IdentitySpanTracker` - Unchanged files
- `ChainedSpanTracker` - Cross-iteration

**Application Layer** (`application/`):
- `SpanTrackerService` - Orchestrates loading, caching, chaining

**Infrastructure Layer** (`infrastructure/`):
- `SQLiteSpanTrackerReader` - Reads from SQL.js database

### Stories
- **S-4.5**: Artifact Discovery & Download
- **S-4.6**: SQL.js Integration & Database Parsing
- **S-4.7**: Iteration Selector UI
- **S-4.8**: Cross-Iteration Diff Computation
- **S-4.9**: SpanTracker Client Integration
- **S-4.10**: Graceful Degradation

---

## Implementation Tasks

### Week 1: Foundation

- [x] 5A: Update OAuth scope (add `actions:read`)
- [x] 5B: Create iteration types (`types.ts`)
- [x] 5C.1: SpanTracker domain layer (`domain/`)
  - [x] `text-span.ts` - Value objects
  - [x] `span-mapping.ts` - Mapping types
  - [x] `span-tracker.ts` - Interface + implementations
  - [x] `index.ts` - Exports
- [x] 5C.2: SpanTracker application layer
  - [x] `span-tracker-service.ts`
- [x] 5C.3: SpanTracker infrastructure layer
  - [x] `sqlite-span-tracker-reader.ts`
- [x] 5D: SQL.js integration
  - [x] Install `sql.js` package
  - [x] Create `src/lib/sqlite-wasm.ts`
  - [x] Configure Next.js for WASM

### Week 2: Artifact Loading

- [x] 5E.1: Artifact loader
  - [x] Comment discovery
  - [x] Artifact download
  - [x] ZIP extraction
  - [x] IndexedDB caching
- [x] 5E.2: Iteration client
  - [x] SQLite query interface
  - [x] Iteration queries
  - [x] File content queries

### Week 3: UI & Integration

- [x] 5F.1: Iteration store
  - [x] Zustand store with persist
  - [x] Load/select actions
- [x] 5F.2: UI components
  - [x] `IterationSelector.tsx`
  - [x] `DegradedModeBanner.tsx`
- [x] 5G: Graceful degradation
  - [x] Commits fallback client
  - [x] Detection logic

### Week 4: GitHub Action & Testing

- [x] 5H: GitHub Action (Producer) - Template in `action/` directory
  - [x] Create action structure
  - [x] Implement capture logic
  - [x] Implement SpanTracker computation
  - [x] Implement comment updates
- [x] 5I: Lint and typecheck passing (472 existing tests pass)
  - [ ] E2E tests (full flow)

---

## Data Flow

### Producer Flow (GitHub Action)

```
PR Event (opened/synchronize/reopened)
  ↓
Download previous artifact (if exists)
  ↓
Initialize/open SQLite database
  ↓
Capture iteration data
  ├── Parse event payload (head_sha, base_sha, before_sha)
  ├── Fetch changed files list
  └── Fetch file contents (base + head)
  ↓
Compute SpanTrackers
  ├── Adjacent pairs (0→1, 2→3, ...)
  └── Base→latest (0→rightmost)
  ↓
Upload SQLite artifact
  ↓
Update PR comment
  ↓
Done
```

### Consumer Flow (Frontend)

```
User navigates to PR page
  ↓
Load iterations (useIterationStore)
  ↓
Discover artifact (find PR comment)
  ├── Found → Download artifact
  │           └── Parse SQLite with SQL.js
  └── Not found → Graceful degradation (commits)
  ↓
Display iteration selector
  ↓
User selects range
  ↓
Load file diffs from SQLite
  ↓
Load SpanTrackers (for M5 comment tracking)
  ↓
Render diff view
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/features/auth/config.ts` | Added `actions:read` scope |
| `package.json` | Add `sql.js` dependency |
| `next.config.ts` | WASM configuration |

## Files Created

| File | Purpose |
|------|---------|
| `src/features/iterations/types.ts` | Core types |
| `src/features/iterations/domain/*` | SpanTracker domain layer |
| `src/features/iterations/application/*` | SpanTracker service |
| `src/features/iterations/infrastructure/*` | SQLite reader |
| `src/features/iterations/components/*` | UI components |
| `src/features/iterations/stores/*` | Zustand store |
| `src/features/iterations/artifact-loader.ts` | Artifact handling |
| `src/features/iterations/iteration-client.ts` | SQLite queries |
| `src/features/iterations/graceful-degradation.ts` | Fallback |
| `src/lib/sqlite-wasm.ts` | SQL.js wrapper |

---

## Testing Strategy

| Type | Coverage | Tools |
|------|----------|-------|
| Unit | Domain layer, utils | Vitest |
| Integration | Artifact loading, SQLite | Vitest + mocks |
| E2E | Full iteration flow | Playwright |

**Coverage Target**: 70% minimum

---

## Success Criteria

- [ ] GitHub Action captures iterations to SQLite
- [ ] Artifact uploaded with correct schema
- [ ] PR comment posted with artifact reference
- [ ] Frontend loads artifact and displays iterations
- [ ] Iteration selector works (from/to dropdowns)
- [ ] Cross-iteration diff computed correctly
- [ ] SpanTracker chains across iterations
- [ ] Graceful degradation for repos without workflow
- [ ] All acceptance criteria from spec verified
- [ ] `npm run test:all` passes
- [ ] 70% test coverage achieved
