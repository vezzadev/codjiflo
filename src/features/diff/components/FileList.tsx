import { useState, useMemo, useCallback, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import { useIterationAwareFiles } from '../hooks';
import { groupFilesByFolder, getBasename } from '../utils';
import { FileListItem } from './FileListItem';
import { Skeleton } from '@/components/ui';

/** Number of items to skip with PageUp/PageDown */
const PAGE_JUMP_SIZE = 10;

/**
 * List of changed files in the PR
 * S-1.3: AC-1.3.1 through AC-1.3.9
 * M4: AC-4.8.11 through AC-4.8.15 (iteration-aware filtering)
 */
export function FileList() {
  const { selectedFileIndex, selectFile, isLoading, error } = useDiffStore();
  const { files } = useIterationAwareFiles();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const treeRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Filter files by filename (case-insensitive match)
  const filteredFiles = useMemo(() => {
    if (!filterText.trim()) return files;
    const lowerFilter = filterText.toLowerCase();
    return files.filter((file) => file.filename.toLowerCase().includes(lowerFilter));
  }, [files, filterText]);

  const groupedFiles = useMemo(() => groupFilesByFolder(filteredFiles), [filteredFiles]);

  const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
  }, []);

  const handleFilterKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setFilterText('');
      filterInputRef.current?.blur();
    }
    // Prevent tree keyboard navigation from triggering when in filter input
    e.stopPropagation();
  }, []);

  const clearFilter = useCallback(() => {
    setFilterText('');
    filterInputRef.current?.focus();
  }, []);

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
          // Otherwise move to next item, stopping at the end (no wrap)
          if (currentIndex === -1) {
            nextIndex = 0;
          } else if (currentIndex < items.length - 1) {
            nextIndex = currentIndex + 1;
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          // When no item is focused (currentIndex === -1), start at first item
          // Otherwise move to previous item, stopping at the start (no wrap)
          if (currentIndex === -1) {
            nextIndex = 0;
          } else if (currentIndex > 0) {
            nextIndex = currentIndex - 1;
          }
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
      {/* Header with integrated filter */}
      <div className="file-explorer-header">
        <div className="file-explorer-filter-inline">
          <Search size={14} className="filter-icon" aria-hidden="true" />
          <input
            ref={filterInputRef}
            type="text"
            className="textbox file-filter-input"
            placeholder="Filter by file name"
            value={filterText}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            aria-label="Filter files by name"
          />
          {filterText && (
            <button
              type="button"
              className="btn-icon filter-clear"
              onClick={clearFilter}
              aria-label="Clear filter"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      {/* AC-1.3.7: File list is keyboard navigable */}
      <div
        ref={treeRef}
        className="file-tree"
        role="tree"
        onKeyDown={handleTreeKeyDown}
      >
        {/* PR Description entry - hidden when filtering */}
        {!filterText && (
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
        )}
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
