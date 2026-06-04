# Stateless-mode Visual Indicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Show a compact, accessible pill next to the iteration tabs whenever a PR's iteration data is in stateless mode, explaining why — with an actionable sign-in variant when the cause is an anonymous session.

**Architecture:** Convert the store's free-text `statelessReason` into a typed `StatelessReason` enum (`'unauthenticated' | 'no-artifact'`), then add a `StatelessModeIndicator` component that reads `mode` + `statelessReason` from `useIterationStore` and renders nothing in stateful mode, an info pill for `no-artifact`, or a sign-in action pill for `unauthenticated`. It is placed as a sibling of `<IterationSelector />` inside `.diff-header-iterations` in `DiffView.tsx`.

**Tech Stack:** React 19, TypeScript (strict), Zustand, react-aria-components (`Button`, `TooltipTrigger`, `Tooltip`), lucide-react, custom CSS, Vitest + RTL, Playwright.

---

## Ground-truth references (verified)

- Store: `src/features/iterations/stores/useIterationStore.ts`
  - Local `IterationState` interface at lines 65–95; `statelessReason: string | null` at line 87.
  - `loadIterations` sets the reason at lines 150–161 (`reason` local var), then `set({... statelessReason: reason ...})` at lines 197 and 213. Stateful path sets `statelessReason: null` at line 290.
  - `initialState` at lines 108–122 (`statelessReason: null`).
  - `persist` `partialize` (line 413) persists ONLY `selectedRanges` — `mode`/`statelessReason` are not persisted. No persist change needed.
- Canonical types: `src/features/iterations/types.ts` — `IterationMode` at line 175; `IterationState.statelessReason: string | null` at line 206. (Note: the store file keeps its own local copy of these types; BOTH must be updated.)
- Login initiation hook: `src/features/auth/hooks/useOAuthFlow.ts` → `const { initiateOAuth } = useOAuthFlow()`; `initiateOAuth()` redirects to GitHub OAuth. Exported via `src/features/auth/hooks/index.ts`.
- UI primitives: `Button`, `TooltipTrigger`, `Tooltip` are re-exported from `@/components/ui` (see `src/components/ui/index.ts`).
- Placement: `src/features/diff/components/DiffView.tsx` renders `<IterationSelector />` inside `.diff-header-iterations` at lines 206–208 (description view) and 242–244 (sticky file header).
- Component barrel: `src/features/iterations/components/index.ts` (currently exports only `IterationSelector`).
- Store stateless test cases: `src/features/iterations/stores/useIterationStore.test.ts` lines 335+ (`mockFindArtifactReference.mockResolvedValue(null)` → `no-artifact`).
- Styling home: `src/styles/shared/features.css`.

---

## Task 1: Add `StatelessReason` enum to types

**Files:**
- Modify: `src/features/iterations/types.ts:175-206`
- Modify: `src/features/iterations/stores/useIterationStore.ts` (local type copy at line 63/87, import)

**Step 1: Add the type in `types.ts`** — directly after `IterationMode` (line 175):

```ts
/** Iteration storage mode: stateful (artifact available) or stateless (GitHub API only) */
export type IterationMode = 'stateful' | 'stateless';

/**
 * Why iteration data is in stateless mode.
 * - 'unauthenticated': a CodjiFlo artifact exists but the user is signed out (data available once signed in)
 * - 'no-artifact': no CodjiFlo artifact found (repo likely lacks the CodjiFlo GitHub Action)
 */
export type StatelessReason = 'unauthenticated' | 'no-artifact';
```

Then change line 206:

```ts
  /** Reason for stateless mode (null when stateful) */
  statelessReason: StatelessReason | null;
```

**Step 2: Update the store's local type copy** in `useIterationStore.ts`.

Add `StatelessReason` to the existing import from `../types` (the import block that already brings in iteration types), and change line 87:

```ts
  /** Reason for stateless mode (null when stateful) */
  statelessReason: StatelessReason | null;
```

**Step 3: Run typecheck to verify it FAILS** (the `reason` strings assigned at lines 156/159 are now type errors):

Run: `npm run typecheck`
Expected: FAIL — `Type 'string' is not assignable to type 'StatelessReason | null'` in `loadIterations`.

**Step 4: Set enum values in `loadIterations`** (lines 150–161). Replace the sentence assignments with enum values:

```ts
            const hasArtifactReference = earlyReference !== null;
            const isAuthenticated = useAuthStore.getState().token !== null;

            let reason: StatelessReason;
            if (hasArtifactReference && !isAuthenticated) {
              reason = 'unauthenticated';
              console.info(`[CodjiFlo] Entering stateless mode: not authenticated for ${prKey}`);
            } else {
              reason = 'no-artifact';
              console.info(`[CodjiFlo] Entering stateless mode: no artifact found for ${prKey}`);
            }
```

