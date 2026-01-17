import { useState, useMemo, useCallback, useRef, type KeyboardEvent } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import { useIterationAwareFiles, type IterationAwareFile } from '../hooks';
import { FileListItem } from './FileListItem';
import { Skeleton } from '@/components/ui';

/** Number of items to skip with PageUp/PageDown */
const PAGE_JUMP_SIZE = 10;

interface FileGroup {
  folder: string;
  files: IterationAwareFile[];
}

/**
 * Get parent directory path from a filename
 */
function getParentPath(filename: string): string {
  const lastSlash = filename.lastIndexOf('/');
  if (lastSlash === -1) return '/';
  return '/' + filename.substring(0, lastSlash);
}

/**
 * Get basename from a filename
 */
function getBasename(filename: string): string {
  const lastSlash = filename.lastIndexOf('/');
  if (lastSlash === -1) return filename;
  return filename.substring(lastSlash + 1);
}

/**
 * Group files by their parent directory
 */
export function groupFilesByFolder(files: IterationAwareFile[]): FileGroup[] {
  const groups = new Map<string, IterationAwareFile[]>();
  for (const file of files) {
    const folder = getParentPath(file.filename);
    const existing = groups.get(folder);
    if (existing) {
      existing.push(file);
    } else {
      groups.set(folder, [file]);
    }
  }
  // Sort folders alphabetically, root "/" first
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)))
    .map(([folder, files]) => ({ folder, files }));
}

/**
 * List of changed files in the PR
 * S-1.3: AC-1.3.1 through AC-1.3.9
 * M4: AC-4.8.11 through AC-4.8.15 (iteration-aware filtering)
 */
export function FileList() {
  const { selectedFileIndex, selectFile, isLoading, error } = useDiffStore();
  const { files } = useIterationAwareFiles();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const treeRef = useRef<HTMLDivElement>(null);

  const groupedFiles = useMemo(() => groupFilesByFolder(files), [files]);

  const toggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  /**
   * Get all focusable tree items in DOM order
   */
  const getTreeItems = useCallback((): HTMLElement[] => {
    if (!treeRef.current) return [];
    return Array.from(treeRef.current.querySelectorAll<HTMLElement>('[role="treeitem"]'));
  }, []);

  /**
   * Handle keyboard navigation within the file tree
   * Arrow keys move focus, PageUp/PageDown jump by PAGE_JUMP_SIZE
   */
  const handleTreeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const items = getTreeItems();
      if (items.length === 0) return;

      const currentIndex = items.findIndex((item) => item === document.activeElement);
      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          // When no item is focused (currentIndex === -1), start at first item
          nextIndex =
            currentIndex === -1
              ? 0
              : currentIndex < items.length - 1
                ? currentIndex + 1
                : 0;
          break;
        case 'ArrowUp':
          e.preventDefault();
          // When no item is focused (currentIndex === -1), start at first item
          nextIndex =
            currentIndex === -1
              ? 0
              : currentIndex > 0
                ? currentIndex - 1
                : items.length - 1;
          break;
        case 'PageDown':
          e.preventDefault();
          nextIndex = Math.min(currentIndex + PAGE_JUMP_SIZE, items.length - 1);
          break;
        case 'PageUp':
          e.preventDefault();
          nextIndex = Math.max(currentIndex - PAGE_JUMP_SIZE, 0);
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = items.length - 1;
          break;
      }

      if (nextIndex !== null) {
        const nextItem = items[nextIndex];
        if (nextItem) {
          nextItem.focus();
        }
      }
    },
    [getTreeItems]
  );

  if (error) {
    return (
      <div
        style={{ padding: '16px', color: 'var(--error-fg)' }}
        role="alert"
        aria-live="polite"
      >
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="skeleton-text-wrapper" style={{ padding: '16px' }} role="status" aria-label="Loading files">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Skeleton width="20px" height="20px" />
            <Skeleton width="100%" height="16px" />
          </div>
        ))}
      </div>
    );
  }

  const isDescriptionSelected = selectedFileIndex === PR_DESCRIPTION_INDEX;

  return (
    <nav aria-label="Changed files">
      {/* AC-1.3.7: File list is keyboard navigable */}
      <div
        ref={treeRef}
        className="file-tree"
        role="tree"
        onKeyDown={handleTreeKeyDown}
      >
        {/* PR Description entry */}
        <div
          className={`tree-item file ${isDescriptionSelected ? 'selected' : ''}`}
          role="treeitem"
          onClick={() => selectFile(PR_DESCRIPTION_INDEX)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectFile(PR_DESCRIPTION_INDEX);
            }
          }}
          tabIndex={0}
          aria-current={isDescriptionSelected ? 'location' : undefined}
          aria-label="Pull Request Description"
        >
          <span className="change-type" style={{ backgroundColor: 'var(--toggle-btn-toggled)' }} aria-hidden="true">
            PR
          </span>
          <span className="tree-label" aria-hidden="true">Pull Request Description</span>
        </div>
        {groupedFiles.map(({ folder, files: folderFiles }) => {
          const isCollapsed = collapsedFolders.has(folder);
          return (
            <div key={folder} role="group" aria-label={`Folder ${folder}`}>
              {/* Folder header */}
              <div
                className={`tree-item folder ${!isCollapsed ? 'expanded' : ''}`}
                role="treeitem"
                aria-expanded={!isCollapsed}
                aria-label={folder}
                onClick={() => toggleFolder(folder)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFolder(folder);
                  }
                }}
                tabIndex={0}
              >
                <span className="tree-toggle" role="presentation" aria-hidden="true" />
                <span className="tree-label" role="presentation" aria-hidden="true">{folder}</span>
              </div>
              {/* Files in folder */}
              {!isCollapsed &&
                folderFiles.map((file) => (
                  <FileListItem
                    key={file.filename}
                    file={file}
                    isSelected={file.originalIndex === selectedFileIndex}
                    onClick={() => selectFile(file.originalIndex)}
                    displayName={getBasename(file.filename)}
                    indent={1}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
