## 1. Dependency and scaffolding

- [ ] 1.1 Add `react-aria-components` to `dependencies` and `@axe-core/react` to `devDependencies` in `package.json`, run `npm install`, commit lockfile
- [ ] 1.2 Verify `npm run build` and `npm run test:all` are green with the dependency installed but unused (baseline)
- [ ] 1.3 Spike: render `<Tree>` from `react-aria-components` over a fake `useFileTree`-shaped collection and confirm Up/Down/Left/Right + typeahead + expand/collapse + selection work; record the chosen integration approach (components API vs `@react-aria/tree` hooks) in `openspec/specs/ui-primitives/architecture.md`
- [ ] 1.4 Wire the existing CSS variables to react-aria render-state data attributes by previewing one button in `src/styles/shared/buttons.css`: replace `:hover` with `[data-hovered]`, `:active` with `[data-pressed]`, `:focus-visible` with `[data-focus-visible]`, `:disabled` with `[data-disabled]`; smoke-test in Storybook with a throwaway `<RAButton>` to validate the styling approach before milestone 2 commits

## 2. Milestone 1 — Modal, Dialog, ToggleButton, SearchField, Popover (+ replace ThemeModal & ShortcutsModal)

- [ ] 2.1 Create `src/components/ui/Modal/` (`Modal.tsx`, `Modal.test.tsx`, `index.ts`) wrapping `ModalOverlay` + `Modal` + `Dialog` from `react-aria-components`; apply `modal-overlay` and `modal` classes; expose a `<Modal isOpen onOpenChange={…} title="…">` API; portal-mounted; dismiss button slot inside
- [ ] 2.2 Re-export `ToggleButton`, `SearchField`, `Popover`, `OverlayArrow` from `react-aria-components` via `src/components/ui/index.ts` (no wrappers)
- [ ] 2.3 Replace `src/features/theme/components/ThemeModal.tsx` to render `Modal` from 2.1; delete the local `useEffect` Escape listener, `modalRef.current?.focus()`, and any hand-rolled `role="dialog"` markup; switch from the `isOpen`/`onClose` prop pair to react-aria's `isOpen`/`onOpenChange` signature; update the test file accordingly
- [ ] 2.4 Replace `src/features/keyboard/components/ShortcutsModal.tsx` and `ShortcutsModal.test.tsx` to use the new `Modal`; assert dialog accessible name, focus trap (Tab cycles inside), Escape closes, focus returns to trigger
- [ ] 2.5 Update `src/styles/modals/modal-base.css` to target `[data-entering]`/`[data-exiting]` (react-aria animation hooks) and `[data-focus-visible]` on the dismiss button; delete any unused overlay-click handlers in feature CSS
- [ ] 2.6 **UI-delta review gate**: capture before/after screenshots of both modals (open state, focus indicator on dismiss button, overlay animation in/out); call out any default react-aria visual delta (overlay opacity, dialog shadow, dismiss-button placement, focus ring) and present via `AskUserQuestion` — block on approval before committing the milestone
- [ ] 2.7 Add `e2e/common/stateless-mode/keyboard-modal.spec.ts`: open Theme modal with Enter on the trigger, Tab cycles inside, Escape closes, focus returns; under 5s budget
- [ ] 2.8 Run `npm run test:all`; commit milestone 1

## 3. Milestone 2 — Button (delete + rewrite + every caller)