(The two `set({ ... statelessReason: reason ... })` calls at lines ~197 and ~213 now carry the enum; the stateful `statelessReason: null` at line 290 is unchanged.)

**Step 5: Run typecheck to verify it PASSES**

Run: `npm run typecheck`
Expected: PASS.

**Step 6: Update store tests** in `useIterationStore.test.ts`. The existing stateless tests assert `mode === 'stateless'`; add reason assertions. In the `no-artifact` test (line 335, `mockFindArtifactReference.mockResolvedValue(null)`):

```ts
      expect(state.mode).toBe('stateless');
      expect(state.statelessReason).toBe('no-artifact');
```

Add a NEW test for the unauthenticated path (artifact reference present, load returns null, no token):

```ts
    it('should set statelessReason to "unauthenticated" when artifact exists but user is signed out', async () => {
      useAuthStore.setState({ token: null });
      mockFindArtifactReference.mockResolvedValue({ /* a non-null ArtifactReference; reuse the shape used elsewhere in this file */ });
      mockLoad.mockResolvedValue(null);
      mockGithubClientFetch.mockResolvedValue({ base: { sha: 'base' } });
      mockTimelineLoad.mockResolvedValue({ iterations: [], collapsedGroups: [] });

      await useIterationStore.getState().loadIterations('owner', 'repo', 1);

      const state = useIterationStore.getState();
      expect(state.mode).toBe('stateless');
      expect(state.statelessReason).toBe('unauthenticated');
    });
```

> Implementer note: import/locate `useAuthStore` the same way the file already mocks auth (check the top of the test for an existing `useAuthStore` import/mock; reuse it). Use the same `ArtifactReference` object shape the stateful tests build.

**Step 7: Run the store tests**

Run: `npm run test -- useIterationStore`
Expected: PASS (all, including the new case).

**Step 8: Commit**

```bash
git add src/features/iterations/types.ts src/features/iterations/stores/useIterationStore.ts src/features/iterations/stores/useIterationStore.test.ts
git commit -m "feat(iterations): type statelessReason as a StatelessReason enum"
```

---

## Task 2: `StatelessModeIndicator` component (TDD)

**Files:**
- Create: `src/features/iterations/components/StatelessModeIndicator.tsx`
- Test: `src/features/iterations/components/StatelessModeIndicator.test.tsx`
- Modify: `src/features/iterations/components/index.ts`

**Step 1: Write the failing test** in `StatelessModeIndicator.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatelessModeIndicator } from './StatelessModeIndicator';
import { useIterationStore } from '../stores';

const mockInitiateOAuth = vi.fn();
vi.mock('@/features/auth/hooks', () => ({
  useOAuthFlow: () => ({ initiateOAuth: mockInitiateOAuth, isInitiating: false, error: null, clearError: vi.fn() }),
}));

function setMode(mode: 'stateful' | 'stateless', statelessReason: 'unauthenticated' | 'no-artifact' | null) {
  useIterationStore.setState({ mode, statelessReason });
}

describe('StatelessModeIndicator', () => {
  beforeEach(() => {
    mockInitiateOAuth.mockClear();
    useIterationStore.getState().reset();
  });

  it('renders nothing in stateful mode', () => {
    setMode('stateful', null);
    const { container } = render(<StatelessModeIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a neutral info pill when the repo has no artifact', () => {
    setMode('stateless', 'no-artifact');
    render(<StatelessModeIndicator />);
    const pill = screen.getByTestId('stateless-indicator');
    expect(pill).toHaveTextContent(/stateless/i);
    expect(pill).toHaveClass('stateless-indicator--info');
  });

  it('renders a sign-in action pill when unauthenticated', () => {
    setMode('stateless', 'unauthenticated');
    render(<StatelessModeIndicator />);
    const pill = screen.getByTestId('stateless-indicator');
    expect(pill).toHaveTextContent(/sign in/i);
    expect(pill).toHaveClass('stateless-indicator--action');
  });

  it('initiates OAuth when the sign-in pill is pressed', async () => {
    setMode('stateless', 'unauthenticated');
    render(<StatelessModeIndicator />);
    await userEvent.click(screen.getByTestId('stateless-indicator'));
    expect(mockInitiateOAuth).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run the test to verify it FAILS**

Run: `npm run test -- StatelessModeIndicator`
Expected: FAIL — cannot resolve `./StatelessModeIndicator`.

**Step 3: Implement the component** in `StatelessModeIndicator.tsx`:

```tsx
import { Zap, LogIn } from 'lucide-react';
import { Button, TooltipTrigger, Tooltip } from '@/components/ui';
import { useOAuthFlow } from '@/features/auth/hooks';
import { useIterationStore } from '../stores';

