/**
 * Main Diff View Component
 *
 * Orchestrates diff rendering using the pipeline architecture.
 * S-1.4: Inline view
 * S-3.2: Side-by-side view
 * S-3.3: View mode toggles
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import {
  useDiffPipeline,
  useDraftComment,
  useContainerHeight,
  useIterationDiff,
} from '../hooks';
import { DiffToolbar } from './DiffToolbar';
import { SideBySideDiffView } from './SideBySideDiffView';
import { VirtualizedInlineDiffTable } from './VirtualizedInlineDiffTable';
import { VirtualizedSideBySideDiffView } from './VirtualizedSideBySideDiffView';
import { InlineDiffTable } from './InlineDiffTable';
import { DiffLoadingState } from './DiffLoadingState';
import { DiffEmptyState } from './DiffEmptyState';
import { ShikiTokensProvider } from './ShikiTokensContext';
import { useCommentsStore } from '@/features/comments';
import { usePRStore } from '@/features/pr';
import { PRDescription, PRMetadata } from '@/features/pr/components';
import { IterationSelector } from '@/features/iterations';

/** Duration in milliseconds for screen reader announcements */
const ANNOUNCEMENT_TIMEOUT_MS = 4000;

/**
 * Main diff view component with support for inline and side-by-side modes.
 */
