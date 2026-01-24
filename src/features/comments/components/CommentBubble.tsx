/**
 * Comment Bubble Component
 *
 * A floating comment card that displays outside the code flow.
 * Part of S-5.2: Floating Comment Bubbles
 */

import { useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { CommentThread } from './CommentThread';
import type { BubbleLayout } from '../layout-engine';
import type { ReviewThread } from '../types';

export interface CommentBubbleProps {
  /** Layout data with position and dimensions */
  layout: BubbleLayout;
  /** The thread to display */
  thread: ReviewThread;
  /** Current user login for edit/delete permissions */
  currentUserLogin: string;
  /** Whether this bubble is focused */
  isFocused: boolean;
  /** Handler for bubble focus (click) */
  onFocus: (threadId: string) => void;
  /** Handler for bubble close/collapse */
  onClose: (threadId: string) => void;
  /** Handler for adding a reply */
  onAddReply: (threadId: string, body: string) => Promise<void>;
  /** Handler for editing a comment */
  onEditComment: (threadId: string, commentId: string, body: string) => Promise<void>;
  /** Handler for deleting a comment */
  onDeleteComment: (threadId: string, commentId: string) => Promise<void>;
  /** Handler for toggling resolved state */
  onToggleResolved: (threadId: string, resolved: boolean) => Promise<void>;
  /** Handler for hover state (for highlighting connectors) */
  onHover?: (threadId: string | null) => void;
}

/**
 * Floating comment bubble with header and content
 */
export function CommentBubble({
  layout,
  thread,
  currentUserLogin,
  isFocused,
  onFocus,
  onClose,
  onAddReply,
  onEditComment,
  onDeleteComment,
  onToggleResolved,
  onHover,
}: CommentBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Format line info for header
  const lineInfo =
    layout.anchorSpan.startLine === layout.anchorSpan.endLine
      ? `Line ${layout.anchorSpan.startLine}`
      : `Lines ${layout.anchorSpan.startLine}-${layout.anchorSpan.endLine}`;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFocus(thread.id);
    },
    [onFocus, thread.id]
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(thread.id);
    },
    [onClose, thread.id]
  );

  const handleMouseEnter = useCallback(() => {
    onHover?.(thread.id);
  }, [onHover, thread.id]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  // Focus the bubble when it becomes focused
  useEffect(() => {
    if (isFocused && bubbleRef.current) {
      bubbleRef.current.focus();
    }
  }, [isFocused]);

  // Handlers for thread actions - adapt to CommentThread interface
  const handleReply = useCallback(
    (_threadId: string, body: string) => onAddReply(thread.id, body),
    [onAddReply, thread.id]
  );

  const handleEdit = useCallback(
    (commentId: string, body: string) => onEditComment(thread.id, commentId, body),
    [onEditComment, thread.id]
  );

  const handleDelete = useCallback(
    (commentId: string) => onDeleteComment(thread.id, commentId),
    [onDeleteComment, thread.id]
  );

  const handleToggleResolved = useCallback(
    () => {
      void onToggleResolved(thread.id, !thread.isResolved);
    },
    [onToggleResolved, thread.id, thread.isResolved]
  );

  return (
    <div
      ref={bubbleRef}
      className={`comment-bubble ${layout.isDisplaced ? 'comment-bubble--displaced' : ''} ${
        isFocused ? 'comment-bubble--focused' : ''
      }`}
      style={{
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${layout.width}px`,
        zIndex: layout.zIndex,
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={-1}
      role="article"
      aria-label={`Comment thread on ${lineInfo}`}
      data-thread-id={thread.id}
    >
      <div className="comment-bubble-header">
        <div className="comment-bubble-title">
          <span className="comment-bubble-line-info">{lineInfo}</span>
          {thread.isResolved && (
            <span className="comment-resolved-badge" aria-label="Resolved">
              Resolved
            </span>
          )}
        </div>
        <button
          type="button"
          className="comment-bubble-close"
          onClick={handleClose}
          aria-label="Collapse comment"
          title="Collapse"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="comment-bubble-content">
        <CommentThread
          thread={thread}
          currentUserLogin={currentUserLogin}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleResolved={handleToggleResolved}
        />
      </div>
    </div>
  );
}
