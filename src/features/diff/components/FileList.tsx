import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import { useIterationAwareFiles } from '../hooks';
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
      <div className="file-tree" role="list">
        {/* PR Description entry */}
        <div
          className={`tree-item file ${isDescriptionSelected ? 'selected' : ''}`}
          role="listitem"
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
          <span className="change-type" style={{ backgroundColor: 'var(--toggle-btn-toggled)' }}>
            PR
          </span>
          <span className="tree-label">Pull Request Description</span>
        </div>
        {files.map((file) => (
          <FileListItem
            key={file.filename}
            file={file}
            isSelected={file.originalIndex === selectedFileIndex}
            onClick={() => selectFile(file.originalIndex)}
          />
        ))}
      </div>
    </nav>
  );
}