export function DiffView() {
  const { files, selectedFileIndex, isLoading, currentChangeIndex, resetChangeIndex, setTotalChangeCount } = useDiffStore();
  const { currentPR, isLoading: isPRLoading } = usePRStore();
  const { selectedRange, getFileDiffByPath, isIterationMode } = useIterationDiff();
  const {
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

  // Pipeline: all diff computation in one composable hook
  const pipeline = useDiffPipeline();

  // Draft comment management
  const draft = useDraftComment();

  // Virtualization support
  const { containerHeight, containerRefCallback, scrollContainerRef } = useContainerHeight();

  const isShowingDescription = selectedFileIndex === PR_DESCRIPTION_INDEX;
  const selectedFile = files[selectedFileIndex];

  // Clear announcement after timeout
  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => {
      clearAnnouncement();
    }, ANNOUNCEMENT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [announcement, clearAnnouncement]);

  // Reset change navigation when iteration selection changes
  useEffect(() => {
    resetChangeIndex();
  }, [selectedRange, resetChangeIndex]);

  // Sync hunk count to store for navigation controls
  useEffect(() => {
    setTotalChangeCount(pipeline.hunkIndices.length);
  }, [pipeline.hunkIndices.length, setTotalChangeCount]);

  // Scroll to specific hunk when currentChangeIndex changes (non-virtualized views only)
  // Virtualized views handle scrolling via scrollToRowIndex prop
  useEffect(() => {
    if (isShowingDescription || currentChangeIndex < 0 || pipeline.isVirtualized) return;

    const frameId = requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      // Query DOM for the target element
      const allRows = Array.from(scrollContainer.querySelectorAll('[data-line-type]'));
      let hunkCount = 0;
      let inHunk = false;
      let targetElement: Element | null = null;

      for (const row of allRows) {
        const lineType = row.getAttribute('data-line-type');
        const isChange = lineType === 'addition' || lineType === 'deletion';

        if (isChange && !inHunk) {
          if (hunkCount === currentChangeIndex) {
            targetElement = row;
            break;
          }
          hunkCount++;
          inHunk = true;
        } else if (!isChange) {
          inHunk = false;
        }
      }

      if (targetElement) {
        const rootStyles = getComputedStyle(document.documentElement);
        const lineHeight = parseFloat(rootStyles.getPropertyValue('--diff-line-height')) || 23;
        const contextLines = parseFloat(rootStyles.getPropertyValue('--diff-scroll-context-lines')) || 3;
        const contextOffset = contextLines * lineHeight;

        const lineRect = targetElement.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const scrollOffset = lineRect.top - containerRect.top + scrollContainer.scrollTop - contextOffset;
        scrollContainer.scrollTop = Math.max(0, scrollOffset);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [currentChangeIndex, isShowingDescription, pipeline.isVirtualized, scrollContainerRef]);

  // Handler for starting comment (inline view only shows RIGHT side)
  const handleStartCommentInline = useCallback(
    (index: number) => {
      const targetLine = pipeline.diffLines[index];
      const side = targetLine?.type === 'deletion' ? 'LEFT' : 'RIGHT';
      draft.startComment(index, side);
    },
    [pipeline.diffLines, draft]
  );

  // Handler for submitting draft
  const handleSubmitDraft = useCallback(() => {
    if (draft.draftLineIndex !== null && draft.draftSide !== null && pipeline.filename) {
      void draft.submitComment(
        pipeline.diffLines,
        pipeline.alignedLines,
        pipeline.filename,
        pipeline.viewMode
      );
    }
  }, [draft, pipeline]);

  // Get full file content from iteration diff for accurate multi-line syntax highlighting
  const fullFileContent = useMemo(() => {
    if (!isIterationMode || !pipeline.filename) {
      return { oldContent: undefined, newContent: undefined };
    }
    const iterationDiff = getFileDiffByPath(pipeline.filename);
    return {
      oldContent: iterationDiff?.base?.content,
      newContent: iterationDiff?.head?.content,
    };
  }, [isIterationMode, pipeline.filename, getFileDiffByPath]);

  const hasFullContent = fullFileContent.oldContent !== undefined || fullFileContent.newContent !== undefined;

  // Fallback: extract line contents for non-iteration mode (multi-line comment support)
  const visibleLines = useMemo(() => {
    if (hasFullContent) return undefined;
    return pipeline.diffLines.map(line => line.content);
  }, [pipeline.diffLines, hasFullContent]);

  // Loading state
  if (isLoading || (isShowingDescription && isPRLoading) || pipeline._isLoadingFullFile) {
    return <DiffLoadingState />;
  }

  // PR description view
  if (isShowingDescription) {
    return (
      <div className="diff-description-view">
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
          <DiffEmptyState variant="no-pr" />
        )}
      </div>
    );
  }

  // No file selected
  if (!selectedFile && !pipeline.filename) {
    return <DiffEmptyState variant="no-file" />;
  }

  // No patch available (binary file or too large)
  if (!pipeline.isIterationMode && selectedFile && !selectedFile.patch) {
    return <DiffEmptyState variant="no-patch" />;
  }

  return (
    <div className="diff-view-container">
      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Sticky file header with toolbar */}
      <div className="diff-header">
        <div className="diff-header-iterations">
          <IterationSelector />
        </div>
        <div className="diff-header-toolbar">
          <h2 className="diff-filename" title={pipeline.filename}>
            {pipeline.filename}
          </h2>
          <DiffToolbar />
        </div>
      </div>

      {/* Error and loading banners */}
      {pipeline._fullFileError && (
        <div className="diff-error-banner">{pipeline._fullFileError}</div>
      )}
      {commentsError && (
        <div className="diff-error-banner">{commentsError}</div>
      )}
      {isLoadingComments && (
        <div className="diff-loading-banner">Loading comments...</div>
      )}

      {/* Diff content - wrapped with ShikiTokensProvider for multi-line comment support */}
      <ShikiTokensProvider
        oldContent={fullFileContent.oldContent}
        newContent={fullFileContent.newContent}
        visibleLines={visibleLines}
        language={pipeline.language}
      >
        {pipeline.viewMode === 'inline' ? (
          <div
            ref={containerRefCallback}
            className="diff-content-area"
            role="region"
            aria-label={`Diff content for ${pipeline.filename}`}
            tabIndex={0}
          >
            {pipeline.isVirtualized ? (
              <VirtualizedInlineDiffTable
              key={pipeline.filename ?? 'diff-table-virtualized'}
              diffLines={pipeline.diffLines}
              language={pipeline.language}
              containerHeight={containerHeight}
              threadsByLineAndSide={pipeline.threadsByLineAndSide}
              currentUserLogin={currentUser.login}
              addReply={addReply}
              editComment={editComment}
              deleteComment={deleteComment}
              toggleResolved={toggleResolved}
              draftLineIndex={draft.draftLineIndex}
              draftBody={draft.draftBody}
              isSubmittingDraft={draft.isSubmitting}
              submitError={draft.submitError}
              onStartComment={handleStartCommentInline}
              onCancelDraft={draft.cancelDraft}
              onChangeDraftBody={draft.setDraftBody}
              onSubmitDraft={handleSubmitDraft}
              showWhitespace={pipeline.showWhitespace}
              lineNumberMode={pipeline.lineNumberMode}
              scrollToRowIndex={pipeline.scrollToRowIndex}
              hasFullContent={hasFullContent}
            />
          ) : (
            <InlineDiffTable
              key={pipeline.filename ?? 'diff-table'}
              diffLines={pipeline.diffLines}
              language={pipeline.language}
              threadsByLineAndSide={pipeline.threadsByLineAndSide}
              currentUserLogin={currentUser.login}
              addReply={addReply}
              editComment={editComment}
              deleteComment={deleteComment}
              toggleResolved={toggleResolved}
              draftLineIndex={draft.draftLineIndex}
              draftBody={draft.draftBody}
              isSubmittingDraft={draft.isSubmitting}
              submitError={draft.submitError}
              onStartComment={handleStartCommentInline}
              onCancelDraft={draft.cancelDraft}
              onChangeDraftBody={draft.setDraftBody}
              onSubmitDraft={handleSubmitDraft}
              showWhitespace={pipeline.showWhitespace}
              lineNumberMode={pipeline.lineNumberMode}
              hasFullContent={hasFullContent}
            />
          )}
        </div>
      ) : pipeline.isVirtualized ? (
        <div
          ref={containerRefCallback}
          className="diff-content-area"
          role="region"
          aria-label={`Diff content for ${pipeline.filename}`}
          tabIndex={0}
        >
          <VirtualizedSideBySideDiffView
            alignedLines={pipeline.alignedLines}
            language={pipeline.language}
            containerHeight={containerHeight}
            threadsByLineAndSide={pipeline.threadsByLineAndSide}
            currentUserLogin={currentUser.login}
            addReply={addReply}
            editComment={editComment}
            deleteComment={deleteComment}
            toggleResolved={toggleResolved}
            contentFilter={pipeline.contentFilter}
            draftLineIndex={draft.draftLineIndex}
            draftSide={draft.draftSide}
            draftBody={draft.draftBody}
            isSubmittingDraft={draft.isSubmitting}
            submitError={draft.submitError}
            onStartComment={draft.startComment}
            onCancelDraft={draft.cancelDraft}
            onChangeDraftBody={draft.setDraftBody}
            onSubmitDraft={handleSubmitDraft}
            showWhitespace={pipeline.showWhitespace}
            scrollToRowIndex={pipeline.scrollToRowIndex}
            hasFullContent={hasFullContent}
          />
        </div>
      ) : (
        <SideBySideDiffView
          containerRef={scrollContainerRef}
          alignedLines={pipeline.alignedLines}
          language={pipeline.language}
          threadsByLineAndSide={pipeline.threadsByLineAndSide}
          currentUserLogin={currentUser.login}
          addComment={addComment}
          addReply={addReply}
          editComment={editComment}
          deleteComment={deleteComment}
          toggleResolved={toggleResolved}
          contentFilter={pipeline.contentFilter}
          draftLineIndex={draft.draftLineIndex}
          draftSide={draft.draftSide}
          draftBody={draft.draftBody}
          isSubmittingDraft={draft.isSubmitting}
          submitError={draft.submitError}
          onStartComment={draft.startComment}
          onCancelDraft={draft.cancelDraft}
          onChangeDraftBody={draft.setDraftBody}
          onSubmitDraft={handleSubmitDraft}
          showWhitespace={pipeline.showWhitespace}
          hasFullContent={hasFullContent}
        />
        )}
      </ShikiTokensProvider>
    </div>
  );
}
