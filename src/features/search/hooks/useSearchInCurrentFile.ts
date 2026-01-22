/**
 * useSearchInCurrentFile Hook
 *
 * Performs search in the current file's diff content and manages highlights.
 */

import { useEffect, useRef } from 'react';
import { useSearchStore } from '../stores';
import { searchInDiffLines } from '../utils';
import type { EditorView } from '@codemirror/view';
import { updateSearchHighlights, clearSearchHighlights } from '../extensions';

interface DiffLine {
  content: string;
  type: string;
}

interface UseSearchInCurrentFileOptions {
  /** The diff lines to search through */
  diffLines: DiffLine[];
  /** Callback to scroll to a specific line index (0-based) */
  scrollToLine?: (lineIndex: number) => void;
  /** Reference to the CodeMirror EditorView for highlighting */
  editorView?: EditorView | null;
}

/**
 * Hook that handles searching in the current file's diff content.
 * Updates the search store with matches and manages CodeMirror highlights.
 */
export function useSearchInCurrentFile({
  diffLines,
  scrollToLine,
  editorView,
}: UseSearchInCurrentFileOptions) {
  const query = useSearchStore((s) => s.query);
  const options = useSearchStore((s) => s.options);
  const mode = useSearchStore((s) => s.mode);
  const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);
  const currentFileMatches = useSearchStore((s) => s.currentFileMatches);
  const setCurrentFileMatches = useSearchStore((s) => s.setCurrentFileMatches);

  // Track previous match index for scroll triggering
  const prevMatchIndexRef = useRef(currentMatchIndex);

  // Perform search when query or options change
  useEffect(() => {
    if (mode !== 'current-file') {
      return;
    }

    if (!query) {
      setCurrentFileMatches([]);
      return;
    }

    const matches = searchInDiffLines(query, diffLines, options, 'both');
    setCurrentFileMatches(matches);
  }, [query, options, diffLines, mode, setCurrentFileMatches]);

  // Update CodeMirror highlights when matches or currentMatchIndex changes
  useEffect(() => {
    if (!editorView) return;

    if (mode !== 'current-file' || currentFileMatches.length === 0) {
      clearSearchHighlights(editorView);
      return;
    }

    updateSearchHighlights(
      editorView,
      currentFileMatches,
      currentMatchIndex,
      options.highlightAll
    );
  }, [editorView, mode, currentFileMatches, currentMatchIndex, options.highlightAll]);

  // Scroll to current match when index changes
  useEffect(() => {
    if (mode !== 'current-file') return;
    if (currentFileMatches.length === 0) return;
    if (currentMatchIndex < 0 || currentMatchIndex >= currentFileMatches.length) return;

    // Only scroll if the index actually changed
    if (prevMatchIndexRef.current !== currentMatchIndex) {
      prevMatchIndexRef.current = currentMatchIndex;
      const match = currentFileMatches[currentMatchIndex];
      if (match && scrollToLine) {
        // lineIndex is 0-based, scrollToLine expects 1-based
        scrollToLine(match.lineIndex + 1);
      }
    }
  }, [mode, currentMatchIndex, currentFileMatches, scrollToLine]);

  // Clear highlights when mode changes away from current-file
  useEffect(() => {
    if (mode !== 'current-file' && editorView) {
      clearSearchHighlights(editorView);
    }
  }, [mode, editorView]);

  return {
    matches: currentFileMatches,
    currentIndex: currentMatchIndex,
    hasMatches: currentFileMatches.length > 0,
  };
}
