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

#### Scenario: Single-line comment on added line anchors to right side
- **WHEN** a reviewer creates a single-line comment whose anchor falls on a line that exists only on the post-change side of the diff
- **THEN** the system SHALL persist the thread with its `viewContext` set to `RightOnly` and render the bubble exclusively against the right side of the diff

#### Scenario: Single-line comment on deleted line anchors to left side
- **WHEN** a reviewer creates a single-line comment whose anchor falls on a line that exists only on the pre-change side of the diff
- **THEN** the system SHALL persist the thread with its `viewContext` set to `LeftOnly` and render the bubble exclusively against the left side of the diff

#### Scenario: Comment on unchanged context line is visible on both sides
- **WHEN** a reviewer creates a comment on a context line that appears identically on both sides of the diff
- **THEN** the system SHALL persist the thread with its `viewContext` set to `Both` and render the bubble in both the left and right side views

#### Scenario: Character-level comment selection
- **WHEN** a reviewer selects a sub-line character range (for example characters 47 through 73 on line 3) and creates a comment
- **THEN** the tracking span SHALL record both start and end positions at character granularity and the lasso highlight SHALL cover exactly those characters

#### Scenario: Multi-line range comment
- **WHEN** a reviewer selects a range spanning multiple whole lines (for example line 6 through line 8) and creates a comment
- **THEN** the tracking span SHALL cover every line in the selection inclusive and the lasso highlight SHALL span the full multi-line region

#### Scenario: Comment spans partial characters across two lines
- **WHEN** a reviewer selects a range that starts at a sub-line offset on one line and ends at a sub-line offset on a later line (for example line 9 offset 30 through line 10 offset 15)
- **THEN** the tracking span SHALL preserve both endpoints exactly and the lasso SHALL render a cross-line highlight bounded by the partial-character endpoints

### Requirement: Cross-Line-Type Comment Spans
The system SHALL support comment spans that cross between line types (unchanged context, added, and deleted lines) within the same diff. The lasso geometry MUST highlight the entire spanned region across the side(s) the span occupies, without splitting the comment into separate threads.

#### Scenario: Span crosses from unchanged into deleted lines
- **WHEN** a reviewer selects a range that begins on an unchanged context line and ends on a deleted line
- **THEN** the thread SHALL be anchored on the left side of the diff with a single span covering both the context and deleted portions

#### Scenario: Span crosses from unchanged into added lines
- **WHEN** a reviewer selects a range that begins on an unchanged context line and ends on an added line
- **THEN** the thread SHALL be anchored on the right side of the diff with a single span covering both the context and added portions

#### Scenario: Span crosses from added into unchanged lines
- **WHEN** a reviewer selects a range that begins on an added line and ends on an unchanged context line
- **THEN** the thread SHALL be anchored on the right side of the diff with a single span covering both the added and context portions

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

#### Scenario: Three-level deep reply chain preserves parent linkage
- **WHEN** a thread contains a root comment, a reply to the root, and a further reply to that reply
- **THEN** each non-root comment SHALL carry a parent reference to the comment it replies to, and the nested display SHALL render the comments indented at depths 0, 1, and 2 respectively

#### Scenario: Multiple parallel threads on the same line
- **WHEN** two or more distinct threads are anchored to the same line of the same file
- **THEN** each thread SHALL retain its own identity, status, and reply chain, and the system SHALL render each thread independently rather than merging them

### Requirement: Thread Status Transitions
The system SHALL allow each thread to carry exactly one status from the set supported by the underlying platform (at minimum: Active, Resolved, Closed; additional statuses such as Pending, WontFix, and ByDesign MAY be supported when the platform allows). Changing a thread's status SHALL update the local model, notify the backend, refresh the display, and reapply the current visibility filters.

#### Scenario: Reviewer marks a thread as resolved
- **WHEN** a reviewer changes a thread's status to Resolved
- **THEN** the system SHALL update the thread's stored status, send the status change to the backend, refresh the rendered status, and reapply the active filters (which MAY then hide the thread)

