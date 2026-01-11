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

**All changes:** `npm run test:all` must pass
**New features:** 1-2 E2E tests + integration tests + unit tests

| Type | Pattern | Notes |
|------|---------|-------|
| Unit | `src/**/*.test.ts(x)` | Primary. Use Vitest + RTL |
| Integration | `*.integration.test.tsx` | Use `data-testid`, helpers in `src/tests/helpers/`. Test happy AND unhappy paths |
| E2E | `e2e/{mock\|prod}/{degraded\|iteration}-mode/**/*.spec.ts` | Playwright. Critical flows only. Organized by mode and artifact availability |
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
├── mock/
│   ├── degraded-mode/     # Tests without iteration artifacts
│   └── iteration-mode/    # Tests with iteration artifacts (mocked)
├── prod/
│   ├── degraded-mode/     # Prod tests without iteration artifacts
│   └── iteration-mode/    # Prod tests with real iteration artifacts
└── fixtures/              # Shared test fixtures
```

**Organizational Principles:**
- Tests are organized by **mode** (mock/prod) and **artifact availability** (degraded/iteration)
- Mode is determined by `E2E_DEPENDENCIES_MODE` environment variable
- Playwright config automatically selects the appropriate directory based on mode
- **No `test.skip()` calls** - tests are placed in their intended directory instead
- ESLint enforces this with `"playwright/no-skipped-test": "error"`

**Environment:**
- `.env.local` - Created by running `npm run dev` (pulls from Vercel). Required for prod mode tests locally.
- `CODJIFLO_E2E_GITHUB_TOKEN` - GitHub PAT for prod mode (loaded from `.env.local` locally, from secrets in CI)

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
When a Playwright E2E test fails, NEVER assume it's a timeout/flakiness issue. You will not get your tests working by adding arbitrary waitForTimeouts. So much so that they are banned via an ESLint rule. You must analyze the test trace before blindly changing test code.

1. Read the `error-context.md` file in the test-results folder - it shows the page snapshot at failure time
2. Run `npx playwright show-trace <trace.zip>` if deeper investigation needed
3. Look for actual failures: missing elements, wrong content, API errors, auth issues

#### Proper use of waitFor methods
 * waitForSelector: Best for waiting for elements to appear, disappear, or change state.
 * waitForFunction: Ideal for complex conditions involving multiple elements or JavaScript state.
 * waitForLoadState: Good for ensuring the page has reached a certain loading stage.
 * waitForURL: Perfect for navigation events and redirects.
 * waitForEvent: Useful for downloads, dialogs, and other events.
 * waitForTimeout: Banned.

## Prefer locators to selectors
Unlike traditional selectors that perform a one-time query, locators are lazy and resilient references to elements that automatically retry until elements become available, wait implicitly for elements to be actionable, and adapt to DOM changes between queries.

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
├── components/         # SHARED, Dumb UI Components (Buttons, Inputs, Layouts)
│   ├── ui/             # Atomic design elements (Typography, Colors)
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
├── hooks/              # Global shared hooks (useTheme, useDebounce)
├── types/              # Global shared types (Avoid overusing this, prefer feature types)
├── stores/             # GLOBAL CROSS-FEATURE STORES (Only if absolutely necessary, prefer feature stores)
└── App.tsx             # Root Orchestrator
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

**Graceful degradation:** Repos without workflow get standard GitHub diff (no iteration tracking).

See [spec/functional/iterations.md](spec/functional/iterations.md) for full architecture.

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
- **Refactor Alert**: `App.tsx` might need to support a "Widget Mode" vs "Full Page Mode".

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
- **Path Aliases**: Use `@/` for imports (e.g., `import { Button } from '@/components/ui/button'`) instead of `../../../../`. This reduces cognitive load when moving files.
- **Type Definitions**: Look in `src/features/{feature}/types.ts` first. Only verify `src/types` if generic.

### 4.5 Self-Verification
- **Run the Build**: After significant changes, run `npm run type-check` (or `tsc --noEmit`).
- **Visual Check**: If possible, use `generate_image` to mockup complex UI before implementing, or request a screenshot review if the user has a browser active.

### 4.6 Mock Data Standard
- **Factories**: Use `src/tests/factories/` for generating test data. Do not manually construct complex objects in tests. This prevents test brittleness when types change.
- **Example**: `const pr = createMockPullRequest({ state: 'open' });`

### 4.7 Visual Component Usage
- **No Native Elements**: Avoid using raw `<button>`, `<input>`, or `<select>` tags. Use the standardized components in `src/components/ui/` (e.g., `<Button>`, `<Input>`) to maintain design consistency.
- **Icons**: Use `lucide-react` for icons. Do not import other icon libraries.
