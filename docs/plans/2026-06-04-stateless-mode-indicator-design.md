# Stateless-mode visual indicator — design

**Date:** 2026-06-04

## Problem

A PR's iteration data loads in one of two modes (`useIterationStore.mode`):

- **stateful** — a CodjiFlo GitHub Action artifact (SQLite iteration DB) is available; full
  iteration + span tracking.
- **stateless** — fallback via the GitHub Timeline API when no artifact is found; iteration
  tracking is limited (no span tracking, etc.).

Today nothing in the UI tells the reviewer they're in stateless mode or why, so limited
behaviour looks like a bug. The store already records a `statelessReason`, but it is never
surfaced.

## Goal

When a PR is in stateless mode, show a compact, accessible indicator next to the iteration
tabs that explains why, and — when the cause is that the user is signed out — offers a
sign-in action.

## Design

### 1. Store: typed reason enum

`useIterationStore` currently holds `statelessReason: string | null` as free text. Per the
project's enum-over-string guidance, change it to a discriminated value so the UI branches
reliably instead of string-matching:

```ts
export type StatelessReason = 'unauthenticated' | 'no-artifact';
// store state: statelessReason: StatelessReason | null
```

- `'unauthenticated'` — an artifact reference exists but the user is anonymous (data is
  available once signed in). Actionable.
- `'no-artifact'` — no artifact reference; the repo likely lacks the CodjiFlo Action.
  Informational.

Human-readable copy moves into the component. Store console logging keeps its own strings.
Stateful loads continue to set `statelessReason: null`.

### 2. Component: `StatelessModeIndicator`

Location: `src/features/iterations/components/StatelessModeIndicator.tsx`. Reads `mode` and
`statelessReason` from the store.

| Condition | Render |
|-----------|--------|
| `mode === 'stateful'` | `null` (no clutter in the normal case) |
| `statelessReason === 'no-artifact'` | neutral info pill `⚡ Stateless`; tooltip: "No CodjiFlo artifact found. This repo may not have the CodjiFlo GitHub Action installed. Iteration tracking is limited." |
| `statelessReason === 'unauthenticated'` | warning pill `⚠ Sign in for full tracking`; `onPress` triggers the existing login flow; tooltip explains data is available once signed in |

Built from existing primitives only:

- `Button` (react-aria) as the focusable tooltip trigger.
- `TooltipTrigger` / `Tooltip` (already re-exported from `@/components/ui`).
- `lucide-react` icons (`Zap`, `LogIn`).
- `aria-label` on the pill so the state is conveyed without relying on colour.

The sign-in action wires to the same login initiation used by the login screen (exact
hook/route confirmed during implementation).

### 3. Placement & styling

Rendered as a sibling immediately after `<IterationSelector />` inside
`.diff-header-iterations` in `DiffView.tsx` — both the PR-description view and the sticky
file-header instance. Being a sibling (not inside the selector) means it still shows when
the selector renders nothing because there are zero iterations.

New styles in `src/styles/shared/features.css`:
`.stateless-indicator`, `.stateless-indicator--info`, `.stateless-indicator--action`,
using existing theme CSS variables (warning / `--error-fg` tones for the action variant).

## Testing

Per AGENTS.md exit criteria (TDD: failing-test commit first, then implementation commit,
failure noted in the message).

- **Unit:** component renders `null` in stateful mode, info pill for `no-artifact`, action
  pill for `unauthenticated`; sign-in `onPress` invokes login. Store test for the new enum
  values being set on each path.
- **Integration:** a mode transition is reflected in the rendered pill.
- **E2E (mock):** a PR with no artifact → stateless pill visible with the correct text.

## Out of scope / non-goals

- No indicator in stateful mode.
- No change to how mode itself is detected — only how the reason is typed and surfaced.
- No backwards-compatibility shim for the old free-text `statelessReason` (no current
  readers display it).
