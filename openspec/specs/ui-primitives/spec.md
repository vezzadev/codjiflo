# ui-primitives Specification

## Purpose
TBD - created by archiving change adopt-react-aria. Update Purpose after archive.
## Requirements
### Requirement: Primitive Component Layer
The system SHALL source every user-facing interactive widget — buttons, text inputs, multi-line inputs, modals/dialogs, tree views, search fields, toggle buttons, and popovers — from `react-aria-components` (either re-exported directly from `src/components/` or behind a minimal CSS-only wrapper). Application code (pages, feature components, stories) MUST NOT render bare native `<button>`, `<input>`, `<textarea>`, `<select>`, or `<dialog>` elements outside of `src/components/`, and MUST NOT introduce a parallel hand-rolled primitive (e.g. a custom focus-trapping dialog or a custom keyboard-driven tree).

#### Scenario: Feature code consumes the primitive layer
- **WHEN** a feature component needs a clickable action (e.g. "Apply theme")
- **THEN** it imports `Button` from the primitives barrel `@/components` and does not render a raw `<button>` element

#### Scenario: Lint rejects native interactive elements
- **WHEN** a developer writes `<button onClick={...}>` inside `src/features/` or `src/app/`
- **THEN** lint fails with a rule pointing at the corresponding primitive component (and the same applies to `<input>`, `<textarea>`, `<select>`, `<dialog>`)

### Requirement: Button Primitive
The system SHALL provide a `Button` primitive that, in addition to its visual variants (`primary`, `secondary`) and sizes (`default`, `sm`, `icon`), exposes the accessibility contract of a native button while remaining keyboard-, pointer-, and touch-driven: it MUST be activatable with Enter and Space, MUST emit a focus-visible state distinguishable from hover, MUST forward the `isDisabled` prop to assistive technology, and MUST accept an explicit accessible name for icon-only variants.

#### Scenario: Keyboard activation
- **WHEN** the button has keyboard focus and the user presses Space or Enter
- **THEN** the button's press handler fires exactly once, and the press is announced by the underlying primitive (no synthetic click bridge)

#### Scenario: Icon-only button has an accessible name
- **WHEN** a button is rendered in icon size with no visible label
- **THEN** the rendered DOM exposes an accessible name (via `aria-label` or `aria-labelledby`) so screen readers can announce its purpose

#### Scenario: Disabled state blocks interaction
- **WHEN** `isDisabled` is true
- **THEN** the button does not fire its press handler on click, Enter, or Space, and assistive technology announces it as disabled

#### Scenario: Focus-visible state styles separately from hover
- **WHEN** the button receives focus via keyboard
- **THEN** it renders the focus-visible style; hovering with a pointer alone MUST NOT trigger the focus-visible style

### Requirement: Text Field Primitive
The system SHALL provide single-line and multi-line text field primitives built on `react-aria-components`'s `TextField` composition (`TextField` + `Label` + `Input`/`TextArea` + `Text` + `FieldError`), wiring label, description, and error into the field with a single shared identity. The primitive MUST expose validation state to assistive technology, announce errors via the polite live region react-aria provides, and present an idiomatic react-aria API (e.g. `isInvalid`, `errorMessage`, `description`, `validate`) rather than the previous bespoke `error: string` / `helperText: string` props.

#### Scenario: Label is programmatically associated with the field
- **WHEN** a `TextField` renders with a child `Label` slot wrapping its `Input` (or `TextArea`) slot
- **THEN** the composition wires the association without explicit `htmlFor`/`id` plumbing at the call site: clicking the rendered Label focuses the Input, and the rendered DOM exposes the Label text as the field's accessible name

#### Scenario: Error is announced and described
- **WHEN** a `TextField` is rendered with `isInvalid` and a child `FieldError` slot containing the error text
- **THEN** the field's invalid state is exposed (`aria-invalid="true"` and `[data-invalid]`), the `FieldError` content is referenced as the field's description (`aria-describedby`), and the error region is announced via the polite live region react-aria provides

#### Scenario: Helper text is exposed when no error
- **WHEN** a `TextField` is rendered with a child `<Text slot="description">` and is NOT in the invalid state
- **THEN** the description text is referenced as the field's description (`aria-describedby` points at the `Text` slot) and is NOT announced as an error

### Requirement: Modal / Dialog Primitive
The system SHALL provide a `Modal` + `Dialog` primitive pair that traps focus inside the dialog, restores focus to the trigger element on dismiss, locks background scroll while open, dismisses on Escape and on overlay click (when dismissible), exposes a labelled dialog role to assistive technology, and renders inside a portal so its stacking context is independent of its ancestor.

#### Scenario: Focus is trapped while the dialog is open
- **WHEN** a dialog is open and the user presses Tab repeatedly
- **THEN** focus cycles through the dialog's focusable descendants and never escapes to elements behind the overlay

#### Scenario: Focus is restored on dismiss
- **WHEN** the user dismisses the dialog (Escape, close button, or overlay click)
- **THEN** focus returns to the element that opened the dialog

#### Scenario: Background scroll is locked
- **WHEN** the dialog is open
- **THEN** scrolling the page behind the overlay has no effect, and scrolling resumes after dismiss

#### Scenario: Dialog has an accessible name
- **WHEN** a dialog is rendered with a heading
- **THEN** the dialog's accessible name reflects that heading (`aria-labelledby` to the heading element)

