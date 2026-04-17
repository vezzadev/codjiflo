/**
 * Utilities for grouping files by folder.
 *
 * Used by both FileList component and useFileDisplayOrder hook to ensure
 * consistent file ordering across the UI and keyboard navigation.
 */

import type { IterationAwareFile } from '../hooks/useIterationAwareFiles';

export interface FileGroup {
  folder: string;
  files: IterationAwareFile[];
}

/**
 * Get parent directory path from a filename.
 * Returns '/' for root-level files (no directory separator).
 */
export function getParentPath(filename: string): string {
  const lastSlash = filename.lastIndexOf('/');
  if (lastSlash === -1) return '/';
  return '/' + filename.substring(0, lastSlash);
}

/**
 * Get basename (filename without directory) from a path.
 */
export function getBasename(filename: string): string {
  const lastSlash = filename.lastIndexOf('/');
  if (lastSlash === -1) return filename;
  return filename.substring(lastSlash + 1);
}

/**
 * Group files by their parent directory.
 * Folders are sorted alphabetically with root '/' first.
 */
export function groupFilesByFolder(files: IterationAwareFile[]): FileGroup[] {
  const groups: Map<string, IterationAwareFile[]> = new Map();
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
 * Flatten grouped files into a single array in display order.
 */
export function flattenGroupedFiles(groups: FileGroup[]): IterationAwareFile[] {
  const result: IterationAwareFile[] = [];
  for (const group of groups) {
    result.push(...group.files);
  }
  return result;
}
