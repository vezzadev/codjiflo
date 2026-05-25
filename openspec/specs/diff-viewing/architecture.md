# diff-viewing — Architecture

> Implementation reference. The behavioral contract lives in [spec.md](spec.md).

The diff feature uses a composable pipeline of React hooks where each stage handles one concern.

## Pipeline Stages

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

## Key Files

| File | Purpose |
|------|---------|
| `src/features/diff/hooks/pipeline/*.ts` | Pipeline stage hooks |
| `src/features/diff/hooks/useDiffPipeline.ts` | Composite hook |
| `src/features/diff/hooks/useDraftComment.ts` | Comment draft state |
| `src/features/diff/hooks/useContainerHeight.ts` | Virtualization support |
| `src/features/diff/components/DiffView.tsx` | Main orchestrator |

## Benefits

- Each stage testable in isolation
- Memoization at each stage boundary
- Clear data flow for debugging
