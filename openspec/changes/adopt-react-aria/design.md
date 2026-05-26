## Context

CodjiFlo's UI primitives live in `src/components/` (`Button`, `Input`, `Textarea`, `FormField`, `Badge`, `Skeleton`) and are thin wrappers over native HTML with custom CSS classes (`btn`, `btn-colorful`, `textbox`, `form-group`). All higher-level interactive surfaces — `features/theme/components/ThemeModal`, `features/keyboard/components/ShortcutsModal`, `features/diff/components/FileList`, `features/diff/components/DiffToolbar`, `features/diff/components/search/{SearchPanel,GoToLinePanel}`, `features/auth/components/RateLimitBanner`, `features/pr/components/PRHeader` — bolt their own keyboard, focus, and ARIA handling on top of these primitives. Examples of the resulting duplication and gaps:

- `ThemeModal` ships a manual `useEffect`-bound Escape listener, focuses `modalRef.current` once, has no focus trap, no return-focus, no scroll lock, and uses a `<div role="dialog">` rather than a real focus-trapped dialog.
- `Button` takes a `label: string` prop and an `ariaLabel` prop and forwards them to a native `<button>`; it does not centralise focus-visible styling.
- `FormField` reimplements the `htmlFor`/`aria-describedby`/`aria-invalid` plumbing that every accessibility library bundles for free, with no `aria-errormessage` semantics.
- There is no `Tree`, `Popover`, `ToggleButton`, or `SearchField` primitive; consumers ship one-off DOM constructions that are not lint-checked.

