# diff-viewing — Architecture

> Implementation reference. The behavioral contract lives in [spec.md](spec.md).

The diff feature uses a composable pipeline of React hooks where each stage handles one concern.

## Pipeline Stages

```
Source → Filter → Shape → Display → SideFilter → Navigation → Comments → render
```

| Stage | Hook | Responsibility |
|-------|------|----------------|
| 1 | `useDiffSource` | Get raw diff from GitHub API or iteration artifact |
| 2 | `useDiffFilter` | Apply full-file vs changes-only filtering |
| 3 | `useDiffShape` | Shape data for inline vs side-by-side |
| 4 | `useDiffDisplay` | Apply display options (whitespace, line numbers) |
| 5 | `useDiffSideFilter` | Filter by side (left/right/both) |
| 6 | `useDiffNavigation` | Calculate hunk indices and scroll targets |
| 7 | `useDiffComments` | Map comment threads to line positions |

## Key Files

| File | Purpose |
|------|---------|
| `src/features/diff/hooks/pipeline/*.ts` | Pipeline stage hooks |
| `src/features/diff/hooks/useDiffPipeline.ts` | Composite hook |
| `src/features/diff/hooks/useDraftComment.ts` | Comment draft state |
| `src/features/diff/hooks/useContainerHeight.ts` | Virtualization support |
| `src/features/diff/components/DiffView.tsx` | Main orchestrator |

## Benefits

- Each stage testable in isolation
- Memoization at each stage boundary
- Clear data flow for debugging

## View Modes (types)

### Four Display Modes

```typescript
enum DiffViewMode {
  Inline = 'inline',           // Unified view, changes interleaved
  SideBySide = 'side_by_side', // Two panels, left=old, right=new
  LeftOnly = 'left_only',      // Only original file
  RightOnly = 'right_only'     // Only modified file
}
```

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

### Whitespace Handling

```typescript
enum WhitespaceBehavior {
  None = 'none',                    // Show all whitespace changes
  IgnoreAllWhitespace = 'ignore'    // Hide whitespace-only changes
}
```

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

### Identity Span Tracker (Optimization)

When left and right files are identical:
- No real diff exists
- Tracking returns spans unchanged
- Optimization to skip unnecessary computation

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

## Overview Margin (Minimap)

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

**Colors:**

| Element | CSS Variable | Purpose |
|---------|-------------|---------|
| Deletions | `--diff-delete-word` | Red highlight on left bar |
| Additions | `--diff-add-word` | Green highlight on right bar |
| Lasso stroke | `#505050` | Gray outline around visible viewport |

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

**25% Viewport Positioning:**

Both click and drag navigation position the target line at **25% of the viewport height** (near the top with context above):

```
clickRatio = (y - barTop) / barHeight
targetLine = clickRatio * totalLines
scrollPosition = targetLine - (0.25 * visibleLines)
```

**Asymmetric Lasso Heights:**

When files have different line counts, the lasso height on each side reflects what portion of that file is actually visible in the viewport:

```
leftLassoHeight = (visibleLeftLines / totalLeftLines) * leftBarHeight
rightLassoHeight = (visibleRightLines / totalRightLines) * rightBarHeight
```

**View Mode Adaptation:**

The minimap adapts its display based on the current view mode:

| View Mode | Left Bar Shows | Right Bar Shows | Click Behavior |
|-----------|---------------|-----------------|----------------|
| **Inline** | Removed regions | Added regions | Scrolls unified view |
| **Side-by-Side** | Removed regions | Added regions | Scrolls respective panel, syncs the other |
| **Left Only** | Removed regions | (grayed out) | Scrolls left view only |
| **Right Only** | (grayed out) | Added regions | Scrolls right view only |

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

## Performance / Caching

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

## Platform Notes

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
- [ ] Full keyboard shortcut support (I/X for view modes, L/O/R for filters, F/C for full/changes, B/D/P for toggles)
- [ ] Scroll navigation (Space, PageDown/PageUp, Home/End)
- [ ] Text wrap toggle
