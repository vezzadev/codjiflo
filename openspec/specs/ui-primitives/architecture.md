# ui-primitives — Architecture

> Companion to [spec.md](./spec.md). Records implementation reference, not requirements.
>
> Source of truth for the primitive layer is `react-aria-components`. This sidecar documents
> which components we re-export directly, which we wrap, the data-attribute styling contract,
> the lint rule that defends the boundary, and the Tree integration decision from the
> milestone-1 spike. Spec scenarios in `spec.md` are what the layer guarantees; this file
> explains how we get there.

## Component-by-component decision matrix

| Primitive | Backing | Decision | Rationale |
|---|---|---|---|
| `Button` | `react-aria-components/Button` | **Wrap** in `src/components/Button` | Apply `btn`/`btn-colorful`/`btn-icon` classes off the `variant`/`size` props; expose idiomatic `onPress`/`isDisabled` API; no `label`/`onClick` bridge. `variant: 'ghost'` (added in M5) emits no base class so callers with bespoke classes (`.btn-nav`, `.btn-toolbar`, `.btn-link`, `.btn-icon`, `.rate-limit-banner-dismiss`, `.diff-search-nav-btn`, `.toolbar-dropdown-button`, `.diff-panel-close-btn`) opt out of the default `.btn` styling. |
| `ToggleButton` | `react-aria-components/ToggleButton` | **Re-export** via `src/components/ui` | CSS targets `[data-pressed]`. No wrapper needed. |
| `TextField` (single-line) | `react-aria-components/TextField` + `Label` + `Input` + `Text` + `FieldError` | **Re-export composition slots** via `src/components/ui` | The composition is the idiomatic API; a bundling helper would only remove a single label line per caller and obscures the slot model. |
| Multi-line text field | same composition with `TextArea` slot | **Re-export** | Same as single-line. |
| `Modal` + `Dialog` | `react-aria-components/ModalOverlay` + `Modal` + `Dialog` | **Wrap** in `src/components/ui/Modal` | Apply `modal-overlay`/`modal` classes; centralize the dismiss-button slot; expose a `<Modal isOpen onOpenChange title>` API. |
| `Tree` | `react-aria-components/Tree` + `TreeItem` + `TreeItemContent` + `Collection` (components API) | **Inline** in `src/features/diff/components/FileList.tsx` | Single caller; a wrapper would only forward props. If a second tree caller appears, extract a `src/components/ui/Tree` wrapper. See [Tree integration](#tree-integration) below. |
| `SearchField` | `react-aria-components/SearchField` | **Re-export** via `src/components/ui` | Built-in clear control + Escape-clears behavior is exactly what `SearchPanel` needs. |
| `RadioGroup` + `Radio` | `react-aria-components/RadioGroup` + `Radio` | **Re-export** via `src/components/ui` (used inline) | Used by the diff-toolbar content-filter slider and the theme modal (UI theme / diff scheme / contrast). CSS targets `[data-selected]` on the `Radio` label, not the visually-hidden native input. |
| `Checkbox` | `react-aria-components/Checkbox` | **Re-export** via `src/components/ui` (used inline) | Used by `SearchPanel` (Match case / Whole word / Regex). |
| `Select` + `ListBox` + `Popover` | `react-aria-components/Select` + `ListBox` + `ListBoxItem` + `Popover` + `SelectValue` | **Re-export** via `src/components/ui` (used inline) | Pre-1.17 API (`selectedKey`/`onSelectionChange`) is deprecated — use `value`/`onChange`. |
| `Popover` | `react-aria-components/Popover` | **Re-export** via `src/components/ui` | Used for floating overlays anchored to triggers. |
| `OverlayArrow` | `react-aria-components/OverlayArrow` | **Re-export** via `src/components/ui` | Optional decoration for `Popover`. |

The bar for keeping a wrapper: it removes duplication every caller would otherwise write.
The bar for adding one: same. Wrappers do not exist to preserve old prop shapes.

## Data-attribute styling contract

`react-aria-components` exposes render state via `data-*` attributes on the rendered DOM,
not via CSS pseudo-classes alone. Our CSS targets these data attributes so that:

- Keyboard activation (Space/Enter) flips `[data-pressed]` the same way pointer activation does.
- `[data-focus-visible]` is library-managed and consistent across input modalities — no
  `:focus-visible` flicker on mouse-down/up cycles.
- Invalid form state is a single `[data-invalid]` attribute, not a `.textbox-error` class
  the caller has to remember to add.

| State | Data attribute | Pseudo-class equivalent (removed) |
|---|---|---|
| Hover | `[data-hovered]` | `:hover` |
| Pressed (pointer or keyboard) | `[data-pressed]` | `:active` |
| Keyboard focus visible | `[data-focus-visible]` | `:focus-visible` |
| Disabled | `[data-disabled]` | `:disabled` |
| Invalid form field | `[data-invalid]` | `.textbox-error` (deprecated) |
| Selected (tree item, etc.) | `[data-selected]` | n/a — was hand-rolled `.selected` |
| Expanded (tree folder) | `[data-expanded]` | n/a — was hand-rolled `.expanded` |
| Modal entering/exiting | `[data-entering]` / `[data-exiting]` | n/a — animation hooks |

**Rule:** for any primitive sourced from `react-aria-components`, CSS interactive-state rules
target the data attribute, not the pseudo-class. The pseudo-class rule is deleted in the
same milestone that migrates the primitive (M2 for `.btn`/`.btn-colorful`, M3 for
`.textbox`/`.textarea`).

**Project class hooks unchanged.** `btn`, `btn-colorful`, `btn-icon`, `textbox`, `form-group`,
`label`, `modal`, `modal-overlay` continue to be applied to the react-aria components. The
visual identity comes from these classes; the interactive state comes from data attributes.

## Tree integration

The file explorer lives in `src/features/diff/components/FileList.tsx`. M4 replaced the
hand-rolled `onKeyDown` + `[role="treeitem"]` queries with `Tree` + `TreeItem` +
`TreeItemContent` + `Collection` from `react-aria-components`.

**Decision: components API, not the `@react-aria/tree` hooks.** The data is shallow (a
pinned "Pull Request Description" item plus folder groups each containing files — 2 levels,
no recursion). The components API handles this with `<Tree items={folders}>` and a nested
`<Collection items={folder.files}>` per folder, and the keyboard model / ARIA roles /
selection state come for free. The hooks API (`useTree` + `useTreeState`) would only be
needed for virtualization or a custom collection store.

**Pull Request Description pinned item.** Rendered as a sibling `TreeItem` outside the
`Collection`, so it stays visible regardless of the filter / folder collection content.

**Filter behavior.** `filterText` remains a `FileList` concern; the filtered list is what
gets handed to `<Tree items={...}>`. react-aria does not need to know the filter exists.

**Role shape (verified in M4 task 5.4).** The rendered DOM emits `role="treegrid"` (NOT
`role="tree"`) with `role="row"` items containing a `role="gridcell"` — this is the standard
react-aria-components Tree shape. Tests that previously queried `getByRole('tree')` /
`getByRole('treeitem')` now query `getByRole('treegrid')` / `getByRole('row')`.

**Keyboard model (verified in M4 task 5.4).** Up/Down move between visible rows; Left
collapses or moves to parent; Right expands or moves to first child; Home/End jump;
Enter on a file row activates `onAction` → `selectFile`; printable typeahead works out of
the box. `aria-expanded` is emitted on folder rows; `aria-selected` on selected rows.

**Selection / expansion state.** `expandedKeys` derives from `collapsedFolders: Set`;
`selectedKeys` derives from `selectedFileIndex`. `onSelectionChange` routes through a
unified `handleAction` that detects `PR_DESCRIPTION_KEY` / `folder:` / `file:` prefixes.
Folder rows toggle expansion on single-click via `handleAction`; the chevron is a real
`<RAButton slot="chevron">`.

**Legacy class hooks.** Render-prop `className={({ isSelected }) => …}` /
`className={({ isExpanded }) => …}` keeps the legacy `.selected` / `.expanded` class hooks
for CSS, while `[data-selected]` / `[data-expanded]` are emitted in parallel for
focus-visible / hover styling.

**Gap vs. ui-shell spec.** The `ui-shell` spec lists "Space toggles the marked state" and
"Ctrl+C copies the path" under File Explorer Keyboard Navigation; these are not part of
react-aria's Tree default keymap and were not part of the hand-rolled handler either. The
gap is pre-existing (not introduced by the migration) and tracked outside this change.

**Fallback.** If a future requirement (e.g. deep nesting + virtualization) demonstrates the
components API is the wrong fit, drop down to `@react-aria/tree` + `@react-stately/tree`.
Until then, the components API is the chosen path.

## Lint enforcement

`eslint-rules/no-native-interactive-elements.js` (added in M5) bans bare `<button>`,
`<input>`, `<textarea>`, `<select>`, and `<dialog>` inside `src/features/**`, `src/app/**`,
and any `*.stories.tsx`. It allows them inside `src/components/**`, `*.test.tsx`, and
`src/tests/**`. The error message names the replacement primitive (e.g. "Use `<Button>` from
`@/components` (react-aria-components)").

The rule mirrors `eslint-rules/one-top-level-test-describe.js`:
- **ESM** (the spec's original wording said "CommonJS" but the sibling rule is ESM, so the
  codebase convention won).
- Registered in `eslint.config.mjs` under the `custom-rules/` namespace.
- Tested via ESLint's built-in `RuleTester` (`@eslint/rule-tester` is not installed; the
  `eslint` package exports the same API) under `eslint-rules/__tests__/`. `vitest.config.ts`
  `include` was extended to pick up the rule test files. 13 cases (7 valid / 6 invalid)
  cover each disallowed tag plus a nested-position case.

**M5 sweep outcome.** The initial run reported 36 offenders. Resolved by: adding
`variant: 'ghost'` to `Button`; migrating `<input type="radio">` clusters to
`RadioGroup`+`Radio` (`DiffToolbar` content-filter slider, `ThemeModal` UI Theme + Diff
Colors + Contrast); migrating `SearchPanel` search options to `Checkbox`; migrating
`FileList` filter `<input>` to `SearchField`+`Input` with the built-in clear `Button`;
migrating `Titlebar.stories.tsx` `<select>` to `Select`+`SelectValue`+`ListBox`+`Popover`.
**No `eslint-disable` added.**

The rule is the structural guarantee behind the spec's "Lint rejects native interactive
elements" scenario. Without it, future code drifts back to native HTML and the migration's
value erodes.

## Accessibility verification stack

Three layers, each with a different blast radius:

1. **Unit (`@axe-core/react` in Vitest + RTL):** every primitive test asserts core ARIA
   (`getByRole`, accessible name, render-state attributes) and runs axe on the rendered
   tree, failing on serious/critical violations. Fast (no browser).
2. **Storybook stories:** one story per render-state (default, hovered, pressed,
   focus-visible, disabled, invalid). Visual review catches CSS regressions; existing
   Storybook interaction tests verify keyboard activation.
3. **Playwright E2E:** `e2e/common/stateless-mode/keyboard-modal.spec.ts` and
   `keyboard-tree.spec.ts` cover the modal focus trap and the file-explorer keyboard
   model end-to-end. Budgeted under 5s/test.

`@axe-core/playwright` is intentionally not used — the unit-level axe is fast and catches
contract regressions; adding it to E2E would burn the 5s budget without adding signal.

## Bundle-size budget

`react-aria-components` is tree-shakeable. The change proposal set a ≤40 kB gzipped budget
for the production bundle delta vs. the pre-M0 baseline.

**M5 measurement** (`next build` total gzipped chunks in `.next/static/chunks`):

| | gzipped |
|---|---|
| Baseline (commit `9b23d7d`, pre-M0) | 857.1 kB |
| Current (post-M5 sweep) | 929.0 kB |
| **Delta** | **+71.9 kB (+8.4%)** |

**The delta exceeds the 40 kB target by 31.9 kB.** Surfaced via `AskUserQuestion` and
approved on the basis that `react-aria-components` (Modal, Button, Tree, SearchField,
ToggleButton, TextField, RadioGroup, Checkbox, Select, ListBox, Popover, Dialog) is now
replacing 36 native elements and gaining the full a11y keyboard model.

`@axe-core/react` and `axe-core` are verified absent from the prod bundle (devDependency
only).

## Accepted UI deltas

Each milestone surfaced its visual deltas via `AskUserQuestion` before committing. The
approved deltas, by milestone:

- **M1 (Modal/Dialog/Shortcuts):** Behavior-only — focus trap, return-focus, scroll lock.
  No visual delta; backdrop div removed (`ModalOverlay` handles outside click via
  `isDismissable`); dismiss button stayed native until M2.
- **M2 (Button):** `[data-focus-visible]` fires on keyboard focus only, so primary buttons
  no longer show the inset glow on click-focus (canonical keyboard/pointer distinction).
  Hover / press / disabled visuals unchanged.
- **M3 (TextField/Textarea/SearchPanel/GoToLine):** `[data-invalid]` + `aria-invalid="true"`
  paints the input red on `isInvalid`; `FieldError` rendered as a span beneath the input.
  `GoToLinePanel` reports out-of-range / non-numeric inline instead of silent clamp.
  `SearchPanel` wraps the input in `SearchField` with no visible delta (no clear button
  added). `IterationSelector` tabs are now `ToggleButton`; selected/in-range styling
  unchanged, pressed state via `[data-pressed]` (visually same as old `:active`).
- **M4 (Tree/FileList):** Tree role shape is now `treegrid` / `row` / `gridcell` (was
  `tree` / `treeitem` hand-rolled), driven by react-aria's components API. Selection /
  expansion visuals unchanged (legacy `.selected` / `.expanded` classes preserved via
  render-prop). Keyboard model is now the standard react-aria tree keymap (Left/Right
  collapse-expand, typeahead).
- **M5 (sweep):** `<Select>` migration in `Titlebar.stories.tsx` swapped a native
  `<select>` for `Select`+`SelectValue`+`ListBox`+`ListBoxItem`+`Popover`. Content-filter
  slider (`ContentFilterSlider`) regressed initially (thumb invisible in all 3 states)
  because the CSS sibling selector `input:checked + .content-filter-thumb` broke when
  react-aria wrapped the native input in a visually-hidden span; fix was to switch the CSS
  to `.content-filter-option[data-selected] .content-filter-thumb { display: flex; }`
  (the same `[data-selected]` rule documented above). Storybook regression test added at
  `src/features/diff/components/ContentFilterSlider.stories.tsx`.
- **M7 (axe sweep, including the `axe-main-ux.spec.ts` regression gate):** `BottomPane` switched from hand-rolled tab divs to
  `Tabs`+`TabList`+`Tab`+`TabPanel`; the visible deltas are (a) the inactive tab now uses
  `[data-hovered]` instead of `:hover:not(.active)`, (b) the active panel is the only one
  in the DOM (react-aria only renders the selected `TabPanel`), and (c) the active tab now
  shows a keyboard-only focus ring via `[data-focus-visible]`. The pane is now an ARIA
  `region` landmark named "Discussion" via `useLandmark`. The PR page gained a
  visually-hidden `<h1>` placed inside `<main>`; the previously-visible `pr-title` in
  `PRMetadata` was demoted to `<h2>` to keep exactly one `<h1>` per page (visual styling
  identical via the unchanged `.pr-title` class). The CodeMirror editor's `.cm-content`
  (`role="textbox"`) now carries an `aria-label="Diff for <path>"` (or
  `(original)` / `(modified)` in split view), set via `EditorView.contentAttributes`.
  Residual axe violations after the sweep: `color-contrast` (palette decisions, tracked in
  `ui-shell`) and `.cm-scroller` `scrollable-region-focusable` (CodeMirror-internal; the
  editor already exposes its own accessible name). `e2e/mock/stateless-mode/axe-main-ux.spec.ts`
  runs axe-core against both the description view and the diff-editor view; the allow-list
  excludes only those two residual rules so any new serious/critical violation fails CI.
