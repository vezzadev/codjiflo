/**
 * Inline Diff Table Component
 *
 * Renders a non-virtualized inline diff view (for files under 500 lines).
 * Supports content filtering, comments, and line-level interactions.
 */

import { Fragment } from 'react';
import { DiffLine } from './DiffLine';
import { CommentEditor, CommentThread } from '@/features/comments';
import type { ReviewThread } from '@/features/comments';
import type { ParsedDiffLine } from '../types';

export interface InlineDiffTableProps {
  /** Pre-filtered diff lines from pipeline */
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
  /** Show whitespace characters visibly */
  showWhitespace: boolean;
  /** Line number display mode: left (old only), right (new only), both */
  lineNumberMode: 'left' | 'both' | 'right';
  /** Whether full file content is available for accurate token lookup */
  hasFullContent?: boolean;
}

/**
 * Renders an inline diff view as a table.
 *
 * Features:
 * - Content filtering (left/both/right)
 * - Line-level comment threads
 * - Draft comment editor
 * - Whitespace visibility toggle
 */
export function InlineDiffTable({
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
  hasFullContent = false,
}: InlineDiffTableProps) {
  // colSpan depends on line number mode: both = 4 (2 line nums + marker + content), left/right = 3
  const colSpan = lineNumberMode === 'both' ? 4 : 3;

  return (
    <table className="diff-table">
      <tbody>
        {diffLines.map((line, index) => {
          const leftKey = line.oldLineNumber != null ? `${String(line.oldLineNumber)}-LEFT` : null;
          const rightKey = line.newLineNumber != null ? `${String(line.newLineNumber)}-RIGHT` : null;
          const lineThreads = [
            ...(leftKey ? threadsByLineAndSide.get(leftKey) ?? [] : []),
            ...(rightKey ? threadsByLineAndSide.get(rightKey) ?? [] : []),
          ];
          const showCommentButton = line.type !== 'header';

          // Use line numbers for stable keys when available, fall back to index
          const lineKey =
            line.oldLineNumber != null || line.newLineNumber != null
              ? `${String(line.oldLineNumber ?? 'n')}-${String(line.newLineNumber ?? 'n')}-${line.type}`
              : `${String(index)}-${line.type}`;

          return (
            <Fragment key={lineKey}>
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
              {draftLineIndex === index && (
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
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
