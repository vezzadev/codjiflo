/**
 * Side-by-side diff view component (S-3.2)
 * AC-3.2.1-9: Two-pane layout with scroll sync and spacer rows
 *
 * Uses react-window for performant rendering of large diffs.
 */

import { useMemo, useEffect, useCallback, useRef } from 'react';
import { List, useListRef, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import { DiffLine, DiffLineSpacer } from './DiffLine';
import type { AlignedDiffLine, TextWrap } from '../types';
import type { ReviewThread } from '@/features/comments';
import { CommentThread, CommentEditor } from '@/features/comments';
import type { VisibleRowRange } from './InlineDiffTable';

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
  /** Callback when visible row range changes (for minimap synchronization) */
  onVisibleRangeChange?: (range: VisibleRowRange) => void;
/** Text wrap mode: 'nowrap' for horizontal scroll, 'wrap' for line wrapping */
  textWrap?: TextWrap;
  /** Callback when scroll completes (to clear pending scroll request) */
  onScrollComplete?: () => void;
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
  textWrap: TextWrap;
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
  textWrap,
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
                    textWrap={textWrap}
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
                {showComments && leftThreads.map((thread) => (
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
                    textWrap={textWrap}
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
                {showComments && rightThreads.map((thread) => (
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
  onVisibleRangeChange,
textWrap = 'nowrap',
  onScrollComplete,
}: SideBySideDiffViewProps) {
  const listRef = useListRef(null);
  // Track whether the List has rendered at least once (for initial scroll timing)
  const hasRenderedRef = useRef(false);
  // Store pending scroll request to execute after first render
  const pendingScrollRef = useRef<number | null>(null);

  // Handle visible rows change from react-window
  const handleRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      // Mark that the list has rendered
      hasRenderedRef.current = true;

      // If there's a pending scroll, execute it after the browser has painted
      // This ensures react-window's internal state is fully initialized
      if (pendingScrollRef.current !== null) {
        const targetIndex = pendingScrollRef.current;
        pendingScrollRef.current = null;
        // Wait for next animation frame to ensure List is fully ready
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollToRow({ index: targetIndex, align: 'center' });
            // Clear the pending scroll request after another frame
            requestAnimationFrame(() => {
              onScrollComplete?.();
            });
          }
        });
      }

      if (onVisibleRangeChange) {
        onVisibleRangeChange(visibleRows);
      }
    },
    [onVisibleRangeChange, onScrollComplete]
  );

  // Generate key for dynamic row height cache based on comments and text wrap
  // This ensures rows are re-measured when comments are added/removed or text wrap changes
  const dynamicHeightKey = useMemo(() => {
    const commentCount = threadsByLineAndSide.size;
    const hasDraft = draftLineIndex !== null;
    return `${commentCount}-${String(hasDraft)}-${String(draftLineIndex ?? 'none')}-${draftSide ?? 'none'}-${textWrap}`;
  }, [threadsByLineAndSide.size, draftLineIndex, draftSide, textWrap]);

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

  // Note: We don't need a useEffect to reset hasRenderedRef when alignedLines changes.
  // When the filename changes, the component remounts (via key prop in DiffView),
  // which resets all refs to their initial values. When view mode toggles (causing
  // alignedLines to change without a filename change), we want hasRenderedRef to stay
  // true so J/K navigation scrolls execute immediately instead of being queued.

  // Helper to calculate effective index with filtering
  const calculateEffectiveIndex = useCallback((targetIndex: number) => {
    let effectiveIndex = Math.min(targetIndex, alignedLines.length - 1);

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
          if (i === targetIndex) {
            filteredIndex = lastKeptIndex;
            break;
          }

          // If we've passed the target unfiltered index without an exact match,
          // then the target was filtered out. Scroll to the closest previous
          // visible line (lastKeptIndex).
          if (i > targetIndex && filteredIndex === -1) {
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

    // Clamp to valid range
    const maxIndex = Math.max(0, filteredLines.length - 1);
    return Math.min(effectiveIndex, maxIndex);
  }, [alignedLines, contentFilter, filteredLines.length]);

  // Scroll to row when scrollToRowIndex changes (J/K navigation or file switch auto-scroll)
  // Note: Only depend on scrollToRowIndex and onScrollComplete, not data arrays or filter.
  // This prevents re-triggering the scroll when view mode changes (e.g., full-file toggle).
  useEffect(() => {
    if (scrollToRowIndex === undefined || scrollToRowIndex < 0) {
      return;
    }

    // Early return if list is empty
    if (filteredLines.length === 0) {
      requestAnimationFrame(() => {
        onScrollComplete?.();
      });
      return;
    }

    const clampedIndex = calculateEffectiveIndex(scrollToRowIndex);

    // If the list hasn't rendered yet, queue the scroll for after first render
    if (!hasRenderedRef.current) {
      pendingScrollRef.current = clampedIndex;
      return;
    }

    // List is already rendered, scroll immediately
    if (listRef.current) {
      listRef.current.scrollToRow({ index: clampedIndex, align: 'center' });
      requestAnimationFrame(() => {
        onScrollComplete?.();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only scrollToRowIndex should trigger scroll; other values read from closure
  }, [scrollToRowIndex, onScrollComplete]);

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
      textWrap,
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
      textWrap,
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
        onRowsRendered={handleRowsRendered}
      />
    </div>
  );
}