#### Scenario: Status set is constrained by platform
- **WHEN** the underlying review platform supports only a subset of statuses (for example, GitHub or GitLab)
- **THEN** the system SHALL only offer statuses supported by that platform and SHALL not allow transitions into unsupported statuses

#### Scenario: Active is the default thread status
- **WHEN** a reviewer creates a new comment thread without specifying a status
- **THEN** the thread SHALL be persisted with status `Active`, representing an open discussion

#### Scenario: Resolved status indicates author-acknowledged fix
- **WHEN** a thread is transitioned to the `Resolved` status (semantically "Fixed" on platforms that distinguish it)
- **THEN** the system SHALL treat the thread as resolved for visibility filtering and SHALL display a resolved indicator on the bubble

#### Scenario: WontFix status indicates acknowledged-but-declined
- **WHEN** a thread is transitioned to `WontFix`
- **THEN** the system SHALL display the thread as acknowledged-but-declined and SHALL treat it as resolved for comment-resolution gating

#### Scenario: Closed status indicates ended discussion
- **WHEN** a thread is transitioned to `Closed`
- **THEN** the system SHALL treat the discussion as ended for visibility filtering and SHALL not allow further status transitions other than re-opening to `Active`

#### Scenario: ByDesign status only on platforms that support it
- **WHEN** a reviewer attempts to set `ByDesign` on a thread
- **THEN** the system SHALL permit the transition only when `ByDesign` is present in the platform's `selectableThreadStatuses` (Azure DevOps only) and SHALL reject the transition on other platforms

#### Scenario: Pending status indicates awaiting response
- **WHEN** a thread is transitioned to `Pending`
- **THEN** the system SHALL display the thread as awaiting a response from another participant and SHALL NOT treat it as resolved

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

#### Scenario: Comment position preserved when file is unchanged in later iteration
- **WHEN** a comment is created on an iteration and the anchored file is unchanged in a later iteration
- **THEN** the comment SHALL appear at the same line and column in the later iteration with no repositioning

#### Scenario: Comment follows code movement when surrounding code is modified
- **WHEN** a comment is anchored to code that is preserved verbatim but shifted to a different line number by surrounding edits in a later iteration
- **THEN** the system SHALL re-anchor the comment to the new line via the iteration-supplied tracking span without losing the thread

#### Scenario: Comment on deleted code shows on the deleted line side
- **WHEN** the code anchored by a comment is deleted in a later iteration
- **THEN** the thread SHALL render anchored to the deleted line on the left side of the diff for the iteration where the deletion occurred

#### Scenario: Comment orphaned when its file is deleted in a later iteration
- **WHEN** the file containing a commented thread is deleted in a later iteration
- **THEN** the thread SHALL be marked as orphaned, SHALL remain viewable via the iteration filter for the iteration where it was created, and SHALL NOT prevent loading of the later iteration

#### Scenario: Comment survives a force-push that rewrites history
- **WHEN** the branch is force-pushed (amend, rebase, or reset) such that the commit SHA referenced by a thread no longer exists
- **THEN** the thread SHALL persist via its iteration identity rather than its commit SHA and SHALL re-anchor to the equivalent code in the new iteration when possible

#### Scenario: Comment tracks through a file rename
- **WHEN** a file is renamed (or moved to a new directory) between iterations and a thread was anchored to a line in the original file
- **THEN** the thread SHALL be re-attached to the renamed/moved file using the iterations capability's rename-tracking identifier, preserving its anchored line

#### Scenario: Comment tracks through a rename combined with content edits
- **WHEN** a single iteration both renames a file and modifies its contents
- **THEN** the thread SHALL be re-attached to the new filename and re-anchored to the updated line position in a single carryover step

#### Scenario: Comment survives a merge commit integrated into the branch
- **WHEN** the branch incorporates a merge commit from another branch in a later iteration
- **THEN** threads anchored to code preserved through the merge SHALL re-appear at their post-merge positions

