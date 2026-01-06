import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useDiffStore, useDiffContentStore, PR_DESCRIPTION_INDEX } from '../stores';
import {
  parsePatch,
  detectLanguage,
  getDiffLinePosition,
  alignDiffLines,
} from '../utils';
import { useIterationDiff } from '../hooks';
import { DiffLine } from './DiffLine';
import { DiffToolbar } from './DiffToolbar';
import { SideBySideDiffView } from './SideBySideDiffView';
import { VirtualizedDiffTable } from './VirtualizedDiffTable';
import { VirtualizedSideBySideDiffView } from './VirtualizedSideBySideDiffView';
import { Skeleton } from '@/components/ui';
import { CommentEditor, CommentThread, useCommentsStore } from '@/features/comments';
import type { ReviewThread } from '@/features/comments';
import { usePRStore } from '@/features/pr';
import { PRDescription, PRMetadata } from '@/features/pr/components';
import { IterationSelector } from '@/features/iterations';
import type { ParsedDiffLine, AlignedDiffLine, FullFileDiff } from '../types';

/** Duration in milliseconds for screen reader announcements */
const ANNOUNCEMENT_TIMEOUT_MS = 4000;

/** Threshold for enabling virtualization (AC-3.1.12) */
const VIRTUALIZATION_THRESHOLD = 500;

/**
 * Main diff view component with support for unified and side-by-side modes
 * S-1.4: AC-1.4.1 through AC-1.4.10 (Unified view)
 * S-3.2: AC-3.2.1 through AC-3.2.9 (Side-by-side view)
 * S-3.3: AC-3.3.1 through AC-3.3.16 (View mode toggles)
 */
