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
  /** Get file diff by path at the selected snapshots */
  getFileDiffByPath: (path: string) => FullFileDiff | null;
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

  // Map path to ALL artifacts that have that path (needed because action uses SHA as tracking ID)
  const pathToArtifacts = useMemo(() => {
    const map = new Map<string, ReviewFileArtifact[]>();
    for (const artifact of artifacts) {
      // Map by all known paths
      for (const path of artifact.repoPaths) {
        if (path) {
          const existing = map.get(path) ?? [];
          existing.push(artifact);
          map.set(path, existing);
        }
      }
    }
    return map;
  }, [artifacts]);

  // For backwards compatibility - returns first artifact
  const getArtifactByPath = useCallback(
    (path: string): ReviewFileArtifact | undefined => {
      const artifacts = pathToArtifacts.get(path);
      return artifacts?.[0];
    },
    [pathToArtifacts]
  );

  /**
   * Get file content by trying all artifacts that match the path.
   * This is needed because the action uses file SHA as tracking ID,
   * so different versions of the same file have different artifacts.
   *
   * Returns the content from the artifact with the CLOSEST snapshot to the requested one,
   * preferring exact matches over "at or before" matches.
   */
  const getContentFromAnyArtifact = useCallback(
    (path: string, snapshotIndex: number): IterationFileContent | undefined => {
      if (!client) return undefined;

      const artifactsForPath = pathToArtifacts.get(path) ?? [];

      // Find the best content - prefer content at the closest snapshot
      let bestContent: IterationFileContent | undefined;
      let bestDistance = Infinity;

      for (const artifact of artifactsForPath) {
        const content = client.getFileContent(artifact.id, snapshotIndex);
        if (content?.content) {
          // getFileContent returns content at or before snapshotIndex
          // Calculate how far this content is from the requested snapshot
          const distance = snapshotIndex - content.snapshotIndex;
          if (distance < bestDistance) {
            bestContent = content;
            bestDistance = distance;
            // If we found exact match, no need to check more
            if (distance === 0) break;
          }
        }
      }

      return bestContent;
    },
    [client, pathToArtifacts]
  );

  /**
   * Compute diff for a file path in the selected iteration range.
   * Searches all artifacts matching the path to find content.
   */
  const getFileDiffByPath = useCallback(
    (path: string): FullFileDiff | null => {
      if (!isIterationMode || !client || !selectedRange) {
        return null;
      }

      // Try to get content from ANY artifact with this path
      // This handles the case where different file versions have different artifacts
      const leftContent = getContentFromAnyArtifact(path, selectedRange.fromSnapshot);
      const rightContent = getContentFromAnyArtifact(path, selectedRange.toSnapshot);

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
    [isIterationMode, client, selectedRange, getContentFromAnyArtifact]
  );

  return {
    isIterationMode,
    changedFiles,
    getFileDiffByPath,
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
