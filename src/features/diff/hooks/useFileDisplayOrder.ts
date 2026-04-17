/**
 * Hook for getting files in display order (matching FileList visual order)
 *
 * Issue #261: Keyboard navigation must follow the same order as the file list display.
 * The display groups files by folder, then sorts folders alphabetically.
 * This hook provides files in that flattened display order.
 */

import { useMemo } from 'react';
import { useIterationAwareFiles, type IterationAwareFile } from './useIterationAwareFiles';
import { groupFilesByFolder, flattenGroupedFiles } from '../utils';

interface FileDisplayOrderResult {
  /** Files in display order (matching FileList visual order) */
  files: IterationAwareFile[];
  /** Whether iteration filtering is active */
  isIterationMode: boolean;
  /** Total files before filtering */
  totalFilesInPR: number;
}

/**
 * Get files in the same order as displayed in the FileList component.
 *
 * This hook ensures keyboard navigation follows the visual display order:
 * 1. Files are grouped by parent folder
 * 2. Folders are sorted alphabetically (root "/" first)
 * 3. Files within each folder maintain their input order (already alphabetically sorted)
 *
 * Use this hook for keyboard navigation instead of useIterationAwareFiles directly.
 */
export function useFileDisplayOrder(): FileDisplayOrderResult {
  const { files: iterationFiles, isIterationMode, totalFilesInPR } = useIterationAwareFiles();

  const filesInDisplayOrder = useMemo(() => {
    const grouped = groupFilesByFolder(iterationFiles);
    return flattenGroupedFiles(grouped);
  }, [iterationFiles]);

  return {
    files: filesInDisplayOrder,
    isIterationMode,
    totalFilesInPR,
  };
}
