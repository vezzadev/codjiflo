# Architecture Documentation

## Authentication

### Overview
GitHub App with OAuth 2.0 and PKCE (not a standalone OAuth App). Supports cross-subdomain auth for PR previews.

### Key Files
| File | Purpose |
|------|---------|
| `src/features/auth/config.ts` | OAuth config (client ID, scopes, URLs) |
| `src/features/auth/utils/pkce.ts` | PKCE utilities and state storage |
| `src/features/auth/utils/cookies.ts` | Cross-subdomain cookie utilities |
| `src/features/auth/hooks/useOAuthFlow.ts` | Initiates OAuth redirect |
| `src/features/auth/stores/useAuthStore.ts` | Token storage (Zustand + localStorage) |
| `src/app/api/auth/token/route.ts` | Server-side token exchange |
| `src/app/api/auth/refresh/route.ts` | Server-side token refresh |
| `src/app/auth/callback/page.tsx` | OAuth callback handler |
| `src/app/auth/landing/page.tsx` | Cross-subdomain token hydration |

### Cross-Subdomain Flow (PR Previews)

PR previews run on `pr-{number}.codjiflo.vza.net`. GitHub OAuth only allows specific callback URLs, so all callbacks go through `codjiflo.vza.net`, then redirect back.

```
pr-123.codjiflo.vza.net (click login)
    ↓ store return origin cookie (domain=.vza.net)
GitHub OAuth
    ↓
codjiflo.vza.net/auth/callback
    ↓ exchange code, store token in transfer cookie
pr-123.codjiflo.vza.net/auth/landing
    ↓ hydrate token from cookie
/dashboard
```

### Cookie Strategy
| Cookie | Purpose | TTL |
|--------|---------|-----|
| `oauth_code_verifier` | PKCE verifier | 10 min |
| `oauth_state` | CSRF protection | 10 min |
| `oauth_return_origin` | Redirect destination | 10 min |
| `oauth_token_transfer` | Token handoff | 1 min |

All cookies use `domain=.vza.net` (hardcoded in `KNOWN_BASE_DOMAIN`).

### Environment Variables

Env vars for dev, preview, and prod are stored in Vercel (`vercel env pull` to sync locally).

| Variable | Location | Purpose |
|----------|----------|---------|
| `GITHUB_APP_CLIENT_ID` | Server | Token exchange |
| `GITHUB_APP_CLIENT_SECRET` | Server | Token exchange (secret) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | Client | Build OAuth URL |
| `NEXT_PUBLIC_APP_URL` | Client | Callback base URL |

**Backup values:**
```
GITHUB_APP_CLIENT_ID = Iv23liUEkzCUSR78IkHn
NEXT_PUBLIC_GITHUB_CLIENT_ID = Iv23liUEkzCUSR78IkHn
NEXT_PUBLIC_APP_URL = http://localhost:3000        # local dev
NEXT_PUBLIC_APP_URL = https://codjiflo.vza.net     # preview & prod
```

### GitHub App Setup
1. Go to https://github.com/settings/apps → "New GitHub App"
2. Set Homepage URL: `https://codjiflo.vza.net`
3. Under "Identifying and authorizing users", add callback URLs:
   - `http://localhost:3000/auth/callback` (local dev)
   - `https://codjiflo.vza.net/auth/callback` (production + PR previews)
4. Set required permissions (see table below)
5. Copy Client ID → `GITHUB_APP_CLIENT_ID` and `NEXT_PUBLIC_GITHUB_CLIENT_ID`
6. Generate Client Secret → `GITHUB_APP_CLIENT_SECRET`

### Required Permissions

**Repository permissions:**
| Permission | Access | Purpose |
|------------|--------|---------|
| Pull requests | Read & Write | View PRs, files, diffs; create/edit comments |
| Contents | Read | View raw file contents for diffs |
| Checks | Read | View CI status, code coverage results |
| Deployments | Read | View deployment status for PRs |
| Issues | Read | View linked issue titles, assignees |
| Metadata | Read | Required for all GitHub Apps |

### Security Considerations
- Return origin validated against `KNOWN_BASE_DOMAIN` to prevent open redirects
- Token transfer cookie uses 1-min TTL and is cleared immediately after read
- Base64 encoding is for transport only, not encryption
- HTTP status checked before JSON parsing

