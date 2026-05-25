## ADDED Requirements

### Requirement: Composable pipeline of single-purpose hooks

The diff feature SHALL be implemented as a fixed-order pipeline of React hooks, each responsible for exactly one transformation. The pipeline order SHALL be:

```
Source → Filter → Shape → Display → SideFilter → Navigation → Comments → render
```

Each stage SHALL receive the output of the previous stage and SHALL NOT reach across stages.

#### Scenario: Stage ordering is fixed
- **WHEN** a developer adds a new transformation
- **THEN** it is inserted at one of the seven defined stage boundaries (extending the chain if necessary), not interleaved inside an existing stage

### Requirement: Per-stage responsibilities

Each pipeline stage SHALL have exactly the responsibility documented below.

| Stage | Hook | Responsibility |
|-------|------|----------------|
| 1 | `useDiffSource` | Get raw diff from the GitHub API or iteration artifact |
| 2 | `useDiffFilter` | Apply full-file vs changes-only filtering |
| 3 | `useDiffShape` | Shape data for inline vs side-by-side rendering |
| 4 | `useDiffDisplay` | Apply display options (whitespace, line numbers) |
| 5 | `useDiffSideFilter` | Filter by side (left / right / both) |
| 6 | `useDiffNavigation` | Compute hunk indices and scroll targets |
| 7 | `useDiffComments` | Map comment threads onto line positions |

#### Scenario: A new display option is added
- **WHEN** a developer adds a new toggle such as "hide deletions"
- **THEN** the toggle is implemented in `useDiffDisplay` (stage 4), not in `useDiffShape` or in the renderer

#### Scenario: Comment position calculation is asked for outside stage 7
- **WHEN** any code outside `useDiffComments` attempts to derive a line position for a comment
- **THEN** that logic is moved into stage 7 instead

### Requirement: Stage isolation and memoization

Each pipeline stage SHALL be independently testable and SHALL memoize its output at the stage boundary so that an upstream-only change does not invalidate downstream stages whose inputs are unchanged.

#### Scenario: Display-only toggle does not re-fetch
- **WHEN** the user toggles "show whitespace" (a `useDiffDisplay` concern)
- **THEN** stages 1–3 return cached outputs and only stages 4–7 re-run

#### Scenario: Stage tested in isolation
- **WHEN** a unit test exercises `useDiffNavigation`
- **THEN** the test feeds a fabricated stage-5 output directly and does not have to mock the GitHub API

### Requirement: Composite hook entry point

The orchestrator component SHALL consume the pipeline through a single composite hook (`useDiffPipeline`) rather than calling the seven stage hooks directly.

#### Scenario: Renderer consumes pipeline
- **WHEN** `src/features/diff/components/DiffView.tsx` renders a PR diff
- **THEN** it calls `useDiffPipeline(...)` and does not import any individual `pipeline/*` hook

### Requirement: Web Worker for heavy comparison

For full-file and side-by-side diffs, the Myers comparison SHALL run in a Web Worker (`src/features/diff/workers/diff-compute.worker.ts`) to keep the main thread responsive. The `useDiffSource` stage SHALL be responsible for dispatching to the worker and surfacing its result.

#### Scenario: Large file diff does not block the UI
- **WHEN** a reviewer opens a PR that includes a 5,000-line file change
- **THEN** scrolling and toolbar interactions remain responsive while the worker computes the diff, and a loading indicator is shown for that file until the worker returns

## Implementation Notes

| File | Purpose |
|------|---------|
| `src/features/diff/hooks/pipeline/*.ts` | One file per pipeline stage hook |
| `src/features/diff/hooks/useDiffPipeline.ts` | Composite hook |
| `src/features/diff/hooks/useDraftComment.ts` | Comment draft state |
| `src/features/diff/hooks/useContainerHeight.ts` | Virtualization support |
| `src/features/diff/components/DiffView.tsx` | Main orchestrator |
| `src/features/diff/components/SideBySideView.tsx` | Side-by-side layout |
| `src/features/diff/workers/diff-compute.worker.ts` | Myers diff in a Web Worker |
| `src/features/diff/scheduler/diff-scheduler.ts` | Priority queue for worker tasks |
