/**
 * Side-by-side diff view component (S-3.2)
 * AC-3.2.1-9: Two-pane layout with scroll sync and spacer rows
 *
 * Uses react-window for performant rendering of large diffs.
 */

import { useMemo, useEffect } from 'react';
import { List, useListRef, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import { DiffLine, DiffLineSpacer } from './DiffLine';
import type { AlignedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';
import { CommentThread, CommentEditor } from '@/features/comments';

/** Default line height from CSS variables (--diff-line-height) */
const DEFAULT_ROW_HEIGHT = 23;

/** Number of rows to render outside the visible area */
const OVERSCAN_COUNT = 10;

interface SideBySideDiffViewProps {
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
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
  /** Row index to scroll to (for J/K navigation) */
  scrollToRowIndex?: number | undefined;
  /** Whether full file content is available for accurate token lookup */
  hasFullContent?: boolean;
  /** Whether to show comment threads (controlled by toolbar toggle) */
  showComments?: boolean;
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
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
  hasFullContent: boolean;
  showComments: boolean;
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
function SideBySideRow({
  index,
  style,
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
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
  showWhitespace,
  hasFullContent,
  showComments,
}: RowComponentProps<RowData>) {

  const pair = alignedLines[index];
  if (!pair) return <div style={style} />;

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
          <div
            className="virtualized-sxs-pane virtualized-sxs-pane-left"
            role="region"
            aria-label="Original version"
          >
            <table className="diff-table">
              <tbody>
                {leftLine ? (
                  <DiffLine
                    line={leftLine}
                    language={language}
                    side="left"
                    singleLineNumber
                    showWhitespace={showWhitespace}
                    hasFullContent={hasFullContent}
                  />
                ) : (
                  <DiffLineSpacer />
                )}
                {showLeftDraft && (
                  <tr>
                    <td colSpan={2} className="diff-comment-cell">
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
                {showComments && leftThreads.map((thread) => (
                  <tr key={`thread-left-${thread.id}`}>
                    <td colSpan={2} className="diff-comment-cell">
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
          <div
            className="virtualized-sxs-pane"
            role="region"
            aria-label="Modified version"
          >
            <table className="diff-table">
              <tbody>
                {rightLine ? (
                  <DiffLine
                    line={rightLine}
                    language={language}
                    side="right"
                    singleLineNumber
                    showWhitespace={showWhitespace}
                    hasFullContent={hasFullContent}
                  />
                ) : (
                  <DiffLineSpacer />
                )}
                {showRightDraft && (
                  <tr>
                    <td colSpan={2} className="diff-comment-cell">
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
                {showComments && rightThreads.map((thread) => (
                  <tr key={`thread-right-${thread.id}`}>
                    <td colSpan={2} className="diff-comment-cell">
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
 * Side-by-side diff view using react-window
 * Virtualized rendering is always enabled for optimal performance
 */
export function SideBySideDiffView({
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
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
  showWhitespace,
  scrollToRowIndex,
  hasFullContent = false,
  showComments = true,
}: SideBySideDiffViewProps) {
  const listRef = useListRef(null);

  // Generate key for dynamic row height cache based on comments
  // This ensures rows are re-measured when comments are added/removed
  const dynamicHeightKey = useMemo(() => {
    const commentCount = threadsByLineAndSide.size;
    const hasDraft = draftLineIndex !== null;
    return `${commentCount}-${String(hasDraft)}-${String(draftLineIndex ?? 'none')}-${draftSide ?? 'none'}`;
  }, [threadsByLineAndSide.size, draftLineIndex, draftSide]);

  // Use dynamic row heights to accommodate comment threads
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    key: dynamicHeightKey,
  });

  // Filter lines based on content filter (moved before useEffect to use filteredLines.length)
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

  // Scroll to row when scrollToRowIndex changes (J/K navigation)
  useEffect(() => {
    if (scrollToRowIndex !== undefined && scrollToRowIndex >= 0 && listRef.current) {
      // Early return if list is empty
      if (filteredLines.length === 0) return;

      let effectiveIndex = Math.min(scrollToRowIndex, alignedLines.length - 1);

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

      // Calculate target index with context, clamped to valid range
      const maxIndex = Math.max(0, filteredLines.length - 1);
      const targetIndex = Math.min(Math.max(0, effectiveIndex - contextLines), maxIndex);
      listRef.current.scrollToRow({ index: targetIndex, align: 'start' });
    }
  }, [scrollToRowIndex, alignedLines, contentFilter, filteredLines.length]);

  // Memoize row props to prevent unnecessary re-renders
  const rowProps = useMemo<RowData>(
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
      onCancelDraft,
      onChangeDraftBody,
      onSubmitDraft,
      showWhitespace,
      hasFullContent,
      showComments,
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
      onCancelDraft,
      onChangeDraftBody,
      onSubmitDraft,
      showWhitespace,
      hasFullContent,
      showComments,
    ]
  );

  return (
    <div
      className="virtualized-sxs-wrapper"
      role="region"
      aria-label="Side-by-side diff view"
    >
      <List
        listRef={listRef}
        rowComponent={SideBySideRow}
        rowCount={filteredLines.length}
        rowHeight={dynamicRowHeight}
        style={{ height: containerHeight, width: '100%', overflowX: 'visible' }}
        overscanCount={OVERSCAN_COUNT}
        rowProps={rowProps}
      />
    </div>
  );
}
