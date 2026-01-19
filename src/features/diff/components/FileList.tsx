import { useState, useMemo } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import { useIterationAwareFiles } from '../hooks';
import { groupFilesByFolder, getBasename } from '../utils';
import { FileListItem } from './FileListItem';
import { Skeleton } from '@/components/ui';

/**
 * List of changed files in the PR
 * S-1.3: AC-1.3.1 through AC-1.3.9
 * M4: AC-4.8.11 through AC-4.8.15 (iteration-aware filtering)
 */
export function FileList() {
  const { selectedFileIndex, selectFile, isLoading, error } = useDiffStore();
  const { files } = useIterationAwareFiles();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const groupedFiles = useMemo(() => groupFilesByFolder(files), [files]);

  const toggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

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
      <div className="file-tree" role="tree">
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
