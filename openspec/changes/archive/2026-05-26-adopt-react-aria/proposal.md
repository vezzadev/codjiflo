## Why

CodjiFlo's interactive surfaces (buttons, inputs, modals, file explorer, search panels, theme picker) are hand-rolled atop native HTML with bespoke focus, keyboard, and ARIA wiring. As surfaces multiply (Theme modal, Shortcuts modal, Search panel, Go-to-line panel, file explorer tree, properties panel) the cost of keeping focus order, screen-reader semantics, and keyboard interactions correct grows non-linearly, and gaps already exist (no focus trap, no return-focus, ad-hoc Escape handling, no live regions on async errors). Adopting [React Aria](https://react-aria.adobe.com/) as the standard component layer lets us delete that surface area, gain WCAG 2.1 AA-grade behavior for free, and keep the custom CSS look-and-feel intact.

The goal is to use `react-aria-components` **as much as possible** — replacing existing components rather than wrapping them, adopting react-aria's idiomatic props at every call site, and not preserving the current public API for back-compat. Small visual deltas (focus ring style, dialog overlay animation, default keyboard affordances) are acceptable but MUST be reviewed with a stakeholder before landing.

## What Changes

- Add `react-aria-components` as a direct dependency and use it as the **default** primitive layer; expose its components from `src/components/` either directly (re-exported) or behind a minimal wrapper that exists ONLY to apply our CSS class hooks.
- Delete the current `src/components/Button/Button.tsx`, `src/components/Input/Input.tsx`, `src/components/Textarea/Textarea.tsx`, and `src/components/FormField/FormField.tsx` implementations. Replace with react-aria-components-based implementations using idiomatic props (`onPress` instead of `onClick`, `children` instead of `label`, react-aria's `validate` callback instead of an `error: string` prop where it improves the contract).
- **BREAKING**: All call sites of `Button`, `Input`, `Textarea`, `FormField` are updated to the new props in the same change. No deprecation aliases. No `// kept for back-compat` shims.
- Replace the hand-rolled `features/theme/components/ThemeModal` and `features/keyboard/components/ShortcutsModal` with `Modal` + `Dialog` from `react-aria-components` (focus trap, return-focus, scroll lock, Escape/overlay dismiss, portalled overlay) and delete their manual Escape/focus `useEffect`s.
- Replace the file explorer tree (`features/diff/components/FileList`) with `Tree` / `TreeItem` from `react-aria-components`, refactoring `useFileTree` if necessary to feed react-aria's `Collection` model; do NOT keep a parallel hand-rolled tree.
- Replace toggle controls in `features/diff/components/DiffToolbar` with `ToggleButton`; replace search inputs in `features/diff/components/search/SearchPanel` and `GoToLinePanel` with `SearchField` / `TextField` from react-aria-components.
- Drive ALL component styling off react-aria's render-state data attributes (`[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`, `[data-invalid]`, `[data-selected]`, `[data-expanded]`) — remove scattered `:hover` / `:active` / `:focus-visible` rules across `src/styles/`.
- Add an ESLint rule banning bare `<button>`, `<input>`, `<textarea>`, `<select>`, `<dialog>` outside `src/components/` so future code can't regress.
- Update Storybook stories to demonstrate react-aria render-state variants and snapshot the rendered ARIA contract; add `@axe-core/react` assertions in unit tests for each replaced component.
- Add Playwright keyboard-only specs for the Theme modal (focus trap + return-focus) and the file explorer tree (full keyboard model).

This change **deletes** more code than it adds at the primitive layer. It does not introduce Tailwind, does not replace CSS variable theming, and does not aim for a visual redesign — but any visual delta react-aria introduces by default (e.g. its focus ring approach) is explicitly surfaced for approval in the design doc rather than papered over.

## Capabilities

### New Capabilities
- `ui-primitives`: The contract for the application's accessible UI components — Button, TextField (single-line and multi-line), Modal/Dialog, Tree, SearchField, ToggleButton, Popover. Specifies keyboard interaction model, ARIA semantics, focus behavior, render-state data attributes that drive styling, and the rule that every interactive widget in the app is sourced from this layer (`react-aria-components`, optionally with a thin CSS wrapper) rather than hand-rolled.

### Modified Capabilities
- `ui-shell`: Restates the keyboard-navigation, focus, and theme-contrast requirements in terms of the `ui-primitives` contract (focus trap on modals, return-focus on dismiss, tree-grid keyboard model on the file explorer, visible focus indicator at AA contrast in every theme).

## Impact

- **Code (deleted)**: Current `src/components/Button/Button.tsx`, `src/components/Input/Input.tsx`, `src/components/Textarea/Textarea.tsx`, `src/components/FormField/FormField.tsx` — replaced wholesale. The manual focus and Escape `useEffect`s in `ThemeModal` and `ShortcutsModal`. Any hand-rolled "tree" walking in `features/diff/components/FileList`.
- **Code (rewritten)**: `src/components/Button`, `Input`, `Textarea` re-implemented thinly over react-aria-components (or removed in favor of direct re-export). `src/components/ui/` gains `Modal`, `Dialog`, `Tree`, `Popover`, `ToggleButton`, `SearchField` modules. `src/features/theme/components/ThemeModal`, `src/features/keyboard/components/ShortcutsModal`, `src/features/diff/components/{FileList,DiffToolbar,search/SearchPanel,search/GoToLinePanel}`, plus every consumer of `Button` / `Input` / `Textarea` updated to the new (react-aria-idiomatic) prop shapes.
- **Styling**: `src/styles/shared/{buttons,controls}.css`, `src/styles/modals/modal-base.css`, and any `:focus-visible`/`:hover`/`:active` rules in feature-scoped CSS rewritten to target react-aria render-state data attributes. CSS variables unchanged.
- **Dependencies**: Adds `react-aria-components`. Adds `@axe-core/react` as a devDependency for primitive a11y tests. No other deps removed in this change.
- **Tests**: Existing primitive unit tests (`Button.test.tsx`, `Input.test.tsx`, `Textarea.test.tsx`, `FormField.test.tsx`, `Button.stories.test.tsx`, modal tests) rewritten against the new props and react-aria-components DOM. New Playwright specs `e2e/common/stateless-mode/keyboard-modal.spec.ts` and `keyboard-tree.spec.ts`. Storybook stories updated to drive the new components.
- **Lint**: New `eslint-rules/no-native-interactive-elements.js` enforced in `src/features/**` and `src/app/**`.
- **UI delta review**: The design doc enumerates each visual/behavioral change react-aria introduces by default (e.g. focus ring approach, modal animation, tree expand-collapse animation, SearchField clear-button placement). These MUST be reviewed and approved before the corresponding milestone lands.
- **No back-compat shims**: Prop renames (`label` → `children`, `onClick` → `onPress`, etc.) propagate to every call site in the same change.
