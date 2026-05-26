# ui-shell — Architecture

> Companion to [spec.md](./spec.md). Records implementation reference, not requirements.

The ui-shell capability covers the chrome around the diff and comments: the dashboard, file
explorer, properties panel, layout grid, status bar, theme handling, and resizable panes.
This sidecar focuses on the pieces whose implementation strategy is non-obvious from the
spec text — chiefly the file-explorer tree.

## File-explorer tree

Implementation lives in `src/features/diff/components/FileList.tsx`. The primitive layer is
`react-aria-components` (`Tree` + `TreeItem` + `TreeItemContent` + `Collection` + the
inline `RAButton slot="chevron"`). See
[`ui-primitives/architecture.md`](../ui-primitives/architecture.md#tree-integration) for
the rationale (components API vs. hooks API, why no wrapper).

### What the spec says vs. what react-aria provides

| Spec requirement | Provided by react-aria | Notes |
|---|---|---|
| Up / Down move between visible nodes | ✅ Standard keymap | Respects expansion / filter |
| Enter opens the selected file | ✅ Wired via `onAction` → `selectFile` | |
| Folders expand / collapse | ✅ Left / Right keys + chevron button | `<RAButton slot="chevron">` is a real button |
| PR Description pinned at top | ⚙️ Sibling `TreeItem` outside `Collection` | Survives filter / expansion |
| Filename filter (substring, real-time) | ⚙️ Caller filters `items` before handing to `<Tree>` | react-aria does not know the filter exists |
| Filter clears on Escape | ⚙️ `SearchField` (Escape clears input) | Whole panel does not unmount on Escape; only the field clears |
| Space toggles marked state | ❌ Not in react-aria's default keymap | **Pre-existing gap** — the hand-rolled handler did not implement it either |
| Ctrl+C copies the path | ❌ Not in react-aria's default keymap | Same — pre-existing gap |

The two gaps are inherited from the previous implementation, not introduced by the
adopt-react-aria migration. They are tracked outside this change.

### Role shape

The rendered DOM emits `role="treegrid"` (NOT `role="tree"`) with `role="row"` items
containing a `role="gridcell"`. This is the standard react-aria-components Tree shape. Tests
that previously queried `getByRole('tree')` / `getByRole('treeitem')` now query
`getByRole('treegrid')` / `getByRole('row')`.

### State

| UI state | Source of truth | Derived from |
|---|---|---|
| `expandedKeys` | react-aria | `collapsedFolders: Set` from `useDiffStore` |
| `selectedKeys` | react-aria | `selectedFileIndex` from `useDiffStore` |
| Filter text | `useDiffStore` | Caller filters items before render |
| Action routing | `handleAction` | Detects `PR_DESCRIPTION_KEY` / `folder:` / `file:` prefixes |

`onSelectionChange` is the single entry point; folder rows toggle expansion via
`handleAction` and file rows route to `selectFile`.

### Legacy CSS class hooks

`className={({ isSelected }) => …}` / `className={({ isExpanded }) => …}` keeps the legacy
`.selected` / `.expanded` class hooks alive for the existing CSS. In parallel, react-aria
emits `[data-selected]` / `[data-expanded]` so hover / focus-visible styling can use the
data-attribute contract documented in `ui-primitives/architecture.md`.

## Theme handling

The theme modal (`src/features/theme/components/ThemeModal.tsx`) renders the Modal
primitive (M1) with three `RadioGroup`s for UI Theme / Diff Colors / Contrast. Theme is
applied by toggling a class on `<body>` (e.g. `theme-dark`). The diff preview swatch was
restructured during M5 to render `<Radio value="regular" | "high-contrast">` inside its
own `RadioGroup` rather than hand-rolled `<input type="radio">` markup.

## Layout & resizable panes

Out of scope for the adopt-react-aria migration; documented here for future reference.
The shell uses native CSS Grid for the top-level layout (titlebar / left pane / main /
bottom pane / right pane / status bar). Pane resize handles are not yet on the react-aria
roadmap and remain hand-rolled.
