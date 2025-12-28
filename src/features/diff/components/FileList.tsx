import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import { FileListItem } from './FileListItem';
import { Skeleton } from '@/components/ui';
import { cn } from '@/utils/cn';

/**
 * List of changed files in the PR
 * S-1.3: AC-1.3.1 through AC-1.3.9
 */
export function FileList() {
  const { files, selectedFileIndex, selectFile, isLoading, error } = useDiffStore();

  if (error) {
    return (
      <div className="p-4 text-red-600" role="alert" aria-live="polite">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" role="status" aria-label="Loading files">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  const isDescriptionSelected = selectedFileIndex === PR_DESCRIPTION_INDEX;

  return (
    <nav aria-label="Changed files">
      {/* AC-1.3.7: File list is keyboard navigable */}
      <ul role="list" className="divide-y divide-gray-200">
        {/* PR Description entry */}
        <li>
          <button
            onClick={() => selectFile(PR_DESCRIPTION_INDEX)}
            type="button"
            aria-current={isDescriptionSelected ? 'location' : undefined}
            aria-label="Pull Request Description"
            className={cn(
              'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
              isDescriptionSelected && 'bg-blue-50 border-l-4 border-blue-600'
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center w-5 h-5 rounded text-xs font-bold text-gray-600 bg-gray-100"
                aria-hidden="true"
              >
                PR
              </span>
              <span className="flex-1 text-sm font-medium">
                Pull Request Description
              </span>
            </div>
          </button>
        </li>
        {files.map((file, index) => (
          <FileListItem
            key={file.filename}
            file={file}
            isSelected={index === selectedFileIndex}
            onClick={() => selectFile(index)}
          />
        ))}
      </ul>
    </nav>
  );
}
