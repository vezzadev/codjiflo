/**
 * Hook for computing iteration-aware file list with filtering and stats
 *
 * When stateful mode is active (artifact available), this hook:
 * - Uses artifact as source of truth (not GitHub API)
 * - Filters out files with no changes in the selected range
 * - Computes additions/deletions from the iteration diff
 * - Derives file status from the iteration range
 *
 * GitHub API is only used as fallback in stateless mode (no artifact available).
 */

import { useMemo, useEffect, useRef } from 'react';
import { useDiffStore } from '../stores';
import { useIterationDiff } from './useIterationDiff';
import { useIterationStore } from '@/features/iterations/stores';
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
 * In stateful mode (artifact available):
 * - Artifact is source of truth (changedFiles from artifact database)
 * - Files with no changes in the selected range are hidden
 * - Lines added/removed reflect the iteration diff
 * - File status (Added, Modified, Deleted) is derived from iteration range
 *
 * In stateless mode (no artifact):
 * - Returns original files from GitHub API unchanged
 */
export function useIterationAwareFiles(): IterationAwareFilesResult {
  const { files: githubFiles } = useDiffStore();
  const { isIterationMode, changedFiles, getFileDiffByPath, selectedRange } = useIterationDiff();
  const { mode, statelessReason, currentPrKey } = useIterationStore();

  // Track if we've already warned for this PR to avoid duplicate warnings
  const warnedForPrRef = useRef<string | null>(null);

  // Emit warning when GitHub API is used as fallback in stateless mode
  useEffect(() => {
    // Only warn if we're in stateless mode and haven't warned for this PR yet
    if (mode === 'stateless' && currentPrKey && warnedForPrRef.current !== currentPrKey) {
      warnedForPrRef.current = currentPrKey;
      console.warn(
        `[CodjiFlo] Using GitHub API as fallback (stateless mode). ` +
        `Reason: ${statelessReason ?? 'Unknown'}. ` +
        `Iteration tracking features are unavailable.`
      );
    }
  }, [mode, statelessReason, currentPrKey]);

  // Build lookup from GitHub files for originalIndex and previousFilename
  const githubFileMap = useMemo(() => {
    const map: Map<string, { index: number; file: FileChange }> = new Map();
    for (let i = 0; i < githubFiles.length; i++) {
      const file = githubFiles[i];
      if (file) {
        map.set(file.filename, { index: i, file });
      }
    }
    return map;
  }, [githubFiles]);

  const result = useMemo((): IterationAwareFilesResult => {
    // Stateless mode: return original files from GitHub API
    if (!isIterationMode || !selectedRange) {
      const files = githubFiles.map((file, index): IterationAwareFile => {
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
      });
      // Sort files alphabetically by filename
      files.sort((a, b) => a.filename.localeCompare(b.filename));
      return {
        files,
        isIterationMode: false,
        totalFilesInPR: githubFiles.length,
      };
    }

    // Iteration mode: use artifact as source of truth
    const iterationFiles: IterationAwareFile[] = [];
    const processedPaths: Set<string> = new Set();
    // Next available index for artifact-only files (after GitHub files)
    let nextArtifactIndex = githubFiles.length;

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

      // Check if artifact stopped tracking before the end of selected range.
      // This can happen for two reasons:
      // 1. File was reverted to original state - action stops tracking (no changes vs base)
      // 2. File was deleted - action stops tracking (file no longer exists)
      //
      // To distinguish: check WHEN the artifact stopped tracking relative to our range.
      // - If artifact tracked until just before toSnapshot (lastSnapshotIndex === toSnapshot - 1),
      //   something happened AT this exact iteration boundary → likely deletion
      // - If artifact stopped tracking earlier (lastSnapshotIndex < toSnapshot - 1),
      //   the file was stable for multiple snapshots → likely reverted to base state
      const artifactStoppedTracking = artifact.lastSnapshotIndex < selectedRange.toSnapshot;
      if (artifactStoppedTracking && diff.head === null && diff.base !== null) {
        // Check if artifact stopped well before this iteration (revert) or just before (deletion)
        const stoppedBeforeThisIteration = artifact.lastSnapshotIndex < selectedRange.toSnapshot - 1;
        if (stoppedBeforeThisIteration) {
          // File was tracked, then stopped being tracked before this iteration
          // This indicates reversion to base state - skip it
          continue;
        }
        // Otherwise, artifact tracked until just before toSnapshot - likely deletion
        // Continue processing to show as Deleted
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

      // Assign index: use GitHub index if available, otherwise assign next available
      const fileIndex = githubInfo?.index ?? nextArtifactIndex++;

      const iterationFile: IterationAwareFile = {
        filename: path,
        status,
        additions: stats.additions,
        deletions: stats.deletions,
        changes: stats.additions + stats.deletions,
        patch: githubInfo?.file.patch ?? '', // Empty string for artifact-only files
        originalIndex: fileIndex,
        artifactId: artifact.id,
      };

      // Preserve previousFilename if available from GitHub
      if (githubInfo?.file.previousFilename !== undefined) {
        iterationFile.previousFilename = githubInfo.file.previousFilename;
      }

      iterationFiles.push(iterationFile);
    }

    // Sort files alphabetically by filename
    iterationFiles.sort((a, b) => a.filename.localeCompare(b.filename));

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
