/**
 * Hook for computing iteration-aware file list with filtering and stats
 *
 * When iteration mode is active, this hook:
 * - Filters out files with no changes in the selected range
 * - Computes additions/deletions from the iteration diff
 * - Derives file status from the iteration range
 */

import { useMemo } from 'react';
import { useDiffStore } from '../stores';
import { useIterationDiff } from './useIterationDiff';
import type { FileChange } from '@/api/types';
import { FileChangeStatus } from '@/api/types';
import type { ParsedDiffLine } from '../types';

export interface IterationAwareFile extends FileChange {
  /** Original GitHub index for file selection */
  originalIndex: number;
  /** Artifact ID if in iteration mode */
  artifactId?: number;
}

interface IterationAwareFilesResult {
  /** Files filtered and with stats updated for iteration range */
  files: IterationAwareFile[];
  /** Whether iteration filtering is active */
  isIterationMode: boolean;
  /** Total files before filtering (for showing "X of Y files changed") */
  totalFilesInPR: number;
}

/**
 * Compute iteration-aware file list with filtering and updated stats.
 *
 * In iteration mode:
 * - Files with no changes in the selected range are hidden
 * - Lines added/removed reflect the iteration diff
 * - File status (Added, Modified, Deleted) is derived from iteration range
 *
 * In non-iteration mode:
 * - Returns original files from GitHub API unchanged
 */
export function useIterationAwareFiles(): IterationAwareFilesResult {
  const { files: githubFiles } = useDiffStore();
  const { isIterationMode, getFileDiffByPath, getArtifactByPath, selectedRange } = useIterationDiff();

  const result = useMemo((): IterationAwareFilesResult => {
    // Non-iteration mode: return original files with indices
    if (!isIterationMode || !selectedRange) {
      return {
        files: githubFiles.map((file, index): IterationAwareFile => {
          const result: IterationAwareFile = {
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch,
            originalIndex: index,
          };
          if (file.previousFilename !== undefined) {
            result.previousFilename = file.previousFilename;
          }
          return result;
        }),
        isIterationMode: false,
        totalFilesInPR: githubFiles.length,
      };
    }

    // Iteration mode: filter and compute stats
    const iterationFiles: IterationAwareFile[] = [];

    for (let i = 0; i < githubFiles.length; i++) {
      const file = githubFiles[i];
      if (!file) continue;

      const artifact = getArtifactByPath(file.filename);

      if (!artifact) {
        // File not in artifact - shouldn't happen but include as-is
        const fallback: IterationAwareFile = {
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
          originalIndex: i,
        };
        if (file.previousFilename !== undefined) {
          fallback.previousFilename = file.previousFilename;
        }
        iterationFiles.push(fallback);
        continue;
      }

      // Get diff for this file in the selected iteration range
      const diff = getFileDiffByPath(file.filename);

      if (!diff) {
        // No diff available - skip file
        continue;
      }

      // Count additions and deletions from the diff
      const stats = computeDiffStats(diff.diffLines);

      // Skip files with no actual changes
      if (stats.additions === 0 && stats.deletions === 0 && !stats.isNewFile && !stats.isDeletedFile) {
        continue;
      }

      // Determine status based on iteration range
      const status = computeIterationStatus(diff.base !== null, diff.head !== null, file.status);

      const iterationFile: IterationAwareFile = {
        filename: file.filename,
        status,
        additions: stats.additions,
        deletions: stats.deletions,
        changes: stats.additions + stats.deletions,
        patch: file.patch,
        originalIndex: i,
        artifactId: artifact.id,
      };
      if (file.previousFilename !== undefined) {
        iterationFile.previousFilename = file.previousFilename;
      }
      iterationFiles.push(iterationFile);
    }

    return {
      files: iterationFiles,
      isIterationMode: true,
      totalFilesInPR: githubFiles.length,
    };
  }, [githubFiles, isIterationMode, getFileDiffByPath, getArtifactByPath, selectedRange]);

  return result;
}

interface DiffStats {
  additions: number;
  deletions: number;
  isNewFile: boolean;
  isDeletedFile: boolean;
}

/**
 * Count additions and deletions from parsed diff lines
 */
function computeDiffStats(diffLines: ParsedDiffLine[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  let hasOldLines = false;
  let hasNewLines = false;

  for (const line of diffLines) {
    if (line.type === 'addition') {
      additions++;
      hasNewLines = true;
    } else if (line.type === 'deletion') {
      deletions++;
      hasOldLines = true;
    } else if (line.type === 'context') {
      hasOldLines = true;
      hasNewLines = true;
    }
  }

  // File is new if no old content exists
  const isNewFile = !hasOldLines && hasNewLines && additions > 0;
  // File is deleted if no new content exists
  const isDeletedFile = hasOldLines && !hasNewLines && deletions > 0;

  return { additions, deletions, isNewFile, isDeletedFile };
}

/**
 * Derive file status from iteration diff
 */
function computeIterationStatus(
  hasBase: boolean,
  hasHead: boolean,
  originalStatus: FileChangeStatus
): FileChangeStatus {
  if (!hasBase && hasHead) {
    return FileChangeStatus.Added;
  }
  if (hasBase && !hasHead) {
    return FileChangeStatus.Deleted;
  }
  // Keep renamed status if original was renamed
  if (originalStatus === FileChangeStatus.Renamed) {
    return FileChangeStatus.Renamed;
  }
  return FileChangeStatus.Modified;
}
