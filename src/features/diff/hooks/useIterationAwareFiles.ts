/**
 * Hook for computing iteration-aware file list with filtering and stats
 *
 * When iteration mode is active, this hook:
 * - Uses artifact as source of truth (not GitHub API)
 * - Filters out files with no changes in the selected range
 * - Computes additions/deletions from the iteration diff
 * - Derives file status from the iteration range
 *
 * GitHub API is only used as fallback when degraded (no artifact available).
 */

import { useMemo } from 'react';
import { useDiffStore } from '../stores';
import { useIterationDiff } from './useIterationDiff';
import type { FileChange } from '@/api/types';
import { FileChangeStatus } from '@/api/types';
import type { ParsedDiffLine } from '../types';
import type { ReviewFileArtifact } from '@/features/iterations/types';

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
 * - Artifact is source of truth (changedFiles from artifact database)
 * - Files with no changes in the selected range are hidden
 * - Lines added/removed reflect the iteration diff
 * - File status (Added, Modified, Deleted) is derived from iteration range
 *
 * In non-iteration mode (degraded, no artifact):
 * - Returns original files from GitHub API unchanged
 */
export function useIterationAwareFiles(): IterationAwareFilesResult {
  const { files: githubFiles } = useDiffStore();
  const { isIterationMode, changedFiles, getFileDiffByPath, selectedRange } = useIterationDiff();

  // Build lookup from GitHub files for originalIndex and previousFilename
  const githubFileMap = useMemo(() => {
    const map = new Map<string, { index: number; file: FileChange }>();
    for (let i = 0; i < githubFiles.length; i++) {
      const file = githubFiles[i];
      if (file) {
        map.set(file.filename, { index: i, file });
      }
    }
    return map;
  }, [githubFiles]);

  const result = useMemo((): IterationAwareFilesResult => {
    // Non-iteration mode (degraded): return original files from GitHub API
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

    // Iteration mode: use artifact as source of truth
    const iterationFiles: IterationAwareFile[] = [];
    const processedPaths = new Set<string>();

    // Process all artifacts that have changes in the selected range
    // Deduplicate by path (multiple artifacts may exist for same file due to SHA changes)
    for (const artifact of changedFiles) {
      const path = getArtifactPath(artifact, selectedRange.toSnapshot);
      if (!path) continue;

      // Skip if already processed (deduplicate by path)
      if (processedPaths.has(path)) continue;
      processedPaths.add(path);

      // Get diff for this file in the selected iteration range
      const diff = getFileDiffByPath(path);

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

      // Look up GitHub file info for originalIndex and previousFilename
      const githubInfo = githubFileMap.get(path);
      const originalStatus = githubInfo?.file.status ?? FileChangeStatus.Modified;

      // Determine status based on iteration range
      const status = computeIterationStatus(diff.base !== null, diff.head !== null, originalStatus);

      const iterationFile: IterationAwareFile = {
        filename: path,
        status,
        additions: stats.additions,
        deletions: stats.deletions,
        changes: stats.additions + stats.deletions,
        patch: githubInfo?.file.patch ?? '', // Empty string for artifact-only files
        originalIndex: githubInfo?.index ?? -1, // -1 indicates not in GitHub file list
        artifactId: artifact.id,
      };

      // Preserve previousFilename if available from GitHub
      if (githubInfo?.file.previousFilename !== undefined) {
        iterationFile.previousFilename = githubInfo.file.previousFilename;
      }

      iterationFiles.push(iterationFile);
    }

    return {
      files: iterationFiles,
      isIterationMode: true,
      totalFilesInPR: githubFiles.length,
    };
  }, [githubFiles, githubFileMap, isIterationMode, changedFiles, getFileDiffByPath, selectedRange]);

  return result;
}

/**
 * Get the file path from an artifact at a given snapshot.
 * Prefers the path at the exact snapshot, falling back to the last known path.
 */
function getArtifactPath(artifact: ReviewFileArtifact, snapshotIndex: number): string | null {
  // Try exact snapshot first
  const exactPath = artifact.repoPaths[snapshotIndex];
  if (exactPath) return exactPath;

  // Fall back to any known path (for deleted files, use the last known path)
  for (let i = snapshotIndex; i >= 0; i--) {
    const path = artifact.repoPaths[i];
    if (path) return path;
  }

  // Try forward for newly added files
  for (let i = snapshotIndex + 1; i < artifact.repoPaths.length; i++) {
    const path = artifact.repoPaths[i];
    if (path) return path;
  }

  return null;
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
