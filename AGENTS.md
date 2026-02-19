# CodjiFlo

CodjiFlo is a code review tool tailored to power users of pull requests to improve contextual understanding and ease of code review and collaboration.

## Commands

```bash
npm run dev              # Development server
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking (tsc)
npm run test             # Unit and integration tests (Vitest)
npm run test:coverage    # Unit and integration tests with coverage, min 70% enforced
npm run test:storybook   # Storybook interaction tests
npm run test:e2e         # Playwright E2E (mock mode, localhost)
npm run test:e2e:prod    # Playwright E2E (prod mode, codjiflo.vza.net)
npm run test:all         # REQUIRED before push (lint + typecheck + coverage + e2e + storybook)
```

**Troubleshooting:** If any `npm run` command fails, the very first thing to try is `npm install`.

## Testing Exit Criteria
This is a **requirement**:
* **Any changes:** `npm run test:all` must pass
* **New features:** Several unit tests + some integration tests + 1-2 new E2E tests + manual testing sanity check with Playwright

### Running Specific Tests (Vitest)
**Important:** This project uses **Vitest** (not Jest), so Jest-specific flags like `--testPathPattern` will **not work**.

```bash
# Run tests in files matching "DiffToolbar"
npm run test -- DiffToolbar

# Run specific test cases by name
npm run test -- -t "should render toolbar"
```

| Type | Pattern | Notes |
|------|---------|-------|
| Unit | `src/**/*.test.ts(x)` | Primary. Use Vitest + RTL |
| Integration | `*.integration.test.tsx` | Use `data-testid`, helpers in `src/tests/helpers/`. Test happy AND unhappy paths |
| E2E | `e2e/{mock\|prod}/{stateless\|stateful}-mode/**/*.spec.ts` | Playwright. Critical flows only |
| Stories | `src/**/*.stories.tsx` | Visual docs only, no behavior tests |

### Show that your tests are working
Tests that have never failed even once are USELESS. This applies to all test types, especially integration and E2E tests. You absolutely MUST confirm that the test is actually testing what you intend, either by following TDD and writing your test code before your product code, or by writing your changes, writing your test, temporarily removing your code changes, confirming that the test fails as expected, and then restoring the product code changes. You WILL be asked to demonstrate a commit where your new test fails, followed by a second commit where you include your code fixes that make the test pass. Include the test failure validation in the commit message.

### E2E Test Modes and Organization

E2E tests support two modes and are organized by mode and artifact availability:

| Mode | Command | Target | GitHub API |
|------|---------|--------|------------|
| Mock | `npm run test:e2e` | `localhost:<dynamic port>` | Mocked via Playwright routes |
| Prod | `npm run test:e2e:prod` | `localhost:<dynamic port>` | Real API with PAT |

Both E2E test modes start a test server automatically. It is NOT necessary to start a separate dev server.

**Test Directory Structure:**
```
e2e/
├── common/
│   └── stateless-mode/    # Tests that run in both mock and prod modes
├── mock/
│   ├── stateless-mode/    # Mock-only tests without iteration artifacts
│   └── stateful-mode/     # Mock-only tests with iteration artifacts
├── prod/
│   └── stateful-mode/     # Prod tests with real iteration artifacts
└── fixtures/              # Shared test fixtures
```

**Organizational Principles:**
- Tests are organized by **mode** (mock/prod) and **artifact availability** (stateless/stateful)
- Mode is determined by `E2E_DEPENDENCIES_MODE` environment variable
- Playwright config automatically selects the appropriate directory based on mode
- **One describe() per file** - each `.spec.ts` file contains exactly one `test.describe()` block at the top level
  - Enforced by custom ESLint rule: `custom-rules/one-top-level-test-describe`
  - Prevents both multiple top-level describes and nested describes
  - Rule implementation: `eslint-rules/one-top-level-test-describe.js`
- **No `test.skip()` calls** - tests are placed in their intended directory instead
  - Enforced by ESLint: `"playwright/no-skipped-test": "error"`

