## ADDED Requirements

### Requirement: View Mode Catalog

The system SHALL expose four diff display modes — Inline (Unified), Side-by-Side (Split), Left Only, and Right Only — composed from two orthogonal controls: a Layout mode (Unified vs Split) and a Content Filter (Left / Both / Right).

#### Scenario: Unified layout with Both filter

- **WHEN** the user selects Unified layout with the Both content filter (the default)
- **THEN** the diff renders in a single column showing unchanged lines, removed lines highlighted as deletions, and added lines highlighted as additions

#### Scenario: Unified layout with Left filter

- **WHEN** the user selects Unified layout with the Left content filter
- **THEN** the diff shows unchanged lines and removed lines with deletion highlighting, and hides added lines entirely

#### Scenario: Unified layout with Right filter

- **WHEN** the user selects Unified layout with the Right content filter
- **THEN** the diff shows unchanged lines and added lines with addition highlighting, and hides removed lines entirely

#### Scenario: Split layout with Both filter

- **WHEN** the user selects Split layout with the Both content filter
- **THEN** the diff renders two synchronized panels with the original file on the left and the modified file on the right

#### Scenario: Split layout with single-side filter

- **WHEN** the user selects Split layout with the Left or Right filter
- **THEN** only the corresponding pane is displayed and the other pane is hidden

### Requirement: View Mode Switching and Persistence

The system SHALL allow the user to switch view modes via toolbar or keyboard at any time, and SHALL persist the chosen view mode and content filter as user preferences across sessions.

#### Scenario: Switching layout via keyboard

- **WHEN** the user presses `I` or `X`
- **THEN** the layout switches to Unified or Side-by-Side respectively without losing scroll context

#### Scenario: Switching content filter via keyboard

- **WHEN** the user presses `L`, `O`, or `R`
- **THEN** the content filter switches to Left, Both, or Right respectively and the diff re-renders accordingly

#### Scenario: Forced mode change for comment visibility

- **WHEN** the user navigates to a comment that is not visible in the current view mode
- **THEN** the system automatically switches to a view mode in which that comment is visible

#### Scenario: Persisted defaults reload

- **WHEN** the user reopens the application after previously choosing a non-default view mode
- **THEN** the previously chosen view mode and content filter are restored as the active selection

### Requirement: Scroll Synchronization in Split Layout

The system SHALL keep the left and right panels scrolled in sync in Split layout so that corresponding regions in the two files remain aligned.

#### Scenario: User scrolls one panel

- **WHEN** the user scrolls either the left or the right panel
- **THEN** the other panel scrolls to keep the corresponding lines aligned in the viewport

### Requirement: Hierarchical Line and Word Diff Classification

The system SHALL classify diff content at two levels — line-level (AddedLine, RemovedLine) and word/character-level within changed lines (AddedWord, RemovedWord) — and SHALL apply theme-aware highlighting that visually distinguishes each classification.

#### Scenario: Entirely new line

- **WHEN** a line exists only in the right (modified) file
- **THEN** the line is rendered with the AddedLine background (light green in default themes)

#### Scenario: Entirely deleted line

- **WHEN** a line exists only in the left (original) file
- **THEN** the line is rendered with the RemovedLine background (light red in default themes)

#### Scenario: Word changed within an otherwise common line

- **WHEN** a line is present on both sides but differs in some words
- **THEN** the unchanged portion uses the line-level background and the differing words use the darker word-level highlight (AddedWord on the right, RemovedWord on the left)

#### Scenario: Theme change

- **WHEN** the active theme changes (light, dark, or high-contrast)
- **THEN** all diff highlight colors update to the corresponding theme variables without requiring a reload

### Requirement: Whitespace Handling Toggle

The system SHALL provide a user-controllable "Ignore Whitespace" setting with two behaviors — None (show all whitespace changes) and IgnoreAllWhitespace (hide whitespace-only changes) — and SHALL recompute the diff immediately when the setting changes.

#### Scenario: Toggling ignore whitespace via keyboard

- **WHEN** the user presses `B`
- **THEN** the whitespace visibility setting toggles and the displayed diff recomputes immediately to reflect the new setting

#### Scenario: Whitespace-only changes hidden

- **WHEN** IgnoreAllWhitespace is active and a line differs only in whitespace
- **THEN** that line is rendered as unchanged rather than as an addition or deletion

### Requirement: Span Tracking Contract

The system SHALL provide a position-mapping mechanism that maps text spans bidirectionally between the original (left) and modified (right) versions of a file, so that anchored content such as comments remains attached to the correct code across iterations.

The public contract is:

