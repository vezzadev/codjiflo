# UI Components Specification

---

## 1. Theme System

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

## 2. Layout Components

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

## 3. File Explorer

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

## 4. Review Properties

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

## 5. Persistence

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

## 6. Keyboard Shortcuts

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
