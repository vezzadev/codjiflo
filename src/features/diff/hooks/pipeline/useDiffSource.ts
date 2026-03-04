/**
 * Pipeline Stage 1: Data Source
 *
 * Gets raw diff data from the appropriate source:
 * - Stateless mode: GitHub API (files from useDiffStore)
 * - Stateful mode: Artifact database (via useIterationDiff)
 */

import { useMemo } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../../stores';
import { useIterationDiff, useIterationAwareFiles } from '..';
import type { DiffSourceOutput } from './types';

/**
 * Hook to get raw diff data from the appropriate source.
 *
 * Branches:
 * - Stateless: Returns patch and file info from GitHub API
 * - Stateful: Returns pre-computed diff from artifact database
 */
export function useDiffSource(): DiffSourceOutput {
  const { files, selectedFileIndex } = useDiffStore();
  const { isIterationMode, getFileDiffByPath, selectedRange } = useIterationDiff();
  const { files: iterationAwareFiles } = useIterationAwareFiles();

  // Get selected file from GitHub API
  const selectedFile = files[selectedFileIndex];

  // In iteration mode, get file from iteration-aware files
  // This handles artifact-only files not in GitHub API (Issue #183)
  const iterationSelectedFile = useMemo(() => {
    if (!isIterationMode) return null;
    return iterationAwareFiles.find(f => f.originalIndex === selectedFileIndex) ?? null;
  }, [isIterationMode, iterationAwareFiles, selectedFileIndex]);

  // Determine filename: prefer iteration-aware file, fall back to GitHub file
  const filename = iterationSelectedFile?.filename ?? selectedFile?.filename;

  // Get patch from GitHub file or iteration file
  const patch = selectedFile?.patch ?? iterationSelectedFile?.patch;

  // Get file status
  const fileStatus = iterationSelectedFile?.status ?? selectedFile?.status;

  // Get previous filename for renamed files
  const previousFilename = iterationSelectedFile?.previousFilename ?? selectedFile?.previousFilename;

  // Get iteration-based diff when in iteration mode
  // selectedRange in dependency array ensures recomputation on iteration change
  const iterationDiff = useMemo(() => {
    if (!isIterationMode || !filename) {
      return null;
    }
    return getFileDiffByPath(filename);
  }, [isIterationMode, filename, getFileDiffByPath, selectedRange]);

  // Handle PR description view - no file selected
  if (selectedFileIndex === PR_DESCRIPTION_INDEX) {
    return {
      patch: undefined,
      filename: undefined,
      previousFilename: undefined,
      fileStatus: undefined,
      iterationDiff: null,
      isIterationMode,
    };
  }

  return {
    patch,
    filename,
    previousFilename,
    fileStatus,
    iterationDiff,
    isIterationMode,
  };
}
