import { useDiffStore } from '../stores';
import { DiffViewMode, DiffContentFilter, DiffDisplayMode } from '../types';

/**
 * Toolbar for switching diff view modes
 * Implements S-3.3: View Mode Toggle Buttons
 * AC-3.3.1 through AC-3.3.16
 */
export function DiffViewModeToolbar() {
  const { viewMode, contentFilter, displayMode, setViewMode, setContentFilter, setDisplayMode } =
    useDiffStore();

  return (
    <div
      className="flex items-center gap-4 px-4 py-2 border-b bg-gray-50"
      role="toolbar"
      aria-label="Diff view options"
    >
      {/* Primary View Mode Toggle (Unified/Side-by-Side) */}
      {/* AC-3.3.1, AC-3.3.2 */}
      <div className="flex items-center gap-2" role="group" aria-label="View mode">
        <span className="text-sm font-medium text-gray-700">View:</span>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setViewMode(DiffViewMode.Inline)}
            className={`px-3 py-1.5 text-sm font-medium border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              viewMode === DiffViewMode.Inline
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={viewMode === DiffViewMode.Inline}
            title="Unified diff view (Keyboard: U)"
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setViewMode(DiffViewMode.SideBySide)}
            className={`px-3 py-1.5 text-sm font-medium border-t border-b border-r rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              viewMode === DiffViewMode.SideBySide
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={viewMode === DiffViewMode.SideBySide}
            title="Side-by-side diff view (Keyboard: S)"
          >
            Side-by-Side
          </button>
        </div>
      </div>

      {/* Content Filter Toggle (Left/Both/Right) */}
      {/* AC-3.3.5 through AC-3.3.9 */}
      <div className="flex items-center gap-2" role="group" aria-label="Content filter">
        <span className="text-sm font-medium text-gray-700">Show:</span>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setContentFilter(DiffContentFilter.Left)}
            className={`px-3 py-1.5 text-sm font-medium border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              contentFilter === DiffContentFilter.Left
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={contentFilter === DiffContentFilter.Left}
            title="Show only original file with deletions"
          >
            Left Only
          </button>
          <button
            type="button"
            onClick={() => setContentFilter(DiffContentFilter.Both)}
            className={`px-3 py-1.5 text-sm font-medium border-t border-b focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              contentFilter === DiffContentFilter.Both
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={contentFilter === DiffContentFilter.Both}
            title="Show standard diff view"
          >
            Both
          </button>
          <button
            type="button"
            onClick={() => setContentFilter(DiffContentFilter.Right)}
            className={`px-3 py-1.5 text-sm font-medium border rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              contentFilter === DiffContentFilter.Right
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={contentFilter === DiffContentFilter.Right}
            title="Show only modified file with additions"
          >
            Right Only
          </button>
        </div>
      </div>

      {/* Display Mode Toggle (Changes Only / Full File) */}
      {/* AC-3.1.10, AC-3.1.11 */}
      <div className="flex items-center gap-2 ml-auto" role="group" aria-label="Display mode">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setDisplayMode(DiffDisplayMode.ChangesOnly)}
            className={`px-3 py-1.5 text-sm font-medium border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              displayMode === DiffDisplayMode.ChangesOnly
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={displayMode === DiffDisplayMode.ChangesOnly}
            title="Show only changed lines"
          >
            Changes Only
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode(DiffDisplayMode.FullFile)}
            className={`px-3 py-1.5 text-sm font-medium border-t border-b border-r rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              displayMode === DiffDisplayMode.FullFile
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={displayMode === DiffDisplayMode.FullFile}
            title="Show complete file content"
          >
            Full File
          </button>
        </div>
      </div>
    </div>
  );
}
