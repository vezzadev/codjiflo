import type { FileChange } from '@/api/types';
import { FileChangeStatus } from '@/api/types';

const CHANGE_TYPE_ICONS: Record<FileChangeStatus, string> = {
  [FileChangeStatus.Added]: 'A',
  [FileChangeStatus.Modified]: 'M',
  [FileChangeStatus.Deleted]: 'D',
  [FileChangeStatus.Renamed]: 'R',
};

const CHANGE_TYPE_CLASSES: Record<FileChangeStatus, string> = {
  [FileChangeStatus.Added]: 'add',
  [FileChangeStatus.Modified]: 'edit',
  [FileChangeStatus.Deleted]: 'delete',
  [FileChangeStatus.Renamed]: 'edit',
};

const CHANGE_TYPE_LABELS: Record<FileChangeStatus, string> = {
  [FileChangeStatus.Added]: 'added',
  [FileChangeStatus.Modified]: 'modified',
  [FileChangeStatus.Deleted]: 'deleted',
  [FileChangeStatus.Renamed]: 'renamed',
};

interface FileListItemProps {
  file: FileChange;
  isSelected: boolean;
  onClick: () => void;
  /** Display name (basename) to show instead of full path */
  displayName?: string;
  /** Indentation level (1 = under folder) */
  indent?: number;
}

/**
 * Single file item in the file list
 * S-1.3: AC-1.3.1 through AC-1.3.5
 */
export function FileListItem({ file, isSelected, onClick, displayName, indent }: FileListItemProps) {
  const itemClasses = [
    'tree-item',
    'file',
    isSelected ? 'selected' : '',
    indent ? `indent-${indent}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={itemClasses}
      role="treeitem"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      aria-current={isSelected ? 'location' : undefined}
      aria-label={`${file.filename}, ${CHANGE_TYPE_LABELS[file.status]}, ${String(file.additions)} additions, ${String(file.deletions)} deletions`}
    >
      {/* Filename - AC-1.3.1 */}
      <span className="tree-label" title={file.filename}>
        {displayName ?? file.filename}
      </span>

      {/* Line counts - AC-1.3.3 */}
      <span className="line-counts" aria-hidden="true">
        {file.additions > 0 && <span className="additions">+{file.additions}</span>}
        {file.deletions > 0 && <span className="deletions">−{file.deletions}</span>}
      </span>

      {/* Change type indicator - AC-1.3.2 */}
      <span
        className={`change-type ${CHANGE_TYPE_CLASSES[file.status]}`}
        aria-hidden="true"
      >
        {CHANGE_TYPE_ICONS[file.status]}
      </span>
    </div>
  );
}