const NO_ARTIFACT_TOOLTIP =
  'No CodjiFlo artifact found. This repo may not have the CodjiFlo GitHub Action installed. Iteration tracking is limited.';
const UNAUTHENTICATED_TOOLTIP =
  'CodjiFlo data is available for this PR. Sign in to enable full iteration tracking.';

export function StatelessModeIndicator() {
  const mode = useIterationStore((s) => s.mode);
  const statelessReason = useIterationStore((s) => s.statelessReason);
  const { initiateOAuth } = useOAuthFlow();

  if (mode === 'stateful') {
    return null;
  }

  if (statelessReason === 'unauthenticated') {
    return (
      <TooltipTrigger>
        <Button
          className="stateless-indicator stateless-indicator--action"
          data-testid="stateless-indicator"
          onPress={() => { initiateOAuth(); }}
          aria-label="Stateless mode — sign in to enable full iteration tracking"
        >
          <LogIn size={12} aria-hidden="true" />
          <span>Sign in for full tracking</span>
        </Button>
        <Tooltip className="stateless-indicator-tooltip">{UNAUTHENTICATED_TOOLTIP}</Tooltip>
      </TooltipTrigger>
    );
  }

  // statelessReason === 'no-artifact' (and any future stateless reason): neutral info pill
  return (
    <TooltipTrigger>
      <Button
        className="stateless-indicator stateless-indicator--info"
        data-testid="stateless-indicator"
        aria-label="Stateless mode — iteration tracking is limited"
      >
        <Zap size={12} aria-hidden="true" />
        <span>Stateless</span>
      </Button>
      <Tooltip className="stateless-indicator-tooltip">{NO_ARTIFACT_TOOLTIP}</Tooltip>
    </TooltipTrigger>
  );
}
```

> Note: the info-variant `Button` has no `onPress` — it exists solely as a focusable tooltip trigger (react-aria requires a focusable trigger). That is acceptable; the `aria-label` carries the meaning.

**Step 4: Run the test to verify it PASSES**

Run: `npm run test -- StatelessModeIndicator`
Expected: PASS (all 4 cases).

**Step 5: Export from the barrel** — add to `src/features/iterations/components/index.ts`:

```ts
export { StatelessModeIndicator } from './StatelessModeIndicator';
```

Also confirm it is reachable via the feature barrel `src/features/iterations/index.ts` (it re-exports from `./components`; add there too if that file lists components individually).

**Step 6: Commit**

```bash
git add src/features/iterations/components/StatelessModeIndicator.tsx src/features/iterations/components/StatelessModeIndicator.test.tsx src/features/iterations/components/index.ts src/features/iterations/index.ts
git commit -m "feat(iterations): add StatelessModeIndicator component"
```

---

## Task 3: Styles

**Files:**
- Modify: `src/styles/shared/features.css` (append)

**Step 1: Add styles** using theme CSS variables (match the existing `.badge` look in `controls.css` for sizing):

```css
/* Stateless-mode indicator (next to iteration tabs) */
.stateless-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  cursor: default;
}

.stateless-indicator--info {
  background-color: var(--badge-merged);
  color: white;
}

.stateless-indicator--action {
  background-color: var(--error-fg);
  color: white;
  cursor: pointer;
}

.stateless-indicator--action[data-hovered],
.stateless-indicator--action[data-focus-visible] {
  filter: brightness(1.1);
  outline: 2px solid var(--focus-border);
  outline-offset: 1px;
}

.stateless-indicator-tooltip {
  max-width: 260px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  background-color: var(--menu-hover);
  color: var(--watermark-text);
}
```

> Implementer note: confirm each `var(--...)` exists in `src/styles/themes/variables.css`. If `--menu-hover`/`--watermark-text` don't read well for a tooltip, pick the nearest existing tooltip/menu token rather than inventing a new variable.

**Step 2: Verify it builds/lints**

Run: `npm run lint`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/styles/shared/features.css
git commit -m "feat(iterations): style stateless-mode indicator pill"
```

---

## Task 4: Wire into DiffView

**Files:**
- Modify: `src/features/diff/components/DiffView.tsx` (import + lines 206–208 and 242–244)

**Step 1: Import** alongside the existing `IterationSelector` import (line 35):