**Environment:**
- `.env.local` - Created by running `npm run dev` (pulls from Vercel). Required for prod mode tests locally.
- `GITHUB_TOKEN` - GitHub PAT for prod mode (loaded from `.env.local` locally, auto-provided in CI)

**Test fixtures:**
- `e2e/fixtures/mode.ts` - Mode detection (`isMockMode()`, `isProdMode()`)
- `e2e/fixtures/github-mocks.ts` - Centralized mock handlers
- `e2e/fixtures/iteration-db-builder.ts` - Iteration artifact builders for mock mode

### E2E Test Debugging

#### One second is an ETERNITY for a computer
Tests in this project are finely tuned to run very fast. Each E2E test case MUST run in 5s or less. This is PLENTY. GitHub APIs, Vercel, CI/CD machines, local dev environment, etc. are all extremely fast. This is applicable to old and new tests. The entire test suite runs in 20s. When running E2E tests, enforce a timeout in the Bash tool call of 1 minute.

#### There are no flaky tests only failing tests
Leave the tests better than how you found them. If you notice a flaky test, you are supposed to help investigate what is the issue and if possible come up with a solution for it. Don't dismiss test failures as "unrelated to my changes".

#### Don't guess - Use the Playwright test trace to understand what is happening
When a Playwright E2E test fails, NEVER assume it's a timeout/flakiness issue. You will not get your tests working by adding arbitrary waitForTimeouts. So much so that they are banned via an ESLint rule. You must analyze the test trace before blindly changing test code. The codebase uses an unreleased version of Playwright with a **new feature called playwright-cli that helps with investigations**.

1. Load the playwright-cli skill 
2. Run `npx playwright show-trace --port 0 <trace.zip>` - it will start a web server with the trace information
3. Traces have everything you might need to troubleshoot: Step-by-step action timeline with links to exact DOM state before and after of each action, full error details with stack traces, browser console output, HTTP request log, etc.
3. Use Playwright skill **in headed mode** to open the desired snapshot HTML and have full debugging capabilities
4. Look for actual failures: missing elements, wrong content, API errors, auth issues

#### Proper use of waitFor methods
 * waitForSelector: Best for waiting for elements to appear, disappear, or change state.
 * waitForFunction: Ideal for complex conditions involving multiple elements or JavaScript state.
 * waitForLoadState: Good for ensuring the page has reached a certain loading stage.
 * waitForURL: Perfect for navigation events and redirects.
 * waitForEvent: Useful for downloads, dialogs, and other events.
 * waitForTimeout: Banned.

#### Prefer locators to selectors
Unlike traditional selectors that perform a one-time query, locators are lazy and resilient references to elements that automatically retry until elements become available, wait implicitly for elements to be actionable, and adapt to DOM changes between queries.

#### E2E tests in this project are rock solid
All E2E tests go through a stress test where they run 10x in parallel and 10x in sequence every new push to main in search of race conditions and flakiness. You may check the stress test health looking at the workflow history of the ci-cd-main workflow on GitHub.

## Manual testing
You have access to Playwright via playwright-cli skill. Make sure to **only use it in headed mode** so the user can see your work and assist you. Use it sparingly in the following situations:
 * You are stuck trying to reproduce a bug through code analysis or test cases. `evaluate` is invaluable to capture runtime information such as computed styles or library side effects.
 * Sanity check your work as you reach a milestone in the implementation of a feature. Once you reach ~200 lines of code changes, the risk that you are compounding errors and don't have working code becomes high. A quick inspection in Playwright gives extra assurance that you are on the right track.
 * Final quality assurance. Don't ask the user to test a feature manually before you did it yourself!

## E2E Test Repo & Demo Data

