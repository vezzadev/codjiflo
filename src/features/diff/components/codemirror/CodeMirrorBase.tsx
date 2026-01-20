/**
 * CodeMirrorBase Component
 *
 * Reusable wrapper around @uiw/react-codemirror for diff views.
 * Handles common setup like read-only mode, theming, and basic extensions.
 */

import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { type Extension } from '@codemirror/state';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { getLanguageSupport } from './utils/language-registry';
import { diffTheme } from './extensions/diff-theme';

export interface CodeMirrorBaseProps {
  /** Document content */
  doc: string;
  /** Additional extensions to apply */
  extensions?: Extension[];
  /** CSS class name for the editor container */
  className?: string;
  /** Whether the editor is read-only (default: true for diff views) */
  readOnly?: boolean;
  /** Language for syntax highlighting (file extension like 'ts', 'js', 'py') */
  language?: string;
  /** Whether to enable line wrapping */
  lineWrapping?: boolean;
  /** Callback when editor view is ready */
  onViewReady?: (view: EditorView) => void;
  /** Height of the editor (CSS value) */
  height?: string;
  /** Basic setup options (defaults disabled for custom diff setup) */
  basicSetup?: boolean;
}

export interface CodeMirrorBaseHandle {
  /** Get the current EditorView instance */
  getView: () => EditorView | null;
  /** Scroll to a specific line (1-indexed) */
  scrollToLine: (line: number, align?: 'start' | 'center' | 'end') => void;
  /** Get the visible line range */
  getVisibleRange: () => { from: number; to: number } | null;
}

/**
 * Base CodeMirror component for diff views.
 * Provides common functionality and can be extended with custom extensions.
 */
export const CodeMirrorBase = forwardRef<CodeMirrorBaseHandle, CodeMirrorBaseProps>(
  function CodeMirrorBase(
    {
      doc,
      extensions = [],
      className,
      readOnly = true,
      language,
      lineWrapping = false,
      onViewReady,
      height = '100%',
      basicSetup = false,
    },
    ref
  ) {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [languageState, setLanguageState] = useState<{ ext: Extension | null; loaded: boolean }>({
      ext: null,
      loaded: !language, // If no language, we're already "loaded"
    });

    // Track if component is still mounted
    const isMountedRef = useRef(true);
    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    // Load language extension dynamically
    // Use a ref to track the current language to avoid resetting state synchronously
    const currentLanguageRef = useRef(language);
    useEffect(() => {
      if (!language) {
        // No language specified - use initial state without calling setState
        return;
      }

      // Track if this effect's language has changed
      const languageChanged = currentLanguageRef.current !== language;
      currentLanguageRef.current = language;

      // If language changed and we're not on initial render, we need to reload
      // Set loading state via an async callback to avoid sync setState in effect
      if (languageChanged && languageState.loaded) {
        // Use a microtask to defer the state update
        queueMicrotask(() => {
          if (isMountedRef.current) {
            setLanguageState({ ext: null, loaded: false });
          }
        });
      }

      let cancelled = false;

      void getLanguageSupport(language).then((support) => {
        if (cancelled || !isMountedRef.current) return;
        setLanguageState({ ext: support, loaded: true });
      });

      // Only cancel the async operation, don't reset state (causes act() warning on unmount)
      return () => {
        cancelled = true;
      };
    }, [language, languageState.loaded]);

    // Build extensions array
    const allExtensions = useCallback((): Extension[] => {
      const exts: Extension[] = [
        diffTheme,
        EditorView.editable.of(!readOnly),
        // Add syntax highlighting with default styles
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ];

      if (lineWrapping) {
        exts.push(EditorView.lineWrapping);
      }

      if (languageState.ext) {
        exts.push(languageState.ext);
      }

      exts.push(...extensions);

      return exts;
    }, [readOnly, lineWrapping, languageState.ext, extensions]);

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        getView: () => editorRef.current?.view ?? null,

        scrollToLine: (line: number, align: 'start' | 'center' | 'end' = 'start') => {
          const view = editorRef.current?.view;
          if (!view) return;

          const clampedLine = Math.max(1, Math.min(line, view.state.doc.lines));
          const lineInfo = view.state.doc.line(clampedLine);

          // Use CodeMirror's scrollIntoView which handles virtualized content properly
          // It works even when the line isn't rendered yet
          const yMargin = align === 'center' ? view.scrollDOM.clientHeight / 2 - 50 : 50;
          view.dispatch({
            effects: EditorView.scrollIntoView(lineInfo.from, {
              y: align === 'start' ? 'start' : align === 'end' ? 'end' : 'center',
              yMargin,
            }),
          });
        },

        getVisibleRange: () => {
          const view = editorRef.current?.view;
          if (!view) return null;

          const { from, to } = view.viewport;
          const fromLine = view.state.doc.lineAt(from).number;
          const toLine = view.state.doc.lineAt(to).number;

          return { from: fromLine, to: toLine };
        },
      }),
      []
    );

    // Notify when view is ready
    const handleCreateEditor = useCallback(
      (view: EditorView) => {
        onViewReady?.(view);
      },
      [onViewReady]
    );

    // Don't render until language is loaded to avoid flash
    if (!languageState.loaded) {
      return (
        <div className={className} style={{ height }}>
          <div className="cm-loading">Loading...</div>
        </div>
      );
    }

    return (
      <CodeMirror
        ref={editorRef}
        value={doc}
        extensions={allExtensions()}
        className={className}
        height={height}
        basicSetup={basicSetup}
        editable={!readOnly}
        onCreateEditor={handleCreateEditor}
      />
    );
  }
);
