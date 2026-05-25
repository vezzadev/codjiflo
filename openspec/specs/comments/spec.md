# comments Specification

## Purpose
Inline review comments with bubble layout, threading, resolution state, anchoring to diff lines, visibility filters, and cross-iteration carry-over. Covers connector geometry, draft state, and per-user persistence.

## Requirements
### Requirement: Comment Display Modes
The system SHALL support two comment display modes: bubble mode (floating boxes connected to code by lasso lines) and interlinear mode (inline between code lines). Users MUST be able to switch between the two modes.

#### Scenario: Bubble mode renders floating bubbles with lassos
- **WHEN** a reviewer views a file with comments in bubble mode
- **THEN** each comment thread SHALL render as a floating bubble at the right side of the viewport, visually connected to its anchored code region by a lasso line

#### Scenario: Interlinear mode renders comments inline
- **WHEN** a reviewer switches the display mode to interlinear
- **THEN** comment threads SHALL render inline between the code lines they anchor to, without lasso connectors

### Requirement: Comment Anchoring To Code
The system SHALL anchor every comment thread to a specific location in a file using a tracking span that includes file path, view context (left, right, or both sides of the diff), and a span over the code (which MAY be zero-length for point comments or non-empty for selections).

#### Scenario: Reviewer creates a comment from a non-empty text selection
- **WHEN** a reviewer selects a range of code in a diff and creates a new comment
- **THEN** the system SHALL create a thread whose tracking span exactly matches the selected range, on the side of the diff where the selection was made

#### Scenario: Reviewer creates a comment at a single point
- **WHEN** a reviewer creates a comment without an active text selection (point comment)
- **THEN** the system SHALL create a thread with a zero-length span at the chosen point, displayed using an 8-pointed asterisk marker

### Requirement: Lasso Connector Geometry
The system SHALL render a lasso connector for every visible bubble. For non-empty spans the lasso SHALL highlight the selected code region with a translucent fill and draw a connecting line from the rightmost-bottom point of the highlight to the bubble's left edge. For empty spans the lasso SHALL render an 8-pointed asterisk marker with four cardinal and four diagonal rays.

#### Scenario: Reviewer drags a bubble in bubble mode
- **WHEN** a reviewer drags a bubble to a new position
- **THEN** the lasso connector SHALL update continuously so it always runs from the anchor point on the code to the current bubble edge

#### Scenario: Lasso thickness changes on focus
- **WHEN** a bubble receives focus
- **THEN** its lasso line SHALL render thicker than the unfocused default thickness, returning to the default when focus is lost

### Requirement: Bubble Positioning And Anchoring
The system SHALL position bubbles relative to their anchored code. When the anchored code is visible in the viewport the bubble SHALL anchor to the exact code line. When the anchored code has scrolled out of view the bubble SHALL anchor to the nearest viewport edge and be marked as provisional to indicate that the anchor position is approximate.

#### Scenario: New comment positions at the right edge aligned with anchor
- **WHEN** a new comment thread is created
- **THEN** its bubble SHALL appear at the right edge of the viewport, vertically aligned with the lasso anchor point, with focus given to the comment input

#### Scenario: Anchored code scrolls out of view
- **WHEN** the code a bubble is anchored to scrolls outside the viewport
- **THEN** the bubble SHALL move to anchor against the nearest viewport edge and SHALL be marked as provisional

### Requirement: Bubble Size Constraints
The system SHALL clamp bubble dimensions to a configured minimum and maximum size. Minimum dimensions SHALL ensure basic readability and the maximum dimensions SHALL scale with the viewport so a single bubble never exceeds the visible area.

#### Scenario: Reviewer resizes a bubble below the minimum
- **WHEN** a reviewer drags a bubble edge in a direction that would make the bubble smaller than the configured minimum width or height
- **THEN** the bubble SHALL stop shrinking at the minimum size

