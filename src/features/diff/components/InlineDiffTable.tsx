/**
 * Inline diff table using react-window for performant rendering
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { List, useListRef, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import { DiffLine } from './DiffLine';
import type { ParsedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';
import { CommentThread, CommentEditor } from '@/features/comments';

/** Default line height from CSS variables (--diff-line-height) */
const DEFAULT_ROW_HEIGHT = 23;

/** Number of rows to render outside the visible area */
const OVERSCAN_COUNT = 10;

/** Visible row range for minimap synchronization */
export interface VisibleRowRange {
  /** First visible row index (0-indexed) */
  startIndex: number;
  /** Last visible row index (0-indexed, inclusive) */
  stopIndex: number;
}

export interface InlineDiffTableProps {
  diffLines: ParsedDiffLine[];
  language: string;
  containerHeight: number;
  threadsByLineAndSide: Map<string, ReviewThread[]>;
  currentUserLogin: string;
  addReply: (threadId: string, body: string) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleResolved: (threadId: string) => void;
  draftLineIndex: number | null;
  draftBody: string;
  isSubmittingDraft: boolean;
  submitError: string | null;
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
  lineNumberMode: 'left' | 'both' | 'right';
  /** Row index to scroll to (for J/K navigation) */
  scrollToRowIndex?: number | undefined;
  /** Whether full file content is available for accurate token lookup */
  hasFullContent?: boolean;
  /** Whether to show comment threads (controlled by toolbar toggle) */
  showComments?: boolean;
  /** Callback when visible row range changes (for minimap synchronization) */
  onVisibleRangeChange?: (range: VisibleRowRange) => void;
}

interface RowData {
  diffLines: ParsedDiffLine[];
  language: string;
  threadsByLineAndSide: Map<string, ReviewThread[]>;
  currentUserLogin: string;
  addReply: (threadId: string, body: string) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleResolved: (threadId: string) => void;
  draftLineIndex: number | null;
  draftBody: string;
  isSubmittingDraft: boolean;
  submitError: string | null;
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
  lineNumberMode: 'left' | 'both' | 'right';
  hasFullContent: boolean;
  showComments: boolean;
}

/**
 * Individual row renderer for the virtualized list
 */
