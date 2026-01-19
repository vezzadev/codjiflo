# Diff Viewing Specification

---

## Overview

The diff viewer displays code changes between two versions (iterations) with:
- Line-level and word-level highlighting
- Multiple view modes (inline, side-by-side)
- Comment integration with position tracking
- Support for text, images, and binary files

---

## View Modes

### Four Display Modes

```typescript
enum DiffViewMode {
  Inline = 'inline',           // Unified view, changes interleaved
  SideBySide = 'side_by_side', // Two panels, left=old, right=new
  LeftOnly = 'left_only',      // Only original file
  RightOnly = 'right_only'     // Only modified file
}
```

### Mode Behaviors

The view system has two orthogonal controls:

1. **Layout Mode** (Unified vs Split): Controls how content is arranged spatially
2. **Content Filter** (Left/Both/Right): Controls which line types are visible

#### Layout Modes

| Layout | Description | Use Case |
|--------|-------------|----------|
| **Unified** | Single editor, all changes in one stream | Quick review, seeing flow |
| **Split** | Two synchronized side-by-side editors | Detailed comparison |

#### Content Filter (Left/Both/Right)

The content filter controls which line types are displayed. It applies to **both** Unified and Split layouts.

| Filter | Unified Mode Behavior | Split Mode Behavior |
|--------|----------------------|---------------------|
| **Left** | Shows removed lines + unchanged lines only | Shows only the left (original) pane |
| **Both** | Shows all lines: removed, added, unchanged (default) | Shows both panes side-by-side (default) |
| **Right** | Shows added lines + unchanged lines only | Shows only the right (modified) pane |

#### Unified Mode with Content Filter

In Unified mode, the content filter modifies which diff lines appear in the single-column view:

- **Left filter**: Displays the original file perspective
  - Unchanged lines: shown normally
  - Removed lines: shown with red/deletion highlighting
  - Added lines: **hidden** (not displayed)

- **Both filter** (default): Displays complete diff
  - Unchanged lines: shown normally
  - Removed lines: shown with red/deletion highlighting
  - Added lines: shown with green/addition highlighting

- **Right filter**: Displays the modified file perspective
  - Unchanged lines: shown normally
  - Added lines: shown with green/addition highlighting
  - Removed lines: **hidden** (not displayed)

### Mode Switching

- User can switch modes via toolbar/keyboard
- **Automatic switching**: When navigating to a comment that's only visible in one mode, the system forces a mode change
- **Scroll sync**: In SideBySide mode, scrolling one panel scrolls the other

---

## Diff Computation

### Hierarchical Diff Model

Diffs are computed at two levels:

```
Line-Level Differences
    │
    └── Word/Character-Level Differences (within changed lines)
```

### Diff Categories

```typescript
enum DiffClassification {
  AddedLine = 'added_line',       // Entire line is new
  AddedWord = 'added_word',       // Word within line is new
  RemovedLine = 'removed_line',   // Entire line deleted
  RemovedWord = 'removed_word'    // Word within line deleted
}
```

### Visual Styling

| Classification | Background |
|---------------|------------|
| AddedLine | Light green |
| AddedWord | Dark green |
| RemovedLine | Light red |
| RemovedWord | Dark red |

Colors are theme-aware (light/dark/high-contrast).

### Whitespace Handling

```typescript
enum WhitespaceBehavior {
  None = 'none',                    // Show all whitespace changes
  IgnoreAllWhitespace = 'ignore'    // Hide whitespace-only changes
}
```

User toggle: "Ignore Whitespace" recomputes diff immediately.

---

## Span Tracking

### The Problem

When code changes between iterations, comments must "follow" the code they're attached to:

```
Iteration 1:          Iteration 2:
Line 5: foo()   →     Line 5: (new line)
                      Line 6: foo()  ← Comment should move here
```

### The Three Snapshots

```typescript
interface TripleSnapshot {
  left: TextSnapshot;       // Original file content
  right: TextSnapshot;      // Modified file content
  both: ProjectionSnapshot; // Merged view for inline mode
}
```

The `both` snapshot is a **projection buffer** that maps positions from both left and right into a single coordinate space.

### SpanTracker Operations