### Requirement: Tree View Primitive
The system SHALL provide a `Tree` primitive supporting hierarchical items with expand/collapse, single selection, the standard tree keyboard model (Up/Down to move, Left to collapse or move to parent, Right to expand or move to first child, Home/End to jump, typeahead to select by name), and accessible roles (`tree`, `treeitem`, `group`).

#### Scenario: Arrow keys navigate the tree
- **WHEN** a tree has focus and the user presses Down
- **THEN** focus moves to the next visible node; Up moves it back; Right expands a collapsed parent or moves into the first child of an expanded parent; Left collapses an expanded parent or moves to the parent of a leaf

#### Scenario: Typeahead jumps to a matching node
- **WHEN** the user types a printable character while the tree has focus
- **THEN** focus jumps to the next visible node whose label starts with that character (case-insensitive), and continuing to type extends the search prefix

#### Scenario: Tree exposes tree semantics
- **WHEN** the tree renders
- **THEN** the root has role `tree`, each node has role `treeitem` with `aria-level`, `aria-expanded` (when it has children), and `aria-selected` reflecting selection state

### Requirement: Search Field Primitive
The system SHALL provide a `SearchField` primitive with an integrated clear control that appears while text is present and clears the value on activation, supports Escape to clear and blur, and exposes the search role to assistive technology.

#### Scenario: Clear control resets the field
- **WHEN** the search field contains text and the user clicks the clear control or presses Escape
- **THEN** the field's value resets to empty, the clear control hides, and the consumer's `onChange` receives the empty value

#### Scenario: Search role is exposed
- **WHEN** the search field renders
- **THEN** the input exposes `role="searchbox"` (or its equivalent native `type="search"` semantics) so assistive technology announces it as a search input

### Requirement: Toggle Button Primitive
The system SHALL provide a `ToggleButton` primitive that exposes a pressed state to assistive technology, toggles on Enter/Space, and renders distinct styles for pressed vs unpressed using the library's pressed-state data attribute.

#### Scenario: Pressed state is exposed
- **WHEN** a toggle button is in the pressed state
- **THEN** its rendered DOM exposes `aria-pressed="true"` and the styling reflects the pressed state via the documented data attribute (`[data-pressed]`)

### Requirement: Popover Primitive
The system SHALL provide a `Popover` primitive anchored to a trigger element that positions itself with collision detection, dismisses on Escape and on outside click, restores focus to the trigger on dismiss, and exposes an accessible relationship between trigger and popover content.

#### Scenario: Popover opens anchored to its trigger
- **WHEN** a popover is opened by activating its trigger
- **THEN** the popover renders positioned next to the trigger, flipping or shifting when the viewport would clip it

#### Scenario: Outside click dismisses the popover
- **WHEN** the popover is open and the user clicks outside it
- **THEN** the popover closes and focus returns to the trigger

### Requirement: Focus Indicator
The system SHALL render a visible focus indicator on every focusable primitive whenever focus is reached via keyboard, using the library's focus-visible data attribute (`[data-focus-visible]`) targeted from CSS, and the indicator MUST meet WCAG 2.1 AA contrast against the surrounding surface in every theme (dark, light, black, high-contrast).

#### Scenario: Tabbing reveals the indicator
- **WHEN** the user moves focus with the Tab key
- **THEN** the newly focused primitive renders the focus indicator and the previously focused primitive removes it

#### Scenario: Mouse focus does not show the indicator
- **WHEN** the user clicks a primitive with the mouse
- **THEN** the primitive does not render the focus-visible indicator unless focus subsequently moves via keyboard

### Requirement: Themed Component Styling
The primitive layer SHALL preserve CodjiFlo's CSS-variable theming and visual design by applying the project's existing class hooks (`btn`, `btn-colorful`, `btn-icon`, `textbox`, `form-group`, `label`, `modal`, `modal-overlay`, etc.) to react-aria components, and by driving ALL interactive-state styling (hover, press, focus-visible, disabled, invalid, selected, expanded) off react-aria's render-state data attributes — never off CSS pseudo-classes like `:hover`, `:active`, or `:focus-visible` alone.

#### Scenario: Project class hooks apply to react-aria components
- **WHEN** a `Button` is rendered with the primary variant
- **THEN** the rendered element carries the `btn-colorful` class so CSS in `src/styles/shared/buttons.css` continues to style it without any visual regression

#### Scenario: State data attributes drive interactive styling
- **WHEN** a `Button`, `TextField`, or `TreeItem` is in the hovered, pressed, focus-visible, disabled, invalid, selected, or expanded state
- **THEN** the rendered element exposes the corresponding `data-*` attribute, and the project's CSS targets that attribute exclusively to render the state (no `:hover`/`:active`/`:focus-visible`-only rules remain on these primitives)

### Requirement: Accessibility Test Coverage
The system SHALL include automated accessibility checks for the primitive layer: every primitive's unit tests MUST assert its core ARIA contract (role, accessible name, state attributes), AND keyboard-only end-to-end tests MUST cover modal focus trapping, tree navigation, and toggle button activation.

#### Scenario: Primitive unit test asserts ARIA contract
- **WHEN** the `Button` primitive's test suite runs
- **THEN** it asserts the rendered element has `role="button"`, an accessible name, and that `isDisabled` propagates to `[data-disabled]` and the native disabled state — failing a primitive change that drops these would fail the build

#### Scenario: Keyboard-only end-to-end test covers a modal
- **WHEN** the Playwright suite opens the theme modal using keyboard activation alone
- **THEN** Tab cycles inside the modal, Escape closes it, and focus returns to the trigger button — verified without any mouse interaction

