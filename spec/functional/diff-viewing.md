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

Minimap has two bars, with 100% of their height visible at all times. The left bar is highlighted in red in the region proportional to the lines that were removed or modified. The right bar is highlighted in yellow in the region proportional to the lines that were added or modified. A lasso surrounds the parts of the bar that correspond to the code chunk that is in the viewport. As the user scrolls, the lasso is auto updated. Users may also click on the bars or drag the lasso to scroll directly to the region of interest.

```typescript
interface OverviewMargin {
  width: 60;  // pixels

  // Visual elements
  leftBar: Rectangle;   // Shows diff blocks in left file
  rightBar: Rectangle;  // Shows diff blocks in right file
  viewport: Rectangle;  // Current visible area indicator

  // Interactions
  onClick(y: number): void;  // Jump to position
  onDrag(y: number): void;   // Scroll to position
}
```

### Comment Margins

Multiple margin types for comment display:

| Margin | Purpose |
|--------|---------|
| CommentMargin | Minimized comment indicators |
| CommentTextMargin | Full comment content |
| CommentStatusMargin | Thread status icons |

### Line Number Margin

- Toggleable via settings
- Shows line numbers for both sides
- Highlights lines with comments

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
| Next/Prev diff | Navigate between change blocks |
| Go to line | Jump to specific line number |
| Find | Search within current view |

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

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Find in file |
| `F7` | Next difference |
| `Shift+F7` | Previous difference |
| `Ctrl+G` | Go to line |
| `Ctrl+Mouse Wheel` | Zoom |

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
- [ ] Keyboard navigation between diffs
