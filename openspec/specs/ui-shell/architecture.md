# ui-shell — Architecture

> Companion to [spec.md](./spec.md). Records implementation reference, not requirements.

The ui-shell capability covers the chrome around the diff and comments: the dashboard, file
explorer, properties panel, layout grid, status bar, theme handling, and resizable panes.
This sidecar focuses on the pieces whose implementation strategy is non-obvious from the
spec text — chiefly the file-explorer tree.

## File-explorer tree

Implementation lives in `src/features/diff/components/FileList.tsx`. The primitive layer is
`react-aria-components` (`Tree` + `TreeItem` + `TreeItemContent` + `Collection` + the
inline `RAButton slot="chevron"`). See
[`ui-primitives/architecture.md`](../ui-primitives/architecture.md#tree-integration) for
the rationale (components API vs. hooks API, why no wrapper).

### What the spec says vs. what react-aria provides

| Spec requirement | Provided by react-aria | Notes |
|---|---|---|
| Up / Down move between visible nodes | ✅ Standard keymap | Respects expansion / filter |
| Enter opens the selected file | ✅ Wired via `onAction` → `selectFile` | |
| Folders expand / collapse | ✅ Left / Right keys + chevron button | `<RAButton slot="chevron">` is a real button |
| PR Description pinned at top | ⚙️ Sibling `TreeItem` outside `Collection` | Survives filter / expansion |
| Filename filter (substring, real-time) | ⚙️ Caller filters `items` before handing to `<Tree>` | react-aria does not know the filter exists |
| Filter clears on Escape | ⚙️ `SearchField` (Escape clears input) | Whole panel does not unmount on Escape; only the field clears |
| Space toggles marked state | ❌ Not in react-aria's default keymap | **Pre-existing gap** — the hand-rolled handler did not implement it either |
| Ctrl+C copies the path | ❌ Not in react-aria's default keymap | Same — pre-existing gap |

The two gaps are inherited from the previous implementation, not introduced by the
adopt-react-aria migration. They are tracked outside this change.

### Role shape

The rendered DOM emits `role="treegrid"` (NOT `role="tree"`) with `role="row"` items
containing a `role="gridcell"`. This is the standard react-aria-components Tree shape. Tests
that previously queried `getByRole('tree')` / `getByRole('treeitem')` now query
`getByRole('treegrid')` / `getByRole('row')`.

### State

| UI state | Source of truth | Derived from |
|---|---|---|
| `expandedKeys` | react-aria | `collapsedFolders: Set` from `useDiffStore` |
| `selectedKeys` | react-aria | `selectedFileIndex` from `useDiffStore` |
| Filter text | `useDiffStore` | Caller filters items before render |
| Action routing | `handleAction` | Detects `PR_DESCRIPTION_KEY` / `folder:` / `file:` prefixes |

`onSelectionChange` is the single entry point; folder rows toggle expansion via
`handleAction` and file rows route to `selectFile`.

### Legacy CSS class hooks

`className={({ isSelected }) => …}` / `className={({ isExpanded }) => …}` keeps the legacy
`.selected` / `.expanded` class hooks alive for the existing CSS. In parallel, react-aria
emits `[data-selected]` / `[data-expanded]` so hover / focus-visible styling can use the
data-attribute contract documented in `ui-primitives/architecture.md`.

## Theme handling

The theme modal (`src/features/theme/components/ThemeModal.tsx`) renders the Modal
primitive (M1) with three `RadioGroup`s for UI Theme / Diff Colors / Contrast. Theme is
applied by toggling a class on `<body>` (e.g. `theme-dark`). The diff preview swatch was
restructured during M5 to render `<Radio value="regular" | "high-contrast">` inside its
own `RadioGroup` rather than hand-rolled `<input type="radio">` markup.

## Layout & resizable panes

Out of scope for the adopt-react-aria migration; documented here for future reference.
The shell uses native CSS Grid for the top-level layout (titlebar / left pane / main /
bottom pane / right pane / status bar). Pane resize handles are not yet on the react-aria
roadmap and remain hand-rolled.

---

## Theme System

CSS custom properties-based theme system supporting multiple visual styles.

### Available Themes

```typescript
type Theme = 'dark' | 'light' | 'black' | 'highcontrast';
```

| Theme | Description |
|-------|-------------|
| `dark` | Default theme, dark gray backgrounds |
| `light` | Light backgrounds, dark text |
| `black` | Pure black backgrounds for OLED |
| `highcontrast` | High contrast for accessibility |

### Theme Store

```typescript
interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}
```

Theme selection persists to localStorage under key `codjiflo-theme`.

### CSS Custom Properties

Themes are implemented via CSS custom properties (170+ variables) in `src/styles/themes/variables.css`. Key categories:

- **Main colors**: `--main-bg`, `--main-fg`, `--default-bg`, `--error-fg`
- **Controls**: `--control-bg`, `--control-fg`, `--control-disabled`
- **Buttons**: `--btn-hover`, `--btn-press`, `--btn-disabled`
- **Diff colors**: `--diff-add-line`, `--diff-delete-line`, `--diff-add-word`, `--diff-delete-word`
- **File explorer**: `--file-explorer-bg`, `--file-explorer-header`
- **Window chrome**: `--window-bg`, `--titlebar-text`, `--sidebar-bg`

---

## Layout Components

Desktop-style window layout with resizable panels.

### Component Hierarchy

```
AppShell
├── Titlebar
└── content-wrapper
    ├── LeftPane (resizable)
    │   └── ResizeHandle
    ├── MainContent
    └── BottomPane (resizable)
        └── ResizeHandle
```

### Layout Store

```typescript
interface LayoutState {
  leftPaneWidth: number;        // Default: 330px, Range: 200-600px
  bottomPaneHeight: number;     // Default: 200px, Range: 100-500px
  setLeftPaneWidth: (width: number) => void;
  setBottomPaneHeight: (height: number) => void;
  resizeLeftPane: (delta: number) => void;
  resizeBottomPane: (delta: number) => void;
}
```

Layout dimensions persist to localStorage under key `codjiflo-layout`.

### Component Interfaces

```typescript
interface TitlebarProps {
  title?: string;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
}

interface LeftPaneProps {
  children: ReactNode;
}

interface MainContentProps {
  children: ReactNode;
}

interface BottomPaneProps {
  children: ReactNode;
  visible?: boolean;
}

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}
```

---

## File Explorer

Hierarchical tree view of files with change indicators.

### Node Types

```typescript
interface ExplorerNode {
  type: 'file' | 'folder' | 'discussion';
  fileName: string;
  fullDepotPath: string;
  isVisible: boolean;
  isMarked: boolean;            // User marked for attention
  isSelected: boolean;

  // For files
  changeType?: ChangeType;
  isAcquired?: boolean;         // Content downloaded
  artifactTags?: string[];
}

interface FileNode extends ExplorerNode {
  type: 'file';
  changeType: ChangeType;
  acquisitionState: AcquisitionState;
  iterationClarification?: string;  // "(Iteration X Only)"
}

interface FolderNode extends ExplorerNode {
  type: 'folder';
  children: ExplorerNode[];
  markStatus: 'none' | 'partial' | 'all';  // Aggregated from children
}

interface DiscussionNode extends ExplorerNode {
  type: 'discussion';
  isFixed: true;                // Always visible
}
```

### Change Types

```typescript
enum ChangeType {
  None = 'none',
  Add = 'add',
  Delete = 'delete',
  Edit = 'edit',
  Rename = 'rename',
  Move = 'move',
  RenameEdit = 'rename_edit',
  MoveEdit = 'move_edit'
}
```

### Acquisition States

```typescript
enum AcquisitionState {
  Unacquired = 'unacquired',
  Acquiring = 'acquiring',
  Acquired = 'acquired',
  Hashed = 'hashed',
  Error = 'error',
  Unknown = 'unknown'
}
```

### Filtering

The file explorer header contains an inline filter input for quick file name filtering.

#### Filter UI

| Element | Description |
|---------|-------------|
| Search icon | Visual indicator (non-interactive) |
| Filter input | Text input with placeholder "Filter by file name" |
| Clear button | X icon button, visible only when filter has text |

#### Filter Behavior

- **Case-insensitive substring match**: Filters files by filename
- **PR Description**: Shown when filter matches "Pull Request Description" or when empty
- **Escape key**: Clears filter and blurs input
- **Real-time**: Filtering updates immediately as user types

```typescript
interface FileExplorerFilter {
  // Name filter
  fileNamePattern?: string;
  useRegex: boolean;

  // Tag filter
  artifactTags?: string[];

  // Change type filter
  showUnchangedIterationFiles: boolean;
  showUnchangedCompareFiles: boolean;
  showRenamedFiles: boolean;
}
```

### Navigation

```typescript
interface FileExplorerNavigation {
  // Get adjacent nodes (respecting filter)
  getNextNode(skipFiltered: boolean): ExplorerNode | null;
  getPreviousNode(skipFiltered: boolean): ExplorerNode | null;

  // Programmatic selection
  selectNode(node: ExplorerNode): Promise<void>;
}
```

### Actions

| Action | Description |
|--------|-------------|
| Mark/Unmark | Toggle marked state |
| Copy Path | Copy depot/local path |
| Copy File Name | Copy just the name |
| Open Containing Folder | Open in OS explorer |
| Compare External | Open in external diff tool |
| Open Left/Right | Open specific version |

---

## Review Properties

Display dynamic review and iteration metadata.

### Property Model

```typescript
interface ReviewProperty {
  // Display
  caption: string;
  captionTooltip?: string;
  displayText: string;
  displayTextTooltip?: string;

  // Styling
  foregroundColor?: string;
  backgroundColor?: string;
  statusColor?: StatusColor;

  // Links
  displayTextLinkTarget?: string;   // URL for value
  captionHelpLinkTarget?: string;   // URL for help

  // Action button
  actionButtonCaption?: string;
  actionButtonTooltip?: string;
  shouldDisplayAction: boolean;
  shouldEnableAction: boolean;
  runActionAsync(): Promise<void>;

  // Metadata
  providerName: string;
  statusContext?: string;
}

enum StatusColor {
  Success = 'success',    // Green
  Warning = 'warning',    // Yellow
  Error = 'error',        // Red
  Pending = 'pending',    // Gray
  Custom = 'custom'
}
```

### Property Sources

Properties come from:
1. **Policies** - Build status, approver count, etc.
2. **Plugins** - Custom static analysis results
3. **Review metadata** - Title, description, work items

### Display Sections

```typescript
interface ReviewPropertiesPane {
  reviewProperties: ReviewProperty[];      // Review-level
  iterationProperties: ReviewProperty[];   // Iteration-level

  showReviewProperties: boolean;
  showIterationProperties: boolean;
  iterationPropertiesTitle: string;        // "Iteration N"
}
```

---

## Persistence

User preferences stored in localStorage.

### Storage Keys

| Key | Content |
|-----|---------|
| `codjiflo-theme` | Theme selection (`dark`, `light`, `black`, `highcontrast`) |
| `codjiflo-layout` | Panel dimensions (`leftPaneWidth`, `bottomPaneHeight`) |
| `codjiflo-auth` | Authentication state |

### Persisted Settings by Feature

- **Theme**: Current theme selection
- **Layout**: Left pane width, bottom pane height
- **File Explorer**: Column widths, show/hide options (future)
- **Dashboard**: Account, filters, group expansion (future)

---

## Keyboard Shortcuts (reference)

### Dashboard

| Key | Action |
|-----|--------|
| Enter | Open selected review |
| Delete | Remove subscription |
| Ctrl+C | Copy review link |

### File Explorer

| Key | Action |
|-----|--------|
| Up/Down | Navigate files |
| Enter | Open selected file |
| Space | Toggle marked |
| Ctrl+C | Copy path |

### Review Properties

| Key | Action |
|-----|--------|
| Enter | Activate link/button |
| Tab | Navigate between properties |
