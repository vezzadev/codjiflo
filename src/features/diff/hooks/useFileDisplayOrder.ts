/**
 * Hook for getting files in display order (matching FileList visual order)
 *
 * Issue #261: Keyboard navigation must follow the same order as the file list display.
 * The display groups files by folder, then sorts folders alphabetically.
 * This hook provides files in that flattened display order.
 */

import { useMemo } from 'react';
import { useIterationAwareFiles, type IterationAwareFile } from './useIterationAwareFiles';

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
 * Group files by their parent directory
 * Note: This is duplicated from FileList.tsx to avoid circular dependencies.
 * The canonical implementation is in FileList.tsx - keep them in sync.
 */
function groupFilesByFolder(files: IterationAwareFile[]): FileGroup[] {
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
 * Flatten grouped files into display order
 */
function flattenGroupedFiles(groups: FileGroup[]): IterationAwareFile[] {
  const result: IterationAwareFile[] = [];
  for (const group of groups) {
    result.push(...group.files);
  }
  return result;
}

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