```typescript
interface ISpanTracker {
  // Map position from old version to new version
  trackSpanForward(span: TextSpan): TextSpan;

  // Map position from new version to old version
  trackSpanBackward(span: TextSpan): TextSpan;
}
```

### Tracking Algorithm

1. Build list of text changes (insertions, deletions, replacements)
2. For each tracked span:
   - Find overlapping changes
   - Adjust start/end positions based on insertions/deletions before it
   - Handle edge cases (span deleted, span split)

### Special Cases

| Scenario | Behavior |
|----------|----------|
| Span unchanged | Returns same position |
| Span deleted | Returns zero-length span at deletion point |
| Span modified | Returns span covering new content |
| Line inserted before | Span shifts down by inserted lines |

### Identity Span Tracker (Optimization)

When left and right files are identical:
- No real diff exists
- Tracking returns spans unchanged
- Optimization to skip unnecessary computation

---

## File Type Viewers

### Viewer Selection

```typescript
function selectViewer(file: ReviewFile): DiffViewer {
  if (isTextFile(file)) return new TextDiffViewer();
  if (isImageFile(file)) return new ImageDiffViewer();
  if (isFolder(file)) return new FolderViewer();
  return new PlaceholderViewer();
}

function isTextFile(file: ReviewFile): boolean {
  // Based on extension and content detection
  return !isBinaryContent(file.content);
}

function isImageFile(file: ReviewFile): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico'];
  return imageExtensions.includes(file.extension.toLowerCase());
}
```

### Text Diff Viewer

**Features:**
- Syntax highlighting (language-aware)
- Line numbers
- Word wrap toggle
- Zoom control
- Comment margins
- Overview margin (minimap)

**Loading Pattern:**
```typescript
async function loadTextDiff(left: FileContent, right: FileContent): Promise<DiffView> {
  // 1. Create text buffers
  const leftBuffer = createTextBuffer(left.content);
  const rightBuffer = createTextBuffer(right.content);

  // 2. Compute diff
  const diff = computeDiff(leftBuffer, rightBuffer);

  // 3. Create triple snapshot for tracking
  const snapshots = new TripleSnapshot(leftBuffer, rightBuffer, diff);

  // 4. Apply syntax highlighting
  applySyntaxHighlighting(leftBuffer, left.language);
  applySyntaxHighlighting(rightBuffer, right.language);

  // 5. Create span tracker for comments
  const tracker = new SpanTracker(diff);

  return { snapshots, tracker, diff };
}
```

### Image Diff Viewer

**Features:**
- Side-by-side image display
- Zoom controls
- Pixel-level comment positioning
- Overlay/swipe comparison modes

**Comment Anchoring:**
- Comments anchor to pixel coordinates
- Coordinates are relative (percentage-based) for zoom independence

### Placeholder Viewer

For unsupported file types:
- Shows file metadata
- "No visualization available" message
- Download link if applicable

---

## Editor Margins

### Overview Margin (Minimap)

Minimap has two bars, with 100% of their height visible at all times. The left bar is highlighted in red (`--diff-delete-word`) in the region proportional to the lines that were removed or modified. The right bar is highlighted in green/yellow (`--diff-add-word`) in the region proportional to the lines that were added or modified. A lasso surrounds the parts of the bar that correspond to the code chunk that is in the viewport. As the user scrolls, the lasso is auto updated. Users may click on the bars or drag the lasso to scroll directly to the region of interest.

**Positioning:**

| View Mode | Minimap Position |
|-----------|------------------|
| Inline | Left edge of diff content |
| Side-by-Side | Center, between left and right panes |

**Bar Heights and Centering:**

Bar heights are proportional to the number of lines in each original file. The bar with more lines gets full render area height; the shorter file's bar is proportionally smaller. Both bars are **centered vertically** within the render area, meaning:
- If the left file has fewer lines than the right, the left bar is shorter and centered
- If the right file has fewer lines than the left, the right bar is shorter and centered
- When files have equal line counts, both bars have equal height

This centering ensures asymmetric diffs remain visually balanced and the lasso correctly tracks viewport position on each bar independently.

**Colors:**

| Element | CSS Variable | Purpose |
|---------|-------------|---------|
| Deletions | `--diff-delete-word` | Red highlight on left bar |
| Additions | `--diff-add-word` | Green highlight on right bar |
| Lasso stroke | `#505050` | Gray outline around visible viewport |