```ts
import { IterationSelector, StatelessModeIndicator } from '@/features/iterations';
```

**Step 2: Render as a sibling** in BOTH `.diff-header-iterations` blocks:

```tsx
        <div className="diff-header-iterations" data-testid="diff-header-iterations">
          <IterationSelector />
          <StatelessModeIndicator />
        </div>
```

(Apply to both the description-view block ~line 206 and the sticky-header block ~line 242.)

**Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/features/diff/components/DiffView.tsx
git commit -m "feat(diff): show StatelessModeIndicator beside iteration tabs"
```

---

## Task 5: Integration test

**Files:**
- Create: `src/features/iterations/components/StatelessModeIndicator.integration.test.tsx`

**Step 1: Write the test** — a mode transition is reflected in the rendered pill:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatelessModeIndicator } from './StatelessModeIndicator';
import { useIterationStore } from '../stores';

vi.mock('@/features/auth/hooks', () => ({
  useOAuthFlow: () => ({ initiateOAuth: vi.fn(), isInitiating: false, error: null, clearError: vi.fn() }),
}));

describe('StatelessModeIndicator (integration)', () => {
  beforeEach(() => { useIterationStore.getState().reset(); });

  it('appears/disappears as the store mode changes', () => {
    useIterationStore.setState({ mode: 'stateful', statelessReason: null });
    const { rerender } = render(<StatelessModeIndicator />);
    expect(screen.queryByTestId('stateless-indicator')).toBeNull();

    useIterationStore.setState({ mode: 'stateless', statelessReason: 'no-artifact' });
    rerender(<StatelessModeIndicator />);
    expect(screen.getByTestId('stateless-indicator')).toHaveTextContent(/stateless/i);
  });
});
```

**Step 2: Run it**

Run: `npm run test -- StatelessModeIndicator.integration`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/features/iterations/components/StatelessModeIndicator.integration.test.tsx
git commit -m "test(iterations): integration coverage for stateless indicator mode transitions"
```

---

## Task 6: E2E (mock mode)

**Files:**
- Create: `e2e/mock/stateless-mode/stateless-indicator.spec.ts`

> The directory is for mock-only stateless tests. Use the centralized GitHub mocks in `e2e/fixtures/github-mocks.ts`. The default mock PR (no CodjiFlo artifact comment) lands in stateless mode → `no-artifact` reason. ONE top-level `test.describe` per file (enforced). Each test must complete in < 5s; run with a 1-minute Bash timeout.

**Step 1: Inspect a sibling spec** to copy the navigation/auth fixture pattern (e.g. an existing file under `e2e/mock/stateless-mode/` or `e2e/common/stateless-mode/`). Match how they open a PR and assert on the diff header.

**Step 2: Write the test** — open a stateless-mode PR, assert the indicator is visible with the info copy:

```ts
import { test, expect } from '@playwright/test';
// + the project's standard mock setup imports used by sibling specs

test.describe('Stateless-mode indicator', () => {
  test('shows the stateless pill when no CodjiFlo artifact is present', async ({ page }) => {
    // navigate to a mock PR the same way sibling specs do
    const indicator = page.getByTestId('stateless-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText(/stateless/i);
  });
});
```

**Step 3: Run it (1-minute timeout)**

Run: `npm run test:e2e -- stateless-indicator`
Expected: PASS. If it fails, fetch `trace.zip` and run `npx playwright-trace-llm <trace.zip> -o ./trace-export` — do NOT add `waitForTimeout`.

**Step 4: Commit**

```bash
git add e2e/mock/stateless-mode/stateless-indicator.spec.ts
git commit -m "test(e2e): stateless-mode indicator visible for artifact-less PR"
```

---

## Task 7: Full suite + manual sanity check

**Step 1: Run the full required suite**

Run: `npm run test:all`
Expected: PASS (lint + typecheck + spec:validate + coverage + e2e + storybook).

**Step 2: Manual sanity check** with the playwright-cli skill (headed): open a PR known to be stateless (no artifact) and confirm the pill renders next to the iteration tabs with a working tooltip; if you can reach an unauthenticated state, confirm the sign-in variant.

**Step 3: Push & open PR** (auto-merge per the user's workflow), then monitor the PR lifecycle with a single Monitor call.

---

## Notes / non-goals

- No indicator in stateful mode (renders `null`).
- No backwards-compat shim for the old free-text `statelessReason` — Explore confirmed nothing displays it today.
- Mode detection logic itself is unchanged; only the reason's type and its surfacing change.
- The duplicate `IterationMode` declaration (store-local vs `types.ts`) is left as-is to keep scope tight; not introduced by this change.