#### Scenario: Reviewer resizes a bubble beyond the maximum
- **WHEN** a reviewer drags a bubble edge in a direction that would exceed the configured maximum width or height relative to the viewport
- **THEN** the bubble SHALL stop growing at the maximum size

### Requirement: Bubble Drag And Resize Behavior
The system SHALL allow reviewers to drag bubbles to reposition them and to resize bubbles from any edge. Drag operations MUST be constrained so the bubble stays within the viewport bounds. Resizing from the left or top edge MUST keep the opposite edge anchored in place.

#### Scenario: Reviewer drags a bubble
- **WHEN** a reviewer drags a bubble across the viewport
- **THEN** the bubble SHALL follow the cursor by the drag delta, remain inside the viewport bounds, and update its tracking span so it continues to follow the anchored code

#### Scenario: Reviewer resizes a bubble from the left edge
- **WHEN** a reviewer drags the left edge of a bubble to resize it
- **THEN** the right edge of the bubble SHALL remain fixed while the left edge moves, and the new dimensions SHALL be clamped to the configured min and max bounds

### Requirement: Z-Index Layering On Interaction
The system SHALL allow bubbles to overlap and SHALL bring an interacted bubble to the top of the visual stack. When a reviewer starts dragging or expands a bubble, the system SHALL increment that bubble's z-index so it renders above all other bubbles.

#### Scenario: Overlapping bubble brought to front on drag
- **WHEN** a reviewer starts dragging a bubble that is partially hidden behind another bubble
- **THEN** the dragged bubble's z-index SHALL be incremented so it renders above all other bubbles for the rest of the interaction

### Requirement: Thread Structure And Replies
The system SHALL model each comment thread as a root comment plus zero or more nested replies, where each comment records its author, text body, creation timestamp, last-updated timestamp, withdrawn state, and parent reference. Reviewers MUST be able to reply to existing threads, producing nested comments under the appropriate parent.

#### Scenario: Reviewer replies to an existing thread
- **WHEN** a reviewer submits a reply on an existing thread
- **THEN** the new comment SHALL be appended to the thread with its parent reference set to the comment being replied to, and SHALL appear under the parent in the thread display

#### Scenario: Reviewer toggles between flat and nested display
- **WHEN** a reviewer toggles the thread display option
- **THEN** comments SHALL render either flat in chronological order or nested in hierarchical reply structure according to the selected option

### Requirement: Thread Status Transitions
The system SHALL allow each thread to carry exactly one status from the set supported by the underlying platform (at minimum: Active, Resolved, Closed; additional statuses such as Pending, WontFix, and ByDesign MAY be supported when the platform allows). Changing a thread's status SHALL update the local model, notify the backend, refresh the display, and reapply the current visibility filters.

#### Scenario: Reviewer marks a thread as resolved
- **WHEN** a reviewer changes a thread's status to Resolved
- **THEN** the system SHALL update the thread's stored status, send the status change to the backend, refresh the rendered status, and reapply the active filters (which MAY then hide the thread)

#### Scenario: Status set is constrained by platform
- **WHEN** the underlying review platform supports only a subset of statuses (for example, GitHub or GitLab)
- **THEN** the system SHALL only offer statuses supported by that platform and SHALL not allow transitions into unsupported statuses

### Requirement: Thread Visibility Filters
The system SHALL allow reviewers to filter visible threads by status, by author, and by the iteration in which they were created. Threads that contain unpublished (draft) comments SHALL remain visible regardless of the status filter. A global "hide everything" override SHALL be available to temporarily hide all comment adornments.

#### Scenario: Reviewer hides resolved threads
- **WHEN** the reviewer disables the Resolved status filter
- **THEN** all threads currently in Resolved status SHALL be hidden from the diff view, except threads that contain unpublished draft comments

#### Scenario: Reviewer hides comments from a specific author
- **WHEN** the reviewer adds an author to the hidden-authors filter
- **THEN** all threads whose root comment is authored by that participant SHALL be hidden until the author is removed from the filter

