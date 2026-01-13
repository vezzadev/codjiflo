/**
 * Inline Diff Table Component
 *
 * Renders a non-virtualized inline diff view (for files under 500 lines).
 * Supports content filtering, comments, and line-level interactions.
 */

import { Fragment, useMemo } from 'react';
import { DiffLine } from './DiffLine';
import { CommentEditor, CommentThread } from '@/features/comments';
import type { ReviewThread } from '@/features/comments';
import type { ParsedDiffLine, ContentFilter } from '../types';

export interface InlineDiffTableProps {
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
  /** Content filter: left (original), both, or right (modified) - AC-3.3.11-15 */
  contentFilter: ContentFilter;
}

/**
 * Renders a inline diff view as a table.
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
  contentFilter,
}: InlineDiffTableProps) {
  // Filter lines based on content filter (AC-3.3.11-13)
  const filteredLines = useMemo(() => {
    if (contentFilter === 'both') return diffLines;

    return diffLines.filter((line) => {
      // Always show headers
      if (line.type === 'header') return true;
      // Context lines shown in all modes
      if (line.type === 'context') return true;

      if (contentFilter === 'left') {
        // Left: show deletions, hide additions
        return line.type === 'deletion';
      } else {
        // Right: show additions, hide deletions
        return line.type === 'addition';
      }
    });
  }, [diffLines, contentFilter]);

  // Determine line number display mode based on content filter (AC-3.3.14-15)
  const lineNumberMode = contentFilter === 'left' ? 'left' : contentFilter === 'right' ? 'right' : 'both';

  return (
    <table className="diff-table">
      <tbody>
        {filteredLines.map((line, index) => {
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

          // colSpan depends on line number mode: both = 4 (2 line nums + marker + content), left/right = 3 (1 line num + marker + content)
          const colSpan = lineNumberMode === 'both' ? 4 : 3;

          return (
            <Fragment key={lineKey}>
              <DiffLine
                line={line}
                language={language}
                showCommentButton={showCommentButton}
                onStartComment={() => onStartComment(index)}
                showWhitespace={showWhitespace}
                lineNumberMode={lineNumberMode}
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