```typescript
interface ISpanTracker {
  trackSpanForward(span: TextSpan): TextSpan;   // old -> new
  trackSpanBackward(span: TextSpan): TextSpan;  // new -> old
}
```

#### Scenario: Span in unchanged region

- **WHEN** a span covers content that was not modified between left and right
- **THEN** `trackSpanForward` and `trackSpanBackward` return the span at the corresponding position in the other version

#### Scenario: Span shifted by insertion above

- **WHEN** lines are inserted before a tracked span
- **THEN** the tracked span is returned shifted down by the inserted lines on the side where the insertion occurred

#### Scenario: Span covering deleted content

- **WHEN** the content covered by a span has been deleted on the target side
- **THEN** the returned span is a zero-length span anchored at the deletion point

#### Scenario: Span covering modified content

- **WHEN** the content covered by a span has been modified
- **THEN** the returned span covers the new content in the target version

#### Scenario: Identical files use identity tracking

- **WHEN** the left and right contents are identical
- **THEN** span tracking returns every requested span unchanged without performing diff computation

### Requirement: Triple Snapshot for Inline Projection

The system SHALL maintain three coordinated text snapshots — left (original), right (modified), and a both projection that merges both sides into a single coordinate space — so that Inline view rendering and position lookups operate on a unified buffer.

#### Scenario: Inline projection contains all lines

- **WHEN** the both projection is built for a file pair
- **THEN** every line from the left and right snapshots is represented in the projection with a consistent coordinate that can be mapped back to its source side

### Requirement: File Type Viewer Selection

The system SHALL select an appropriate viewer for each reviewed file based on its type — a text diff viewer for text content, an image diff viewer for image content, a folder viewer for directories, and a placeholder viewer for any other unsupported type.

#### Scenario: Text file

- **WHEN** the file content is detected as text
- **THEN** the text diff viewer is used and renders with syntax highlighting, line numbers, and diff highlighting

#### Scenario: Image file by extension

