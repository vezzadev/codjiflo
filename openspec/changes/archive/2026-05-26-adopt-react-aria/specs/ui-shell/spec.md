## ADDED Requirements

### Requirement: Bottom Pane Tabs use react-aria
The system SHALL render the bottom pane's tab strip using the `ui-primitives` `Tabs`, `TabList`, `Tab`, and `TabPanel` components (from `react-aria-components`). The tab list MUST support the standard react-aria keyboard model — Left and Right (or Up and Down for vertical orientation) move between tabs, Home and End jump to the first and last tab — and the active `TabPanel` MUST be focusable so a screen-reader user can move past the tab list into the panel content even when the panel has no inherently focusable children.

#### Scenario: Keyboard navigation between tabs
- **WHEN** the bottom-pane tab list has focus on the Comments tab
- **THEN** pressing Right (or Down) moves focus to the Activity tab and switches the visible panel to Activity; pressing Left (or Up) moves it back; Home and End jump to the first and last tab respectively

#### Scenario: Tab panel is reachable from the keyboard
- **WHEN** the active tab panel has no focusable children (e.g. an empty Activity feed)
- **THEN** the panel's rendered DOM exposes `tabindex="0"` (set automatically by `TabPanel`) so Tab from the tab list lands on the panel content, and axe's `scrollable-region-focusable` rule does not flag it

### Requirement: Bottom Pane is a Landmark
The system SHALL register the bottom pane (the surface that hosts the Comments and Activity tabs) as an ARIA landmark with `role="region"` and an `aria-label` of `"Discussion"`, using the `ui-primitives` `useLandmark` hook so the pane participates in F6 landmark cycling alongside the file-explorer navigation and the main content area.

#### Scenario: F6 cycles to the discussion pane
- **WHEN** the user is anywhere on a PR page and presses F6
- **THEN** focus advances to the next landmark in document order; one of the stops is the bottom-pane discussion region whose accessible name is `"Discussion"`

#### Scenario: All page content is inside a landmark
- **WHEN** axe-core runs the `region` rule against the rendered PR page
- **THEN** no top-level content sits outside a landmark (the bottom pane is no longer flagged)

### Requirement: PR Page exposes a level-one heading
The system SHALL render exactly one level-one heading (`<h1>`) on each PR page that identifies the pull request (e.g. `"PR #219: feat: store artifact ID in PR comment for direct download"`). The heading MAY be visually hidden via the existing `.sr-only` utility so the page chrome is unaffected; assistive technology MUST be able to discover and announce it.

#### Scenario: Page has an h1
- **WHEN** the PR page is rendered for a known PR
- **THEN** the document contains a single `<h1>` whose text includes the PR number and title, and axe-core's `page-has-heading-one` rule passes

### Requirement: Diff editor exposes an accessible name
The system SHALL provide an `aria-label` on the CodeMirror editor surface (`.cm-content`, which carries `role="textbox"`) that names the file currently being viewed (e.g. `"Diff for src/foo.ts"`). The label MUST update when the user opens a different file.

#### Scenario: Editor has an accessible name
- **WHEN** the user opens `src/foo.ts` from the file explorer
- **THEN** the CodeMirror editor's `aria-label` reads `"Diff for src/foo.ts"`, axe-core's `aria-input-field-name` rule passes, and switching to a different file updates the label without requiring a remount

### Requirement: High-contrast theme for accessibility
The system SHALL provide a high-contrast theme variant whose palette guarantees that interactive controls, focus rings, text, and error states meet WCAG 2.1 AA contrast against their surrounding surfaces. The focus indicator MUST be driven by the `ui-primitives` focus-visible data attribute (`[data-focus-visible]`) so every primitive component receives the same indicator consistently.

#### Scenario: User picks the high-contrast theme
- **WHEN** the user selects `high-contrast` from the theme picker
- **THEN** the shell re-renders with the high-contrast palette without a reload, and a quick keyboard tab across the titlebar, file explorer, toolbar, and properties panel reveals a visible focus indicator on every primitive

#### Scenario: Focus indicator contrast holds across themes
- **WHEN** the focus indicator is rendered on a `Button`, `TextField`, or `Tree` node in any of the four themes (`dark`, `light`, `black`, `high-contrast`)
- **THEN** the indicator's contrast ratio against the immediately surrounding background is at least 3:1 (the WCAG 2.1 AA non-text minimum)

## MODIFIED Requirements

### Requirement: Theme Selection
The system SHALL offer the user four visual themes — `dark`, `light`, `black` (pure-black OLED), and `highcontrast` (accessibility) — and SHALL apply the selected theme to every surface of the shell (titlebar, sidebar, panes, file explorer, status bar, dashboard, and the diff/comments surfaces hosted inside it). Detailed accessibility requirements for the `highcontrast` variant are covered by the standalone `High-contrast theme for accessibility` requirement.

#### Scenario: User picks an alternate theme
- **WHEN** the user selects `light` from the theme picker while the app is in the default `dark` theme
- **THEN** all shell chrome (titlebar, sidebar, panes, status bar) and the embedded diff/comment surfaces re-render with the light palette without requiring a page reload

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
- **WHEN** a property receives keyboard focus while the active theme is `dark`, `light`, `black`, or `high-contrast`
- **THEN** the property renders the standard focus indicator at WCAG 2.1 AA contrast against the panel background