#### Scenario: Comment re-anchors after a rebase shifts line positions
- **WHEN** the branch is rebased onto an updated base such that new lines from the base shift the position of commented code
- **THEN** each thread SHALL re-anchor to its commented code's new position in the post-rebase iteration

#### Scenario: Comment trackable forward through many iterations
- **WHEN** a comment is created on a mid-history iteration and the reviewer navigates to the latest iteration after many subsequent edits
- **THEN** the thread SHALL be re-anchored using the chained tracking spans without losing its connection to the original code

#### Scenario: Comment on code referencing a garbage-collected commit
- **WHEN** the commit SHA referenced by a thread has been garbage-collected from the remote repository
- **THEN** the thread SHALL remain viewable using the content preserved in the iteration artifact, displayed with a warning indicating the underlying commit is no longer available

### Requirement: Comments On File-Lifecycle Changes
The system SHALL support creating and displaying comments on files that are added, deleted, renamed, moved, or are binary in the current iteration. Threads on files without a viewable diff body (binary, deleted, empty) SHALL be modeled as file-level comments with no line anchor.

#### Scenario: Comment on a newly added file
- **WHEN** a reviewer creates a comment on a file that is added in the current iteration (no pre-change version)
- **THEN** the thread SHALL be persisted with its `viewContext` set to `RightOnly` and SHALL anchor only to the post-change side

#### Scenario: Comment on a deleted file
- **WHEN** a reviewer creates a comment on a file that is deleted in the current iteration (no post-change version)
- **THEN** the thread SHALL be persisted with its `viewContext` set to `LeftOnly` and SHALL anchor only to the pre-change side

#### Scenario: Comment on a renamed file tracked via rename identifier
- **WHEN** a reviewer comments on a file whose path changes between iterations
- **THEN** the thread SHALL be attached to the file's rename-tracking identifier rather than its path so the comment follows the file to its new name

#### Scenario: File-level comment on a binary file
- **WHEN** a reviewer comments on a binary file whose changes cannot be rendered as a line-by-line diff
- **THEN** the system SHALL create a file-level thread without any line anchor and SHALL render the bubble against the file header

#### Scenario: Comment on a file moved into a subdirectory
- **WHEN** a file is moved into a subdirectory (path change without content change)
- **THEN** any thread anchored to that file SHALL be re-attached to the new path via the rename-tracking identifier

### Requirement: Review-Level (Top-Level) Comments
The system SHALL support comments that are scoped to the review as a whole rather than to a specific file or line. These review-level threads SHALL share the same status, reply, edit, delete, and markdown semantics as file-anchored threads, and MUST be retrievable alongside file-anchored threads from `getThreads(reviewId)`.

#### Scenario: Reviewer creates a top-level comment
- **WHEN** a reviewer creates a comment without any file or line context
- **THEN** the system SHALL create a review-level thread with no `filePath` and no anchor span, and SHALL display it in the review-level discussion area

#### Scenario: Top-level thread carries a status
- **WHEN** a top-level thread is created or updated
- **THEN** it SHALL carry a status from `selectableThreadStatuses` (defaulting to `Active`) and SHALL participate in status-based visibility filters identically to file-anchored threads

#### Scenario: Top-level thread supports a reply chain
- **WHEN** participants reply to a top-level thread
- **THEN** each reply SHALL be appended to the thread with its parent reference set, identically to file-anchored threads

#### Scenario: Top-level comment renders markdown formatting
- **WHEN** the body of a top-level comment contains markdown (headers, lists, code blocks, links, images)
- **THEN** the system SHALL render the formatted markdown in the comment view

#### Scenario: Top-level comment with an @mention notifies the mentioned user
- **WHEN** a top-level comment body contains an `@mention` of a participant
- **THEN** the system SHALL emit a notification to that participant through the platform's notification channel

#### Scenario: Top-level comment with a linked work item
- **WHEN** a top-level comment body references a work item using the platform's work-item linking syntax
- **THEN** the system SHALL render the reference as a link to the work item

