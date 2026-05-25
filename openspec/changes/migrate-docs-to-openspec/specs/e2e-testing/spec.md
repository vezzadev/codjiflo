## ADDED Requirements

### Requirement: Two test modes — mock and prod

The E2E test suite SHALL support exactly two execution modes selected by the `E2E_DEPENDENCIES_MODE` environment variable: `mock` (default) and `prod`. Both modes SHALL start a local test server automatically on the worktree's designated port; the developer SHALL NOT need to run `npm run dev` separately.

| Mode | Command | Target | GitHub API |
|------|---------|--------|------------|
| `mock` | `npm run test:e2e` | `localhost:<dynamic port>` | Mocked via Playwright routes |
| `prod` | `npm run test:e2e:prod` | `localhost:<dynamic port>` | Real GitHub API with PAT |

#### Scenario: Mock mode requires no network access to GitHub
- **WHEN** `npm run test:e2e` runs with no `GITHUB_TOKEN` set
- **THEN** all GitHub API calls are served by Playwright route handlers and the suite passes

#### Scenario: Prod mode uses real GitHub
- **WHEN** `npm run test:e2e:prod` runs with `GITHUB_TOKEN` available (from `.env.local` locally, from CI secrets in CI)
- **THEN** tests in `e2e/prod/**` hit the real GitHub REST API

### Requirement: Test directory organisation

E2E tests SHALL be organised by mode and by artifact availability:

```
e2e/
├── common/stateless-mode/    # Run in BOTH mock and prod
├── mock/
│   ├── stateless-mode/       # Mock-only, no iteration artifacts
│   └── stateful-mode/        # Mock-only, with iteration artifacts
├── prod/
│   └── stateful-mode/        # Prod, with real iteration artifacts
└── fixtures/                 # Shared fixtures
```

Playwright config SHALL select the directory set automatically based on `E2E_DEPENDENCIES_MODE`.

#### Scenario: Mock run picks mock directories
- **WHEN** Playwright runs with `E2E_DEPENDENCIES_MODE=mock`
- **THEN** it executes specs under `e2e/common/` and `e2e/mock/` and skips `e2e/prod/`

#### Scenario: Prod run picks prod directories
- **WHEN** Playwright runs with `E2E_DEPENDENCIES_MODE=prod`
- **THEN** it executes specs under `e2e/common/` and `e2e/prod/` and skips `e2e/mock/`

### Requirement: Performance budget

Each E2E test case SHALL complete in 5 seconds or less. The full E2E suite SHALL complete in approximately 20 seconds. CI invocations SHALL set a Bash timeout no greater than 1 minute for the suite.

#### Scenario: A new test exceeds 5 seconds
- **WHEN** an added or modified test takes longer than 5s
- **THEN** the change is rejected at review and the test is rewritten (the cause is almost always a missing `waitForSelector`/`waitForFunction`, not a real performance issue)

### Requirement: Stress-test stability (no flaky tests)

E2E tests SHALL pass under both 10× parallel and 10× sequential repetition on every push to `main`. A failing run SHALL be treated as a real defect — never dismissed as "flaky" — and SHALL be investigated by examining the Playwright trace.

#### Scenario: A test fails under stress
- **WHEN** the post-merge stress workflow flags a failure
- **THEN** the contributor opens the trace zip, inspects the step that failed (DOM snapshots, console, HTTP log), and fixes the root cause; ad-hoc `waitForTimeout` retries are NOT an acceptable remediation

### Requirement: Banned and required test idioms

The codebase SHALL forbid the following patterns via ESLint:
- `page.waitForTimeout(...)` — banned; use `waitForSelector`, `waitForFunction`, `waitForLoadState`, `waitForURL`, or `waitForEvent`.
- `test.skip(...)` — banned (`playwright/no-skipped-test: error`); tests SHALL be placed in their intended directory rather than skipped.
- Multiple top-level `test.describe(...)` blocks per file, or nested `describe` blocks — banned (`custom-rules/one-top-level-test-describe`).

The codebase SHALL prefer Playwright **locators** over one-shot **selectors**, since locators retry automatically and survive DOM churn between queries.

#### Scenario: Lint catches a banned idiom
- **WHEN** a contributor adds `await page.waitForTimeout(500)` or a second top-level `test.describe`
- **THEN** `npm run lint` fails with the corresponding rule and CI blocks the PR

### Requirement: Shared fixtures and factories

E2E tests SHALL build GitHub state through the shared fixtures rather than constructing objects inline:
- `e2e/fixtures/mode.ts` (`isMockMode()`, `isProdMode()`)
- `e2e/fixtures/github-mocks.ts` (centralised mock handlers)
- `e2e/fixtures/iteration-db-builder.ts` (iteration artifact builders for mock mode)
- Unit/integration tests SHALL use factories under `src/tests/factories/` (e.g., `createMockPullRequest({ state: 'open' })`).

#### Scenario: A new PR fixture is needed
- **WHEN** a new test needs a PR in a state not covered by existing factories
- **THEN** the contributor extends the relevant factory in `src/tests/factories/` rather than constructing the object literal inside the test file

### Requirement: Prod-mode test repository

Prod-mode tests SHALL use the dedicated repository `pedropaulovc/codjiflo` and its companion `pedropaulovc/codjiflo-e2e-test-repo`. The following PRs are pinned:

- PR #1 — valid PR tests
- PR #6 — keyboard navigation tests
- PR #0 — 404 error handling

#### Scenario: Iteration artifacts have expired
- **WHEN** prod tests fail with iteration-related assertions because the 90-day artifact retention has elapsed
- **THEN** the contributor closes and reopens `pedropaulovc/codjiflo-e2e-test-repo` PR #11 to refresh the iteration artifact

## Implementation Notes

| File | Purpose |
|------|---------|
| `e2e/fixtures/mode.ts` | Mode detection |
| `e2e/fixtures/github-mocks.ts` | Centralised mock handlers |
| `e2e/fixtures/iteration-db-builder.ts` | SQLite iteration artifact builder for mock mode |
| `playwright.config.ts` | Loads `.env.local`, selects baseURL & directories per mode |
| `eslint-rules/one-top-level-test-describe.js` | Custom ESLint rule enforcing the describe invariant |

**Environment variables:**

| Variable | Purpose |
|----------|---------|
| `E2E_DEPENDENCIES_MODE` | `mock` (default) or `prod` |
| `GITHUB_TOKEN` | GitHub PAT for prod mode (`public_repo` scope); auto-provided in CI |

**CI integration:**
- PR workflows run mock mode only.
- Main-branch workflow runs prod mode after deploy and runs the stress matrix (10× parallel × 10× sequential).
