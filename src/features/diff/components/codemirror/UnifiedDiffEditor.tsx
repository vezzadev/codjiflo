/**
 * Unified Diff Editor Component
 *
 * Single CodeMirror editor for inline/unified diff view.
 * Shows all diff lines in a single column with dual line numbers.
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
  setLineNumberMode,
  createDiffKeymap,
  setHunkIndices,
  commentWidgets,
  setCommentThreads,
  setDraftLineIndex,
  setShowComments,
} from './extensions';
import type { ParsedDiffLine, TextWrap, VisibleRowRange } from '../../types';
import type { ReviewThread } from '@/features/comments';

export interface UnifiedDiffEditorProps {
  /** Parsed diff lines to display */
  diffLines: ParsedDiffLine[];
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
  /** Line index for draft comment editor */
  draftLineIndex: number | null;
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
  /** Line number display mode */
  lineNumberMode: 'left' | 'both' | 'right';
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

export interface UnifiedDiffEditorHandle {
  /** Get the CodeMirror EditorView */
  getView: () => EditorView | null;
  /** Scroll to a specific line */
  scrollToLine: (line: number) => void;
  /** Get the scroll container element */
  getScrollElement: () => HTMLElement | null;
}

/**
 * Unified diff editor using CodeMirror 6.
 * Replaces InlineDiffTable with native CodeMirror virtualization.
 */