**Visual Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  8px   16px    12px   16px    8px                        │
│ ┌───┐ ┌────┐       ┌────┐ ┌───┐                          │
│ │pad│ │LEFT│       │RGHT│ │pad│   Total width: 60px      │
│ │   │ │BAR │       │BAR │ │   │                          │
│ └───┘ └────┘       └────┘ └───┘                          │
│       x:8-24       x:36-52                               │
└──────────────────────────────────────────────────────────┘
```

- Fixed width: **60 pixels**
- Left bar: X position 8-24 (16px wide)
- Right bar: X position 36-52 (16px wide)
- Vertical padding: 10px top and bottom
- Effective render height: `containerHeight - 20px`

**Lasso Shape:**

The viewport lasso is rendered as a single continuous SVG path that connects both bars, forming a shape that visually bridges the left and right bar positions. The path flows:
- Top-left of left bar → across to right bar top → down right bar outer edge → across bottom back to left bar → up left bar outer edge → close

This connected shape (rather than two separate rectangles) provides clear visual indication that the lasso represents a unified viewport spanning both file views.

**Lasso Behavior Examples:**

*Example 1: Lasso shows visible area in both files*
```
              LEFT BAR
             +------------^
             | +-------+  \
             | |#######|   |
             | |#######|   \
             | |#######|    |
             | |#######|    \
             | |#######|     |
             | |#######|     |
             | |       |     \
             | |       |      |
             | |       |      \
             +------------^    |
               |       |   |   \
               |       |   \    | RIGHT BAR
               |       |    \   +----------+
               |       |     |    +------+ |
               |       |     \    |::::::| |
               |       |      \   |::::::| |
               |       |       |  |      | |
               |       |       \  |      | |
               |       |        +----------+
               |       |          |      |
               |#######|          |::::::|
               |#######|          |      |
               |       |          |      |
               |       |          |      |
               |       |          |      |
               |       |          |      |
               |#######|          +------+
               |#######|
               |#######|
               |#######|
               |#######|
               |#######|
               |#######|
               |#######|
               |#######|
               +-------+
```

*Example 2: Right side of lasso shrinks when scrolling through deleted content*
```
               +-------+
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
             +-----------^        +------+
             | |#######|  \       |      |
             | |#######|   \      |      |
             | |#######|    |     |      |
             | |#######|    \     |      |
             | |#######|     \    |      |
             | |#######|      \   |      |
             | |#######|       \  |      |
             | |#######|        +----------+
             | |#######|        +----------+
             | |#######|     --/  |      |
             | |#######|   -/     |      |
             +-----------</       |      |
               |       |          |      |
               |       |          |      |
               |       |          |      |
               |       |          |      |
               |       |          |      |
               |       |          |      |
               |       |          |      |
               |       |          +------+
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               +-------+
```

*Example 3: Lasso tracks common content, even if it doesn't line up*
```
               +-------+
               |       |
               |       |
               |#######|
               |#######|
               |#######|
               |       |
               |       |
               |       |
               |       |
               |       |          +------+
               |#######|          |      |
               |       |        +----------+
               |       |       /  |      | |
               |       |      /   |      | |
               |#######|     /    |      | |
               |#######|    /     |      | |
               |#######|   /      |      | |
               |       |  /       |      | |
             +-----------v        |      | |
             | |       |          |      | |
             | |       |          |      | |
             | |       |        +----------+
             | |       |       /  |      |
             | |       |      /   |::::::|
             | |       |      |   |::::::|
             | |       |     /    |      |
             | |       |    /     |      |
             | |       |   /      |      |
             | |       |   |      |      |
             | |       |  /       |      |
             +-----------v        +------+
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               |       |
               +-------+