#### Scenario: Global hide override active
- **WHEN** the global hide override is enabled
- **THEN** all bubble and lasso adornments SHALL be hidden until the override is disabled, regardless of per-dimension filters

### Requirement: Collapse And Expand Bubbles
The system SHALL allow reviewers to collapse any bubble into an indicator in a narrow comment margin and to expand it back into a full bubble. The collapsed/expanded state SHALL persist per user across sessions.

#### Scenario: Reviewer collapses a bubble
- **WHEN** a reviewer collapses a bubble
- **THEN** the bubble and its lasso SHALL be removed from view, an indicator SHALL appear in the comment margin, and the collapsed state SHALL be persisted for that reviewer

#### Scenario: Reviewer expands a collapsed thread
- **WHEN** a reviewer activates the margin indicator for a collapsed thread
- **THEN** the indicator SHALL be removed, the lasso geometry SHALL be regenerated, the bubble SHALL be restored at its saved position with z-index brought to the top, and the expanded state SHALL be persisted

### Requirement: Per-User Display State Persistence
The system SHALL persist each user's bubble positions, dimensions, collapse states, and z-indices independently of other users. Different reviewers viewing the same file SHALL see their own layout, and that layout SHALL survive page reloads and session changes.

#### Scenario: Two reviewers customize layouts independently
- **WHEN** two different reviewers reposition and resize bubbles on the same file
- **THEN** each reviewer SHALL see only their own positions and dimensions, and neither SHALL affect the other's layout

#### Scenario: Layout survives session
- **WHEN** a reviewer reopens a file after closing the application or browser
- **THEN** the bubble positions, sizes, collapse states, and z-indices SHALL be restored to the state the reviewer last left them in

### Requirement: Draft Comment Visibility
The system SHALL treat any comment that has not been published as a draft. Threads containing draft comments SHALL always be visible to their author regardless of any active status, author, or iteration filter, so the author cannot accidentally lose track of unpublished work.

#### Scenario: Draft on a thread that would otherwise be filtered out
- **WHEN** a thread has a draft comment authored by the current user and its status would normally be hidden by the active status filter
- **THEN** the thread SHALL still be displayed to the current user with its draft visible

### Requirement: Keyboard Navigation For Comments
The system SHALL support keyboard interaction for comment navigation and editing. Tab SHALL move focus between comment threads, Enter SHALL submit a comment or open a reply, Escape SHALL cancel editing or collapse the current bubble, and Ctrl+Enter SHALL submit the current comment and close its editor.

#### Scenario: Reviewer submits comment with Ctrl+Enter
- **WHEN** a reviewer is editing a comment and presses Ctrl+Enter
- **THEN** the comment SHALL be submitted and the editor SHALL close

#### Scenario: Reviewer cancels editing with Escape
- **WHEN** a reviewer is editing a comment and presses Escape
- **THEN** any unsaved edits SHALL be discarded and the editor SHALL close (or the bubble SHALL collapse if there was nothing to cancel)

### Requirement: Iteration-Aware Comment Carryover
The system SHALL track which iteration each thread was created in and SHALL re-anchor comments across iterations using the tracking spans defined by the `iterations` capability. When the anchored code still exists in a later iteration the thread SHALL re-appear at its updated location; when the anchored code has been deleted the thread SHALL still be reachable through the iteration filter.

#### Scenario: Comment follows edited code into a new iteration
- **WHEN** a reviewer loads a newer iteration in which the code anchored by a thread has been edited but still exists
- **THEN** the thread SHALL be displayed at the updated location of that code, using the tracking span maintained by the iterations capability

#### Scenario: Comment on deleted code remains reachable via iteration filter
- **WHEN** a reviewer loads a newer iteration in which the code anchored by a thread no longer exists
- **THEN** the thread SHALL not display a bubble against the current file content, but SHALL remain visible when the iteration filter is set to include the originating iteration

