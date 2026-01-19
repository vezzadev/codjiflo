/**
 * Main Diff View Component
 *
 * Orchestrates diff rendering using the pipeline architecture.
 * S-1.4: Inline view
 * S-3.2: Side-by-side view
 * S-3.3: View mode toggles
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDiffStore, PR_DESCRIPTION_INDEX } from '../stores';
import {
  useDiffPipeline,
  useDraftComment,
  useContainerHeight,
  useIterationDiff,
} from '../hooks';
import { DiffToolbar } from './DiffToolbar';
import { InlineDiffTable, type VisibleRowRange } from './InlineDiffTable';
import { SideBySideDiffView } from './SideBySideDiffView';
import { DiffLoadingState } from './DiffLoadingState';
import { DiffEmptyState } from './DiffEmptyState';
import { ShikiTokensProvider } from './ShikiTokensContext';
import { Minimap } from './Minimap';
import { useCommentsStore, useCommentTracking } from '@/features/comments';
import { usePRStore } from '@/features/pr';
import { PRDescription, PRMetadata } from '@/features/pr/components';
import { IterationSelector } from '@/features/iterations';

/** Duration in milliseconds for screen reader announcements */
const ANNOUNCEMENT_TIMEOUT_MS = 4000;

/** Line height matching CSS --diff-line-height and DEFAULT_ROW_HEIGHT */
const LINE_HEIGHT = 23;

/**
 * Main diff view component with support for inline and side-by-side modes.
 */
export function DiffView() {
  const { files, selectedFileIndex, isLoading, resetChangeIndex, setTotalChangeCount, viewConfig } = useDiffStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { currentPR, isLoading: isPRLoading } = usePRStore();
  const { selectedRange, getFileDiffByPath, isIterationMode } = useIterationDiff();
  const {
    isLoading: isLoadingComments,
    error: commentsError,
    announcement,
    currentUser,
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

  // Track comment positions through iterations (side-effect only)
  useCommentTracking();

  // Container height for virtualized rendering
  const { containerHeight, containerRefCallback } = useContainerHeight();

  // Track visible row range from react-window for accurate minimap lasso positioning
  const [visibleRowRange, setVisibleRowRange] = useState<VisibleRowRange | null>(null);

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

  // Handler for keyboard scrolling in diff content area
  const handleDiffKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    // Find the actual scrollable element (virtualized list) inside the region
    const scrollable = e.currentTarget.querySelector('.virtualized-inline-list, .virtualized-split-list');
    if (!scrollable) return;

    let scrollLines: number | null = null;

    // Calculate lines per page, leaving 3 lines visible for context
    const linesPerPage = Math.floor(containerHeight / LINE_HEIGHT);
    const pageScrollLines = Math.max(1, linesPerPage - 3);

    switch (e.key) {
      case 'PageDown':
        e.preventDefault();
        scrollLines = pageScrollLines;
        break;
      case 'PageUp':
        e.preventDefault();
        scrollLines = -pageScrollLines;
        break;
      case 'Home':
        e.preventDefault();
        scrollable.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      case 'End':
        e.preventDefault();
        // Scroll to max position: scrollHeight - clientHeight puts the last content at the bottom
        scrollable.scrollTo({ top: scrollable.scrollHeight - scrollable.clientHeight, behavior: 'smooth' });
        return;
    }

    if (scrollLines !== null) {
      scrollable.scrollBy({ top: scrollLines * LINE_HEIGHT, behavior: 'smooth' });
    }
  }, [containerHeight]);

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
        {...(fullFileContent.oldContent !== undefined && { oldContent: fullFileContent.oldContent })}
        {...(fullFileContent.newContent !== undefined && { newContent: fullFileContent.newContent })}
        {...(visibleLines !== undefined && { visibleLines })}
        language={pipeline.language}
      >
        {pipeline.viewMode === 'inline' ? (
          <div
            ref={(el) => {
              containerRefCallback(el);
              scrollContainerRef.current = el;
            }}
            className="diff-content-area diff-content-with-minimap diff-content-wrapper"
            data-view-mode="inline"
            data-text-wrap={pipeline.textWrap}
            role="region"
            aria-label={`Diff content for ${pipeline.filename}`}
            tabIndex={0}
            onKeyDown={handleDiffKeyDown}
          >
            <InlineDiffTable
              key={pipeline.filename ?? 'diff-table'}
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
              onCancelDraft={draft.cancelDraft}
              onChangeDraftBody={draft.setDraftBody}
              onSubmitDraft={handleSubmitDraft}
              showWhitespace={pipeline.showWhitespace}
              lineNumberMode={pipeline.lineNumberMode}
              scrollToRowIndex={pipeline.scrollToRowIndex}
              hasFullContent={hasFullContent}
              showComments={viewConfig.showComments}
              onVisibleRangeChange={setVisibleRowRange}
              textWrap={pipeline.textWrap}
            />
            <Minimap
              pipeline={pipeline}
              containerHeight={containerHeight}
              scrollContainerRef={scrollContainerRef}
              showFullFile={viewConfig.showFullFile}
              showComments={viewConfig.showComments}
              visibleRowRange={visibleRowRange}
            />
          </div>
        ) : (
          <div
            ref={(el) => {
              containerRefCallback(el);
              scrollContainerRef.current = el;
            }}
            className="diff-content-area diff-content-with-minimap diff-content-wrapper"
            data-view-mode="split"
            data-text-wrap={pipeline.textWrap}
            role="region"
            aria-label={`Diff content for ${pipeline.filename}`}
            tabIndex={0}
            onKeyDown={handleDiffKeyDown}
          >
            <SideBySideDiffView
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
              onCancelDraft={draft.cancelDraft}
              onChangeDraftBody={draft.setDraftBody}
              onSubmitDraft={handleSubmitDraft}
              showWhitespace={pipeline.showWhitespace}
              scrollToRowIndex={pipeline.scrollToRowIndex}
              hasFullContent={hasFullContent}
              showComments={viewConfig.showComments}
              onVisibleRangeChange={setVisibleRowRange}
              textWrap={pipeline.textWrap}
            />
            <Minimap
              pipeline={pipeline}
              containerHeight={containerHeight}
              scrollContainerRef={scrollContainerRef}
              showFullFile={viewConfig.showFullFile}
              showComments={viewConfig.showComments}
              visibleRowRange={visibleRowRange}
            />
          </div>
        )}
      </ShikiTokensProvider>
    </div>
  );
}