```

*Example 4: Right side of lasso grows when scrolling through added content*
```
                                  +-------+
                                  |       |
                                  |       |
                                  |       |
                                  |       |
                                  |       |
                                  |       |
                                  |       |
                                  |       |
               +-------+          |       |
               |       |          |       |
               |       |        +----------+
               |       |        | |      | |
               |       |       /  |      | |
               |       |       |  |::::::| |
               |       |      /   |::::::| |
               |       |      |   |      | |
               |       |      |   |      | |
               |       |     /    |::::::| |
               |       |     |    |::::::| |
               |       |    /     |::::::| |
               |       |    |   +----------+
               |       |   /   /  |      |
               |       |   |   |  |      |
               |       |   |  /   |      |
               |       |  /  /    |      |
               |       |  | /     |      |
               |       | /  |     |      |
             +-----------v /      |::::::|
             | |       |  /       |::::::|
             | |#######|  |       |::::::|
             +-----------v        |::::::|
               |       |          |::::::|
               |       |          |::::::|
               +-------+          |::::::|
                                  |::::::|
                                  |::::::|
                                  |      |
                                  |      |
                                  |      |
                                  +------+
```

*Example 5: Lasso has minimal left side height for added files*
```
                                 |----------+
                                /  +------+ |
                                |  |::::::| |
                               /   |::::::| |
                              /    |::::::| |
                              |    |::::::| |
                             /     |::::::| |
                             |     |::::::| |
                            /      |::::::| |
                           /       |::::::| |
                           |    ------------+
              +-----------v  --/   |::::::|
              +-------------/      |::::::|
                                   |::::::|
                                   |::::::|
                                   |::::::|
                                   |::::::|
                                   |::::::|
                                   |::::::|
                                   |::::::|
                                   +------+
```

*Example 6: Lasso has minimal right side height for deleted files*
```
              +----------|
              | +------+ |
              | |######|  \
              | |######|  |
              | |######|   \
              | |######|   |
              | |######|    \
              | |######|    |
              | |######|     \
              | |######|     |
              +------------   \
                |######|   \- v-----------+
                |######|     \>-----------+
                |######|
                |######|
                |######|
                |######|
                |######|
                |######|
                |######|
                +------+
```

**Lasso Visibility Rules:**

Lasso visibility is determined by the following combined conditions:
- **Lasso is visible only in full-file mode without inline comments**: The lasso is shown when `showFullFile=true` **and** no inline review comments are currently displayed in the diff. Drag scrolling is supported in this mode.
- **Lasso is hidden whenever either hiding condition applies**:
  - when review comments are displayed inline in the diff (to avoid visual clutter and interaction conflicts with comment threads), or
  - when changes-only mode is active (`showFullFile=false`), since only changes are shown without surrounding context, making the lasso less meaningful.

```typescript
interface OverviewMargin {
  width: 60;  // pixels

  // Visual elements
  leftBar: Rectangle;   // Shows diff blocks in left file
  rightBar: Rectangle;  // Shows diff blocks in right file
  lasso: Rectangle;     // Current visible area indicator

