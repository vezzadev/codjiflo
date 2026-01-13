/**
 * Hook for managing draft comment state
 *
 * Handles the lifecycle of a draft comment:
 * - Starting a new comment at a line
 * - Editing the comment body
 * - Submitting the comment
 * - Canceling the draft
 * - Clearing on file change
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDiffStore } from '../stores';
import { useCommentsStore } from '@/features/comments';
import { getDiffLinePosition } from '../utils';
import type { ParsedDiffLine, AlignedDiffLine, DiffViewMode } from '../types';

export interface UseDraftCommentReturn {
  /** Index of the line where draft is being composed */
  draftLineIndex: number | null;
  /** Side of the draft comment (LEFT or RIGHT) */
  draftSide: 'LEFT' | 'RIGHT' | null;
  /** Current draft comment body */
  draftBody: string;
  /** Whether a comment is being submitted */
  isSubmitting: boolean;
  /** Error message from last submission attempt */
  submitError: string | null;
  /** Start composing a new comment */
  startComment: (index: number, side: 'LEFT' | 'RIGHT') => void;
  /** Cancel the current draft */
  cancelDraft: () => void;
  /** Update the draft body text */
  setDraftBody: (body: string) => void;
  /** Submit the draft comment */
  submitComment: (
    diffLines: ParsedDiffLine[],
    alignedLines: AlignedDiffLine[],
    filename: string,
    viewMode: DiffViewMode
  ) => Promise<void>;
}

/**
 * Hook to manage draft comment state.
 *
 * Clears draft automatically when switching files.
 */
export function useDraftComment(): UseDraftCommentReturn {
  const { selectedFileIndex } = useDiffStore();
  const { addComment } = useCommentsStore();

  // Draft state
  const [draftLineIndex, setDraftLineIndex] = useState<number | null>(null);
  const [draftSide, setDraftSide] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ref to prevent double-submission
  const isSubmittingRef = useRef(false);

  // Clear draft when switching files
  useEffect(() => {
    setDraftLineIndex(null);
    setDraftSide(null);
    setDraftBody('');
    setSubmitError(null);
  }, [selectedFileIndex]);

  const startComment = useCallback((index: number, side: 'LEFT' | 'RIGHT') => {
    setDraftLineIndex(index);
    setDraftSide(side);
    setDraftBody('');
    setSubmitError(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setDraftLineIndex(null);
    setDraftSide(null);
    setDraftBody('');
    setSubmitError(null);
  }, []);

  const submitComment = useCallback(
    async (
      diffLines: ParsedDiffLine[],
      alignedLines: AlignedDiffLine[],
      filename: string,
      viewMode: DiffViewMode
    ) => {
      if (isSubmittingRef.current || draftLineIndex === null || draftSide === null) {
        return;
      }

      // Get target line based on view mode
      let targetLine: ParsedDiffLine | null = null;
      let lineNumber: number | null = null;

      if (viewMode === 'unified') {
        targetLine = diffLines[draftLineIndex] ?? null;
        lineNumber =
          draftSide === 'LEFT'
            ? targetLine?.oldLineNumber ?? null
            : targetLine?.newLineNumber ?? null;
      } else {
        const pair = alignedLines[draftLineIndex];
        targetLine = (draftSide === 'LEFT' ? pair?.left : pair?.right) ?? null;
        lineNumber =
          draftSide === 'LEFT'
            ? targetLine?.oldLineNumber ?? null
            : targetLine?.newLineNumber ?? null;
      }

      const position = getDiffLinePosition(diffLines, draftLineIndex);

      if (!targetLine || !lineNumber) {
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await addComment({
          path: filename,
          line: lineNumber,
          side: draftSide,
          body: draftBody.trim(),
          position,
        });

        // Success - clear draft
        setDraftLineIndex(null);
        setDraftSide(null);
        setDraftBody('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to post comment';
        setSubmitError(message);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [addComment, draftLineIndex, draftSide, draftBody]
  );

  return {
    draftLineIndex,
    draftSide,
    draftBody,
    isSubmitting,
    submitError,
    startComment,
    cancelDraft,
    setDraftBody,
    submitComment,
  };
}
