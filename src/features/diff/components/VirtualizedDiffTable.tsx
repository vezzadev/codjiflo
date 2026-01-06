/**
 * Virtualized diff table for large files (500+ lines)
 * Uses react-window for performant rendering
 */

import { useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { DiffLine } from './DiffLine';
import type { ParsedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';
import { CommentThread, CommentEditor } from '@/features/comments';

/** Line height from CSS variables (--diff-line-height) */
const LINE_HEIGHT = 23;

/** Number of rows to render outside the visible area */
const OVERSCAN_COUNT = 10;

interface VirtualizedDiffTableProps {
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
}

/**
 * Individual row renderer for the virtualized list
 */
function DiffRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const {
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
  } = data;

  const line = diffLines[index];
  if (!line) return null;

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
      <table className="diff-table" style={{ width: '100%' }}>
        <tbody>
          <DiffLine
            line={line}
            language={language}
            showCommentButton={showCommentButton}
            onStartComment={() => onStartComment(index)}
            showWhitespace={showWhitespace}
            lineNumberMode={lineNumberMode}
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
 * Virtualized diff table using react-window
 * Used when diff has more than 500 lines for better performance
 */
export function VirtualizedDiffTable({
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
}: VirtualizedDiffTableProps) {
  const listRef = useRef<List>(null);

  // Scroll to row when scrollToRowIndex changes (J/K navigation)
  useEffect(() => {
    if (scrollToRowIndex !== undefined && scrollToRowIndex >= 0 && listRef.current) {
      // Scroll with some offset to show context lines above
      const contextLines = 3;
      const targetIndex = Math.max(0, scrollToRowIndex - contextLines);
      listRef.current.scrollToItem(targetIndex, 'start');
    }
  }, [scrollToRowIndex]);

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo<RowData>(
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
    ]
  );

  return (
    <List
      ref={listRef}
      height={containerHeight}
      itemCount={diffLines.length}
      itemSize={LINE_HEIGHT}
      width="100%"
      overscanCount={OVERSCAN_COUNT}
      itemData={itemData}
    >
      {DiffRow}
    </List>
  );
}
