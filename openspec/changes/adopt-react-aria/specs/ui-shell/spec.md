## MODIFIED Requirements

### Requirement: File Explorer Keyboard Navigation
The system SHALL allow the user to navigate the file explorer entirely from the keyboard using the standard tree-view interaction model exposed by the `ui-primitives` `Tree` component: Up and Down move between visible nodes, Left collapses an expanded folder or moves to the parent of a leaf, Right expands a collapsed folder or moves into its first child, Home and End jump to the first and last visible nodes, printable-character typeahead jumps to the next node whose label starts with the typed prefix, Enter opens the selected file in the diff view, Space toggles the marked state, and Ctrl+C copies the path. The file explorer MUST expose tree semantics (`role="tree"`, `treeitem`, `aria-level`, `aria-expanded`, `aria-selected`) and MUST render a visible focus indicator that meets WCAG 2.1 AA contrast in every theme.

#### Scenario: Arrow keys move selection
- **WHEN** the file explorer has focus and the user presses Down
- **THEN** the selection moves to the next visible node (respecting the active filter), and pressing Up moves it back

#### Scenario: Left and Right collapse and expand folders
- **WHEN** an expanded folder node is focused and the user presses Left
- **THEN** the folder collapses; pressing Right on a collapsed folder expands it; pressing Right on an already-expanded folder moves focus to its first child; pressing Left on a leaf or already-collapsed folder moves focus to the parent

#### Scenario: Typeahead jumps to a file
- **WHEN** the file explorer has focus and the user types one or more printable characters
- **THEN** selection jumps to the next visible node whose label starts with the accumulated prefix (case-insensitive), and the prefix resets after a brief pause

#### Scenario: Enter opens the file
- **WHEN** a file is selected in the explorer and the user presses Enter
- **THEN** that file is opened in the main content area's diff view (see capability `diff-viewing`)

#### Scenario: Tree exposes tree semantics to assistive technology
- **WHEN** the file explorer renders
- **THEN** its container has `role="tree"`, each node has `role="treeitem"` with correct `aria-level` and (for folders) `aria-expanded`, and the selected node carries `aria-selected="true"`

### Requirement: Review Properties Keyboard Access
The system SHALL allow the user to tab between properties and to activate a property's link or action button with Enter or Space, without needing the mouse. Each focusable property MUST render a visible focus indicator meeting WCAG 2.1 AA contrast in every theme, and any action button on a property MUST be implemented via the `ui-primitives` `Button` so the accessibility contract (keyboard activation, focus-visible state, accessible name) is identical to other buttons in the app.

#### Scenario: Tab through properties
- **WHEN** the properties panel has focus
- **THEN** Tab moves focus from one property to the next, Shift+Tab moves it back, Enter activates the focused property's primary link, and Space activates the focused property's action button when present

#### Scenario: Focus indicator is visible in every theme
- **WHEN** a property receives keyboard focus while the active theme is dark, light, black, or high-contrast
- **THEN** the property renders the standard focus indicator at WCAG 2.1 AA contrast against the panel background

### Requirement: High-contrast theme for accessibility
The system SHALL provide a high-contrast theme variant whose palette guarantees that interactive controls, focus rings, text, and error states meet WCAG 2.1 AA contrast against their surrounding surfaces. The focus indicator MUST be driven by the `ui-primitives` focus-visible data attribute (`[data-focus-visible]`) so every primitive component receives the same indicator consistently.

#### Scenario: User picks the high-contrast theme
- **WHEN** the user selects `high-contrast` from the theme picker
- **THEN** the shell re-renders with the high-contrast palette without a reload, and a quick keyboard tab across the titlebar, file explorer, toolbar, and properties panel reveals a visible focus indicator on every primitive

#### Scenario: Focus indicator contrast holds across themes
- **WHEN** the focus indicator is rendered on a `Button`, `Input`, or `Tree` node in any of the four themes
- **THEN** the indicator's contrast ratio against the immediately surrounding background is at least 3:1 (the WCAG 2.1 AA non-text minimum)
