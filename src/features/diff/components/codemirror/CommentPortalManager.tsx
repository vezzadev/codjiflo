/**
 * Comment Portal Manager
 *
 * Manages React portals for rendering CommentThread and draft comment
 * components inside CodeMirror widget containers.
 */

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CommentThread, CommentEditor } from '@/features/comments';
import type { ReviewThread } from '@/features/comments';

export interface PortalCallbacks {
  onMountThread: (threadId: string, container: HTMLElement) => void;
  onUnmountThread: (threadId: string) => void;
  onMountDraft: (lineIndex: number, container: HTMLElement) => void;
  onUnmountDraft: () => void;
}

interface MountedThread {
  container: HTMLElement;
  thread: ReviewThread;
}

interface MountedDraft {
  lineIndex: number;
  container: HTMLElement;
}

export interface CommentPortalManagerProps {
  /** All threads indexed by thread ID */
  threadsById: Map<string, ReviewThread>;
  /** Current user's GitHub login */
  currentUserLogin: string;
  /** Callback to add a reply */
  addReply: (threadId: string, body: string) => Promise<void>;
  /** Callback to edit a comment */
  editComment: (commentId: string, body: string) => Promise<void>;
  /** Callback to delete a comment */
  deleteComment: (commentId: string) => Promise<void>;
  /** Callback to toggle resolved status */
  toggleResolved: (threadId: string) => void;
  /** Draft comment body */
  draftBody: string;
  /** Whether draft is being submitted */
  isSubmittingDraft: boolean;
  /** Draft submit error */
  submitError: string | null;
  /** Cancel draft callback */
  onCancelDraft: () => void;
  /** Change draft body callback */
  onChangeDraftBody: (body: string) => void;
  /** Submit draft callback */
  onSubmitDraft: () => void;
  /** Render function that receives portal callbacks */
  children: (callbacks: PortalCallbacks) => React.ReactNode;
}

/**
 * Manages React portals for rendering comment UI inside CodeMirror widgets.
 *
 * Usage:
 * ```tsx
 * <CommentPortalManager
 *   threadsById={threadsById}
 *   currentUserLogin={login}
 *   // ... other props
 * >
 *   {(callbacks) => (
 *     <UnifiedDiffEditor
 *       onMountThread={callbacks.onMountThread}
 *       // ... other props
 *     />
 *   )}
 * </CommentPortalManager>
 * ```
 */
export function CommentPortalManager({
  threadsById,
  currentUserLogin,
  addReply,
  editComment,
  deleteComment,
  toggleResolved,
  draftBody,
  isSubmittingDraft,
  submitError,
  onCancelDraft,
  onChangeDraftBody,
  onSubmitDraft,
  children,
}: CommentPortalManagerProps) {
  // Track mounted thread containers
  const [mountedThreads, setMountedThreads] = useState<Map<string, MountedThread>>(
    () => new Map()
  );

  // Track mounted draft container
  const [mountedDraft, setMountedDraft] = useState<MountedDraft | null>(null);

  // Handle thread mount
  const handleMountThread = useCallback(
    (threadId: string, container: HTMLElement) => {
      const thread = threadsById.get(threadId);
      if (!thread) return;

      setMountedThreads((prev) => {
        const next = new Map(prev);
        next.set(threadId, { container, thread });
        return next;
      });
    },
    [threadsById]
  );

  // Handle thread unmount
  const handleUnmountThread = useCallback((threadId: string) => {
    setMountedThreads((prev) => {
      const next = new Map(prev);
      next.delete(threadId);
      return next;
    });
  }, []);

  // Handle draft mount
  const handleMountDraft = useCallback(
    (lineIndex: number, container: HTMLElement) => {
      setMountedDraft({ lineIndex, container });
    },
    []
  );

  // Handle draft unmount
  const handleUnmountDraft = useCallback(() => {
    setMountedDraft(null);
  }, []);

  // Create callbacks object
  const callbacks = useMemo<PortalCallbacks>(
    () => ({
      onMountThread: handleMountThread,
      onUnmountThread: handleUnmountThread,
      onMountDraft: handleMountDraft,
      onUnmountDraft: handleUnmountDraft,
    }),
    [handleMountThread, handleUnmountThread, handleMountDraft, handleUnmountDraft]
  );

  // Render portals for mounted threads
  const threadPortals = useMemo(() => {
    const portals: React.ReactNode[] = [];

    mountedThreads.forEach(({ container, thread }, threadId) => {
      // Get the latest thread data from threadsById (for updates)
      const latestThread = threadsById.get(threadId) ?? thread;

      portals.push(
        createPortal(
          <CommentThread
            key={threadId}
            thread={latestThread}
            currentUserLogin={currentUserLogin}
            onReply={addReply}
            onEdit={editComment}
            onDelete={deleteComment}
            onToggleResolved={toggleResolved}
          />,
          container
        )
      );
    });

    return portals;
  }, [
    mountedThreads,
    threadsById,
    currentUserLogin,
    addReply,
    editComment,
    deleteComment,
    toggleResolved,
  ]);

  // Render portal for draft editor
  const draftPortal = useMemo(() => {
    if (!mountedDraft) return null;

    return createPortal(
      <div className="draft-comment-editor" data-line-index={mountedDraft.lineIndex}>
        <CommentEditor
          value={draftBody}
          onChange={onChangeDraftBody}
          onSubmit={onSubmitDraft}
          onCancel={onCancelDraft}
          isSubmitting={isSubmittingDraft}
          submitLabel="Add comment"
          label="New comment"
        />
        {submitError && <div className="draft-comment-error">{submitError}</div>}
      </div>,
      mountedDraft.container
    );
  }, [
    mountedDraft,
    draftBody,
    onChangeDraftBody,
    onSubmitDraft,
    onCancelDraft,
    isSubmittingDraft,
    submitError,
  ]);

  return (
    <>
      {children(callbacks)}
      {threadPortals}
      {draftPortal}
    </>
  );
}
