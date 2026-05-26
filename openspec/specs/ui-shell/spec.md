# ui-shell Specification

## Purpose
The chrome the diff and comments live inside — dashboard (PR list), file explorer, review properties panel, layout grid, status bar, theme handling (dark/light/black/high-contrast), and resizable panes.
## Requirements
### Requirement: Theme Selection
The system SHALL offer the user four visual themes — `dark`, `light`, `black` (pure-black OLED), and `highcontrast` (accessibility) — and SHALL apply the selected theme to every surface of the shell (titlebar, sidebar, panes, file explorer, status bar, dashboard, and the diff/comments surfaces hosted inside it). Detailed accessibility requirements for the `highcontrast` variant are covered by the standalone `High-contrast theme for accessibility` requirement.

#### Scenario: User picks an alternate theme
- **WHEN** the user selects `light` from the theme picker while the app is in the default `dark` theme
- **THEN** all shell chrome (titlebar, sidebar, panes, status bar) and the embedded diff/comment surfaces re-render with the light palette without requiring a page reload

### Requirement: Theme Persistence
The system SHALL persist the user's theme selection across sessions so that returning users see the same theme they last chose.

#### Scenario: Theme survives reload
- **WHEN** the user selects a theme, closes the browser tab, and reopens the application
- **THEN** the previously selected theme is applied on the first paint, with no flash of the default theme

### Requirement: Desktop-Style Layout Shell
The system SHALL present a desktop-style window layout composed of a titlebar at the top, a resizable left pane, a main content area, and a resizable bottom pane, with the diff/comments capabilities hosted inside the main content area.

#### Scenario: Default layout on first visit
- **WHEN** a user opens the application for the first time
- **THEN** they see a titlebar, a left pane at the default width, a main content area filling remaining horizontal space, and a bottom pane at the default height

### Requirement: Resizable Panes
The system SHALL let the user resize the left pane and the bottom pane by dragging their resize handles, and SHALL clamp each dimension to a sensible minimum and maximum so neither pane can collapse the rest of the layout.

#### Scenario: User drags the left pane wider
- **WHEN** the user drags the left pane's resize handle to the right
- **THEN** the left pane grows, the main content area shrinks accordingly, and the new width is retained for the rest of the session

#### Scenario: Resize is bounded
- **WHEN** the user attempts to drag a pane beyond its minimum or maximum bound
- **THEN** the pane stops at the bound rather than collapsing or covering the whole window

### Requirement: Layout Persistence
The system SHALL persist the left pane width and the bottom pane height across sessions.

#### Scenario: Pane sizes survive reload
- **WHEN** the user resizes the left and bottom panes and later reopens the app
- **THEN** the panes are restored to the user's last chosen dimensions

### Requirement: File Explorer Tree
The system SHALL present, in the left pane, a hierarchical tree of the files touched by the current review, plus a fixed top-level "Pull Request Description" / discussion node that is always visible regardless of filtering.

#### Scenario: Files grouped under their folders
- **WHEN** the active review touches files in nested directories
- **THEN** the file explorer renders the files grouped under their folder nodes, with folders that can be expanded and collapsed

#### Scenario: Discussion node is always shown
- **WHEN** the file explorer is rendered for any review
- **THEN** the discussion / PR description entry appears at the top of the tree and remains visible even when a filter is active

### Requirement: File Change Indicators
For every file node, the system SHALL indicate the kind of change it represents — at minimum: added, deleted, edited, renamed, moved, rename+edit, and move+edit — so the user can recognise the change type without opening the diff.

#### Scenario: Renamed-and-edited file is distinguished
- **WHEN** a file in the review was both renamed and modified
- **THEN** the file explorer shows it with an indicator that communicates "rename + edit", distinct from a plain rename and from a plain edit

### Requirement: File Marking
The system SHALL let the user mark and unmark individual files as "needs attention", SHALL persist that marked state for the duration of the review session, and SHALL aggregate a folder's mark status from its children as `none`, `partial`, or `all`.

#### Scenario: Mark and unmark a file
- **WHEN** the user toggles the mark on a file
- **THEN** the file shows the marked indicator, and toggling again removes it

#### Scenario: Folder reflects partial mark state
- **WHEN** only some of a folder's children are marked
- **THEN** the folder is shown in the partial mark state, distinct from "all marked" and "none marked"

### Requirement: File Explorer Filter
The system SHALL provide a filename filter inline in the file explorer header that performs a case-insensitive substring match in real time, that exposes a clear control while text is present, and that is cleared (with the input blurred) when the user presses Escape.

#### Scenario: User types to narrow the list
- **WHEN** the user types a substring into the filter input
- **THEN** only files whose names contain that substring (case-insensitive) remain visible, and the discussion node remains visible

#### Scenario: Escape clears the filter
- **WHEN** the filter input has text and the user presses Escape
- **THEN** the filter is cleared, the input loses focus, and the full file list is restored

### Requirement: File Explorer Context Actions
For each file node, the system SHALL offer at minimum the following actions: mark/unmark, copy path, copy file name, open containing folder, compare in external diff tool, and open the left or right version.

#### Scenario: Copy file path
- **WHEN** the user invokes "Copy Path" on a file
- **THEN** the file's path is placed on the clipboard

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

### Requirement: Review Properties Panel
The system SHALL display, alongside the file explorer, a properties surface that lists review-level metadata and iteration-level metadata in two distinct sections, where each entry has a caption, a display value, optional tooltips, optional links on the caption and on the value, and an optional action button.

#### Scenario: Review and iteration sections are separate
- **WHEN** the active review exposes both review-level properties and iteration-level properties
- **THEN** they appear under two clearly labelled sections, with the iteration section titled after the active iteration (e.g. "Iteration N")

#### Scenario: Property action button
- **WHEN** a property exposes an enabled action button and the user activates it
- **THEN** the associated action runs, and while it is in flight the UI reflects that the action is in progress

### Requirement: Property Status Colour
The system SHALL render each review/iteration property with a status colour drawn from a fixed palette (success, warning, error, pending, custom) so the user can scan health at a glance.

#### Scenario: Failing build property
- **WHEN** a property reports an error status
- **THEN** it is rendered in the error colour, visually distinct from success, warning, and pending properties

### Requirement: Review Properties Keyboard Access
The system SHALL allow the user to tab between properties and to activate a property's link or action button with Enter or Space, without needing the mouse. Each focusable property MUST render a visible focus indicator meeting WCAG 2.1 AA contrast in every theme, and any action button on a property MUST be implemented via the `ui-primitives` `Button` so the accessibility contract (keyboard activation, focus-visible state, accessible name) is identical to other buttons in the app.

#### Scenario: Tab through properties
- **WHEN** the properties panel has focus
- **THEN** Tab moves focus from one property to the next, Shift+Tab moves it back, Enter activates the focused property's primary link, and Space activates the focused property's action button when present

#### Scenario: Focus indicator is visible in every theme
- **WHEN** a property receives keyboard focus while the active theme is `dark`, `light`, `black`, or `high-contrast`
- **THEN** the property renders the standard focus indicator at WCAG 2.1 AA contrast against the panel background

### Requirement: Dashboard Review List
The system SHALL provide a dashboard surface that lists the user's accessible reviews/pull requests and SHALL allow the user to open a review with Enter, copy its link with Ctrl+C, and remove a subscription with Delete.

#### Scenario: Open selected review from dashboard
- **WHEN** the user selects a review in the dashboard and presses Enter
- **THEN** the application navigates to that review, replacing the dashboard with the review's diff + properties shell

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