function DiffRow({
  index,
  style,
  diffLines,
  language,
  threadsByLineAndSide,
  currentUserLogin,
  addReply,
  editComment,
  deleteComment,
  toggleResolved,
  draftLineIndex,
  draftBody,
  isSubmittingDraft,
  submitError,
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
  showWhitespace,
  lineNumberMode,
  hasFullContent,
  showComments,
}: RowComponentProps<RowData>) {

  const line = diffLines[index];
  if (!line) return <div style={style} />;

  // Get threads for this line
  const leftKey = line.oldLineNumber != null ? `${String(line.oldLineNumber)}-LEFT` : null;
  const rightKey = line.newLineNumber != null ? `${String(line.newLineNumber)}-RIGHT` : null;
  const lineThreads = [
    ...(leftKey ? threadsByLineAndSide.get(leftKey) ?? [] : []),
    ...(rightKey ? threadsByLineAndSide.get(rightKey) ?? [] : []),
  ];

  const showDraftHere = draftLineIndex === index;
  // Column count: annotation + line number + content (always 3)
  const colSpan = 3;

  return (
    <div style={style} className="virtualized-row" role="presentation">
      <table className="diff-table">
        <tbody>
          <DiffLine
            line={line}
            language={language}
            showWhitespace={showWhitespace}
            lineNumberMode={lineNumberMode}
            lineIndex={index}
            hasFullContent={hasFullContent}
          />
          {showDraftHere && (
            <tr>
              <td colSpan={colSpan} className="diff-comment-cell">
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
          {showComments && lineThreads.map((thread) => (
            <tr key={`thread-${thread.id}`}>
              <td colSpan={colSpan} className="diff-comment-cell">
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
  );
}

/**
 * Inline diff table using react-window
 * Virtualized rendering is always enabled for optimal performance
 */
export function InlineDiffTable({
  diffLines,
  language,
  containerHeight,
  threadsByLineAndSide,
  currentUserLogin,
  addReply,
  editComment,
  deleteComment,
  toggleResolved,
  draftLineIndex,
  draftBody,
  isSubmittingDraft,
  submitError,
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
  showWhitespace,
  lineNumberMode,
  scrollToRowIndex,
  hasFullContent = false,
  showComments = true,
  onVisibleRangeChange,
}: InlineDiffTableProps) {
  const listRef = useListRef(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle visible rows change from react-window
  const handleRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      if (onVisibleRangeChange) {
        onVisibleRangeChange(visibleRows);
      }
    },
    [onVisibleRangeChange]
  );

  // Generate key for dynamic row height cache based on comments
  // This ensures rows are re-measured when comments are added/removed
  const dynamicHeightKey = useMemo(() => {
    const commentCount = threadsByLineAndSide.size;
    const hasDraft = draftLineIndex !== null;
    return `${commentCount}-${String(hasDraft)}-${String(draftLineIndex ?? 'none')}`;
  }, [threadsByLineAndSide.size, draftLineIndex]);

  // Use dynamic row heights to accommodate comment threads
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    key: dynamicHeightKey,
  });

  // Scroll to row when scrollToRowIndex changes (J/K navigation)
  useEffect(() => {
    if (scrollToRowIndex !== undefined && scrollToRowIndex >= 0 && listRef.current && diffLines.length > 0) {
      // Read context lines from CSS variable for consistency with non-virtualized views
      let contextLines = 3;
      const rootStyles = getComputedStyle(document.documentElement);
      const cssValue = rootStyles.getPropertyValue('--diff-scroll-context-lines');
      const parsed = parseInt(cssValue, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        contextLines = parsed;
      }
      // Clamp scrollToRowIndex to valid range before calculating target
      const clampedIndex = Math.min(scrollToRowIndex, diffLines.length - 1);
      const targetIndex = Math.max(0, clampedIndex - contextLines);
      listRef.current.scrollToRow({ index: targetIndex, align: 'start' });
    }
  }, [scrollToRowIndex, diffLines.length]);

  // Update CSS variable for scroll width so all tables can extend to match widest content.
  // This ensures diff backgrounds (addition/deletion) extend to the full scroll width.
  const updateScrollWidth = useCallback((width?: number) => {
    const container = containerRef.current;
    if (!container) return;

    // If width is provided (from precalculation), use it directly
    if (width !== undefined && width > 0) {
      const list = container.querySelector('.virtualized-inline-list');
      const clientWidth = list?.clientWidth ?? container.clientWidth;
      if (width > clientWidth) {
        container.style.setProperty('--diff-scroll-width', `${String(width)}px`);
        return;
      }
    }

    // Fall back to measuring actual scroll width
    const list = container.querySelector('.virtualized-inline-list');
    if (list && list.scrollWidth > list.clientWidth) {
      container.style.setProperty('--diff-scroll-width', `${String(list.scrollWidth)}px`);
    } else {
      container.style.removeProperty('--diff-scroll-width');
    }
  }, []);

  // Precalculate max width by measuring the longest line content.
  // This ensures the scrollbar appears immediately, not just when long rows render.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || diffLines.length === 0) return;

    // Find the longest line content
    let longestContent = '';
    for (const line of diffLines) {
      if (line.content.length > longestContent.length) {
        longestContent = line.content;
      }
    }

    if (longestContent.length === 0) return;

    // Wait for a rendered diff-code element to exist so we can copy its computed styles.
    // We must query .diff-code (the inner code/pre element), not .diff-content (the td cell),
    // because .diff-code uses monospace font while .diff-content inherits the default font.
    const existingCode = container.querySelector('.diff-code');
    if (!existingCode) {
      // No code rendered yet - will be handled by ResizeObserver when rows render
      return;
    }

    // Get the actual computed styles from the rendered code element
    const codeStyles = getComputedStyle(existingCode);

    // Create a hidden measuring element with the same styles as actual diff code
    const measurer = document.createElement('div');
    measurer.style.cssText = `
      position: absolute;
      visibility: hidden;
      height: auto;
      width: auto;
      white-space: pre;
      font-family: ${codeStyles.fontFamily};
      font-size: ${codeStyles.fontSize};
      font-weight: ${codeStyles.fontWeight};
      letter-spacing: ${codeStyles.letterSpacing};
    `;
    // Add gutter column widths: annotation (24px) + line number (48px) = 72px
    const lineNumberWidth = 72;
    measurer.textContent = longestContent;
    container.appendChild(measurer);

    // Measure and set width
    const contentWidth = measurer.offsetWidth + lineNumberWidth + 40; // 40px padding
    container.removeChild(measurer);

    updateScrollWidth(contentWidth);
  }, [diffLines, lineNumberMode, updateScrollWidth]);

  // Use ResizeObserver to detect when virtualized content width changes.
  // This is needed because react-window renders rows asynchronously, so the
  // scroll width may not be accurate immediately after diffLines changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial measurement after a frame to let react-window render
    const rafId = requestAnimationFrame(() => {
      updateScrollWidth();
    });

    // Observe the inner content div that react-window creates.
    // This fires when rows are rendered and their widths change.
    // Debounce with RAF to avoid excessive DOM queries when react-window
    // renders rows incrementally.
    let resizeRafId: number | undefined;
    const observer = new ResizeObserver(() => {
      resizeRafId ??= requestAnimationFrame(() => {
        resizeRafId = undefined;
        updateScrollWidth();
      });
    });

    // Observe the list container - its scroll width changes when content renders
    const list = container.querySelector('.virtualized-inline-list');
    if (list) {
      observer.observe(list);
      // Also observe the inner div that contains the actual rows
      const innerDiv = list.firstElementChild;
      if (innerDiv) {
        observer.observe(innerDiv);
      }
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (resizeRafId !== undefined) {
        cancelAnimationFrame(resizeRafId);
      }
      observer.disconnect();
    };
  }, [diffLines, updateScrollWidth]);

  // Memoize row props to prevent unnecessary re-renders
  const rowProps = useMemo<RowData>(
    () => ({
      diffLines,
      language,
      threadsByLineAndSide,
      currentUserLogin,
      addReply,
      editComment,
      deleteComment,
      toggleResolved,
      draftLineIndex,
      draftBody,
      isSubmittingDraft,
      submitError,
      onCancelDraft,
      onChangeDraftBody,
      onSubmitDraft,
      showWhitespace,
      lineNumberMode,
      hasFullContent,
      showComments,
    }),
    [
      diffLines,
      language,
      threadsByLineAndSide,
      currentUserLogin,
      addReply,
      editComment,
      deleteComment,
      toggleResolved,
      draftLineIndex,
      draftBody,
      isSubmittingDraft,
      submitError,
      onCancelDraft,
      onChangeDraftBody,
      onSubmitDraft,
      showWhitespace,
      lineNumberMode,
      hasFullContent,
      showComments,
    ]
  );

  return (
    <div ref={containerRef} className="virtualized-inline-container">
      <List
        listRef={listRef}
        rowComponent={DiffRow}
        rowCount={diffLines.length}
        rowHeight={dynamicRowHeight}
        className="virtualized-inline-list"
        style={{ height: containerHeight, width: '100%' }}
        overscanCount={OVERSCAN_COUNT}
        rowProps={rowProps}
        onRowsRendered={handleRowsRendered}
      />
    </div>
  );
}
