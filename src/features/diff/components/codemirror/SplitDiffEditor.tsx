/**
 * Split Diff Editor Component
 *
 * Two synchronized CodeMirror editors for side-by-side diff view.
 * Left pane shows old content, right pane shows new content.
 */

import {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { type Extension } from '@codemirror/state';
import { EditorView, highlightWhitespace } from '@codemirror/view';
import { CodeMirrorBase, type CodeMirrorBaseHandle } from './CodeMirrorBase';
import {
  diffDecorations,
  setDiffLines,
  createDiffGutter,
  setGutterDiffLines,
  createDiffKeymap,
  setHunkIndices,
  syncScrollPosition,
  commentWidgets,
  setCommentThreads,
  setDraftLineIndex,
  setShowComments,
} from './extensions';
import type { AlignedDiffLine, ParsedDiffLine, ContentFilter, TextWrap, VisibleRowRange } from '../../types';
import type { ReviewThread, CommentSide } from '@/features/comments';

export interface SplitDiffEditorProps {
  /** Aligned diff line pairs */
  alignedLines: AlignedDiffLine[];
  /** Language for syntax highlighting */
  language: string;
  /** Container height */
  containerHeight: number;
  /** Comment threads mapped by "lineNumber-side" key */
  threadsByLineAndSide: Map<string, ReviewThread[]>;
  /** Current user's GitHub login */
  currentUserLogin: string;
  /** Callback to add a reply to a thread */
  addReply: (threadId: string, body: string) => Promise<void>;
  /** Callback to edit a comment */
  editComment: (commentId: string, body: string) => Promise<void>;
  /** Callback to delete a comment */
  deleteComment: (commentId: string) => Promise<void>;
  /** Callback to toggle thread resolved status */
  toggleResolved: (threadId: string) => void;
  /** Content filter (left/both/right) */
  contentFilter: ContentFilter;
  /** Line index for draft comment editor */
  draftLineIndex: number | null;
  /** Side for draft comment */
  draftSide: CommentSide | null;
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
  /** Whether to show whitespace characters */
  showWhitespace: boolean;
  /** Row index to scroll to (for J/K navigation) */
  scrollToRowIndex?: number | undefined;
  /** Whether full file content is available */
  hasFullContent?: boolean;
  /** Whether to show comment threads */
  showComments?: boolean;
  /** Callback when visible row range changes */
  onVisibleRangeChange?: (range: VisibleRowRange) => void;
  /** Text wrap mode */
  textWrap?: TextWrap;
  /** Hunk indices for navigation */
  hunkIndices?: number[];
  /** Portal callback: called when thread widget mounts */
  onMountThread?: (threadId: string, container: HTMLElement) => void;
  /** Portal callback: called when thread widget unmounts */
  onUnmountThread?: (threadId: string) => void;
  /** Portal callback: called when draft widget mounts */
  onMountDraft?: (lineIndex: number, container: HTMLElement) => void;
  /** Portal callback: called when draft widget unmounts */
  onUnmountDraft?: () => void;
}

export interface SplitDiffEditorHandle {
  /** Get the left editor view */
  getLeftView: () => EditorView | null;
  /** Get the right editor view */
  getRightView: () => EditorView | null;
  /** Scroll both editors to a specific line */
  scrollToLine: (line: number) => void;
  /** Get the scroll container element */
  getScrollElement: () => HTMLElement | null;
}

/**
 * Extracts lines for one side of the split view.
 * Null lines in aligned pairs become spacer lines.
 */
function buildSideContent(
  alignedLines: AlignedDiffLine[],
  side: 'left' | 'right'
): { content: string; lines: (ParsedDiffLine | null)[] } {
  const lines: (ParsedDiffLine | null)[] = [];
  const contentLines: string[] = [];

  for (const pair of alignedLines) {
    const line = side === 'left' ? pair.left : pair.right;
    lines.push(line);
    contentLines.push(line?.content ?? '');
  }

  return {
    content: contentLines.join('\n'),
    lines,
  };
}

/**
 * Creates ParsedDiffLine array for decorations, treating null as spacer.
 */
function buildDecoratedLines(lines: (ParsedDiffLine | null)[]): ParsedDiffLine[] {
  return lines.map((line) => {
    if (line === null) {
      // Spacer line - uses 'spacer' type for gray background styling
      return {
        type: 'spacer' as const,
        content: '',
        oldLineNumber: null,
        newLineNumber: null,
      };
    }
    return line;
  });
}

/**
 * Split diff editor using two synchronized CodeMirror 6 instances.
 * Replaces SideBySideDiffView with native CodeMirror virtualization.
 */
export const SplitDiffEditor = forwardRef<SplitDiffEditorHandle, SplitDiffEditorProps>(
  function SplitDiffEditor(
    {
      alignedLines,
      language,
      containerHeight,
      threadsByLineAndSide,
      currentUserLogin: _currentUserLogin,
      addReply: _addReply,
      editComment: _editComment,
      deleteComment: _deleteComment,
      toggleResolved: _toggleResolved,
      contentFilter,
      draftLineIndex,
      draftSide,
      draftBody: _draftBody,
      isSubmittingDraft: _isSubmittingDraft,
      submitError: _submitError,
      onCancelDraft: _onCancelDraft,
      onChangeDraftBody: _onChangeDraftBody,
      onSubmitDraft: _onSubmitDraft,
      showWhitespace,
      scrollToRowIndex,
      hasFullContent: _hasFullContent = false,
      showComments = true,
      onVisibleRangeChange,
      textWrap = 'nowrap',
      hunkIndices = [],
      onMountThread,
      onUnmountThread,
      onMountDraft,
      onUnmountDraft,
    },
    ref
  ) {
    const leftEditorRef = useRef<CodeMirrorBaseHandle>(null);
    const rightEditorRef = useRef<CodeMirrorBaseHandle>(null);
    const leftViewRef = useRef<EditorView | null>(null);
    const rightViewRef = useRef<EditorView | null>(null);
    const [isRightViewReady, setIsRightViewReady] = useState(false);

    // These props are used by the parent CommentPortalManager
    void _currentUserLogin; void _addReply; void _editComment; void _deleteComment; void _toggleResolved;
    void _draftBody; void _isSubmittingDraft; void _submitError;
    void _onCancelDraft; void _onChangeDraftBody; void _onSubmitDraft;
    void _hasFullContent;

    // Comment widget callbacks - forward to portal manager
    const handleMountThread = useCallback(
      (threadId: string, container: HTMLElement) => {
        onMountThread?.(threadId, container);
      },
      [onMountThread]
    );

    const handleUnmountThread = useCallback(
      (threadId: string) => {
        onUnmountThread?.(threadId);
      },
      [onUnmountThread]
    );

    const handleMountDraft = useCallback(
      (lineIndex: number, container: HTMLElement) => {
        onMountDraft?.(lineIndex, container);
      },
      [onMountDraft]
    );

    const handleUnmountDraft = useCallback(() => {
      onUnmountDraft?.();
    }, [onUnmountDraft]);

    // Build content for each side
    const { content: leftContent, lines: leftLines } = useMemo(
      () => buildSideContent(alignedLines, 'left'),
      [alignedLines]
    );

    const { content: rightContent, lines: rightLines } = useMemo(
      () => buildSideContent(alignedLines, 'right'),
      [alignedLines]
    );

    const leftDecoLines = useMemo(() => buildDecoratedLines(leftLines), [leftLines]);
    const rightDecoLines = useMemo(() => buildDecoratedLines(rightLines), [rightLines]);

    // Convert threads to line-indexed maps for each side
    const { leftThreadsByLine, rightThreadsByLine } = useMemo(() => {
      const leftMap = new Map<number, ReviewThread[]>();
      const rightMap = new Map<number, ReviewThread[]>();

      threadsByLineAndSide.forEach((threads, key) => {
        const parts = key.split('-');
        const lineStr = parts[0];
        const side = parts[1] as CommentSide;
        const lineNumber = parseInt(lineStr ?? '0', 10);

        for (let i = 0; i < alignedLines.length; i++) {
          const pair = alignedLines[i];
          if (!pair) continue;

          if (side === 'LEFT' && pair.left?.oldLineNumber === lineNumber) {
            const existing = leftMap.get(i) ?? [];
            for (const thread of threads) {
              if (!existing.some((t) => t.id === thread.id)) {
                existing.push(thread);
              }
            }
            leftMap.set(i, existing);
            break;
          }

          if (side === 'RIGHT' && pair.right?.newLineNumber === lineNumber) {
            const existing = rightMap.get(i) ?? [];
            for (const thread of threads) {
              if (!existing.some((t) => t.id === thread.id)) {
                existing.push(thread);
              }
            }
            rightMap.set(i, existing);
            break;
          }
        }
      });

      return { leftThreadsByLine: leftMap, rightThreadsByLine: rightMap };
    }, [threadsByLineAndSide, alignedLines]);

    // Build extensions for left editor
    const leftExtensions = useMemo<Extension[]>(() => {
      const exts: Extension[] = [
        diffDecorations({ diffLines: leftDecoLines, showWordDiffs: true }),
        createDiffGutter({ diffLines: leftDecoLines, lineNumberMode: 'left' }),
        createDiffKeymap({ hunkIndices, contextLines: 3 }),
        commentWidgets({
          threadsByLine: leftThreadsByLine,
          showComments,
          draftLineIndex: draftSide === 'LEFT' ? draftLineIndex : null,
          onMountThread: handleMountThread,
          onUnmountThread: handleUnmountThread,
          onMountDraft: draftSide === 'LEFT' ? handleMountDraft : undefined,
          onUnmountDraft: draftSide === 'LEFT' ? handleUnmountDraft : undefined,
        }),
      ];

      if (showWhitespace) {
        exts.push(highlightWhitespace());
      }

      // Scroll sync is handled via useEffect, not in extensions
      // to avoid accessing refs during render

      return exts;
    }, [leftDecoLines, hunkIndices, leftThreadsByLine, showComments, draftLineIndex, draftSide, showWhitespace, handleMountThread, handleUnmountThread, handleMountDraft, handleUnmountDraft]);

    // Build extensions for right editor
    const rightExtensions = useMemo<Extension[]>(() => {
      const exts: Extension[] = [
        diffDecorations({ diffLines: rightDecoLines, showWordDiffs: true }),
        createDiffGutter({ diffLines: rightDecoLines, lineNumberMode: 'right' }),
        createDiffKeymap({ hunkIndices, contextLines: 3 }),
        commentWidgets({
          threadsByLine: rightThreadsByLine,
          showComments,
          draftLineIndex: draftSide === 'RIGHT' ? draftLineIndex : null,
          onMountThread: handleMountThread,
          onUnmountThread: handleUnmountThread,
          onMountDraft: draftSide === 'RIGHT' ? handleMountDraft : undefined,
          onUnmountDraft: draftSide === 'RIGHT' ? handleUnmountDraft : undefined,
        }),
      ];

      if (showWhitespace) {
        exts.push(highlightWhitespace());
      }

      // Note: onVisibleRangeChange is handled via scroll listener in useEffect
      // instead of EditorView.updateListener, because view.viewport is cached
      // and doesn't update synchronously on programmatic scroll

      return exts;
    }, [rightDecoLines, hunkIndices, rightThreadsByLine, showComments, draftLineIndex, draftSide, showWhitespace, handleMountThread, handleUnmountThread, handleMountDraft, handleUnmountDraft]);

    // Handle left view ready
    const handleLeftViewReady = useCallback((view: EditorView) => {
      leftViewRef.current = view;
      // Setup scroll sync if right view exists
      if (rightViewRef.current) {
        // Sync initial scroll position
        syncScrollPosition(view, rightViewRef.current);
      }
    }, []);

    // Handle right view ready
    const handleRightViewReady = useCallback((view: EditorView) => {
      rightViewRef.current = view;
      setIsRightViewReady(true);
      // Setup scroll sync if left view exists
      if (leftViewRef.current) {
        syncScrollPosition(leftViewRef.current, view);
      }
    }, []);

    // Manual scroll sync handler - sets up bidirectional scroll listeners
    // Re-runs when isRightViewReady changes to ensure both views exist
    useEffect(() => {
      if (!isRightViewReady) return;

      const leftView = leftViewRef.current;
      const rightView = rightViewRef.current;
      if (!leftView || !rightView) return;

      let isSyncing = false;

      const syncFromLeft = () => {
        if (isSyncing) return;
        if (rightView.scrollDOM.scrollTop !== leftView.scrollDOM.scrollTop) {
          isSyncing = true;
          rightView.scrollDOM.scrollTop = leftView.scrollDOM.scrollTop;
          requestAnimationFrame(() => {
            isSyncing = false;
          });
        }
      };

      const syncFromRight = () => {
        if (isSyncing) return;
        if (leftView.scrollDOM.scrollTop !== rightView.scrollDOM.scrollTop) {
          isSyncing = true;
          leftView.scrollDOM.scrollTop = rightView.scrollDOM.scrollTop;
          requestAnimationFrame(() => {
            isSyncing = false;
          });
        }
      };

      leftView.scrollDOM.addEventListener('scroll', syncFromLeft);
      rightView.scrollDOM.addEventListener('scroll', syncFromRight);

      return () => {
        leftView.scrollDOM.removeEventListener('scroll', syncFromLeft);
        rightView.scrollDOM.removeEventListener('scroll', syncFromRight);
      };
    }, [isRightViewReady]);

    // Add scroll event listener for minimap visible range tracking
    // Uses lineBlockAtHeight instead of view.viewport because viewport is cached
    // and doesn't update synchronously on programmatic scroll
    useEffect(() => {
      if (!isRightViewReady || !onVisibleRangeChange) return;

      const view = rightViewRef.current;
      if (!view) return;

      const emitVisibleRange = () => {
        // Use lineBlockAtHeight to calculate visible lines from current scroll position
        const scrollDOM = view.scrollDOM;
        const scrollTop = scrollDOM.scrollTop;
        const clientHeight = scrollDOM.clientHeight;

        // Get the line block at the top of the visible area
        const topBlock = view.lineBlockAtHeight(scrollTop);
        // Get the line block at the bottom of the visible area
        const bottomBlock = view.lineBlockAtHeight(scrollTop + clientHeight);

        // Convert document positions to line numbers (0-indexed for our interface)
        const fromLine = view.state.doc.lineAt(topBlock.from).number - 1;
        const toLine = view.state.doc.lineAt(bottomBlock.from).number - 1;

        onVisibleRangeChange({ startIndex: fromLine, stopIndex: toLine });
      };

      // Emit initial visible range immediately
      emitVisibleRange();

      // Also emit on scroll events
      const scrollDOM = view.scrollDOM;
      scrollDOM.addEventListener('scroll', emitVisibleRange);

      return () => {
        scrollDOM.removeEventListener('scroll', emitVisibleRange);
      };
    }, [isRightViewReady, onVisibleRangeChange]);

    // Update extensions when props change
    useEffect(() => {
      const leftView = leftViewRef.current;
      const rightView = rightViewRef.current;

      if (leftView) {
        leftView.dispatch({
          effects: [
            setDiffLines.of(leftDecoLines),
            setGutterDiffLines.of(leftDecoLines),
            setHunkIndices.of(hunkIndices),
            setCommentThreads.of(leftThreadsByLine),
            setDraftLineIndex.of(draftSide === 'LEFT' ? draftLineIndex : null),
            setShowComments.of(showComments),
          ],
        });
      }

      if (rightView) {
        rightView.dispatch({
          effects: [
            setDiffLines.of(rightDecoLines),
            setGutterDiffLines.of(rightDecoLines),
            setHunkIndices.of(hunkIndices),
            setCommentThreads.of(rightThreadsByLine),
            setDraftLineIndex.of(draftSide === 'RIGHT' ? draftLineIndex : null),
            setShowComments.of(showComments),
          ],
        });
      }
    }, [leftDecoLines, rightDecoLines, hunkIndices, leftThreadsByLine, rightThreadsByLine, draftLineIndex, draftSide, showComments]);

    // Scroll to row when scrollToRowIndex changes
    useEffect(() => {
      if (scrollToRowIndex === undefined || scrollToRowIndex < 0) return;

      // Scroll both editors
      const contextLines = 3;
      const targetLine = Math.max(1, scrollToRowIndex + 1 - contextLines);

      leftEditorRef.current?.scrollToLine(targetLine, 'start');
      rightEditorRef.current?.scrollToLine(targetLine, 'start');
    }, [scrollToRowIndex]);

    const showLeft = contentFilter !== 'right';
    const showRight = contentFilter !== 'left';

    // Clear refs when panes become hidden (important for search panel to detect visibility changes)
    useEffect(() => {
      if (!showLeft) {
        leftViewRef.current = null;
      }
      if (!showRight) {
        rightViewRef.current = null;
        // Use microtask to avoid lint error about setState in effect
        queueMicrotask(() => setIsRightViewReady(false));
      }
    }, [showLeft, showRight]);

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        getLeftView: () => showLeft ? leftViewRef.current : null,
        getRightView: () => showRight ? rightViewRef.current : null,
        scrollToLine: (line: number) => {
          leftEditorRef.current?.scrollToLine(line, 'start');
          rightEditorRef.current?.scrollToLine(line, 'start');
        },
        getScrollElement: () => leftViewRef.current?.scrollDOM ?? null,
      }),
      [showLeft, showRight]
    );

    return (
      <div
        className="split-diff-editor"
        style={{ height: containerHeight, display: 'flex' }}
        role="region"
        aria-label="Side-by-side diff view"
      >
        {/* Left Pane */}
        {showLeft && (
          <div
            className="split-diff-pane split-diff-pane-left"
            style={{ flex: 1, overflow: 'hidden' }}
            role="region"
            aria-label="Original version"
          >
            <CodeMirrorBase
              ref={leftEditorRef}
              doc={leftContent}
              extensions={leftExtensions}
              language={language}
              lineWrapping={textWrap === 'wrap'}
              readOnly
              height={`${containerHeight}px`}
              onViewReady={handleLeftViewReady}
            />
          </div>
        )}

        {/* Divider */}
        {showLeft && showRight && <div className="split-diff-divider" />}

        {/* Right Pane */}
        {showRight && (
          <div
            className="split-diff-pane split-diff-pane-right"
            style={{ flex: 1, overflow: 'hidden' }}
            role="region"
            aria-label="Modified version"
          >
            <CodeMirrorBase
              ref={rightEditorRef}
              doc={rightContent}
              extensions={rightExtensions}
              language={language}
              lineWrapping={textWrap === 'wrap'}
              readOnly
              height={`${containerHeight}px`}
              onViewReady={handleRightViewReady}
            />
          </div>
        )}
      </div>
    );
  }
);