## E2E Testing

### Overview
E2E tests use Playwright and support two modes: mock (for local dev and PRs) and prod (for production validation).

### Test Modes

| Mode | Command | Target | GitHub API |
|------|---------|--------|------------|
| Mock | `npm run test:e2e` | `localhost:3000` | Mocked via Playwright routes |
| Prod | `npm run test:e2e:prod` | `codjiflo.vza.net` | Real API with PAT |

### Key Files
| File | Purpose |
|------|---------|
| `e2e/fixtures/mode.ts` | Mode detection (`isMockMode()`, `isProdMode()`) |
| `e2e/fixtures/github-mocks.ts` | Centralized mock handlers |
| `playwright.config.ts` | Loads `.env.local`, configures baseURL per mode |

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `E2E_DEPENDENCIES_MODE` | `mock` (default) or `prod` |
| `CODJIFLO_E2E_GITHUB_TOKEN` | GitHub PAT for prod mode (needs `public_repo` scope) |

### CI/CD Integration
- **PR workflows:** `npm run test:e2e` (mock mode, fast, no external deps)
- **Main branch:** Deploy → `npm run test:e2e:prod` (validates production)

### Test Repository
Prod mode tests use `pedropaulovc/codjiflo`:
- PR #1 for valid PR tests
- PR #6 for keyboard navigation tests
- PR #0 for 404 error handling tests

## Iteration Storage

### Overview
CodjiFlo tracks PR iterations using a **GitHub Action + Artifact** approach with no backend server required.

### Architecture

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

### Data Flow

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

### SQLite Schema (Content Deduplication)

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

### Key Files
| File | Purpose |
|------|---------|
| `src/features/iterations/artifact-loader.ts` | Download & parse SQLite artifact |
| `src/features/iterations/degraded-banner.tsx` | "Install workflow" prompt |
| `src/lib/sqlite-wasm.ts` | SQL.js wrapper for browser |

### External Repositories
| Repository | Purpose |
|------------|---------|
| `codjiflo/action` | GitHub Action for iteration capture |
| `codjiflo/comment-action` | GitHub Action for PR comment updates |

### Graceful Degradation
Repos without the CodjiFlo workflow installed:
- Commit range comparison via GitHub API (parity with GitHub native)
- User can select any two commits from PR commit list
- Show banner: "Install workflow for force-push resilience and comment tracking"
- No SpanTrackers (comments won't track across ranges)
- Force-push causes old commits to become unreachable

### Trade-offs
| Trade-off | Mitigation |
|-----------|------------|
| 90-day artifact retention | Acceptable for active PRs |
| Requires workflow install | Clear onboarding, one-click install |
| Can't use on repos you don't control | Graceful degradation |
| Artifact download latency | Cache in IndexedDB |

See [spec/functional/iterations.md](../spec/functional/iterations.md) for complete specification.

## Diff Pipeline Architecture

### Overview
The diff feature uses a composable pipeline of React hooks where each stage handles one concern.

### Pipeline Stages
```
Source → Filter → Shape → Display → SideFilter → Navigation → Comments → render
```

| Stage | Hook | Responsibility |
|-------|------|----------------|
| 1 | `useDiffSource` | Get raw diff from GitHub API or iteration artifact |
| 2 | `useDiffFilter` | Apply full-file vs changes-only filtering |
| 3 | `useDiffShape` | Shape data for inline vs side-by-side |
| 4 | `useDiffDisplay` | Apply display options (whitespace, line numbers) |
| 5 | `useDiffSideFilter` | Filter by side (left/right/both) |
| 6 | `useDiffNavigation` | Calculate hunk indices and scroll targets |
| 7 | `useDiffComments` | Map comment threads to line positions |

### Key Files
| File | Purpose |
|------|---------|
| `src/features/diff/hooks/pipeline/*.ts` | Pipeline stage hooks |
| `src/features/diff/hooks/useDiffPipeline.ts` | Composite hook |
| `src/features/diff/hooks/useDraftComment.ts` | Comment draft state |
| `src/features/diff/hooks/useContainerHeight.ts` | Virtualization support |
| `src/features/diff/components/DiffView.tsx` | Main orchestrator |

### Benefits
- Each stage testable in isolation
- Memoization at each stage boundary
- Clear data flow for debugging
