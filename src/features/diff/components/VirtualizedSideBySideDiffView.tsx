/**
 * Virtualized side-by-side diff view for large files (500+ lines)
 * Uses react-window for performant rendering with synchronized scrolling
 */

import { useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { DiffLine, DiffLineSpacer } from './DiffLine';
import type { AlignedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';
import { CommentThread, CommentEditor } from '@/features/comments';

/** Line height from CSS variables (--diff-line-height) */
const LINE_HEIGHT = 23;

/** Number of rows to render outside the visible area */
const OVERSCAN_COUNT = 10;

interface VirtualizedSideBySideDiffViewProps {
  alignedLines: AlignedDiffLine[];
  language: string;
  containerHeight: number;
  threadsByLineAndSide: Map<string, ReviewThread[]>;
  currentUserLogin: string;
  addReply: (threadId: string, body: string) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleResolved: (threadId: string) => void;
  contentFilter: 'left' | 'both' | 'right';
  draftLineIndex: number | null;
  draftSide: 'LEFT' | 'RIGHT' | null;
  draftBody: string;
  isSubmittingDraft: boolean;
  submitError: string | null;
  onStartComment: (index: number, side: 'LEFT' | 'RIGHT') => void;
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
  /** Row index to scroll to (for J/K navigation) */
  scrollToRowIndex?: number | undefined;
}

interface RowData {
  alignedLines: AlignedDiffLine[];
  language: string;
  threadsByLineAndSide: Map<string, ReviewThread[]>;
  currentUserLogin: string;
  addReply: (threadId: string, body: string) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleResolved: (threadId: string) => void;
  contentFilter: 'left' | 'both' | 'right';
  draftLineIndex: number | null;
  draftSide: 'LEFT' | 'RIGHT' | null;
  draftBody: string;
  isSubmittingDraft: boolean;
  submitError: string | null;
  onStartComment: (index: number, side: 'LEFT' | 'RIGHT') => void;
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
}

/**
 * Get threads for a specific line number and side
 */
function getThreadsForLine(
  threadsByLineAndSide: Map<string, ReviewThread[]>,
  lineNumber: number | null,
  side: 'LEFT' | 'RIGHT'
): ReviewThread[] {
  if (lineNumber === null) return [];
  const key = `${String(lineNumber)}-${side}`;
  return threadsByLineAndSide.get(key) ?? [];
}

/**
 * Individual row renderer for the virtualized list
 * Renders both left and right sides in a single row
 */
function SideBySideRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const {
    alignedLines,
    language,
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
    showWhitespace,
  } = data;

  const pair = alignedLines[index];
  if (!pair) return null;

  const { left: leftLine, right: rightLine } = pair;

  const leftThreads = leftLine
    ? getThreadsForLine(threadsByLineAndSide, leftLine.oldLineNumber, 'LEFT')
    : [];
  const rightThreads = rightLine
    ? getThreadsForLine(threadsByLineAndSide, rightLine.newLineNumber, 'RIGHT')
    : [];

  const showLeftDraft = draftLineIndex === index && draftSide === 'LEFT';
  const showRightDraft = draftLineIndex === index && draftSide === 'RIGHT';

  return (
    <div style={style} className="virtualized-sxs-row">
      <div className="virtualized-sxs-container">
        {/* Left Pane */}
        {contentFilter !== 'right' && (
          <div className="virtualized-sxs-pane virtualized-sxs-pane-left">
            <table className="diff-table">
              <tbody>
                {leftLine ? (
                  <DiffLine
                    line={leftLine}
                    language={language}
                    side="left"
                    singleLineNumber
                    showCommentButton={leftLine.type !== 'header'}
                    onStartComment={() => onStartComment(index, 'LEFT')}
                    showWhitespace={showWhitespace}
                  />
                ) : (
                  <DiffLineSpacer />
                )}
                {showLeftDraft && (
                  <tr>
                    <td colSpan={3} className="diff-comment-cell">
                      {submitError && (
                        <div className="diff-comment-error">{submitError}</div>
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
                {leftThreads.map((thread) => (
                  <tr key={`thread-left-${thread.id}`}>
                    <td colSpan={3} className="diff-comment-cell">
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
              </tbody>
            </table>
          </div>
        )}

        {/* Right Pane */}
        {contentFilter !== 'left' && (
          <div className="virtualized-sxs-pane">
            <table className="diff-table">
              <tbody>
                {rightLine ? (
                  <DiffLine
                    line={rightLine}
                    language={language}
                    side="right"
                    singleLineNumber
                    showCommentButton={rightLine.type !== 'header'}
                    onStartComment={() => onStartComment(index, 'RIGHT')}
                    showWhitespace={showWhitespace}
                  />
                ) : (
                  <DiffLineSpacer />
                )}
                {showRightDraft && (
                  <tr>
                    <td colSpan={3} className="diff-comment-cell">
                      {submitError && (
                        <div className="diff-comment-error">{submitError}</div>
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
                {rightThreads.map((thread) => (
                  <tr key={`thread-right-${thread.id}`}>
                    <td colSpan={3} className="diff-comment-cell">
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Virtualized side-by-side diff view using react-window
 * Used when diff has more than 500 lines for better performance
 */
export function VirtualizedSideBySideDiffView({
  alignedLines,
  language,
  containerHeight,
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
  showWhitespace,
  scrollToRowIndex,
}: VirtualizedSideBySideDiffViewProps) {
  const listRef = useRef<List>(null);

  // Scroll to row when scrollToRowIndex changes (J/K navigation)
  useEffect(() => {
    if (scrollToRowIndex !== undefined && scrollToRowIndex >= 0 && listRef.current) {
      let effectiveIndex = scrollToRowIndex;

      // When filtering is active, map the unfiltered index to the corresponding
      // index in the filtered list (or the nearest visible line).
      if (contentFilter !== 'both') {
        let filteredIndex = -1;
        let lastKeptIndex = -1;

        for (let i = 0; i < alignedLines.length; i++) {
          const pair = alignedLines[i];
          if (!pair) continue;
          const keep =
            contentFilter === 'left'
              ? pair.left !== null || pair.right?.type !== 'addition'
              : pair.right !== null || pair.left?.type !== 'deletion';

          if (keep) {
            lastKeptIndex++;

            // Exact match: this unfiltered index is visible
            if (i === scrollToRowIndex) {
              filteredIndex = lastKeptIndex;
              break;
            }

            // If we've passed the target unfiltered index without an exact match,
            // then the target was filtered out. Scroll to the closest previous
            // visible line (lastKeptIndex).
            if (i > scrollToRowIndex && filteredIndex === -1) {
              filteredIndex = lastKeptIndex;
              break;
            }
          }
        }

        if (filteredIndex === -1) {
          // If no kept lines were found at or before the target, fall back to
          // the last visible line (or 0 if there are no visible lines).
          filteredIndex = lastKeptIndex === -1 ? 0 : lastKeptIndex;
        }

        effectiveIndex = filteredIndex;
      }

      // Read context lines from CSS variable for consistency with non-virtualized views
      let contextLines = 3;
      const rootStyles = getComputedStyle(document.documentElement);
      const cssValue = rootStyles.getPropertyValue('--diff-scroll-context-lines');
      const parsed = parseInt(cssValue, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        contextLines = parsed;
      }
      const targetIndex = Math.max(0, effectiveIndex - contextLines);
      listRef.current.scrollToItem(targetIndex, 'start');
    }
  }, [scrollToRowIndex, alignedLines, contentFilter]);

  // Filter lines based on content filter
  const filteredLines = useMemo(() => {
    if (contentFilter === 'both') return alignedLines;

    return alignedLines.filter((pair) => {
      if (contentFilter === 'left') {
        return pair.left !== null || pair.right?.type !== 'addition';
      } else {
        return pair.right !== null || pair.left?.type !== 'deletion';
      }
    });
  }, [alignedLines, contentFilter]);

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo<RowData>(
    () => ({
      alignedLines: filteredLines,
      language,
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
      showWhitespace,
    }),
    [
      filteredLines,
      language,
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
      showWhitespace,
    ]
  );

  return (
    <div
      className="virtualized-sxs-wrapper"
      role="region"
      aria-label="Side-by-side diff view"
    >
      <List
        ref={listRef}
        height={containerHeight}
        itemCount={filteredLines.length}
        itemSize={LINE_HEIGHT}
        width="100%"
        overscanCount={OVERSCAN_COUNT}
        itemData={itemData}
      >
        {SideBySideRow}
      </List>
    </div>
  );
}
