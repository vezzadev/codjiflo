/**
 * Side-by-side diff view component (S-3.2)
 * AC-3.2.1-9: Two-pane layout with scroll sync and spacer rows
 */

import { Fragment, useRef, useEffect, useCallback, useMemo } from 'react';
import { DiffLine, DiffLineSpacer } from './DiffLine';
import type { AlignedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';
import { CommentThread, CommentEditor } from '@/features/comments';

interface SideBySideDiffViewProps {
  alignedLines: AlignedDiffLine[];
  language: string;
  filename: string;
  threadsByLineAndSide: Map<string, ReviewThread[]>;
  currentUserLogin: string;
  addComment: (params: {
    path: string;
    line: number;
    side: 'LEFT' | 'RIGHT';
    body: string;
    position: number;
  }) => Promise<void>;
  addReply: (threadId: string, body: string) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleResolved: (threadId: string) => void;
  /** Content filter to apply */
  contentFilter: 'left' | 'both' | 'right';
  /** Draft comment state */
  draftLineIndex: number | null;
  draftSide: 'LEFT' | 'RIGHT' | null;
  draftBody: string;
  isSubmittingDraft: boolean;
  submitError: string | null;
  onStartComment: (index: number, side: 'LEFT' | 'RIGHT') => void;
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
}

/**
 * SideBySideDiffView - Two-pane synchronized diff view
 */
export function SideBySideDiffView({
  alignedLines,
  language,
  filename: _filename, // unused but kept for API consistency
  threadsByLineAndSide,
  currentUserLogin,
  addReply,
  editComment,
  deleteComment,
  toggleResolved,
  contentFilter,
  draftLineIndex,
  draftSide,
  draftBody,
  isSubmittingDraft,
  submitError,
  onStartComment,
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
}: SideBySideDiffViewProps) {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Scroll sync (AC-3.2.4)
  const syncScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement) => {
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => {
      isScrollingRef.current = false;
    });
  }, []);

  useEffect(() => {
    const leftPane = leftPaneRef.current;
    const rightPane = rightPaneRef.current;
    if (!leftPane || !rightPane) return;

    const handleLeftScroll = () => syncScroll(leftPane, rightPane);
    const handleRightScroll = () => syncScroll(rightPane, leftPane);

    leftPane.addEventListener('scroll', handleLeftScroll, { passive: true });
    rightPane.addEventListener('scroll', handleRightScroll, { passive: true });

    return () => {
      leftPane.removeEventListener('scroll', handleLeftScroll);
      rightPane.removeEventListener('scroll', handleRightScroll);
    };
  }, [syncScroll]);

  // Filter lines based on content filter (AC-3.3.5-8)
  const filteredLines = useMemo(() => {
    if (contentFilter === 'both') return alignedLines;

    return alignedLines.filter((pair) => {
      if (contentFilter === 'left') {
        // Show left side, hide pure additions
        return pair.left !== null || pair.right?.type !== 'addition';
      } else {
        // Show right side, hide pure deletions
        return pair.right !== null || pair.left?.type !== 'deletion';
      }
    });
  }, [alignedLines, contentFilter]);

  // Get comments for a specific line
  const getThreadsForLine = useCallback(
    (lineNumber: number | null, side: 'LEFT' | 'RIGHT'): ReviewThread[] => {
      if (lineNumber === null) return [];
      const key = `${String(lineNumber)}-${side}`;
      return threadsByLineAndSide.get(key) ?? [];
    },
    [threadsByLineAndSide]
  );

  return (
    <div
      className="flex overflow-hidden h-full"
      role="region"
      aria-label="Side-by-side diff view"
    >
      {/* Left Pane - Original (AC-3.2.2, AC-3.2.9) */}
      {contentFilter !== 'right' && (
        <div
          ref={leftPaneRef}
          className="flex-1 overflow-auto border-r border-gray-300"
          aria-label="Original version"
          role="region"
          tabIndex={0}
        >
          <table className="w-full border-collapse text-sm">
            <tbody>
              {filteredLines.map((pair, index) => {
                const leftLine = pair.left;
                const leftThreads = leftLine
                  ? getThreadsForLine(leftLine.oldLineNumber, 'LEFT')
                  : [];
                const showDraftHere =
                  draftLineIndex === index && draftSide === 'LEFT';

                return (
                  <Fragment key={`left-${pair.key}`}>
                    {leftLine ? (
                      <DiffLine
                        line={leftLine}
                        language={language}
                        side="left"
                        singleLineNumber
                        showCommentButton={leftLine.type !== 'header'}
                        onStartComment={() => onStartComment(index, 'LEFT')}
                      />
                    ) : (
                      <DiffLineSpacer />
                    )}
                    {/* Draft comment editor */}
                    {showDraftHere && (
                      <tr>
                        <td colSpan={3} className="bg-gray-50 px-4 py-2">
                          {submitError && (
                            <div className="mb-2 text-sm text-red-600">{submitError}</div>
                          )}
                          <CommentEditor
                            value={draftBody}
                            onChange={onChangeDraftBody}
                            onSubmit={onSubmitDraft}
                            onCancel={onCancelDraft}
                            isSubmitting={isSubmittingDraft}
                            label="Add comment"
                          />
                        </td>
                      </tr>
                    )}
                    {/* Existing comment threads */}
                    {leftThreads.map((thread) => (
                      <tr key={`thread-left-${thread.id}`}>
                        <td colSpan={3} className="bg-gray-50 px-4 py-2">
                          <CommentThread
                            thread={thread}
                            currentUserLogin={currentUserLogin}
                            onReply={addReply}
                            onEdit={editComment}
                            onDelete={deleteComment}
                            onToggleResolved={toggleResolved}
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Right Pane - Modified (AC-3.2.3, AC-3.2.9) */}
      {contentFilter !== 'left' && (
        <div
          ref={rightPaneRef}
          className="flex-1 overflow-auto"
          aria-label="Modified version"
          role="region"
          tabIndex={0}
        >
          <table className="w-full border-collapse text-sm">
            <tbody>
              {filteredLines.map((pair, index) => {
                const rightLine = pair.right;
                const rightThreads = rightLine
                  ? getThreadsForLine(rightLine.newLineNumber, 'RIGHT')
                  : [];
                const showDraftHere =
                  draftLineIndex === index && draftSide === 'RIGHT';

                return (
                  <Fragment key={`right-${pair.key}`}>
                    {rightLine ? (
                      <DiffLine
                        line={rightLine}
                        language={language}
                        side="right"
                        singleLineNumber
                        showCommentButton={rightLine.type !== 'header'}
                        onStartComment={() => onStartComment(index, 'RIGHT')}
                      />
                    ) : (
                      <DiffLineSpacer />
                    )}
                    {/* Draft comment editor */}
                    {showDraftHere && (
                      <tr>
                        <td colSpan={3} className="bg-gray-50 px-4 py-2">
                          {submitError && (
                            <div className="mb-2 text-sm text-red-600">{submitError}</div>
                          )}
                          <CommentEditor
                            value={draftBody}
                            onChange={onChangeDraftBody}
                            onSubmit={onSubmitDraft}
                            onCancel={onCancelDraft}
                            isSubmitting={isSubmittingDraft}
                            label="Add comment"
                          />
                        </td>
                      </tr>
                    )}
                    {/* Existing comment threads */}
                    {rightThreads.map((thread) => (
                      <tr key={`thread-right-${thread.id}`}>
                        <td colSpan={3} className="bg-gray-50 px-4 py-2">
                          <CommentThread
                            thread={thread}
                            currentUserLogin={currentUserLogin}
                            onReply={addReply}
                            onEdit={editComment}
                            onDelete={deleteComment}
                            onToggleResolved={toggleResolved}
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
