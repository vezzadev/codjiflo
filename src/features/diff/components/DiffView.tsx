import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import { parsePatch, detectLanguage, getDiffLinePosition } from '../utils';
import { DiffLine } from './DiffLine';
import { Skeleton } from '@/components/ui';
import { CommentEditor, CommentThread, useCommentsStore } from '@/features/comments';
import type { ReviewThread } from '@/features/comments';
import { usePRStore } from '@/features/pr';
import { PRDescription } from '@/features/pr/components';

/** Duration in milliseconds for screen reader announcements */
const ANNOUNCEMENT_TIMEOUT_MS = 4000;

/**
 * Unified diff view for the selected file
 * S-1.4: AC-1.4.1 through AC-1.4.10
 */
export function DiffView() {
  const { files, selectedFileIndex, isLoading } = useDiffStore();
  const { currentPR, isLoading: isPRLoading } = usePRStore();
  const {
    threads,
    isLoading: isLoadingComments,
    error: commentsError,
    announcement,
    currentUser,
    addComment,
    addReply,
    editComment,
    deleteComment,
    toggleResolved,
    clearAnnouncement,
  } = useCommentsStore();

  const isShowingDescription = selectedFileIndex === PR_DESCRIPTION_INDEX;
  const selectedFile = files[selectedFileIndex];

  // Parse the patch and detect language
  const patch = selectedFile?.patch;
  const filename = selectedFile?.filename;
  const { diffLines, language } = useMemo(() => {
    if (!patch) {
      return { diffLines: [], language: 'plaintext' };
    }
    return {
      diffLines: parsePatch(patch),
      language: detectLanguage(filename ?? ''),
    };
  }, [patch, filename]);

  const threadsForFile = useMemo(() => {
    if (!filename) return [];
    return threads
      .filter(
        (thread) =>
          thread.path === filename &&
          thread.comments.length > 0 &&
          thread.comments[0]?.createdAt != null
      )
      .sort((a, b) => {
        const aTime = a.comments[0]?.createdAt.getTime() ?? 0;
        const bTime = b.comments[0]?.createdAt.getTime() ?? 0;
        return aTime - bTime;
      });
  }, [threads, filename]);

  const threadsByLineAndSide = useMemo(() => {
    const map = new Map<string, typeof threadsForFile>();
    threadsForFile.forEach((thread) => {
      const key = `${String(thread.line)}-${thread.side}`;
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, thread]);
    });
    return map;
  }, [threadsForFile]);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => {
      clearAnnouncement();
    }, ANNOUNCEMENT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [announcement, clearAnnouncement]);

  if (isLoading || (isShowingDescription && isPRLoading)) {
    return (
      <div className="p-4 space-y-2" role="status" aria-label="Loading diff">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  // Show PR description when selected
  if (isShowingDescription) {
    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 bg-gray-100 px-4 py-2 border-b z-10">
          <h2 className="font-mono text-sm font-semibold">Pull Request Description</h2>
        </div>
        <div className="flex-1 overflow-auto pt-6">
          {currentPR ? (
            <PRDescription description={currentPR.description} />
          ) : (
            <div className="px-6 text-gray-500">No description available</div>
          )}
        </div>
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-8">
        Select a file to view diff
      </div>
    );
  }

  if (!selectedFile.patch) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No diff available</p>
        <p className="text-sm mt-1">(binary file or too large)</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {/* Sticky file header */}
      <div className="sticky top-0 bg-gray-100 px-4 py-2 border-b z-10">
        <h2 className="font-mono text-sm font-semibold truncate" title={selectedFile.filename}>
          {selectedFile.filename}
        </h2>
      </div>

      {/* AC-1.4.7: Horizontal scroll for long lines */}
      {/* AC-1.4.8: Accessible code block */}
      <div
        className="flex-1 overflow-auto"
        role="region"
        aria-label={`Diff content for ${selectedFile.filename}`}
        tabIndex={0}
      >
        {commentsError && (
          <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
            {commentsError}
          </div>
        )}
        {isLoadingComments && (
          <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
            Loading comments...
          </div>
        )}
        <DiffTable
          key={filename ?? 'diff-table'}
          diffLines={diffLines}
          language={language}
          filename={filename}
          threadsByLineAndSide={threadsByLineAndSide}
          currentUserLogin={currentUser.login}
          addComment={addComment}
          addReply={addReply}
          editComment={editComment}
          deleteComment={deleteComment}
          toggleResolved={toggleResolved}
        />
      </div>
    </div>
  );
}

type ThreadArray = ReviewThread[];

interface DiffTableProps {
  diffLines: ReturnType<typeof parsePatch>;
  language: string;
  filename: string | undefined;
  threadsByLineAndSide: Map<string, ThreadArray>;
  currentUserLogin: string;
  addComment: ReturnType<typeof useCommentsStore.getState>['addComment'];
  addReply: ReturnType<typeof useCommentsStore.getState>['addReply'];
  editComment: ReturnType<typeof useCommentsStore.getState>['editComment'];
  deleteComment: ReturnType<typeof useCommentsStore.getState>['deleteComment'];
  toggleResolved: ReturnType<typeof useCommentsStore.getState>['toggleResolved'];
}

function DiffTable({
  diffLines,
  language,
  filename,
  threadsByLineAndSide,
  currentUserLogin,
  addComment,
  addReply,
  editComment,
  deleteComment,
  toggleResolved,
}: DiffTableProps) {
  const [draftLineIndex, setDraftLineIndex] = useState<number | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const handleSubmitComment = useCallback(
    async (index: number, body: string) => {
      if (isSubmittingRef.current) return; // Prevent double submission

      const targetLine = diffLines[index];
      const side = targetLine?.type === 'deletion' ? 'LEFT' : 'RIGHT';
      const lineNumber =
        side === 'LEFT' ? targetLine?.oldLineNumber : targetLine?.newLineNumber;
      const position = getDiffLinePosition(diffLines, index);

      if (!targetLine || !lineNumber || !filename) {
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmittingDraft(true);
      setSubmitError(null);

      try {
        await addComment({
          path: filename,
          line: lineNumber,
          side,
          body: body.trim(),
          position,
        });
        setDraftLineIndex(null);
        setDraftBody('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to post comment';
        setSubmitError(message);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmittingDraft(false);
      }
    },
    [addComment, diffLines, filename]
  );

  return (
    <table className="w-full border-collapse text-sm">
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
                onStartComment={() => {
                  setDraftLineIndex(index);
                  setDraftBody('');
                  setSubmitError(null);
                }}
              />
              {draftLineIndex === index && (
                <tr>
                  <td colSpan={4} className="bg-gray-50 px-8 py-4">
                    {submitError && (
                      <div className="mb-2 text-sm text-red-600">{submitError}</div>
                    )}
                    <CommentEditor
                      value={draftBody}
                      onChange={setDraftBody}
                      onSubmit={() => {
                        void handleSubmitComment(index, draftBody);
                      }}
                      onCancel={() => {
                        setDraftLineIndex(null);
                        setDraftBody('');
                        setSubmitError(null);
                      }}
                      isSubmitting={isSubmittingDraft}
                      label="Add comment"
                    />
                  </td>
                </tr>
              )}
              {lineThreads.map((thread) => (
                <tr key={`thread-${thread.id}`}>
                  <td colSpan={4} className="bg-gray-50 px-8 py-4">
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
