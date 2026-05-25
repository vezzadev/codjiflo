## Why

`docs/` and `spec/` accumulated a mix of declarative product specs, milestone roadmaps, implementation plans, architecture notes, and test matrices in three overlapping folder conventions. There is no single source of truth for "what the product must do" — agents and humans must skim 9 milestone stories, 12 functional specs, 3 test matrices, and 2 ad-hoc plan files to answer that. OpenSpec is already installed in this repo (`openspec/`, `config.yaml`, this very change tree) but `openspec/specs/` is empty. Migrating now establishes the OpenSpec capability tree as the canonical "what & why" before more drift accumulates.

## What Changes

- Create nine canonical capability specs in `openspec/specs/` derived from `spec/functional/*.md` (declarative WHAT/WHY only — no implementation guidance).
- Consolidate the four-file iteration set (`iterations.md`, `iterations-common.md`, `iterations-stateful.md`, `iterations-stateless.md`) into a single `iterations` capability spec with sub-sections for the two modes.
- Promote `docs/ARCHITECTURE.md` into `openspec/project.md` as the OpenSpec project context (tech stack, auth, iteration storage, diff pipeline, conventions). **BREAKING** for any tool that hard-codes `docs/ARCHITECTURE.md`.
- Archive (move, do not delete) the historical artifacts into `openspec/archive/legacy/`:
  - `spec/stories/milestone-*.md` (9 milestone roadmaps — already-shipped delivery plans)
  - `docs/plans/2026-02-17-s-4.2.1-*.md` (commit-based iteration loader plan + design)
  - `spec/demo/` (demo materials — keep verbatim, just relocate)
- Move `spec/test/*.md` to `openspec/test-matrices/` (test plans are not first-class OpenSpec artifacts but are still useful; keep them but out of the spec tree).
- Delete the now-empty `docs/` and `spec/` directories after migration.
- Update `AGENTS.md` and `CLAUDE.md` cross-references (every `spec/functional/...` / `spec/stories/...` / `docs/ARCHITECTURE.md` link) to point to the new locations.
- Populate `openspec/config.yaml` with project context and per-artifact rules so future `/opsx:propose` runs inherit the right conventions.

## Capabilities

### New Capabilities
- `diff-viewing`: Four diff view modes (unified, side-by-side, before-only, after-only), word-level highlighting, SpanTracker position mapping, view-mode persistence, navigation between hunks.
- `comments`: Inline review comments with bubble layout, threading, resolution state, visibility filters, position binding to diff lines.
- `iterations`: PR iteration tracking — iteration semantics, snapshot system, comment carry-across-versions, collapsed iterations, force-push resilience. Covers both stateful (GitHub Action + SQLite artifact) and stateless (Timeline API + Web Worker) modes.
- `review-lifecycle`: Review state machine (Active → Completed/Aborted), state transitions, who-can-do-what permissions.
- `realtime-updates`: Live update behaviour — SignalR for Azure DevOps, webhook + polling fallback, optimistic UI rules.
- `unauthenticated-access`: Public-repo review without login, rate-limit accounting, login-required surface boundaries (write actions, private repos, artifact access).
- `backend-abstraction`: Platform-agnostic contracts (`IReviewBackend`, `ICommentBackend`, capability matrix) so the same UI works against GitHub, Azure DevOps, and GitLab.
- `ui-shell`: Dashboard, file explorer, review properties panel, layout grid, status bar — the chrome the diff/comments live inside.
- `data-models`: Canonical domain entities (CodeReview, Comment, Iteration, FileVersion, …) referenced by all other capability specs.

### Modified Capabilities
None — `openspec/specs/` is empty today, so every capability is new.

## Impact

- **Repo layout**: `docs/` and `spec/` removed; `openspec/specs/`, `openspec/project.md`, `openspec/archive/legacy/`, and `openspec/test-matrices/` added.
- **Cross-references**: `AGENTS.md` (project root) and `.github/` workflows that grep specs need updating; ~30 inbound links from milestone stories into functional specs become archive-internal links.
- **Agents/automation**: Any skill or script that reads `spec/functional/...` paths will break until pointed at the new path.
- **No production code changes** — this is a documentation/spec reorganisation only. No tests, build, or runtime behaviour is altered.
- **Reviewability**: `git mv` history preserved so blame survives the move.
