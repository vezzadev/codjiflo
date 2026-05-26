import { useState, useMemo, useCallback, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Tree, TreeItem, TreeItemContent, Collection, Button as RAButton } from 'react-aria-components';
import type { Selection, Key } from 'react-aria-components';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import { useIterationAwareFiles } from '../hooks';
import { groupFilesByFolder, getBasename } from '../utils';
import { Skeleton } from '@/components/ui';
import type { IterationAwareFile } from '../hooks';
import { FileChangeStatus } from '@/api/types';

const PR_DESCRIPTION_KEY = '__pr_description__';

const CHANGE_TYPE_ICONS: { [key in FileChangeStatus]: string } = {
  [FileChangeStatus.Added]: 'A',
  [FileChangeStatus.Modified]: 'M',
  [FileChangeStatus.Deleted]: 'D',
  [FileChangeStatus.Renamed]: 'R',
};

const CHANGE_TYPE_CLASSES: { [key in FileChangeStatus]: string } = {
  [FileChangeStatus.Added]: 'add',
  [FileChangeStatus.Modified]: 'edit',
  [FileChangeStatus.Deleted]: 'delete',
  [FileChangeStatus.Renamed]: 'edit',
};

const CHANGE_TYPE_LABELS: { [key in FileChangeStatus]: string } = {
  [FileChangeStatus.Added]: 'added',
  [FileChangeStatus.Modified]: 'modified',
  [FileChangeStatus.Deleted]: 'deleted',
  [FileChangeStatus.Renamed]: 'renamed',
};

function fileKey(file: IterationAwareFile): string {
  return `file:${String(file.originalIndex)}:${file.filename}`;
}

function folderKey(folder: string): string {
  return `folder:${folder}`;
}

export function FileList() {
  const { selectedFileIndex, selectFile, isLoading, error } = useDiffStore();
  const { files } = useIterationAwareFiles();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const filterInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = useMemo(() => {
    if (!filterText.trim()) return files;
    const lowerFilter = filterText.toLowerCase();
    return files.filter((file) => file.filename.toLowerCase().includes(lowerFilter));
  }, [files, filterText]);

  const groupedFiles = useMemo(() => groupFilesByFolder(filteredFiles), [filteredFiles]);

  const showPrDescription = !filterText.trim() || 'pull request description'.includes(filterText.toLowerCase());

  const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
  }, []);

  const handleFilterKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setFilterText('');
      filterInputRef.current?.blur();
    }
    e.stopPropagation();
  }, []);

  const clearFilter = useCallback(() => {
    setFilterText('');
    filterInputRef.current?.focus();
  }, []);

  const expandedKeys = useMemo<Set<Key>>(() => {
    const keys: Set<Key> = new Set();
    for (const { folder } of groupedFiles) {
      if (!collapsedFolders.has(folder)) keys.add(folderKey(folder));
    }
    return keys;
  }, [groupedFiles, collapsedFolders]);

  const handleExpandedChange = useCallback(
    (next: Set<Key>) => {
      setCollapsedFolders(() => {
        const nextCollapsed: Set<string> = new Set();
        for (const { folder } of groupedFiles) {
          if (!next.has(folderKey(folder))) nextCollapsed.add(folder);
        }
        return nextCollapsed;
      });
    },
    [groupedFiles]
  );

  const selectedKeys = useMemo<Selection>(() => {
    if (selectedFileIndex === PR_DESCRIPTION_INDEX) return new Set([PR_DESCRIPTION_KEY]);
    const match = filteredFiles.find((f) => f.originalIndex === selectedFileIndex);
    return match ? new Set([fileKey(match)]) : new Set();
  }, [selectedFileIndex, filteredFiles]);

  const toggleFolder = useCallback(
    (key: Key) => {
      setCollapsedFolders((prev) => {
        const folder = String(key).slice('folder:'.length);
        const next = new Set(prev);
        if (next.has(folder)) next.delete(folder);
        else next.add(folder);
        return next;
      });
    },
    []
  );

  const handleAction = useCallback(
    (key: Key) => {
      const keyStr = String(key);
      if (keyStr === PR_DESCRIPTION_KEY) {
        selectFile(PR_DESCRIPTION_INDEX);
        return;
      }
      if (keyStr.startsWith('folder:')) {
        toggleFolder(key);
        return;
      }
      if (keyStr.startsWith('file:')) {
        const file = filteredFiles.find((f) => fileKey(f) === keyStr);
        if (file) selectFile(file.originalIndex);
      }
    },
    [filteredFiles, selectFile, toggleFolder]
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

  return (
    <nav aria-label="Changed files">
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
      <Tree
        aria-label="Changed files tree"
        className="file-tree"
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => {
          if (keys === 'all') return;
          const first = keys.values().next().value;
          if (first !== undefined) handleAction(first);
        }}
        // react-aria's Tree fires onAction on Enter/double-click; for our single-click
        // semantics we route through onSelectionChange. Folder rows toggle expansion
        // there; files select. Chevron Button still toggles via expandedKeys.
        onAction={handleAction}
        expandedKeys={expandedKeys}
        onExpandedChange={(keys) => {
          handleExpandedChange(keys);
        }}
        disallowEmptySelection={false}
      >
        {showPrDescription ? (
          <TreeItem
            id={PR_DESCRIPTION_KEY}
            textValue="Pull Request Description"
            className={({ isSelected }) => `tree-item file ${isSelected ? 'selected' : ''}`}
          >
            <TreeItemContent>
              <span className="change-type" style={{ backgroundColor: 'var(--toggle-btn-toggled)' }} aria-hidden="true">PR</span>
              <span className="tree-label" aria-hidden="true">Pull Request Description</span>
            </TreeItemContent>
          </TreeItem>
        ) : null}
        <Collection items={groupedFiles}>
          {(group) => (
            <TreeItem
              id={folderKey(group.folder)}
              textValue={group.folder}
              className={({ isExpanded }) => `tree-item folder ${isExpanded ? 'expanded' : ''}`}
            >
              <TreeItemContent>
                <RAButton
                  slot="chevron"
                  className="tree-toggle"
                  aria-label={`Toggle ${group.folder}`}
                />
                <span className="tree-label" role="presentation" aria-hidden="true">{group.folder}</span>
              </TreeItemContent>
              <Collection items={group.files}>
                {(file) => (
                  <TreeItem
                    id={fileKey(file)}
                    textValue={getBasename(file.filename)}
                    className={({ isSelected }) => `tree-item file indent-1 ${isSelected ? 'selected' : ''}`}
                    aria-label={`${getBasename(file.filename)}, ${CHANGE_TYPE_LABELS[file.status]}, ${String(file.additions)} additions, ${String(file.deletions)} deletions`}
                  >
                    <TreeItemContent>
                      <span className="tree-label" title={file.filename} aria-hidden="true">
                        {getBasename(file.filename)}
                      </span>
                      <span className="line-counts" aria-hidden="true">
                        {file.additions > 0 && <span className="additions">+{file.additions}</span>}
                        {file.deletions > 0 && <span className="deletions">−{file.deletions}</span>}
                      </span>
                      <span className={`change-type ${CHANGE_TYPE_CLASSES[file.status]}`} aria-hidden="true">
                        {CHANGE_TYPE_ICONS[file.status]}
                      </span>
                    </TreeItemContent>
                  </TreeItem>
                )}
              </Collection>
            </TreeItem>
          )}
        </Collection>
      </Tree>
    </nav>
  );
}