### Requirement: Edge Case Comment Locations
The system SHALL support comments at boundary and edge-case locations: empty files, whitespace-only changes, very long lines, Unicode content, and the very first character of a file. Such comments MUST be persisted and rendered without truncation or loss of position fidelity.

#### Scenario: Comment on an empty (zero-byte) file
- **WHEN** a reviewer comments on a zero-byte file
- **THEN** the system SHALL create a file-level thread without any line anchor and SHALL render the bubble against the file header

#### Scenario: Comment on whitespace-only changes
- **WHEN** a diff contains only whitespace changes (trailing spaces, tab/space conversions) and a reviewer comments on one of those changed lines
- **THEN** the thread SHALL anchor to the whitespace-change line and SHALL remain visible regardless of the whitespace-handling toggle

#### Scenario: Comment on a very long line
- **WHEN** a reviewer creates a comment at a sub-line offset on a line longer than 1000 characters
- **THEN** the system SHALL preserve the offset exactly and SHALL render the lasso highlight at the correct sub-line position without truncation

#### Scenario: Comment body contains Unicode and emoji
- **WHEN** the body of a comment contains multi-byte Unicode (CJK characters, Cyrillic, Arabic, emoji)
- **THEN** the system SHALL store the body as UTF-8 and SHALL render every glyph correctly

#### Scenario: Comment at the first character of a file
- **WHEN** a reviewer creates a comment anchored to line 1 at the leading character of the file
- **THEN** the system SHALL persist the boundary position and SHALL render the lasso at the very start of the file without off-by-one errors

### Requirement: Comment Lifecycle Operations
The system SHALL support editing and deleting individual comments after publication, with the following invariants: edited comments SHALL record a `lastUpdatedTimestamp` distinct from the original `createdTimestamp`; deleted comments SHALL be removed from the thread display; and per-comment user reactions ("likes") SHALL be supported when the underlying platform exposes the capability.

#### Scenario: Reviewer edits a published comment
- **WHEN** the author of a published comment edits its body
- **THEN** the system SHALL update the stored content, set `lastUpdatedTimestamp` to the edit time (distinct from `createdTimestamp`), and re-render the comment with its new body

#### Scenario: Reviewer deletes a comment
- **WHEN** the author of a published comment deletes it
- **THEN** the system SHALL remove the comment from the thread display and SHALL preserve sibling and reply comments

#### Scenario: Reviewer likes a comment on a platform that supports likes
- **WHEN** `ICommentBackend.supportsLikes` is true and a reviewer likes a comment
- **THEN** the system SHALL record the like against the current user and SHALL update the like count displayed on the comment

### Requirement: Code Suggestions in Comments
The system SHALL recognize the platform-standard "suggestion" markdown fenced code block syntax (` ```suggestion ... ``` `) within comment bodies and SHALL surface a one-click "Apply" affordance for both single-line and multi-line suggestions. Applied suggestions SHALL be represented in the thread as system-generated change comments.

#### Scenario: Single-line code suggestion renders Apply affordance
- **WHEN** a comment body contains a single-line ` ```suggestion ... ``` ` block
- **THEN** the system SHALL parse the suggestion, render the suggested replacement, and surface an "Apply change" control on the comment

#### Scenario: Multi-line code suggestion renders Apply affordance
- **WHEN** a comment body contains a ` ```suggestion ... ``` ` block spanning multiple lines
- **THEN** the system SHALL parse the multi-line suggestion and SHALL render an "Apply change" control that replaces the entire anchored range

#### Scenario: Applied suggestion appears as a system change comment
- **WHEN** a suggestion is applied via the Apply control
- **THEN** the resulting change SHALL be recorded in the thread as a system-generated code-change comment (rather than as a regular user comment)

#### Scenario: Suggestion alongside free-form prose
- **WHEN** a comment body contains both a ` ```suggestion ``` ` block and surrounding prose
- **THEN** the system SHALL render the prose as markdown and SHALL surface the Apply control only against the suggestion block