- [ ] 3.1 Delete the body of `src/components/Button/Button.tsx`; rewrite using `Button` from `react-aria-components`. Public API: `<Button onPress={…} variant="primary"|"secondary" size="default"|"sm"|"icon" isDisabled aria-label="…">{children}</Button>`. Apply `btn`/`btn-colorful`/`btn-icon` classes off variant/size. No `label` prop. No `onClick` bridge.
- [ ] 3.2 Update `src/styles/shared/buttons.css` to target `[data-hovered]`/`[data-pressed]`/`[data-focus-visible]`/`[data-disabled]` on `.btn` and `.btn-colorful`; remove `:hover`/`:active`/`:focus-visible` rules for those selectors
- [ ] 3.3 Rewrite `src/components/Button/Button.test.tsx`: assert `role="button"`, accessible name, keyboard activation (Space and Enter both fire `onPress` exactly once), `isDisabled` propagates, `[data-pressed]` set during press, `aria-label` exposed; add `@axe-core/react` no-serious-violations assertion
- [ ] 3.4 Update `src/components/Button/Button.stories.tsx` and `Button.stories.test.tsx`: one story per render-state (default, hovered, pressed, focus-visible, disabled), interaction test drives `userEvent.keyboard("{Enter}")` and asserts the press handler fires
- [ ] 3.5 Sweep every `<Button …/>` in `src/app/**` and `src/features/**`: rename `label` → children, `onClick` → `onPress`, `disabled` → `isDisabled`, `ariaLabel` → `aria-label`. Use `grep -rE "<Button" src/ --include='*.tsx'` to enumerate; expected files include at least `src/features/auth/components/RateLimitBanner.tsx`, `src/features/pr/components/PRHeader.tsx`, `src/features/diff/components/DiffToolbar.tsx`, `src/features/theme/components/ThemeModal.tsx`, `src/features/keyboard/components/ShortcutsModal.tsx`, `src/app/login/page.tsx`, `src/app/dashboard/page.tsx`. Confirm `npm run lint` and `npm run typecheck` cover the rename.
- [ ] 3.6 **UI-delta review gate**: capture before/after screenshots of representative buttons (primary, secondary, icon, disabled, focus-visible); flag the react-aria focus ring vs the previous `:focus-visible` style; present via `AskUserQuestion`; block on approval
- [ ] 3.7 Run `npm run test:all`; commit milestone 2

## 4. Milestone 3 — TextField + Textarea + every text-input caller + DiffToolbar/Search