  // Interactions (instant, no animation)
  onClick(y: number): void;  // Jump to position instantly
  onDrag(y: number): void;   // Scroll to position instantly (disabled with inline comments)
}
```

**Navigation Behavior:**

Minimap navigation (click and drag) scrolls the diff view instantly without any smooth scroll animation. This provides immediate visual feedback and responsive drag scrolling. Direct `scrollTop` assignment is used rather than `scrollTo({ behavior: 'smooth' })`.

**25% Viewport Positioning:**

Both click and drag navigation position the target line at **25% of the viewport height** (near the top with context above):

```
clickRatio = (y - barTop) / barHeight
targetLine = clickRatio * totalLines
scrollPosition = targetLine - (0.25 * visibleLines)
```

**Bar-specific scrolling:** The bar clicked/dragged determines which file's lines are used as reference:
- **Left bar**: Uses left file line numbers. Scrolls to show the corresponding left-side line at 25% viewport height.
- **Right bar**: Uses right file line numbers. Scrolls to show the corresponding right-side line at 25% viewport height.

This ensures:
- Target content appears in the upper portion of the viewport
- User can see context above the target line
- Natural reading flow from top to bottom is preserved
- Consistent behavior between click and drag interactions
- Accurate navigation for asymmetric diffs where left and right have different line counts

**Asymmetric Lasso Heights:**

When files have different line counts, the lasso height on each side reflects what portion of that file is actually visible in the viewport:

```
leftLassoHeight = (visibleLeftLines / totalLeftLines) * leftBarHeight
rightLassoHeight = (visibleRightLines / totalRightLines) * rightBarHeight
```

Key behaviors:
- **All-added content**: When scrolled to a region with only additions (no corresponding left content), the left lasso shrinks to minimum height (4px) while the right lasso shows the normal viewport proportion
- **All-deleted content**: When scrolled to a region with only deletions, the right lasso shrinks to minimum while left shows normal proportion
- **Mixed content**: Both lassos show proportional heights based on visible lines
- **Minimum height**: Lasso never disappears completely; minimum height of 4px ensures visibility

This asymmetric behavior provides accurate visual feedback about which portions of each file are currently visible, especially important when reviewing large diffs with significant additions or deletions.

**View Mode Adaptation:**

The minimap adapts its display based on the current view mode:

| View Mode | Left Bar Shows | Right Bar Shows | Click Behavior |
|-----------|---------------|-----------------|----------------|
| **Inline** | Removed regions | Added regions | Scrolls unified view |
| **Side-by-Side** | Removed regions | Added regions | Scrolls respective panel, syncs the other |
| **Left Only** | Removed regions | (grayed out) | Scrolls left view only |
| **Right Only** | (grayed out) | Added regions | Scrolls right view only |

### Comment Margins

Multiple margin types for comment display:

| Margin | Purpose |
|--------|---------|
| CommentMargin | Minimized comment indicators |
| CommentTextMargin | Full comment content |
| CommentStatusMargin | Thread status icons |

### Gutter Columns

The diff gutter always has two columns:

| Column | Width | Purpose |
|--------|-------|---------|
| **Annotation** (left) | 24px | Reserved for future annotations (code coverage, lint markers) |
| **Line Number** (right) | 48px | Displays line numbers based on content filter mode |

**Line Number Display by Content Filter:**

| Filter Mode | Line Numbers Shown |
|-------------|-------------------|
| **Both** | New (right) line numbers only |
| **Left** | Old (left) line numbers |
| **Right** | New (right) line numbers |

The annotation column is currently empty but provides a consistent location for future features like:
- Code coverage indicators
- Linting/error markers
- Breakpoint toggles

---

## Comment Integration

### Comment Display Modes

```typescript
enum CommentDisplayMode {
  Bubble = 'bubble',         // Floating bubbles overlaid on code
  Interlinear = 'interlinear' // Inline between code lines
}
```

### Comment Tracking Flow

```typescript
function computeCommentLocation(
  comment: Comment,
  snapshots: TripleSnapshot,
  tracker: SpanTracker
): CommentLocation {
  const originalSpan = comment.fileRegion.toSpan();

  // Map to both sides
  const leftSpan = tracker.trackSpanBackward(originalSpan);
  const rightSpan = tracker.trackSpanForward(originalSpan);

  return {
    leftContribution: leftSpan.isEmpty ? null : leftSpan,
    rightContribution: rightSpan.isEmpty ? null : rightSpan,
    viewContext: determineViewContext(leftSpan, rightSpan)
  };
}

function determineViewContext(left: Span, right: Span): CommentViewContext {
  if (!left.isEmpty && !right.isEmpty) return 'both';
  if (!left.isEmpty) return 'left_only';
  return 'right_only';
}
```

### Comment Visibility Rules

| View Mode | Shows Comments From |
|-----------|---------------------|
| Inline | All comments (both, left, right) |
| SideBySide | Left panel: left+both, Right panel: right+both |
| LeftOnly | left+both only |
| RightOnly | right+both only |

---

## User Interactions

### Navigation

| Action | Behavior |
|--------|----------|
| Scroll | Synchronized in SideBySide mode |
| Click minimap | Jump to position |
| Next/Prev file (`S`/`W`) | Navigate between files in file list |
| Next/Prev change (`J`/`K`) | Navigate between change hunks within current file |
| Go to line | Jump to specific line number |
| Find | Search within current view |

**Change Navigation Details:**
- Changes are grouped into "hunks" (consecutive groups of additions/deletions)
- Navigation scrolls to show context lines above the change
- Navigation is disabled for fully added/deleted files (every line is a change)
- Toolbar buttons show disabled state at navigation boundaries

### Selection & Comments

```typescript
interface SelectionBehavior {
  // User selects text
  onSelect(range: TextRange): void {
    // Show "Add Comment" button
    showCommentButton(range);
  }