The user has chosen [React Aria](https://react-aria.adobe.com/) (Adobe) and explicitly directed: **use react-aria as much as possible; replace components rather than wrap them; small UI changes are acceptable as long as they are reviewed first; do not worry about back-compat.** That steering shapes every decision below.

The project uses React 19, Next.js 15 App Router with Turbopack, TypeScript strict, custom CSS with CSS variables, no Tailwind, Vitest + RTL, Storybook, Playwright. The test suite is fast (E2E budget: 5s/test). All of these are compatible with `react-aria-components`, which is framework-agnostic, SSR-safe, tree-shakeable, and ships render-state data attributes (`data-pressed`, `data-hovered`, `data-focus-visible`, `data-disabled`, `data-invalid`, `data-selected`, `data-expanded`) that our CSS can target directly.

## Goals / Non-Goals

**Goals**

- Use `react-aria-components` as the **default** component layer. Where react-aria-components already provides everything we need, re-export it directly from `src/components/`; only introduce a wrapper when CSS class hooks or domain-specific composition (e.g. our themed Modal/Dialog pair) demand it. Wrappers MUST be the minimum viable layer — they do not exist to preserve old prop shapes.
- Adopt react-aria's idiomatic API at every call site: `onPress` instead of `onClick` (and remove the `onClick`-to-`onPress` bridge entirely), `children` instead of `label`, `isDisabled`/`isInvalid`/`isPressed` instead of bespoke booleans, `errorMessage`/`description` slots instead of `error: string`/`helperText: string` props.
- Delete the current hand-rolled `Button`, `Input`, `Textarea`, `FormField` implementations and the focus/Escape effects in modals; replace, do not wrap.
- Drive ALL interactive-state styling off react-aria render-state data attributes; remove `:hover`/`:active`/`:focus-visible`-only rules on migrated primitives.
- Make any default visual delta react-aria introduces (focus ring approach, modal overlay animation, tree row indent style, SearchField clear-button placement) **explicit and reviewed** with the user before the milestone lands.
- Make accessibility regressions detectable in CI: unit tests assert ARIA contracts and axe-core; Playwright keyboard-only specs catch focus traps and tree navigation.

**Non-Goals**

- **No back-compat shims.** No prop aliases (`label?: string` falling back to `children`). No deprecation comments. No `// kept for compat` notes. When a prop is renamed, every caller is updated in the same change.
- Not introducing Tailwind, CSS-in-JS, or any new styling system. Custom CSS stays.
- Not rewriting the diff viewer's CodeMirror integration — CodeMirror owns its own accessibility model.
- Not a visual redesign. We preserve the look but accept the small deltas react-aria-components introduces by default (subject to the UI-delta review gate).
- Not adopting the entire React Aria ecosystem (DateField, ColorPicker, NumberField, …) — primitives are added only where we already have a usage today or within this change.
- Not preserving the existing primitive prop contract. Existing callers will be updated.

## Decisions

### Decision 1: Use `react-aria-components` directly; wrappers are the exception

**Choice:** `react-aria-components` is the default. For each primitive, decide explicitly:

| Primitive | Decision |
|---|---|
| `Button` | **Wrap** — apply `btn`, `btn-colorful`, `btn-icon` classes. Variants (`primary`/`secondary`) and `size` (`default`/`sm`/`icon`) flow through className. Children, not `label`. `onPress`, not `onClick`. |
| `ToggleButton` | **Re-export** from `react-aria-components`; CSS targets `[data-pressed]`. No wrapper. |
| `TextField` (single-line) | **Re-export** the composition slot pattern (`TextField`, `Label`, `Input`, `Text`, `FieldError`) from `react-aria-components`; document the composition pattern in the architecture sidecar. Optionally provide a `<TextField>`-shaped helper if and only if it removes more code than it adds. |
| `Textarea` | Same as single-line `TextField` but with `TextArea` slot. |
| `Modal` + `Dialog` | **Wrap** — combine `Modal` + `ModalOverlay` + `Dialog` into a single themed `Modal` that applies `modal-overlay` and `modal` classes and handles the dismiss button slot. |
| `Tree` | **Wrap** thinly to apply tree styling classes and the `Pull Request Description` pinned-top behavior. Default to `react-aria-components`'s `Tree`; fall back to `@react-aria/tree` + `@react-stately/tree` hooks only if the spike in task 1.3 proves the components API can't reuse `useFileTree`. |
| `SearchField` | **Re-export** from `react-aria-components`; CSS targets `[data-empty]` to hide the clear control. |
| `Popover` | **Re-export** from `react-aria-components`. |

The bar for keeping a wrapper: it removes duplication every caller would otherwise write. The bar for adding one: same.

**Why:** The user's explicit direction is to use react-aria as much as possible, replacing rather than wrapping. Wrappers exist only where they actually pay for themselves.

**Alternatives considered:**
- *Wrap everything* — was the previous design. Rejected: bakes in indirection forever for no benefit.
- *Re-export everything with zero wrappers* — leaves themed Modal styling and Button class hooks duplicated at every call site. Rejected as too far the other way.

### Decision 2: Adopt react-aria's idiomatic prop API; no back-compat

**Choice:** Every call site changes in this PR. Prop renames:

| Before | After |
|---|---|
| `<Button label="Save" onClick={fn} />` | `<Button onPress={fn}>Save</Button>` |
| `<Button ariaLabel="Close" />` | `<Button aria-label="Close" />` (native attr, react-aria respects it) |
| `<Button disabled />` | `<Button isDisabled />` |
| `<Input label="Email" error="…" helperText="…" />` | `<TextField isInvalid={...}><Label>Email</Label><Input/><Text slot="description">…</Text><FieldError>…</FieldError></TextField>` |
| `<Textarea label="…" error="…" />` | same composition with `TextArea` slot |
| `<Modal isOpen onClose={fn}>` | `<Modal isOpen onOpenChange={fn}>` (react-aria signature) |

No deprecation aliases. No JSDoc-marked "legacy" props. The full call-site sweep is part of this change. The task list pairs each primitive replacement with its caller migration so the working tree never has a half-migrated state.

**Why:** Direct user steering: "dont worry about back-compat." Preserving prop shapes would add a wrapper layer that has to bridge `onClick→onPress`, `label→children`, etc. — exactly the indirection we are deleting.

**Alternatives considered:**
- *Keep the old shape via wrapper props* — rejected per the user's instruction.

### Decision 3: Style react-aria components with our existing CSS via render-state data attributes

**Choice:** Continue to apply our class names (`btn`, `btn-colorful`, `textbox`, `form-group`, `label`, `modal`, `modal-overlay`) on the react-aria components, but rewrite the interactive-state CSS in `src/styles/shared/buttons.css`, `src/styles/shared/controls.css`, and `src/styles/modals/modal-base.css` to target react-aria's data attributes:

- `.btn:hover` → `.btn[data-hovered]`
- `.btn:active` → `.btn[data-pressed]`
- `.btn:focus-visible` → `.btn[data-focus-visible]`
- `.btn:disabled` → `.btn[data-disabled]`
- `.textbox:focus-visible` → `.textbox[data-focus-visible]`
- `.textbox.textbox-error` (and the `textbox-error` class) → `.textbox[data-invalid]` (the `textbox-error` class is removed; react-aria's `isInvalid` flips the data attribute)

CSS variables are unchanged. Pseudo-class-only rules on migrated primitives are deleted.

**Why:** Data attributes capture states pseudo-classes cannot (e.g. `data-pressed` covers keyboard activation, `data-focus-visible` is library-managed and consistent). This is the canonical react-aria styling approach.

### Decision 4: UI-delta review gate before each consumer milestone

**Choice:** Before each milestone that ships react-aria components to production behavior, the agent MUST prepare a short side-by-side comparison (screenshot or DOM diff plus a description) of any visual or behavioral change react-aria introduces by default — focus ring shape and offset, modal overlay animation/easing, dialog dismiss button placement, tree row indent and chevron, SearchField clear control glyph and position, and any spacing change — and present it to the user via `AskUserQuestion` before the milestone commits. The user either approves the delta, requests a CSS tweak to preserve the current look, or rejects and the milestone is rescoped.

This gate is encoded explicitly in `tasks.md` as a checkbox per milestone.

**Why:** Direct user steering: "small ui changes may be acceptable as long as they are reviewed with the user first." We make that review a hard gate so deltas can't slip in silently.

### Decision 5: Aggressive replacement, vertical-slice milestones

**Choice:** Five milestones. Each is a self-contained vertical slice that BOTH adds the react-aria primitive AND removes the old one AND updates every caller AND passes the UI-delta review gate.

1. **Dependencies + Modal/Dialog/ToggleButton/SearchField/Popover** — add the dependency; replace `ThemeModal` and `ShortcutsModal` with `Modal` + `Dialog`; introduce `ToggleButton` and `SearchField` as re-exports (no consumers yet — they ship together with the consumer migration in milestone 3).
2. **Button + every Button caller** — delete the current `Button.tsx`; rewrite over `react-aria-components/Button` with `children`/`onPress`/`isDisabled`. Update every `<Button label={…} onClick={…} />` in `src/app/**` and `src/features/**` in the same PR.
3. **TextField + Textarea + every text-input caller** — delete `Input.tsx`, `Textarea.tsx`, `FormField.tsx`. Update every caller to the `TextField`/`Label`/`Input`/`Text`/`FieldError` composition. `SearchPanel` and `GoToLinePanel` switch to `SearchField` / `TextField`. `DiffToolbar` toggles switch to `ToggleButton`.
4. **Tree + FileList** — replace the file explorer's hand-rolled keyboard model with `Tree`/`TreeItem` (after the milestone-1 spike resolved the `useFileTree` integration approach).
5. **Lint enforcement + sweep + axe coverage + Playwright keyboard E2E** — ship the ESLint rule banning native interactive elements outside `src/components/`, fix any remaining offenders in features/app, add unit-test axe assertions and the two keyboard E2E specs.

**Why:** Each milestone is independently mergeable, the working tree never has a half-migrated state, and the UI-delta review gate fires per milestone rather than once at the end.

### Decision 6: Enforce the primitive boundary with ESLint

**Choice:** Add `eslint-rules/no-native-interactive-elements.js` (CommonJS, mirroring `eslint-rules/one-top-level-test-describe.js`) banning bare `<button>`, `<input>`, `<textarea>`, `<select>`, `<dialog>` inside `src/features/**` and `src/app/**`. Allow them inside `src/components/**`, `**/*.test.tsx`, `**/*.stories.tsx`, and `src/tests/**`. The error message names the replacement (`Button` from `@/components`, `TextField` from `react-aria-components`, etc.).

**Why:** Without enforcement, future code drifts back to native HTML and the migration's value erodes.

### Decision 7: Accessibility verification stack

**Choice:**
- Unit-level: every primitive's Vitest + RTL test asserts core ARIA (`getByRole`, accessible name, render-state data attributes) and runs `@axe-core/react` on the rendered tree, failing on serious/critical violations.
- Storybook: one story per render-state (default, hovered, pressed, focus-visible, disabled, invalid) so visual review can sanity-check; existing Storybook interaction tests verify keyboard activation.
- End-to-end: Playwright specs `e2e/common/stateless-mode/keyboard-modal.spec.ts` (Tab cycle, Escape, return-focus on the Theme modal) and `keyboard-tree.spec.ts` (Up/Down/Left/Right/typeahead/Enter on the file explorer). Both budgeted under 5s.

**Why:** Three complementary layers: unit catches contract regressions; Storybook catches visual regressions; Playwright catches integration regressions. Axe at the unit level is fast (no browser); skipping `@axe-core/playwright` keeps the E2E budget intact.

## Risks / Trade-offs

- **Risk:** Default react-aria visual differences (focus ring style, modal animation, tree indent) silently change the product look. → **Mitigation:** Decision 4's UI-delta review gate makes every default delta explicit; user signs off or asks for a CSS override before the milestone commits.
- **Risk:** Replacing every call site in one milestone makes individual PRs large. → **Mitigation:** Each milestone replaces ONE primitive + its callers, not all primitives at once. Per-milestone PRs stay reviewable. CI runs `npm run test:all` per milestone so each is independently green.
- **Risk:** `react-aria-components/Tree` may not interop cleanly with the existing `useFileTree` store. → **Mitigation:** Milestone-1 spike (task 1.3) resolves this before milestone 4 starts. Fallback: `@react-aria/tree` + `@react-stately/tree` hooks layered onto `useFileTree`. Outcome documented in `openspec/specs/ui-primitives/architecture.md` (the sidecar).
- **Risk:** Bundle size grows. → **Mitigation:** `react-aria-components` is tree-shakeable; importing only Button/TextField/Modal/Dialog/Tree/Popover/ToggleButton/SearchField is on the order of 30 kB gzipped. Verify with `next build` + bundle analyzer at milestone 5; reject if the client growth exceeds 40 kB gzipped.
- **Risk:** Lint rule false positives in test files. → **Mitigation:** Scope the rule to `src/features/**` and `src/app/**`, excluding `*.test.tsx`, `*.stories.tsx`, and `src/tests/**`.
- **Risk:** SSR mismatch with portal-based `Modal`. → **Mitigation:** `react-aria-components` is SSR-safe (`useId`, `useLayoutEffect` shim, deferred portal). Smoke-test in milestone 1; check both `next dev` and `next build && next start`.
- **Risk:** Storybook interaction tests break because the DOM tree shape changes. → **Mitigation:** Audit `Button.stories.test.tsx` and any other story test in the relevant milestone; replace exact-DOM assertions with `getByRole`/`getByLabelText` queries, which are also more resilient.
- **Trade-off:** Updating every caller in the migration PR makes PRs larger than a behind-the-wrapper swap. We accept this because the user explicitly prioritised end-state cleanliness over migration size, and the per-milestone scope keeps individual PRs reviewable.

## Migration Plan

1. **Branch + dependency** — install `react-aria-components` and `@axe-core/react` (dev), commit lockfile, verify `npm run build` and `npm run test:all` baseline-green.
2. **Milestone 1: Modal + Dialog + ToggleButton + SearchField + Popover** — wrap `Modal`/`Dialog` (themed), re-export the rest. Replace `ThemeModal` and `ShortcutsModal` callers in the same milestone; delete their Escape/focus `useEffect`s. UI-delta review gate. Add `keyboard-modal.spec.ts`.
3. **Milestone 2: Button** — delete current `Button.tsx`; rewrite over `react-aria-components/Button`. Update every caller's prop shape (`label`→`children`, `onClick`→`onPress`, `disabled`→`isDisabled`, `ariaLabel`→`aria-label`). UI-delta review gate. Update `Button.test.tsx` and `Button.stories.test.tsx`.
4. **Milestone 3: TextField + Textarea** — delete `Input.tsx`, `Textarea.tsx`, `FormField.tsx`. Update every caller to the composition pattern. Migrate `SearchPanel`/`GoToLinePanel` to `SearchField`/`TextField`; migrate `DiffToolbar` toggles to `ToggleButton`. UI-delta review gate.
5. **Milestone 4: Tree + FileList** — pick the integration approach from the milestone-1 spike outcome. Replace `FileList`'s keyboard handling with `Tree`/`TreeItem`. UI-delta review gate. Add `keyboard-tree.spec.ts`.
6. **Milestone 5: Lint enforcement + sweep + axe + bundle check** — land `eslint-rules/no-native-interactive-elements.js`, fix any remaining offenders (no `eslint-disable`), add `@axe-core/react` unit assertions per primitive, record bundle-size delta in the PR.
7. **Spec promotion** — `/opsx:archive adopt-react-aria` lifts the new capability into `openspec/specs/ui-primitives/spec.md`. Add an architecture sidecar `openspec/specs/ui-primitives/architecture.md` documenting which react-aria components we use, which we wrap and why, the data-attribute styling contract, and the Tree-integration decision from the spike. `openspec/specs/ui-shell/spec.md` is NOT modified — the existing requirements stay valid because the file explorer and properties panel inherit the stricter behavior automatically by consuming `ui-primitives`.

**Rollback strategy:** Each milestone is its own PR. If a milestone causes a regression, revert that single PR; earlier milestones remain. Because there is no back-compat wrapper layer, a revert restores the previous primitive implementation cleanly.

## Open Questions

- Does `react-aria-components/Tree` integrate with `useFileTree` directly, or do we adopt react-aria's `Collection` model and adapt `useFileTree` to it? Resolved by the milestone-1 spike (task 1.3) — outcome recorded in `openspec/specs/ui-primitives/architecture.md`.
- The current `Button.size = "icon"` plus `ariaLabel` pattern: we replace with `<Button aria-label="…" className="btn-icon">…icon…</Button>`. Confirm during the milestone-2 UI-delta review whether to keep the `btn-icon` class or migrate to a dedicated `IconButton` re-export with the class baked in.
- Should the new lint rule live alongside `one-top-level-test-describe.js` or be promoted to an `eslint-plugin-codjiflo` package? Default: keep it inline; revisit at three or more custom rules.
