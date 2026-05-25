# ui-shell Specification

## Purpose
The chrome the diff and comments live inside — dashboard (PR list), file explorer, review properties panel, layout grid, status bar, theme handling (dark/light/black/high-contrast), and resizable panes.

## Requirements
### Requirement: Theme Selection
The system SHALL offer the user four visual themes — `dark`, `light`, `black` (pure-black OLED), and `highcontrast` (accessibility) — and SHALL apply the selected theme to every surface of the shell (titlebar, sidebar, panes, file explorer, status bar, dashboard, and the diff/comments surfaces hosted inside it).

#### Scenario: User picks an alternate theme
- **WHEN** the user selects `light` from the theme picker while the app is in the default `dark` theme
- **THEN** all shell chrome (titlebar, sidebar, panes, status bar) and the embedded diff/comment surfaces re-render with the light palette without requiring a page reload

#### Scenario: High-contrast theme for accessibility
- **WHEN** the user selects the `highcontrast` theme
- **THEN** the shell renders with the high-contrast palette so that interactive controls, focus rings, and text meet accessibility contrast needs

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
The system SHALL allow the user to navigate the file explorer entirely from the keyboard: Up and Down move between files, Enter opens the selected file in the diff view, Space toggles the marked state, and Ctrl+C copies the path.

#### Scenario: Arrow keys move selection
- **WHEN** the file explorer has focus and the user presses Down
- **THEN** the selection moves to the next visible node (respecting the active filter), and pressing Up moves it back

#### Scenario: Enter opens the file
- **WHEN** a file is selected in the explorer and the user presses Enter
- **THEN** that file is opened in the main content area's diff view (see capability `diff-viewing`)

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
The system SHALL allow the user to tab between properties and to activate a property's link or action button with Enter, without needing the mouse.

#### Scenario: Tab through properties
- **WHEN** the properties panel has focus
- **THEN** Tab moves focus from one property to the next, and Enter activates the focused property's primary link or action

### Requirement: Dashboard Review List
The system SHALL provide a dashboard surface that lists the user's accessible reviews/pull requests and SHALL allow the user to open a review with Enter, copy its link with Ctrl+C, and remove a subscription with Delete.

#### Scenario: Open selected review from dashboard
- **WHEN** the user selects a review in the dashboard and presses Enter
- **THEN** the application navigates to that review, replacing the dashboard with the review's diff + properties shell

