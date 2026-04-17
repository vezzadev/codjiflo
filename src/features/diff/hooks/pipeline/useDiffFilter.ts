/**
 * Pipeline Stage 2: Content Filter
 *
 * Applies full-file vs changes-only filtering:
 * - Full file: Shows all lines (fetches full content in non-iteration mode)
 * - Changes only: Shows only changes with context lines (patch-based)
 */

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useDiffStore, useDiffContentStore } from '../../stores';
import { usePRStore } from '@/features/pr';
import { parsePatch, detectLanguage, filterToChangesOnly, filterAlignedToChangesOnly } from '../../utils';
import { FileChangeStatus } from '@/api/types';
import type { DiffSourceOutput, DiffFilterOutput } from './types';
import type { FullFileDiff, ParsedDiffLine } from '../../types';

/**
 * Hook to filter diff content based on view configuration.
 *
 * Branches:
 * - Full file: Shows all lines from file (from iteration artifact or GitHub API)
 * - Changes only: Shows only changed lines with context (patch-based)
 */
export function useDiffFilter(source: DiffSourceOutput): DiffFilterOutput {
  const params = useParams<{ owner: string; repo: string }>();
  const owner = (params as { [key: string]: string | undefined }).owner ?? '';
  const repo = (params as { [key: string]: string | undefined }).repo ?? '';

  const { viewConfig } = useDiffStore();
  const { currentPR } = usePRStore();
  const { computeFullFileDiff, isLoadingContent } = useDiffContentStore();

  // Local state for full file diff (non-iteration mode)
  const [fullFileDiff, setFullFileDiff] = useState<FullFileDiff | null>(null);
  const [fullFileError, setFullFileError] = useState<string | null>(null);

  const { filename, previousFilename, patch, fileStatus, iterationDiff, isIterationMode } = source;

  // Determine if we should fetch full file content
  const shouldFetchFullFile = !isIterationMode &&
    viewConfig.showFullFile &&
    !!filename &&
    !!currentPR &&
    !!owner &&
    !!repo;

  // Fetch full file content when showFullFile is enabled (non-iteration mode)
  useEffect(() => {
    // Only proceed when all conditions are met (shouldFetchFullFile checks filename, currentPR, etc.)
    if (!shouldFetchFullFile) {
      return;
    }

    let cancelled = false;

    computeFullFileDiff(owner, repo, filename, currentPR.baseSha, currentPR.headSha, previousFilename)
      .then((result) => {
        if (!cancelled) {
          setFullFileDiff(result);
          setFullFileError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load full file';
          setFullFileError(message);
          setFullFileDiff(null);
        }
      });

    return () => {
      cancelled = true;
      // Clear state when conditions change or component unmounts
      setFullFileDiff(null);
      setFullFileError(null);
    };
  }, [
    shouldFetchFullFile,
    filename,
    previousFilename,
    currentPR,
    owner,
    repo,
    computeFullFileDiff,
  ]);

  // Compute diffLines, alignedLines, and language
  const { diffLines, sourceAlignedLines, language } = useMemo(() => {
    // Priority 1: Use iteration diff when in iteration mode
    if (isIterationMode && iterationDiff) {
      // In iteration mode, respect the showFullFile toggle
      // When showFullFile=false, filter to show only changes with context
      const lines = viewConfig.showFullFile
        ? iterationDiff.diffLines
        : filterToChangesOnly(iterationDiff.diffLines);

      // Pass through pre-computed aligned lines (with word diffs)
      const aligned = viewConfig.showFullFile
        ? iterationDiff.alignedLines
        : filterAlignedToChangesOnly(iterationDiff.alignedLines);

      return {
        diffLines: lines,
        sourceAlignedLines: aligned,
        language: detectLanguage(filename ?? ''),
      };
    }

    // Priority 2: Use full file diff when available (non-iteration mode)
    if (viewConfig.showFullFile && fullFileDiff) {
      return {
        diffLines: fullFileDiff.diffLines,
        sourceAlignedLines: fullFileDiff.alignedLines,
        language: detectLanguage(filename ?? ''),
      };
    }

    // Fall back to patch-based diff
    if (!patch) {
      return {
        diffLines: [] as ParsedDiffLine[],
        sourceAlignedLines: null,
        language: 'plaintext',
      };
    }

    return {
      diffLines: parsePatch(patch),
      sourceAlignedLines: null, // Will be computed by useDiffShape
      language: detectLanguage(filename ?? ''),
    };
  }, [patch, filename, viewConfig.showFullFile, fullFileDiff, isIterationMode, iterationDiff]);

  // Determine if file is fully added/deleted (all lines are changes)
  const isFullFileChange = useMemo(() => {
    if (isIterationMode && iterationDiff) {
      // If there are context lines, file existed in both snapshots
      const hasContextLines = iterationDiff.diffLines.some(line => line.type === 'context');
      return !hasContextLines;
    }
    // Non-iteration mode: use file status
    return fileStatus === FileChangeStatus.Added || fileStatus === FileChangeStatus.Deleted;
  }, [isIterationMode, iterationDiff, fileStatus]);

  return {
    diffLines,
    sourceAlignedLines,
    language,
    isFullFileChange,
    filename,
    isIterationMode,
    // Expose loading/error state for UI
    _isLoadingFullFile: viewConfig.showFullFile && isLoadingContent && !fullFileDiff && !isIterationMode,
    _fullFileError: fullFileError,
  };
}