- **WHEN** the file extension is one of `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, or `.ico`
- **THEN** the image diff viewer is used

#### Scenario: Unsupported binary file

- **WHEN** the file is binary and not an image, and not classifiable as text
- **THEN** the placeholder viewer is shown with file metadata and a "No visualization available" message

### Requirement: Text Diff Viewer Features

The text diff viewer SHALL provide syntax highlighting based on file language, line numbers in the gutter, a word-wrap toggle, a zoom control, comment margins, and an overview margin (minimap).

#### Scenario: Syntax highlighting applied

- **WHEN** a text file with a recognized language is opened
- **THEN** language-aware syntax highlighting is applied to both the left and right buffers

#### Scenario: Word wrap toggle via keyboard

- **WHEN** the user presses `P`
- **THEN** the word-wrap setting toggles between wrapped and no-wrap and the text reflows accordingly

#### Scenario: Zoom via Ctrl+MouseWheel

- **WHEN** the user holds `Ctrl` and scrolls the mouse wheel over the diff
- **THEN** the font size of the diff content increases or decreases and the layout recalculates

### Requirement: Image Diff Viewer Features

The image diff viewer SHALL display the original and modified images for comparison with zoom controls, and SHALL support comments anchored to pixel coordinates expressed in relative (percentage-based) terms so anchoring is preserved across zoom changes.

#### Scenario: Anchored comment survives zoom

- **WHEN** the user zooms the image after a comment has been anchored to a pixel position
- **THEN** the comment marker continues to point at the same visual pixel because anchoring is relative

### Requirement: Renamed File Handling

The system SHALL recognize renamed files (GitHub status `renamed` with a `previousFilename` field) and render their diffs even when the file has no content changes, and SHALL fetch base file content from the previous filename when computing full-file diffs for such files.

#### Scenario: Renamed file with content changes

- **WHEN** a renamed file has additions or deletions
- **THEN** the normal diff view is rendered with the additions and deletions highlighted

#### Scenario: Renamed file with no content changes

- **WHEN** a renamed file has zero additions and zero deletions and GitHub returns no `patch` field
- **THEN** the diff page renders the toolbar, filename header, and code viewer with no highlighted changes, instead of the "No diff available" empty state

#### Scenario: Full-file mode for renamed file

- **WHEN** Full File mode is activated for a renamed file
- **THEN** the base content is fetched from `previousFilename` at `baseSHA` and the head content from `filename` at `headSHA`

#### Scenario: Renamed-file badge

- **WHEN** a file's status is `renamed`
- **THEN** an `R` badge is displayed for that file in the file list

### Requirement: Empty State for Binary or Oversized Files

The system SHALL display a "No diff available (binary file or too large)" empty state for files that are binary or exceed GitHub's diff size limit, while continuing to render the normal diff page chrome for renamed files without content changes.

#### Scenario: Binary file

- **WHEN** GitHub does not return a `patch` field because the file is binary or too large and the file is not a no-change rename
- **THEN** the diff area shows the "No diff available (binary file or too large)" empty state

### Requirement: File List Pagination

The system SHALL fetch all changed files for a pull request by paginating the GitHub PR files endpoint with `per_page=100`, so that PRs with more than 30 changed files are fully loaded.

#### Scenario: PR with many files

- **WHEN** a pull request contains more than 30 changed files
- **THEN** all files are fetched and displayed in the file list, not only the first 30

### Requirement: Overview Margin (Minimap) Layout

The system SHALL render a fixed-width 60-pixel minimap with two parallel bars representing the left and right files, each bar's height proportional to its file's line count and vertically centered within the render area, with 10 pixels of vertical padding above and below.

#### Scenario: Asymmetric file lengths

- **WHEN** the left and right files have different line counts
- **THEN** the bar for the shorter file is rendered proportionally shorter and centered vertically, while the longer file's bar occupies the full render area height

#### Scenario: Minimap position by layout

- **WHEN** the layout is Unified
- **THEN** the minimap is positioned at the left edge of the diff content

#### Scenario: Minimap position in Split layout

- **WHEN** the layout is Side-by-Side
- **THEN** the minimap is positioned between the two panes

### Requirement: Overview Margin Diff Visualization

The minimap SHALL highlight removed-or-modified regions on the left bar using the deletion color (`--diff-delete-word`) and added-or-modified regions on the right bar using the addition color (`--diff-add-word`), with both bars always fully visible regardless of the diff content.

#### Scenario: Left bar shows deletions

- **WHEN** the left file contains removed or modified regions
- **THEN** those regions are highlighted on the left bar in the deletion color

#### Scenario: Right bar shows additions

- **WHEN** the right file contains added or modified regions
- **THEN** those regions are highlighted on the right bar in the addition color

#### Scenario: Single-side view dims the inactive bar

- **WHEN** the content filter is Left Only or Right Only
- **THEN** the inactive bar is shown grayed out and only the active bar reflects diff regions

### Requirement: Viewport Lasso

The minimap SHALL render a viewport lasso as a single continuous SVG path that connects both bars, indicating the currently visible region of each file with heights proportional to the visible-line ratio on each side and a minimum height of 4 pixels per side.

#### Scenario: Symmetric visible region

- **WHEN** equal portions of the left and right files are visible
- **THEN** the lasso shows equal heights on both bars and connects them as a single shape

#### Scenario: Viewport over all-added content

- **WHEN** the visible region contains only added content with no corresponding left content
- **THEN** the left side of the lasso shrinks to the 4-pixel minimum while the right side reflects the normal viewport proportion

#### Scenario: Viewport over all-deleted content

- **WHEN** the visible region contains only deleted content
- **THEN** the right side of the lasso shrinks to the 4-pixel minimum while the left side reflects the normal viewport proportion

#### Scenario: Lasso updates on scroll

- **WHEN** the user scrolls the diff
- **THEN** the lasso position and per-side heights update continuously to reflect the new visible region on each file

### Requirement: Lasso Visibility Rules

The system SHALL show the viewport lasso only when full-file mode is active and no inline review comments are currently displayed; in all other situations the lasso SHALL be hidden.

#### Scenario: Full file without inline comments

- **WHEN** `showFullFile` is true and no inline comments are displayed
- **THEN** the lasso is visible and drag-to-scroll is enabled

#### Scenario: Inline comments displayed

- **WHEN** review comments are displayed inline in the diff
- **THEN** the lasso is hidden to avoid visual conflict with comment threads

#### Scenario: Changes-only mode

- **WHEN** full-file mode is off (changes-only mode)
- **THEN** the lasso is hidden

### Requirement: Minimap Navigation

The system SHALL allow the user to click anywhere on a minimap bar or drag the lasso to scroll the diff instantly to that location, positioning the target line at 25% of the viewport height so context remains visible above it.

#### Scenario: Click on a bar

- **WHEN** the user clicks at a vertical position on a minimap bar
- **THEN** the diff scrolls so that the proportional line in the corresponding file (left or right) appears at 25% of the viewport height

#### Scenario: Drag the lasso

- **WHEN** the user drags the lasso to a new vertical position
- **THEN** the diff scrolls instantly (no smooth animation) tracking the drag position

#### Scenario: Bar-specific reference

- **WHEN** the user clicks the left bar versus the right bar at the same vertical position
- **THEN** scrolling targets are computed from the left file line numbers and the right file line numbers respectively, accounting for asymmetric diffs

### Requirement: Diff Gutter Layout

The diff gutter SHALL contain two columns — a 24-pixel annotation column on the left (reserved for future annotations) and a 48-pixel line-number column on the right — and the line numbers shown SHALL depend on the active content filter.

#### Scenario: Both filter active

- **WHEN** the content filter is Both
- **THEN** the line-number column shows the new (right) line numbers

#### Scenario: Left filter active

- **WHEN** the content filter is Left
- **THEN** the line-number column shows the old (left) line numbers

#### Scenario: Right filter active

- **WHEN** the content filter is Right
- **THEN** the line-number column shows the new (right) line numbers

### Requirement: Comment Visibility by View Mode

The system SHALL determine which comments are visible based on the current view mode and on which sides (left, right, or both) a comment is mapped to via the span tracker. See the `comments` capability for comment data model and `data-models` for span and region types.

#### Scenario: Inline view shows all comments

- **WHEN** the layout is Inline
- **THEN** all comments are shown regardless of whether they map to the left, right, or both sides

#### Scenario: Side-by-side view splits comments per panel

- **WHEN** the layout is Side-by-Side
- **THEN** comments mapped to the left or to both sides appear in the left panel and comments mapped to the right or to both sides appear in the right panel

#### Scenario: Left-only and right-only filters

- **WHEN** the Left Only or Right Only filter is active
- **THEN** only comments mapped to that side (or to both) are shown

### Requirement: File Navigation

The system SHALL provide keyboard shortcuts for navigating between files in the file list — `S` for next file, `W` for previous file, arrow keys for single-step navigation when the file list is focused, and `PgUp`/`PgDn` for jumping 10 files when the file list is focused.

#### Scenario: Next file shortcut

- **WHEN** the user presses `S` while viewing any file
- **THEN** the next file in the file list becomes the active file

#### Scenario: Previous file shortcut

- **WHEN** the user presses `W` while viewing any file
- **THEN** the previous file in the file list becomes the active file

### Requirement: Change (Hunk) Navigation

The system SHALL provide `J` and `K` keyboard shortcuts to navigate between consecutive change hunks within the current file, scrolling to show context lines above the target change, and SHALL disable change navigation for fully added or fully deleted files where every line is a change.

#### Scenario: Next change

- **WHEN** the user presses `J` and at least one change hunk exists after the current scroll position
- **THEN** the view scrolls to the next change hunk with context lines visible above it

#### Scenario: Previous change

- **WHEN** the user presses `K` and at least one change hunk exists before the current scroll position
- **THEN** the view scrolls to the previous change hunk with context lines visible above it

#### Scenario: Change navigation disabled for fully changed files

- **WHEN** the current file is fully added or fully deleted
- **THEN** `J` and `K` have no effect and the corresponding toolbar buttons render in a disabled state

#### Scenario: Boundary disabled state

- **WHEN** the user is at the first or last change of a file
- **THEN** the corresponding toolbar button (previous or next) shows a disabled state

### Requirement: Scroll Navigation Shortcuts

The system SHALL provide keyboard scrolling shortcuts within the diff view — `Space` to scroll down by 80% of viewport height, `PageDown` and `PageUp` to scroll by viewport height minus 50 pixels (so context overlaps between pages), and `Home`/`End` to jump to the start or end of the file.

#### Scenario: Space scrolls 80% viewport

- **WHEN** the user presses `Space` within the diff
- **THEN** the view scrolls down by 80% of the current viewport height

#### Scenario: PageDown leaves overlap

- **WHEN** the user presses `PageDown`
- **THEN** the view scrolls down by the viewport height minus 50 pixels so the bottom of the previous page becomes the top of the new page with overlap

#### Scenario: Home and End jumps

- **WHEN** the user presses `Home` or `End`
- **THEN** the view scrolls to the very start or very end of the file respectively

### Requirement: Display Toggle Shortcuts

The system SHALL provide keyboard shortcuts for display toggles: `F` to enter Full File mode, `C` to enter Changes-Only mode, `B` to toggle whitespace visibility, `D` to toggle comment visibility (which also hides the lasso when comments are shown), and `P` to toggle text wrap.

#### Scenario: F is unidirectional into full file

- **WHEN** the user presses `F` while not in full-file mode
- **THEN** the view enters full-file mode

#### Scenario: F is a no-op when already in full file

- **WHEN** the user presses `F` while already in full-file mode
- **THEN** the view state does not change

#### Scenario: C is unidirectional into changes-only

- **WHEN** the user presses `C` while in full-file mode
- **THEN** the view switches to changes-only mode

#### Scenario: C is a no-op when not in full file

- **WHEN** the user presses `C` while not in full-file mode
- **THEN** the view state does not change

#### Scenario: D hides comments and lasso

- **WHEN** the user presses `D` and comments are currently shown
- **THEN** comments are hidden and the lasso visibility rules are re-evaluated

### Requirement: Find and Go-To Shortcuts

The system SHALL provide `Ctrl+F` to find text within the current view, `F3` and `Shift+F3` to find next and previous matches, `Ctrl+G` to jump to a specific line number, and `?` to open the keyboard shortcuts modal.

#### Scenario: Find within file

- **WHEN** the user presses `Ctrl+F`
- **THEN** a find input appears scoped to the current diff view

#### Scenario: Find next and previous

- **WHEN** the user has an active find query and presses `F3` or `Shift+F3`
- **THEN** the view scrolls to the next or previous match respectively

#### Scenario: Go to line

- **WHEN** the user presses `Ctrl+G` and enters a line number
- **THEN** the view scrolls to that line

#### Scenario: Show shortcuts modal

- **WHEN** the user presses `?`
- **THEN** the keyboard shortcuts modal opens

### Requirement: Text Selection and Comment Creation

The system SHALL allow the user to select text within the diff and create a comment thread anchored to the selected range, with the selection's location mapped to the appropriate iteration and side for storage.

#### Scenario: Selection surfaces add-comment affordance

- **WHEN** the user selects a non-empty text range in the diff
- **THEN** an "Add Comment" affordance is shown for that selection

#### Scenario: Creating the comment

- **WHEN** the user activates Add Comment for a selection
- **THEN** a new comment thread is created with the file path, the mapped location (side and span), and the current iteration id

### Requirement: User Preferences

The system SHALL persist the following user preferences for the diff viewer across sessions: default view mode, side-by-side preference, line-number visibility, word-wrap, font family, font size, ignore-whitespace, comment display mode, and theme.

#### Scenario: Persisting a preference

- **WHEN** the user changes any persisted setting
- **THEN** the new value is stored and is the value applied the next time the application loads

### Requirement: Settings Take Immediate Effect

The system SHALL apply each diff-viewer setting change immediately, without requiring a reload or remount of the diff view.

#### Scenario: Theme change

- **WHEN** the user changes the active theme
- **THEN** all diff colors update immediately to the new theme

#### Scenario: Font change

- **WHEN** the user changes the font family or font size
- **THEN** all text in the diff redraws with the new font

#### Scenario: Zoom change

- **WHEN** the user changes the zoom level
- **THEN** the layout recalculates immediately

#### Scenario: Ignore-whitespace change

- **WHEN** the user toggles the ignore-whitespace setting
- **THEN** the diff is recomputed immediately

#### Scenario: View mode change

- **WHEN** the user changes the view mode
- **THEN** panels reconfigure immediately to the new mode

#### Scenario: Word-wrap change

- **WHEN** the user toggles word-wrap
- **THEN** text reflows immediately

### Requirement: Async Loading States

The diff viewer SHALL expose explicit per-side loading states — NotStarted, Loading, Ready, and Error — and SHALL communicate progress to the user, showing a "Just a moment..." indicator while loading, the diff when ready, and an error message on failure.

#### Scenario: Loading indicator

- **WHEN** either the left or right file is still loading
- **THEN** a "Just a moment..." indicator is shown in place of the diff content

#### Scenario: Both sides ready

- **WHEN** both files have loaded and the diff has been computed
- **THEN** the diff view replaces the loading indicator

#### Scenario: Load failure

- **WHEN** loading either file fails
- **THEN** an error message is shown that describes the failure

### Requirement: Large-File Performance

The system SHALL render large files using virtualized rendering so that only visible lines are kept in the DOM, and SHALL compute diffs lazily as the user scrolls.

#### Scenario: Scrolling a large file

- **WHEN** the user scrolls a file with thousands of lines
- **THEN** only the lines near the visible region are present in the DOM, keeping scroll performance smooth

### Requirement: Span Tracker Caching

The system SHALL cache computed span trackers keyed by the file artifact and the pair of iterations being compared, and SHALL reuse a cached tracker when the same pair is requested again rather than recomputing it.

#### Scenario: Repeated request for same iteration pair

- **WHEN** a span tracker is requested for an artifact and iteration pair that has been computed before
- **THEN** the cached tracker is returned without recomputing the diff