**Repo:** [`pedropaulovc/codjiflo-e2e-test-repo`](https://github.com/pedropaulovc/codjiflo-e2e-test-repo) — local path: `../../codjiflo-e2e-test-repo`

Dedicated public repo for real GitHub data used by prod-mode E2E tests (`e2e/prod/`) and demo-presenter agents. You have full control: create PRs, push to main, force-push, add comments, close/reopen, merge, etc. Create as many PRs as needed.

### Creating Scenarios

Each scenario gets its own folder on `main` (base data) and its own PR branch (modifications). Branch naming: `test/<slug>` for E2E, `demo/<slug>` for demos.

```bash
cd ../../codjiflo-e2e-test-repo
git checkout main && git pull
mkdir <scenario-slug>
# Add base files, commit, push to main
git checkout -b test/<scenario-slug>
# Modify files, commit, push, create PR via gh
```

Manipulate PRs freely: force-push for iterations, `gh api` for line-level review comments, close/reopen, merge. Reference in tests as:
```typescript
const config = { owner: "pedropaulovc", repo: "codjiflo-e2e-test-repo", prNumber: <N> };
```

**Rules:** Never delete PRs/branches other tests depend on (`grep` for PR number in `e2e/`). PRs must stay open unless testing merged/closed state. Document new scenarios in `codjiflo-e2e-test-repo/README.md`.

### For Demo-Presenter Agents

Git operations against this repo ARE the "real user flows" for a code review tool — no mocking needed. Create PRs with the desired diff shape, add comments via `gh`, then navigate to the PR in CodjiFlo via Playwright (headed mode) to record the demo. Demo artifacts go to `spec/demo/` in the CodjiFlo repo. Escalate to coordinator/implementer for complex scenarios (multi-iteration force-push histories, etc.).

## Shared environment
There are multiple instances of Claude Code running in parallel. Each one has multiple node.exe instances (MCP, dev server, etc.) they also have dev servers running. Each worktree has its own designated port: 3010 for A, 3020 for B, etc. The `npm run dev` command is smart to only kill zombie servers associated with your worktree and only start a server in its designated port automatically. DO NOT kill all node.exe or kill by port number. If `npm run dev` fails STOP and ask the user for assistance.

## Tech Stack

Next.js 15 (App Router, Turbopack), React 19, TypeScript (strict), Custom CSS with CSS Variables, Zustand, Vitest, Playwright, Storybook

---

# Architecture & Implementation Standards

> **Critical Instruction for Agents**: This document is the source of truth for code structure. You MUST NOT deviate from these patterns without updating this document first. "Consistency is better than cleverness."

## 1. Global Code Structure Principles (The "Constitution")

### 1.1 "Feature-First" Directory Structure
We use a **Feature-based** folder structure. Do not group by file type (e.g., do NOT put all components in `src/components`). Group by **Domain Feature**.

**Allowed Directory Tree**:
```text
src/
├── api/                # Core API Clients (generic, not feature-specific)
├── components/         # SHARED, Dumb UI Components
│   ├── Button/         # Form controls live at root level
│   ├── Input/          # Each component in its own folder with
│   ├── Textarea/       # <ComponentName>.tsx, index.ts, and tests
│   ├── FormField/      # Stories added where applicable (not required)
│   ├── ui/             # Atomic design elements (Badge, Skeleton)
│   └── layout/         # App shells, Sidebars
├── features/           # FUNCTIONAL DOMAINS
│   ├── auth/           # Authentication Feature
│   │   ├── components/ # Auth-specific UI (LoginScreen)
│   │   ├── hooks/      # Auth-specific logic
│   │   ├── stores/     # Auth state (Zustand)
│   │   └── types.ts    # Auth types
│   ├── pr/             # Pull Request Data Feature
│   ├── diff/           # Diffing Logic Feature
│   ├── comments/       # Commenting System Feature
│   └── extension/      # Browser Extension Specifics (Bridge, Messaging)
├── lib/                # Third-party library wrappers (e.g., Octokit configuration)
├── utils/              # Pure utility functions (Date formatting, string manipulation)
├── types/              # Global shared types (Avoid overusing this, prefer feature types)
├── stores/             # GLOBAL CROSS-FEATURE STORES (Only if absolutely necessary, prefer feature stores)
└── tests/              # Test infrastructure (factories, helpers, mocks)
```

### 1.2 State Management Rules (Zustand)
1.  **Scope**: Prefer small, feature-specific stores (e.g., `useAuthStore`, `useDiffStore`) over a single monolithic store.
2.  **Persistence**: configuration and auth tokens use `persist` middleware. UI state (scroll position) should generally be transient unless specified.
3.  **Actions**: Stores must contain actions (business logic) within them, or calls to API services. Components should call `store.login()` rather than calling `api.login()` and then `store.setToken()`.

### 1.3 Styling (Custom CSS)
1.  **Custom Classes**: Use custom CSS classes defined in `src/styles/`. Do NOT use Tailwind utility classes.
2.  **CSS Variables**: Use CSS custom properties from `src/styles/themes/variables.css` for theming (dark/light/black/high-contrast).
3.  **Directory Structure**:
    ```
    src/styles/
    ├── themes/
    │   └── variables.css       # CSS variables for all themes (dark/light/black/high-contrast)
    ├── shared/
    │   ├── buttons.css         # Button styles (.btn, .btn-colorful, etc.)
    │   ├── controls.css        # Form controls (.textbox, .select, .checkbox, etc.)
    │   ├── features.css        # Feature-specific styles (.diff-*, .comment-*, etc.)
    │   └── utilities.css       # Utility classes (.sr-only, .skeleton, etc.)
    ├── shell/
    │   ├── layout.css          # Window container, main layout grid
    │   ├── titlebar.css        # Title bar, logo, version
    │   ├── sidebar.css         # Sidebar navigation
    │   ├── left-pane.css       # File explorer, properties panel
    │   ├── main-content.css    # Nav bar, toolbar, diff viewer
    │   ├── bottom-pane.css     # Bottom pane, comments list
    │   ├── right-pane.css      # News feed
    │   └── status-bar.css      # Status bar
    ├── pages/
    │   ├── login.css           # Login page
    │   ├── dashboard.css       # Dashboard page
    │   └── auth-status.css     # Auth callback/landing pages
    └── modals/
        ├── modal-base.css      # Base modal overlay styles
        └── theme-modal.css     # Theme settings modal
    ```
4.  **Key CSS Variables** (defined in `variables.css`):
    - `--focus-border` - Focus state border color
    - `--menu-hover`, `--menu-focus` - Menu button states
    - `--close-btn-hover`, `--close-btn-border` - Close button states
    - `--badge-merged` - Merged PR badge color
    - `--watermark-text` - Placeholder/watermark text color

### 1.4 Testing Strategy
1.  **Unit Tests (Vitest)**: Focus on logic in `utils/` and `stores/`. Code coverage goal: 70%.
2.  **E2E Tests (Playwright)**:
    - **Mocking**: Uses Playwright route interception. Mock mode for PRs, real mode for main branch.
    - **Coverage**: One E2E spec per User Story Acceptance Criteria set.
    - **See**: [E2E Test Modes](#e2e-test-modes) for configuration details.

### 1.5 Authentication
GitHub App with OAuth 2.0 and PKCE. Supports cross-subdomain auth for PR previews. Env vars for dev/preview/prod are stored in Vercel (`vercel env pull`). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

### 1.6 Iteration Storage (GitHub Action + Artifact)

CodjiFlo tracks PR iterations using a **no-backend** approach:

1. **GitHub Action** (`codjiflo/action`) runs on PR events
2. Captures iteration data (commits, file contents) to **SQLite database**
3. Uploads SQLite as **GitHub Artifact**
4. Posts/updates **PR comment** with artifact reference (`<!-- codjiflo-data -->`)
5. Frontend downloads artifact, parses with **SQL.js** (WASM)

**Key benefits:**
- No backend infrastructure costs
- Force-push resilient (workflow captures `before` SHA)
- Team sync via PR comment pointer
- 90-day artifact retention (sufficient for active PRs)

**Stateless fallback:** Repos without workflow get near-parity iteration support via Timeline API (see M4.2).

See [spec/functional/iterations.md](spec/functional/iterations.md) for full architecture.

### 1.7 Diff Pipeline Architecture

Composable pipeline of hooks for diff computation. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#diff-pipeline-architecture).

## 2. Milestone Architectural Plans

### [Milestone 1: SPA Foundation](spec/stories/milestone-1-spa-github-data.md)
**Goal**: Establish the app shell and GitHub Data integration.
- **Scaffolding Needs**:
  - `src/api/github-client.ts`: The central HTTP/Rest adapter.
  - `src/features/auth`: OAuth + PAT authentication.
  - `src/features/pr`: Dashboard and Navigation logic.
  - `src/features/diff`: Basic "Unified Hacker View" renderer.
- **Framework**: Next.js 15 with App Router. Pages in `src/app/`, API routes in `src/app/api/`.

### [Milestone 2: Comments Engine](spec/stories/milestone-2-minimal-comments.md)
**Goal**: Inline commenting system.
- **Scaffolding Needs**:
  - `src/features/comments`:
    - `comments-store.ts`: specific store for normalizing comment threads.
    - `types.ts`: `ReviewComment` interface matching GitHub API.
- **Constraint**: Comments must be mapped to `diff-line-index`. The logic for "which line does this belong to" belongs in a pure function/helper in `src/features/diff/utils`.

### [Milestone 3: Advanced Diff Engine](spec/stories/milestone-3-advanced-diff.md)
**Goal**: Side-by-Side view, full file content, word-level diffs.
- **Scaffolding Needs**:
  - `src/workers/diff-worker.ts`: Offload heavy text comparison (Myers Diff Algorithm) to a Web Worker.
  - `src/features/diff/components/SideBySideView.tsx`: Side-by-side diff layout.

### [Milestone 4: Iteration Management](spec/stories/milestone-4-iteration-management.md)
**Goal**: Force-push resilient iteration tracking via GitHub Action artifacts.
- **Phase 1 - Producer (GitHub Action)**:
  - `codjiflo/action`: GitHub Action for iteration capture to SQLite.
  - `codjiflo/comment-action`: GitHub Action for PR comment pointer updates.
  - SQLite schema for iterations, file contents, and SpanTrackers.
- **Phase 2 - Consumer (Frontend)**:
  - `src/features/iterations/artifact-loader.ts`: Download and parse SQLite artifact.
  - `src/lib/sqlite-wasm.ts`: SQL.js wrapper for browser SQLite reading.
  - Iteration selector UI and cross-iteration diff computation.

### [Milestone 4.1: Unauthenticated Experience](spec/stories/milestone-4.1-unauthenticated-experience.md)
**Goal**: Enable unauthenticated users to review public PRs without mandatory login.
- **Scaffolding Needs**:
  - `src/api/github/github-client.ts`: Support optional token for public repos.
  - `src/features/auth/hooks/useOptionalAuth.ts`: Non-redirecting auth hook.
  - Rate limit tracking in auth store.
  - Contextual login prompts for auth-required features.
- **Key Features**:
  - Public PR access without authentication (60 req/hr rate limit).
  - Private PR detection with login redirect.
  - Read-only comments with "Log in to reply" prompts.
  - Stateless iteration mode (artifacts require auth).

### [Milestone 4.2: Stateless Iteration Management](spec/stories/milestone-4.2-stateless-iteration-management.md)
**Goal**: Near-parity iteration support without GitHub Action (stateless mode).
- **Scaffolding Needs**:
  - `src/features/iterations/loaders/timeline-loader.ts`: Load iterations from GitHub Timeline API.
  - `src/features/diff/workers/diff-compute.worker.ts`: Web Worker for async diff computation.
  - `src/features/diff/scheduler/diff-scheduler.ts`: Priority queue for diff tasks.
  - `src/features/iterations/storage/stateless-storage.ts`: IndexedDB persistence for last seen iteration.
- **Key Changes**:
  - Rename "degraded mode" → "stateless mode", "iteration mode" → "stateful mode".
  - Remove degraded mode banner.
  - Timeline-based force-push detection via `force_pushed` events.
  - Background SpanTracker precomputation for comment-containing files.

### [Milestone 5: Full Comments & Canvas Layouts](spec/stories/milestone-5-full-comments.md)
**Goal**: Floating Bubbles (The "CodeFlow" feel).
- **Architecture**:
  - **Layering**: Code View is Layer 0. SVG Connector Layer is Layer 1. Comment Cloud is Layer 2.
  - **Layout Engine**: `src/features/comments/layout-engine.ts`. A pure logic class that takes a list of comments + scroll position and returns X/Y coordinates for bubbles.

### [Milestone 6: Real-Time & Polish](spec/stories/milestone-6-remaining-features.md)
**Goal**: Performance and Synchronization.
- **Architecture**:
  - `src/api/realtime.ts`: A polling manager (Interval based) that checks `ETag` or `Last-Modified` headers to fetch delta updates.

### [Milestone 7: Extension Bridge](spec/stories/milestone-7-browser-extension.md)
**Goal**: Inject into GitHub.
- **Architecture**:
  - **Content Script**: Independent entry point `src/extension/content.tsx`.
  - **Shadow DOM**: The React App must be capable of mounting inside a `shadowRoot` to avoid style bleeding.
  - **Messaging**: Use `chrome.runtime.sendMessage` for auth updates if cookies are used (though M7 uses direct API calls).
- **Refactor Alert**: The main layout component might need to support a "Widget Mode" vs "Full Page Mode".

## 3. General Agent Rules
1.  **Do Not Delete Logic**: When refactoring, verify usage. Use "Find Usages".
2.  **Explicit Types**: No `any`. Use `unknown` if unsure, but prefer defined interfaces.
3.  **Errors**: Always handle API errors gracefully in the UI (Error Boundaries or Toast Notifications).

---

## 4. Agent Quality of Life & Workflow Standards
*Guidelines to ensure efficient, error-free autonomous development.*

### 4.1 "Stop and Read" Policy
- **Before Coding**: Agents must read `task.md` and the specific `spec/stories/milestone-X.md` they are working on.
- **Before Modifying**: Always read the existing file content (or a relevant chunk) before calling `replace_file_content`. Blind edits are forbidden.

### 4.2 Error Recovery Protocol
- **Linter Errors**: If a fix triggers a linter error, DO NOT suppress it with `// eslint-disable` unless absolutely necessary. Fix the root cause.
- **Test Failures**: Analyze the failure output. If the test is wrong (e.g., outdated selector), update the test. If the code is wrong, update the code. Do not delete the test.

### 4.3 Atomic Task Management
- **One Task at a Time**: Do not try to implement multiple user stories in a single `task_boundary` session.
- **Update Artifacts**: Keep `task.md` updated in real-time. If you finish a sub-task, mark it checked immediately.

### 4.4 Context Optimization
- **Path Aliases**: Use `@/` for imports (e.g., `import { Button } from '@/components'`) instead of `../../../../`. This reduces cognitive load when moving files.
- **Type Definitions**: Look in `src/features/{feature}/types.ts` first. Only verify `src/types` if generic.

### 4.5 Self-Verification
- **Run the Build**: After significant changes, run `npm run type-check` (or `tsc --noEmit`).
- **Visual Check**: If possible, use `generate_image` to mockup complex UI before implementing, or request a screenshot review if the user has a browser active.

### 4.6 Mock Data Standard
- **Factories**: Use `src/tests/factories/` for generating test data. Do not manually construct complex objects in tests. This prevents test brittleness when types change.
- **Example**: `const pr = createMockPullRequest({ state: 'open' });`

### 4.7 Visual Component Usage
- **No Native Elements**: Avoid using raw `<button>`, `<input>`, or `<select>` tags. Use the standardized components in `src/components/` (e.g., `<Button>`, `<Input>`) to maintain design consistency.
- **Icons**: Use `lucide-react` for icons. Do not import other icon libraries.
