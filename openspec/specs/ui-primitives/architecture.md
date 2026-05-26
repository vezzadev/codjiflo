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
| `Button` | `react-aria-components/Button` | **Wrap** in `src/components/Button` | Apply `btn`/`btn-colorful`/`btn-icon` classes off the `variant`/`size` props; expose idiomatic `onPress`/`isDisabled` API; no `label`/`onClick` bridge. |
| `ToggleButton` | `react-aria-components/ToggleButton` | **Re-export** via `src/components/ui` | CSS targets `[data-pressed]`. No wrapper needed. |
| `TextField` (single-line) | `react-aria-components/TextField` + `Label` + `Input` + `Text` + `FieldError` | **Re-export composition slots** via `src/components/ui` | The composition is the idiomatic API; a bundling helper would only remove a single label line per caller and obscures the slot model. |
| Multi-line text field | same composition with `TextArea` slot | **Re-export** | Same as single-line. |
| `Modal` + `Dialog` | `react-aria-components/ModalOverlay` + `Modal` + `Dialog` | **Wrap** in `src/components/ui/Modal` | Apply `modal-overlay`/`modal` classes; centralize the dismiss-button slot; expose a `<Modal isOpen onOpenChange title>` API. |
| `Tree` | `react-aria-components/Tree` + `TreeItem` + `TreeItemContent` + `Collection` (components API) | **Wrap** in `src/components/ui/Tree` | Thin wrapper applies file-explorer classes and supports the pinned "Pull Request Description" top item. See [Tree integration](#tree-integration) below. |
| `SearchField` | `react-aria-components/SearchField` | **Re-export** via `src/components/ui` | Built-in clear control + Escape-clears behavior is exactly what `SearchPanel` needs. |
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

The file explorer (`src/features/diff/components/FileList.tsx`) currently hand-rolls its
keyboard model with a top-level `onKeyDown` that queries `[role="treeitem"]` and moves
`document.activeElement`. It has no `aria-level`, no real expand/collapse keyboard model,
and no typeahead.

**Decision: use the `react-aria-components` components API (`Tree` + `TreeItem` +
`TreeItemContent` + `Collection`), not the `@react-aria/tree` hooks.**

The current data is shallow: a pinned "Pull Request Description" item plus folder groups
each containing files (2 levels, no recursion needed yet). The components API handles this
with a simple `<Tree items={folders}>` where each `TreeItem` renders a folder header and a
nested `<Collection items={folder.files}>`. The keyboard model, ARIA roles, and selection
state come for free.

The hooks API (`useTree` + `useTreeState`) would be reached for only if we needed full
control over how items are rendered — e.g. virtualization or a custom collection store. We
do not.

**Pull Request Description pinned item.** A regular `TreeItem` at the root of the
collection, rendered first. No special wiring needed: react-aria's selection model treats it
like any other leaf node.

**Filter behavior.** The existing `filterText` filter remains a callsite concern in
`FileList`; the filtered list is what gets handed to `<Tree items={...}>`. react-aria does
not need to know the filter exists.

**Fallback.** If a future requirement (e.g. deep nesting + virtualization) demonstrates the
components API is the wrong fit, drop down to `@react-aria/tree` + `@react-stately/tree`.
Until then, the components API is the chosen path.

## Lint enforcement

`eslint-rules/no-native-interactive-elements.js` (added in M5) bans bare `<button>`,
`<input>`, `<textarea>`, `<select>`, and `<dialog>` inside `src/features/**`, `src/app/**`,
and any `*.stories.tsx`. It allows them inside `src/components/**`, `*.test.tsx`, and
`src/tests/**`. The error message names the replacement primitive.

The rule mirrors `eslint-rules/one-top-level-test-describe.js`:
- CommonJS, registered in the flat config under the `custom-rules/` namespace.
- Tested via `@eslint/rule-tester` with a pass/fail case per disallowed element.

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

`react-aria-components` is tree-shakeable. Importing only Button, ToggleButton, TextField
(+ Label/Input/TextArea/Text/FieldError), Modal/ModalOverlay/Dialog, Tree/TreeItem,
SearchField, and Popover (+ OverlayArrow) is expected to add ≤40 kB gzipped to the client
bundle. M5 (task 6.5) measures with `next build` and the bundle analyzer; the migration is
rejected if the delta exceeds 40 kB.