export const UnifiedDiffEditor = forwardRef<UnifiedDiffEditorHandle, UnifiedDiffEditorProps>(
  function UnifiedDiffEditor(
    {
      diffLines,
      language,
      containerHeight,
      threadsByLineAndSide,
      currentUserLogin: _currentUserLogin,
      addReply: _addReply,
      editComment: _editComment,
      deleteComment: _deleteComment,
      toggleResolved: _toggleResolved,
      draftLineIndex,
      draftBody: _draftBody,
      isSubmittingDraft: _isSubmittingDraft,
      submitError: _submitError,
      onCancelDraft: _onCancelDraft,
      onChangeDraftBody: _onChangeDraftBody,
      onSubmitDraft: _onSubmitDraft,
      showWhitespace,
      lineNumberMode,
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
    const editorRef = useRef<CodeMirrorBaseHandle>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [isViewReady, setIsViewReady] = useState(false);

    // These props are used by the parent CommentPortalManager
    // They're passed through to be accessible if needed for testing
    void _currentUserLogin; void _addReply; void _editComment; void _deleteComment; void _toggleResolved;
    void _draftBody; void _isSubmittingDraft; void _submitError;
    void _onCancelDraft; void _onChangeDraftBody; void _onSubmitDraft;
    void _hasFullContent;

    // Build document content from diff lines
    const docContent = useMemo(() => {
      return diffLines.map((line) => line.content).join('\n');
    }, [diffLines]);

    // Convert threadsByLineAndSide to line-indexed map for widget
    const threadsByLine = useMemo(() => {
      const map: Map<number, ReviewThread[]> = new Map();

      threadsByLineAndSide.forEach((threads, key) => {
        // Key format: "lineNumber-side"
        const [lineStr] = key.split('-');
        const lineNumber = parseInt(lineStr ?? '0', 10);

        // Find the diff line index for this line number
        for (let i = 0; i < diffLines.length; i++) {
          const diffLine = diffLines[i];
          if (!diffLine) continue;
          if (diffLine.newLineNumber === lineNumber || diffLine.oldLineNumber === lineNumber) {
            const existing = map.get(i) ?? [];
            // Avoid duplicates
            for (const thread of threads) {
              if (!existing.some((t) => t.id === thread.id)) {
                existing.push(thread);
              }
            }
            map.set(i, existing);
            break;
          }
        }
      });

      return map;
    }, [threadsByLineAndSide, diffLines]);

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

    // Build extensions
    const extensions = useMemo<Extension[]>(() => {
      const exts: Extension[] = [
        // Diff decorations for line/word highlights
        diffDecorations({ diffLines, showWordDiffs: true }),
        // Custom gutter with dual line numbers
        createDiffGutter({ diffLines, lineNumberMode }),
        // Keyboard navigation
        createDiffKeymap({ hunkIndices, contextLines: 3 }),
        // Comment widgets
        commentWidgets({
          threadsByLine,
          showComments,
          draftLineIndex,
          onMountThread: handleMountThread,
          onUnmountThread: handleUnmountThread,
          onMountDraft: handleMountDraft,
          onUnmountDraft: handleUnmountDraft,
        }),
      ];

      // Whitespace highlighting
      if (showWhitespace) {
        exts.push(highlightWhitespace());
      }

      // Track scroll position for minimap
      if (onVisibleRangeChange) {
        exts.push(
          EditorView.updateListener.of((update) => {
            if (update.geometryChanged || update.viewportChanged) {
              const view = update.view;
              const { from, to } = view.viewport;
              const fromLine = view.state.doc.lineAt(from).number - 1;
              const toLine = view.state.doc.lineAt(to).number - 1;
              onVisibleRangeChange({ startIndex: fromLine, stopIndex: toLine });
            }
          })
        );
      }

      return exts;
    }, [
      diffLines,
      lineNumberMode,
      hunkIndices,
      threadsByLine,
      showComments,
      draftLineIndex,
      showWhitespace,
      onVisibleRangeChange,
      handleMountThread,
      handleUnmountThread,
      handleMountDraft,
      handleUnmountDraft,
    ]);

    // Handle view ready
    const handleViewReady = useCallback((view: EditorView) => {
      viewRef.current = view;
      setIsViewReady(true);
    }, []);

    // Add scroll event listener to catch programmatic scrolls
    // The EditorView.updateListener may not fire viewportChanged for direct scrollTop changes
    useEffect(() => {
      if (!isViewReady || !onVisibleRangeChange) return;

      const view = viewRef.current;
      if (!view) return;

      const emitVisibleRange = () => {
        // Use lineBlockAtHeight to calculate visible lines from current scroll position
        // This is more reliable than view.viewport which may be cached
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
    }, [isViewReady, onVisibleRangeChange]);

    // Update extensions when props change
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      view.dispatch({
        effects: [
          setDiffLines.of(diffLines),
          setGutterDiffLines.of(diffLines),
          setLineNumberMode.of(lineNumberMode),
          setHunkIndices.of(hunkIndices),
          setCommentThreads.of(threadsByLine),
          setDraftLineIndex.of(draftLineIndex),
          setShowComments.of(showComments),
        ],
      });
    }, [diffLines, lineNumberMode, hunkIndices, threadsByLine, draftLineIndex, showComments]);

    // Scroll to row when scrollToRowIndex changes
    useEffect(() => {
      if (scrollToRowIndex === undefined || scrollToRowIndex < 0) return;

      const editor = editorRef.current;
      if (!editor) return;

      // Add context lines
      const contextLines = 3;
      const targetLine = Math.max(1, scrollToRowIndex + 1 - contextLines);
      editor.scrollToLine(targetLine, 'start');
    }, [scrollToRowIndex]);

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        getView: () => viewRef.current,
        scrollToLine: (line: number) => {
          editorRef.current?.scrollToLine(line, 'start');
        },
        getScrollElement: () => viewRef.current?.scrollDOM ?? null,
      }),
      []
    );

    return (
      <div className="unified-diff-editor" style={{ height: containerHeight }}>
        <CodeMirrorBase
          ref={editorRef}
          doc={docContent}
          extensions={extensions}
          language={language}
          lineWrapping={textWrap === 'wrap'}
          readOnly
          height={`${containerHeight}px`}
          onViewReady={handleViewReady}
        />

        {/* React portals for comment threads would be rendered here */}
        {/* The actual portal rendering is handled by the parent component */}
      </div>
    );
  }
);