- [ ] 4.1 Delete `src/components/Input/Input.tsx`, `src/components/Textarea/Textarea.tsx`, `src/components/FormField/FormField.tsx` and their tests
- [ ] 4.2 Decide and document in `openspec/specs/ui-primitives/architecture.md` whether to re-export the `TextField`/`Label`/`Input`/`Text`/`FieldError` composition slots from `react-aria-components` directly, or to introduce one thin helper that bundles them (the bar: the helper must remove duplication every caller would otherwise write). Default: direct re-export from `src/components/ui/index.ts`.
- [ ] 4.3 Update `src/styles/shared/controls.css`: `:focus-visible` → `[data-focus-visible]` on `.textbox`/`.textarea`; introduce `.textbox[data-invalid]` styling and remove the legacy `.textbox-error` class. Delete `.form-group` declarations that duplicate react-aria's `TextField` defaults, keep what the design actually needs.
- [ ] 4.4 Sweep every `<Input …/>` and `<Textarea …/>` call site: replace with the `<TextField isInvalid={…}><Label>…</Label><Input/><Text slot="description">…</Text><FieldError>…</FieldError></TextField>` composition (or the helper from 4.2 if introduced). Expected files include any login form, comment composer, search panel, go-to-line panel.
- [ ] 4.5 Replace `src/features/diff/components/search/SearchPanel.tsx` to use `SearchField` from `react-aria-components`; remove any hand-rolled Escape-clears-and-blurs logic (react-aria's `SearchField` handles it natively)
- [ ] 4.6 Replace `src/features/diff/components/search/GoToLinePanel.tsx` to use the `TextField` composition with `inputMode="numeric"`, `validate` callback for the line-number validation, and `FieldError` for the error slot
- [ ] 4.7 Replace toggle controls in `src/features/diff/components/DiffToolbar.tsx` with `ToggleButton` from `react-aria-components`; assert `aria-pressed` reflects state; CSS targets `[data-pressed]`
- [ ] 4.8 Update every test that referenced exact-DOM shape (`Input.test.tsx`, `Textarea.test.tsx`, `FormField.test.tsx` are deleted; tests in feature folders that grep for `.textbox-error` or `.form-group` are updated to assert `[data-invalid]` or `aria-invalid="true"` instead). Use `getByRole`/`getByLabelText` to keep tests resilient. Add `@axe-core/react` assertions to one canonical TextField test.
- [ ] 4.9 **UI-delta review gate**: capture before/after screenshots of: a labelled text field, an invalid text field with error, a text field with helper text, the diff search input, the go-to-line input, a DiffToolbar toggle in both states. Flag any react-aria default deltas (clear-button glyph in SearchField, error text spacing, toggle pressed style). Present via `AskUserQuestion`; block on approval.
- [ ] 4.10 Run `npm run test:all`; commit milestone 3

## 5. Milestone 4 — Tree + FileList

- [ ] 5.1 Confirm the integration approach chosen in 1.3 still holds against the current `useFileTree` store; if not, redo the spike on a branch and update `openspec/specs/ui-primitives/architecture.md`
- [ ] 5.2 Create `src/components/ui/Tree/` (or extend it from milestone 1) — a thin wrapper that applies the file-explorer styling classes and supports the pinned `Pull Request Description` top node. Default backing: `Tree`/`TreeItem` from `react-aria-components`. Fallback: `@react-aria/tree` + `@react-stately/tree` hooks per 1.3.
- [ ] 5.3 Replace the keyboard handling, expand/collapse state, and selection model in `src/features/diff/components/FileList.tsx` with the new `Tree`; delete all hand-rolled `onKeyDown` listeners on tree nodes
- [ ] 5.4 Verify keyboard model end-to-end against the spec: Up/Down move, Left collapses or moves to parent, Right expands or moves to first child, Home/End jump, Enter opens file, Space toggles mark, Ctrl+C copies path, printable typeahead. Confirm `role="tree"`, `treeitem`, `aria-level`, `aria-expanded`, `aria-selected` are emitted by react-aria.
- [ ] 5.5 Update `FileList`'s unit and integration tests to assert tree semantics and the full keyboard model via `getByRole("tree")` and `getByRole("treeitem")`; add an `@axe-core/react` no-serious-violations assertion
- [ ] 5.6 **UI-delta review gate**: capture before/after screenshots of the file explorer (expanded folders, selected item with focus ring, partial-mark folder, filtered view); flag react-aria's default tree row indent, chevron, and focus indicator deltas; present via `AskUserQuestion`; block on approval
- [ ] 5.7 Add `e2e/common/stateless-mode/keyboard-tree.spec.ts`: focus the tree, Down moves selection, Right expands a folder, Left collapses, typeahead jumps to a file, Enter opens it; under 5s budget
- [ ] 5.8 Run `npm run test:all`; commit milestone 4

## 6. Milestone 5 — Lint enforcement, sweep, axe coverage, bundle check

- [ ] 6.1 Add `eslint-rules/no-native-interactive-elements.js` (CommonJS, mirroring the pattern of `eslint-rules/one-top-level-test-describe.js`) banning bare `<button>`, `<input>`, `<textarea>`, `<select>`, `<dialog>` in `src/features/**`, `src/app/**`, and `**/*.stories.tsx` (stories MUST drive the primitive components, not raw HTML); allow them only inside `src/components/**`, `**/*.test.tsx`, and `src/tests/**`; the error message MUST name the replacement primitive
- [ ] 6.2 Register the rule in `eslint.config.*` and run `npm run lint`; resolve any remaining offenders by migrating them to react-aria — NO `eslint-disable`
- [ ] 6.3 Add a unit test for the lint rule under `eslint-rules/__tests__/no-native-interactive-elements.test.js` using `@eslint/rule-tester` covering pass and fail cases per disallowed element
- [ ] 6.4 Audit `src/components/ui/Modal/Modal.test.tsx`, the new Tree/SearchField/ToggleButton tests, and the migrated `Button`/`TextField` tests to ensure each runs `@axe-core/react` and fails on serious/critical violations
- [ ] 6.5 Run `next build` and analyze the bundle; record the gzipped client growth delta in the PR description; reject if it exceeds 40 kB
- [ ] 6.6 Smoke-test SSR by running `next build && next start` and loading the dashboard + a PR page; verify no hydration warnings in the console (especially for `Modal` portals)
- [ ] 6.7 Run `npm run test:all`; commit milestone 5

## 7. Documentation, sidecars, and archive readiness

- [ ] 7.1 Create `openspec/specs/ui-primitives/architecture.md` documenting: which `react-aria-components` we re-export directly, which we wrap and why, the data-attribute styling contract, the lint rule, the Tree integration decision from 1.3, the UI-delta deltas that were accepted (with screenshots if useful)
- [ ] 7.2 Update or create `openspec/specs/ui-shell/architecture.md` for the new file-explorer tree model; cross-reference `ui-primitives/architecture.md`
- [ ] 7.3 Update `AGENTS.md` section 1.1 and 4.7 to point at `ui-primitives` and the lint rule as the source of truth for "no native interactive elements"; remove or update the line that says "Avoid using raw `<button>`, `<input>`, or `<select>` tags. Use the standardized components in `src/components/`" to reflect that the standardized components ARE react-aria
- [ ] 7.4 Run `npm run spec:validate` and `openspec validate adopt-react-aria --strict`; ensure both pass
- [ ] 7.5 Run `npm run test:all` one final time before requesting review
- [ ] 7.6 Open the PR with bundle-size delta, accessibility test evidence, and the approved UI-delta screenshots in the description; on merge run `/opsx:archive adopt-react-aria` to promote the spec deltas into `openspec/specs/`
