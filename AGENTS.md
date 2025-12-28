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

## Testing Exit Criteria

**All changes:** `npm run test:all` must pass
**New features:** 1-2 E2E tests + integration tests + unit tests

| Type | Pattern | Notes |
|------|---------|-------|
| Unit | `src/**/*.test.ts(x)` | Primary. Use Vitest + RTL |
| Integration | `*.integration.test.tsx` | Use `data-testid`, helpers in `src/tests/helpers/`. Test happy AND unhappy paths |
| E2E | `e2e/**/*.spec.ts` | Playwright. Critical flows only. Supports mock/prod modes |
| Stories | `src/**/*.stories.tsx` | Visual docs only, no behavior tests |

### E2E Test Modes

E2E tests support two modes:

| Mode | Command | Target | GitHub API |
|------|---------|--------|------------|
| Mock | `npm run test:e2e` | `localhost:3000` | Mocked via Playwright routes |
| Prod | `npm run test:e2e:prod` | `codjiflo.vza.net` | Real API with PAT |

**Environment:**
- `CODJIFLO_E2E_GITHUB_TOKEN` - GitHub PAT for prod mode (loaded from `.env.local` locally, from secrets in CI)

**CI/CD:**
- **PR workflows:** `npm run test:e2e` (mock mode, fast)
- **Main branch:** Deploy → `npm run test:e2e:prod` (validates production)

**Test repository:** Prod mode uses `pedropaulovc/codjiflo` (PR #1 for valid tests, PR #6 for keyboard nav, PR #0 for 404 tests)

**Test fixtures:**
- `e2e/fixtures/mode.ts` - Mode detection (`isMockMode()`, `isProdMode()`)
- `e2e/fixtures/github-mocks.ts` - Centralized mock handlers

## Tech Stack

Next.js 15 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind CSS 4, Zustand, Vitest, Playwright, Storybook

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

### 1.3 Styling (TailwindCSS)
1.  **Utility-First**: Use Tailwind classes directly in JSX.
2.  **No Magic Numbers**: Use standard Tailwind spacing/colors. If a custom value is needed, add it to `tailwind.config.js`.
3.  **Encapsulation**: If a component's class string exceeds 80 chars, consider using `class-variance-authority` (CVA) or extracting parts to a variable, but generally inline is preferred for velocity.

### 1.4 Testing Strategy
1.  **Unit Tests (Vitest)**: Focus on logic in `utils/` and `stores/`. Code coverage goal: 70%.
2.  **E2E Tests (Playwright)**:
    - **Mocking**: Uses Playwright route interception. Mock mode for PRs, real mode for main branch.
    - **Coverage**: One E2E spec per User Story Acceptance Criteria set.
    - **See**: [E2E Test Modes](#e2e-test-modes) for configuration details.

### 1.5 Authentication
GitHub App with OAuth 2.0 and PKCE. Supports cross-subdomain auth for PR previews. Env vars for dev/preview/prod are stored in Vercel (`vercel env pull`). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## 2. Milestone Architectural Plans

### Milestone 1: SPA Foundation
**Goal**: Establish the app shell and GitHub Data integration.
- **Scaffolding Needs**:
  - `src/api/github-client.ts`: The central HTTP/Rest adapter.
  - `src/features/auth`: OAuth + PAT authentication.
  - `src/features/pr`: Dashboard and Navigation logic.
  - `src/features/diff`: Basic "Unified Hacker View" renderer.
- **Framework**: Next.js 15 with App Router. Pages in `src/app/`, API routes in `src/app/api/`.

### Milestone 2: Comments Engine
**Goal**: Inline commenting system.
- **Scaffolding Needs**:
  - `src/features/comments`:
    - `comments-store.ts`: specific store for normalizing comment threads.
    - `types.ts`: `ReviewComment` interface matching GitHub API.
- **Constraint**: Comments must be mapped to `diff-line-index`. The logic for "which line does this belong to" belongs in a pure function/helper in `src/features/diff/utils`.

### Milestone 3: Extension Bridge
**Goal**: Inject into GitHub.
- **Architecture**:
  - **Content Script**: Independent entry point `src/extension/content.tsx`.
  - **Shadow DOM**: The React App must be capable of mounting inside a `shadowRoot` to avoid style bleeding.
  - **Messaging**: Use `chrome.runtime.sendMessage` for auth updates if cookies are used (though M3 uses direct API calls).
- **Refactor Alert**: `App.tsx` might need to support a "Widget Mode" vs "Full Page Mode".

### Milestone 4: Advanced Diffing
**Goal**: Side-by-Side and Iterations.
- **Scaffolding Needs**:
  - `src/workers/diff-worker.ts`: Offload heavy text comparison (Myers Diff Algorithm) to a Web Worker to keep UI responsive.
  - `src/features/diff/components/SideBySideView.tsx`: new complex grid layout.

### Milestone 5: Canvas Layouts
**Goal**: Floating Bubbles (The "CodeFlow" feel).
- **Architecture**:
  - **Layering**: Code View is Layer 0. SVG Connector Layer is Layer 1. Comment Cloud is Layer 2.
  - **Layout Engine**: `src/features/comments/layout-engine.ts`. A pure logic class that takes a list of comments + scroll position and returns X/Y coordinates for bubbles.

### Milestone 6: Real-Time & Polish
**Goal**: Performance and Synchronization.
- **Architecture**:
  - `src/api/realtime.ts`: A polling manager (Interval based) that checks `ETag` or `Last-Modified` headers to fetch delta updates.

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