  // User clicks Add Comment
  onAddComment(range: TextRange): void {
    // Determine which iteration/side
    const location = mapSelectionToLocation(range);

    // Create comment with location
    createCommentThread({
      filePath: currentFile.path,
      location: location,
      iterationId: currentIteration.id
    });
  }
}
```

### Keyboard Shortcuts

#### File Navigation
| Shortcut | Action |
|----------|--------|
| `S` | Next file in file list |
| `W` | Previous file in file list |

#### Change Navigation (within file)
| Shortcut | Action |
|----------|--------|
| `J` | Next change (hunk) |
| `K` | Previous change (hunk) |

**Note:** Change navigation (J/K) is disabled for fully added or deleted files where every line is a change, making navigation meaningless.

#### View Mode Shortcuts
| Shortcut | Action |
|----------|--------|
| `I` | Switch to Inline (Unified) view |
| `X` | Switch to Side-by-Side (Split) view |

#### Content Filter Shortcuts
| Shortcut | Action |
|----------|--------|
| `L` | Show Left only (original) |
| `O` | Show Both (default) |
| `R` | Show Right only (modified) |

#### Display Toggles
| Shortcut | Action |
|----------|--------|
| `F` | Toggle Full file / Changes only |
| `B` | Toggle whitespace visibility |
| `D` | Toggle comments visibility (hides lasso when comments shown) |

#### Other Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Find in file |
| `Ctrl+G` | Go to line |
| `Ctrl+Mouse Wheel` | Zoom |
| `?` | Show keyboard shortcuts modal |

---

## Settings

### User Preferences

```typescript
interface DiffViewerSettings {
  // View
  defaultViewMode: DiffViewMode;
  useSideBySideView: boolean;

  // Display
  showLineNumbers: boolean;
  wordWrap: boolean;
  fontFamily: string;
  fontSize: number;

  // Diff
  ignoreWhitespace: boolean;

  // Comments
  commentDisplayMode: CommentDisplayMode;

  // Theme
  theme: 'light' | 'dark' | 'high-contrast';
}
```

### Settings Effects

| Setting Change | Immediate Effect |
|----------------|------------------|
| Theme | All colors update |
| Font | All text redraws |
| Zoom | Layout recalculates |
| Ignore whitespace | Diff recomputes |
| View mode | Panels reconfigure |
| Word wrap | Text reflows |

---

## Loading States

### Async Loading Pattern

```typescript
enum FileLoadState {
  NotStarted = 'not_started',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error'
}

interface DiffViewerState {
  leftFile: FileLoadState;
  rightFile: FileLoadState;
  diffComputed: boolean;

  // UI shows:
  // - "Just a moment..." while loading
  // - Diff view when ready
  // - Error message if failed
}
```

---

## Performance Considerations

### Large File Handling

- Virtualized rendering (only visible lines rendered)
- Lazy diff computation (compute as user scrolls)
- Cached span trackers per file pair

### Diff Caching

```typescript
interface SpanTrackerCache {
  // Key: file artifact ID + iteration pair
  // Value: precomputed SpanTracker
  cache: Map<string, ISpanTracker>;

  getOrCreate(
    artifact: ReviewArtifact,
    leftIteration: number,
    rightIteration: number
  ): ISpanTracker;
}
```

---

## Platform Considerations

### Web Implementation Notes

For React/TypeScript reimplementation:

1. **Diff Computation**: Use library like `diff-match-patch` or `jsdiff`
2. **Syntax Highlighting**: Use `prism.js`, `highlight.js`, or Monaco Editor
3. **Virtualization**: Use `react-window` or `react-virtualized` for large files
4. **Span Tracking**: Implement custom or use operational transformation concepts
5. **Scroll Sync**: Track scroll position, apply proportionally to left/right views and minimap lasso

### Key Behavioral Requirements

- [ ] Line-level diff highlighting
- [ ] Word-level diff highlighting within lines
- [ ] Four view modes with switching
- [ ] Scroll synchronization in SideBySide
- [ ] Comment position tracking across iterations
- [ ] Whitespace toggle with immediate recompute
- [ ] Minimap overview margin
- [ ] Theme-aware colors
- [ ] Keyboard navigation between diffs (J/K for changes, S/W for files)
