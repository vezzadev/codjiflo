/**
 * Inline diff table using react-window for performant rendering
 */

import { useMemo, useEffect } from 'react';
import { List, useListRef, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import { DiffLine } from './DiffLine';
import type { ParsedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';
import { CommentThread, CommentEditor } from '@/features/comments';

/** Default line height from CSS variables (--diff-line-height) */
const DEFAULT_ROW_HEIGHT = 23;

/** Number of rows to render outside the visible area */
const OVERSCAN_COUNT = 10;

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
  onStartComment: (index: number) => void;
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
  lineNumberMode: 'left' | 'both' | 'right';
  /** Row index to scroll to (for J/K navigation) */
  scrollToRowIndex?: number | undefined;
  /** Whether full file content is available for accurate token lookup */
  hasFullContent?: boolean;
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
  onStartComment: (index: number) => void;
  onCancelDraft: () => void;
  onChangeDraftBody: (body: string) => void;
  onSubmitDraft: () => void;
  showWhitespace: boolean;
  lineNumberMode: 'left' | 'both' | 'right';
  hasFullContent: boolean;
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
  onStartComment,
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
  showWhitespace,
  lineNumberMode,
  hasFullContent,
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

  const showCommentButton = line.type !== 'header';
  const showDraftHere = draftLineIndex === index;
  const colSpan = lineNumberMode === 'both' ? 4 : 3;

  return (
    <div style={style} className="virtualized-row">
      <table className="diff-table">
        <tbody>
          <DiffLine
            line={line}
            language={language}
            showCommentButton={showCommentButton}
            onStartComment={() => onStartComment(index)}
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
          {lineThreads.map((thread) => (
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
  onStartComment,
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
  showWhitespace,
  lineNumberMode,
  scrollToRowIndex,
  hasFullContent = false,
}: InlineDiffTableProps) {
  const listRef = useListRef(null);

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
    if (scrollToRowIndex !== undefined && scrollToRowIndex >= 0 && listRef.current) {
      // Read context lines from CSS variable for consistency with non-virtualized views
      let contextLines = 3;
      const rootStyles = getComputedStyle(document.documentElement);
      const cssValue = rootStyles.getPropertyValue('--diff-scroll-context-lines');
      const parsed = parseInt(cssValue, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        contextLines = parsed;
      }
      const targetIndex = Math.max(0, scrollToRowIndex - contextLines);
      listRef.current.scrollToRow({ index: targetIndex, align: 'start' });
    }
  }, [scrollToRowIndex]);

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
      onStartComment,
      onCancelDraft,
      onChangeDraftBody,
      onSubmitDraft,
      showWhitespace,
      lineNumberMode,
      hasFullContent,
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
      onStartComment,
      onCancelDraft,
      onChangeDraftBody,
      onSubmitDraft,
      showWhitespace,
      lineNumberMode,
      hasFullContent,
    ]
  );

  return (
    <List
      listRef={listRef}
      rowComponent={DiffRow}
      rowCount={diffLines.length}
      rowHeight={dynamicRowHeight}
      style={{ height: containerHeight, width: '100%', overflowX: 'visible' }}
      overscanCount={OVERSCAN_COUNT}
      rowProps={rowProps}
    />
  );
}