export function DiffView() {
  // useParams returns object with owner/repo from route, may be empty object in tests
  const params = useParams<{ owner: string; repo: string }>();
  const owner = (params as Record<string, string | undefined>).owner ?? '';
  const repo = (params as Record<string, string | undefined>).repo ?? '';

  const { files, selectedFileIndex, isLoading, viewConfig } = useDiffStore();
  const { currentPR, isLoading: isPRLoading } = usePRStore();
  const { computeFullFileDiff, isLoadingContent, contentError } = useDiffContentStore();

  // Iteration-based diff for cross-iteration comparison
  const { isIterationMode, getFileDiffByPath } = useIterationDiff();
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

  // Full file diff state
  const [fullFileDiff, setFullFileDiff] = useState<FullFileDiff | null>(null);
  const [fullFileError, setFullFileError] = useState<string | null>(null);

  // Draft comment state (shared between unified and SxS views)
  const [draftLineIndex, setDraftLineIndex] = useState<number | null>(null);
  const [draftSide, setDraftSide] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Container height for virtualization
  const [containerHeight, setContainerHeight] = useState(600);

  const isShowingDescription = selectedFileIndex === PR_DESCRIPTION_INDEX;
  const selectedFile = files[selectedFileIndex];

  // Parse the patch and detect language
  const patch = selectedFile?.patch;
  const filename = selectedFile?.filename;

  // Get iteration-based diff when in iteration mode
  // selectedRange is accessed via getFileDiffByPath closure, so changes to it will
  // trigger recomputation through the hook's internal memoization
  const iterationDiff = useMemo((): FullFileDiff | null => {
    if (!isIterationMode || !filename) {
      return null;
    }

    return getFileDiffByPath(filename);
  }, [isIterationMode, filename, getFileDiffByPath]);

  const { diffLines, language } = useMemo(() => {
    // Priority 1: Use iteration diff when in iteration mode (S-4.8)
    if (isIterationMode && iterationDiff) {
      return {
        diffLines: iterationDiff.diffLines,
        language: detectLanguage(filename ?? ''),
      };
    }

    // Priority 2: Use full file diff when available (AC-3.1.3-6)
    if (viewConfig.showFullFile && fullFileDiff) {
      return {
        diffLines: fullFileDiff.diffLines,
        language: detectLanguage(filename ?? ''),
      };
    }

    // Fall back to patch-based diff
    if (!patch) {
      return { diffLines: [] as ParsedDiffLine[], language: 'plaintext' };
    }

    return {
      diffLines: parsePatch(patch),
      language: detectLanguage(filename ?? ''),
    };
  }, [patch, filename, viewConfig.showFullFile, fullFileDiff, isIterationMode, iterationDiff]);

  // Compute aligned lines for side-by-side view (S-3.2)
  const alignedLines = useMemo((): AlignedDiffLine[] => {
    if (viewConfig.mode !== 'split') return [];

    // Priority 1: Use iteration diff aligned lines
    if (isIterationMode && iterationDiff) {
      return iterationDiff.alignedLines;
    }

    // Priority 2: Use full file aligned lines when available (AC-3.1.7-9)
    if (viewConfig.showFullFile && fullFileDiff) {
      return fullFileDiff.alignedLines;
    }

    return alignDiffLines(diffLines);
  }, [diffLines, viewConfig.mode, viewConfig.showFullFile, fullFileDiff, isIterationMode, iterationDiff]);

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
    const map = new Map<string, ReviewThread[]>();
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

  // Clear draft when switching files
  useEffect(() => {
    setDraftLineIndex(null);
    setDraftSide(null);
    setDraftBody('');
    setSubmitError(null);
  }, [selectedFileIndex]);

  // Autoscroll to first changed line when switching files
  useEffect(() => {
    if (isShowingDescription) return;

    // Use requestAnimationFrame to ensure DOM has rendered
    const frameId = requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const firstChangedLine = scrollContainer.querySelector(
        '[data-line-type="addition"], [data-line-type="deletion"]'
      );

      if (firstChangedLine) {
        // Manually scroll the content area instead of using scrollIntoView
        // to avoid scrolling ancestor containers (which would hide the header)
        // Read scroll context settings from CSS variables (defined in :root)
        const rootStyles = getComputedStyle(document.documentElement);
        const lineHeight = parseFloat(rootStyles.getPropertyValue('--diff-line-height')) || 23;
        const contextLines = parseFloat(rootStyles.getPropertyValue('--diff-scroll-context-lines')) || 3;
        const contextOffset = contextLines * lineHeight;

        const lineRect = firstChangedLine.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const scrollOffset = lineRect.top - containerRect.top + scrollContainer.scrollTop - contextOffset;
        scrollContainer.scrollTop = Math.max(0, scrollOffset);
        scrollContainer.scrollLeft = 0;
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [selectedFileIndex, isShowingDescription, viewConfig.mode]);

  // Fetch full file content when showFullFile is enabled (AC-3.1.1-2)
  useEffect(() => {
    if (!viewConfig.showFullFile || !filename || !currentPR || !owner || !repo) {
      setFullFileDiff(null);
      setFullFileError(null);
      return;
    }

    let cancelled = false;
    setFullFileError(null);

    computeFullFileDiff(
      owner,
      repo,
      filename,
      currentPR.baseSha,
      currentPR.headSha
    )
      .then((result) => {
        if (!cancelled) {
          setFullFileDiff(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load full file';
          setFullFileError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewConfig.showFullFile, filename, currentPR, owner, repo, computeFullFileDiff]);

  // Track container height for virtualization
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    // Initial height
    updateHeight();

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle comment submission for both unified and SxS views
  const handleSubmitComment = useCallback(
    async (index: number, side: 'LEFT' | 'RIGHT', body: string) => {
      if (isSubmittingRef.current) return;

      // For unified view, get line from diffLines
      // For SxS view, get line from alignedLines
      let targetLine: ParsedDiffLine | null = null;
      let lineNumber: number | null = null;

      if (viewConfig.mode === 'unified') {
        targetLine = diffLines[index] ?? null;
        lineNumber =
          side === 'LEFT' ? targetLine?.oldLineNumber ?? null : targetLine?.newLineNumber ?? null;
      } else {
        const pair = alignedLines[index];
        targetLine = (side === 'LEFT' ? pair?.left : pair?.right) ?? null;
        lineNumber = side === 'LEFT' ? targetLine?.oldLineNumber ?? null : targetLine?.newLineNumber ?? null;
      }

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
        setDraftSide(null);
        setDraftBody('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to post comment';
        setSubmitError(message);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmittingDraft(false);
      }
    },
    [addComment, diffLines, alignedLines, filename, viewConfig.mode]
  );

  const handleStartComment = useCallback((index: number, side: 'LEFT' | 'RIGHT') => {
    setDraftLineIndex(index);
    setDraftSide(side);
    setDraftBody('');
    setSubmitError(null);
  }, []);

  const handleCancelDraft = useCallback(() => {
    setDraftLineIndex(null);
    setDraftSide(null);
    setDraftBody('');
    setSubmitError(null);
  }, []);

  // Loading state (includes full file content loading AC-3.1.13)
  const isLoadingFullFile = viewConfig.showFullFile && isLoadingContent && !fullFileDiff;
  if (isLoading || (isShowingDescription && isPRLoading) || isLoadingFullFile) {
    return (
      <div className="diff-loading" role="status" aria-label="Loading diff">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton key={i} className="skeleton-line" />
        ))}
      </div>
    );
  }

  // Show PR metadata and description when selected
  if (isShowingDescription) {
    return (
      <div className="diff-description-view">
        {/* Iteration tabs above PR description */}
        <div className="diff-header-iterations">
          <IterationSelector />
        </div>
        {currentPR ? (
          <>
            <PRMetadata pr={currentPR} />
            <div className="diff-description-separator">
              <PRDescription description={currentPR.description} />
            </div>
          </>
        ) : (
          <div className="diff-empty-state">No PR data available</div>
        )}
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="diff-empty-state">
        Select a file to view diff
      </div>
    );
  }

  if (!selectedFile.patch) {
    return (
      <div className="diff-empty-state">
        <p>No diff available</p>
        <p className="diff-empty-subtext">(binary file or too large)</p>
      </div>
    );
  }

  return (
    <div className="diff-view-container">
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Sticky file header with toolbar (S-3.3) */}
      <div className="diff-header">
        {/* Iteration tabs above filename */}
        <div className="diff-header-iterations">
          <IterationSelector />
        </div>
        {/* Filename and toolbar */}
        <div className="diff-header-toolbar">
          <h2 className="diff-filename" title={selectedFile.filename}>
            {selectedFile.filename}
          </h2>
          <DiffToolbar />
        </div>
      </div>

      {/* Error and loading states */}
      {(fullFileError ?? contentError) && (
        <div className="diff-error-banner">
          {fullFileError ?? contentError}
        </div>
      )}
      {commentsError && (
        <div className="diff-error-banner">
          {commentsError}
        </div>
      )}
      {isLoadingComments && (
        <div className="diff-loading-banner">
          Loading comments...
        </div>
      )}

      {/* Diff content - conditional rendering based on view mode and virtualization */}
      {viewConfig.mode === 'unified' ? (
        <div
          ref={scrollContainerRef}
          className="diff-content-area"
          role="region"
          aria-label={`Diff content for ${selectedFile.filename}`}
          tabIndex={0}
        >
          {diffLines.length > VIRTUALIZATION_THRESHOLD ? (
            <VirtualizedDiffTable
              key={filename ?? 'diff-table-virtualized'}
              diffLines={diffLines}
              language={language}
              containerHeight={containerHeight}
              threadsByLineAndSide={threadsByLineAndSide}
              currentUserLogin={currentUser.login}
              addReply={addReply}
              editComment={editComment}
              deleteComment={deleteComment}
              toggleResolved={toggleResolved}
              draftLineIndex={draftLineIndex}
              draftBody={draftBody}
              isSubmittingDraft={isSubmittingDraft}
              submitError={submitError}
              onStartComment={(index) => handleStartComment(index, 'RIGHT')}
              onCancelDraft={handleCancelDraft}
              onChangeDraftBody={setDraftBody}
              onSubmitDraft={() => {
                if (draftLineIndex !== null) {
                  const targetLine = diffLines[draftLineIndex];
                  const side = targetLine?.type === 'deletion' ? 'LEFT' : 'RIGHT';
                  void handleSubmitComment(draftLineIndex, side, draftBody);
                }
              }}
              showWhitespace={viewConfig.showWhitespace}
              lineNumberMode={viewConfig.filter === 'left' ? 'left' : viewConfig.filter === 'right' ? 'right' : 'both'}
            />
          ) : (
            <UnifiedDiffTable
              key={filename ?? 'diff-table'}
              diffLines={diffLines}
              language={language}
              filename={filename ?? ''}
              threadsByLineAndSide={threadsByLineAndSide}
              currentUserLogin={currentUser.login}
              addReply={addReply}
              editComment={editComment}
              deleteComment={deleteComment}
              toggleResolved={toggleResolved}
              draftLineIndex={draftLineIndex}
              draftBody={draftBody}
              isSubmittingDraft={isSubmittingDraft}
              submitError={submitError}
              onStartComment={(index) => handleStartComment(index, 'RIGHT')}
              onCancelDraft={handleCancelDraft}
              onChangeDraftBody={setDraftBody}
              onSubmitDraft={() => {
                if (draftLineIndex !== null) {
                  const targetLine = diffLines[draftLineIndex];
                  const side = targetLine?.type === 'deletion' ? 'LEFT' : 'RIGHT';
                  void handleSubmitComment(draftLineIndex, side, draftBody);
                }
              }}
              showWhitespace={viewConfig.showWhitespace}
              contentFilter={viewConfig.filter}
            />
          )}
        </div>
      ) : diffLines.length > VIRTUALIZATION_THRESHOLD ? (
        <div
          ref={scrollContainerRef}
          className="diff-content-area"
          role="region"
          aria-label={`Diff content for ${selectedFile.filename}`}
          tabIndex={0}
        >
          <VirtualizedSideBySideDiffView
            alignedLines={alignedLines}
            language={language}
            containerHeight={containerHeight}
            threadsByLineAndSide={threadsByLineAndSide}
            currentUserLogin={currentUser.login}
            addReply={addReply}
            editComment={editComment}
            deleteComment={deleteComment}
            toggleResolved={toggleResolved}
            contentFilter={viewConfig.filter}
            draftLineIndex={draftLineIndex}
            draftSide={draftSide}
            draftBody={draftBody}
            isSubmittingDraft={isSubmittingDraft}
            submitError={submitError}
            onStartComment={handleStartComment}
            onCancelDraft={handleCancelDraft}
            onChangeDraftBody={setDraftBody}
            onSubmitDraft={() => {
              if (draftLineIndex !== null && draftSide !== null) {
                void handleSubmitComment(draftLineIndex, draftSide, draftBody);
              }
            }}
            showWhitespace={viewConfig.showWhitespace}
          />
        </div>
      ) : (
        <SideBySideDiffView
          containerRef={scrollContainerRef}
          alignedLines={alignedLines}
          language={language}
          threadsByLineAndSide={threadsByLineAndSide}
          currentUserLogin={currentUser.login}
          addComment={addComment}
          addReply={addReply}
          editComment={editComment}
          deleteComment={deleteComment}
          toggleResolved={toggleResolved}
          contentFilter={viewConfig.filter}
          draftLineIndex={draftLineIndex}
          draftSide={draftSide}
          draftBody={draftBody}
          isSubmittingDraft={isSubmittingDraft}
          submitError={submitError}
          onStartComment={handleStartComment}
          onCancelDraft={handleCancelDraft}
          onChangeDraftBody={setDraftBody}
          onSubmitDraft={() => {
            if (draftLineIndex !== null && draftSide !== null) {
              void handleSubmitComment(draftLineIndex, draftSide, draftBody);
            }
          }}
          showWhitespace={viewConfig.showWhitespace}
        />
      )}
    </div>
  );
}

// ============================================================================
// Unified Diff Table (extracted for clarity)
// ============================================================================

interface UnifiedDiffTableProps {
  diffLines: ParsedDiffLine[];
  language: string;
  filename: string;
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
  contentFilter: 'left' | 'both' | 'right';
}

function UnifiedDiffTable({
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
}: UnifiedDiffTableProps) {
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
