/**
 * Hook for computing diffs based on iteration selection
 *
 * When iterations are available, this hook provides file content
 * from the artifact database instead of GitHub API.
 */

import { useMemo, useCallback } from 'react';
import { useIterationStore } from '@/features/iterations/stores';
import type { FileContent as IterationFileContent, ReviewFileArtifact } from '@/features/iterations/types';
import type { ParsedDiffLine, AlignedDiffLine, FullFileDiff, FileContent } from '../types';
import { computeLineDiff, enhanceWithWordDiffs, computeAlignment } from '../workers/diff-engine';
import { detectLanguage } from '../utils';

interface IterationDiffResult {
  /** Whether iteration mode is active (non-degraded with valid range) */
  isIterationMode: boolean;
  /** Files changed in the selected range */
  changedFiles: ReviewFileArtifact[];
  /** Get file content for a specific artifact at the selected snapshots */
  getFileDiff: (artifactId: number) => FullFileDiff | null;
  /** Get artifact by file path */
  getArtifactByPath: (path: string) => ReviewFileArtifact | undefined;
  /** Currently selected snapshot range */
  selectedRange: { fromSnapshot: number; toSnapshot: number } | null;
}

/**
 * Hook to compute diffs based on iteration selection.
 * Returns iteration-based diff data when available, otherwise returns empty results.
 */
export function useIterationDiff(): IterationDiffResult {
  const { client, selectedRange, isDegraded, artifacts } = useIterationStore();

  const isIterationMode = useMemo(() => {
    return !isDegraded && client !== null && selectedRange !== null;
  }, [isDegraded, client, selectedRange]);

  // Get files changed in the selected range
  const changedFiles = useMemo((): ReviewFileArtifact[] => {
    if (!isIterationMode || !client || !selectedRange) {
      return [];
    }

    return client.getArtifactsForRange(selectedRange.fromSnapshot, selectedRange.toSnapshot);
  }, [isIterationMode, client, selectedRange]);

  // Map path to artifact for quick lookup
  const pathToArtifact = useMemo(() => {
    const map = new Map<string, ReviewFileArtifact>();
    for (const artifact of artifacts) {
      // Use the latest path for the artifact
      const latestPath = artifact.repoPaths[artifact.lastSnapshotIndex];
      if (latestPath) {
        map.set(latestPath, artifact);
      }
      // Also map by all known paths (for renames)
      for (const path of artifact.repoPaths) {
        if (path && !map.has(path)) {
          map.set(path, artifact);
        }
      }
    }
    return map;
  }, [artifacts]);

  const getArtifactByPath = useCallback(
    (path: string): ReviewFileArtifact | undefined => {
      return pathToArtifact.get(path);
    },
    [pathToArtifact]
  );

  // Compute diff for a specific artifact
  const getFileDiff = useCallback(
    (artifactId: number): FullFileDiff | null => {
      if (!isIterationMode || !client || !selectedRange) {
        return null;
      }

      // Get file content at left and right snapshots
      const leftContent = client.getFileContent(artifactId, selectedRange.fromSnapshot);
      const rightContent = client.getFileContent(artifactId, selectedRange.toSnapshot);

      // Get file paths for metadata
      const leftPath = client.getFilePath(artifactId, selectedRange.fromSnapshot);
      const rightPath = client.getFilePath(artifactId, selectedRange.toSnapshot);
      const path = rightPath ?? leftPath ?? '';

      // Convert to FileContent format
      const baseContent = iterationToFileContent(leftContent, path, 'snapshot-' + String(selectedRange.fromSnapshot));
      const headContent = iterationToFileContent(rightContent, path, 'snapshot-' + String(selectedRange.toSnapshot));

      // Compute diff
      let diffLines: ParsedDiffLine[] = [];
      let alignedLines: AlignedDiffLine[] = [];

      if (baseContent && headContent) {
        // Both versions exist - compute diff
        diffLines = computeLineDiff(baseContent.content, headContent.content, false);
        diffLines = enhanceWithWordDiffs(diffLines);
        alignedLines = computeAlignment(diffLines);
      } else if (headContent) {
        // New file - all lines are additions
        diffLines = headContent.lines.map((line, index): ParsedDiffLine => ({
          type: 'addition',
          content: line,
          oldLineNumber: null,
          newLineNumber: index + 1,
        }));
        alignedLines = diffLines.map((line, index) => ({
          left: null,
          right: line,
          key: 'add-' + String(index),
        }));
      } else if (baseContent) {
        // Deleted file - all lines are deletions
        diffLines = baseContent.lines.map((line, index): ParsedDiffLine => ({
          type: 'deletion',
          content: line,
          oldLineNumber: index + 1,
          newLineNumber: null,
        }));
        alignedLines = diffLines.map((line, index) => ({
          left: line,
          right: null,
          key: 'del-' + String(index),
        }));
      }

      return {
        base: baseContent,
        head: headContent,
        diffLines,
        alignedLines,
      };
    },
    [isIterationMode, client, selectedRange]
  );

  return {
    isIterationMode,
    changedFiles,
    getFileDiff,
    getArtifactByPath,
    selectedRange,
  };
}

/**
 * Convert iteration file content to diff FileContent format.
 */
function iterationToFileContent(
  content: IterationFileContent | undefined,
  path: string,
  ref: string
): FileContent | null {
  if (!content?.content) {
    return null;
  }

  return {
    path,
    ref,
    content: content.content,
    lines: content.content.split('\n'),
    language: detectLanguage(path),
  };
}
