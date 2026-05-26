import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components';
import type { ReviewThread } from '../types';
import { CommentEditor } from './CommentEditor';
import { CommentItem } from './CommentItem';

interface CommentThreadProps {
  thread: ReviewThread;
  currentUserLogin: string;
  onReply: (threadId: string, body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onToggleResolved: (threadId: string) => void;
}

export function CommentThread({
  thread,
  currentUserLogin,
  onReply,
  onEdit,
  onDelete,
  onToggleResolved,
}: CommentThreadProps) {
  const [reply, setReply] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const threadLabel = useMemo(
    () =>
      `Thread on line ${String(thread.line)} (${
        thread.side === 'LEFT' ? 'deleted' : 'added'
      } line)`,
    [thread.line, thread.side]
  );

  const handleReplySubmit = useCallback(async () => {
    if (!reply.trim()) return;
    setIsReplying(true);
    await onReply(thread.id, reply.trim());
    setReply('');
    setIsReplying(false);
  }, [onReply, reply, thread.id]);

  const handleEditStart = useCallback((commentId: string, body: string) => {
    setEditingCommentId(commentId);
    setEditBody(body);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingCommentId(null);
    setEditBody("");
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editingCommentId) return;
    setIsUpdating(true);
    await onEdit(editingCommentId, editBody.trim());
    setIsUpdating(false);
    handleEditCancel();
  }, [editBody, editingCommentId, handleEditCancel, onEdit]);

  const handleDelete = useCallback(
    async (commentId: string) => {
      const confirmed = window.confirm('Are you sure you want to delete this comment?');
      if (!confirmed) return;
      await onDelete(commentId);
    },
    [onDelete]
  );

  const classes = ['comment-thread', thread.isResolved ? 'resolved' : ''].filter(Boolean).join(' ');

  return (
    <section
      className={classes}
      aria-label={threadLabel}
    >
      <header className="comment-thread-header">
        <div className="comment-thread-title">
          <span>Thread on line {thread.line}</span>
          {thread.isResolved && (
            <span className="badge badge-success">Resolved</span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => onToggleResolved(thread.id)}
        >
          {thread.isResolved ? 'Unresolve' : 'Resolve conversation'}
        </Button>
      </header>
      <div className="comment-thread-body">
        {thread.comments.map((comment) =>
          editingCommentId === comment.id ? (
            <CommentEditor
              key={comment.id}
              value={editBody}
              onChange={setEditBody}
              onSubmit={() => {
                void handleEditSubmit();
              }}
              onCancel={handleEditCancel}
              isSubmitting={isUpdating}
              submitLabel="Update"
              label="Edit comment"
            />
          ) : (
            <CommentItem
              key={comment.id}
              comment={comment}
              isCurrentUser={comment.author.login === currentUserLogin}
              onEdit={() => handleEditStart(comment.id, comment.body)}
              onDelete={() => {
                void handleDelete(comment.id);
              }}
            />
          )
        )}
      </div>
      <div className="comment-thread-footer">
        <CommentEditor
          value={reply}
          onChange={setReply}
          onSubmit={() => {
            void handleReplySubmit();
          }}
          isSubmitting={isReplying}
          submitLabel="Reply"
          label="Reply to conversation"
        />
      </div>
    </section>
  );
}
