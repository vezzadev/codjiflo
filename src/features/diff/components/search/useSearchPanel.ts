/**
 * useSearchPanel Hook
 *
 * Manages state for search and go-to-line floating panels.
 * Handles keyboard shortcuts (Ctrl+F, Ctrl+G) and provides
 * access to the active CodeMirror editor based on view mode.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

export type ViewMode = 'inline' | 'split';
export type FocusedSide = 'left' | 'right' | null;

export interface UseSearchPanelOptions {
  /** Current view mode */
  viewMode: ViewMode;
  /** Get the unified editor view (inline mode) */
  getUnifiedView: () => EditorView | null;
  /** Get the left editor view (split mode) */
  getLeftView: () => EditorView | null;
  /** Get the right editor view (split mode) */
  getRightView: () => EditorView | null;
  /** Get the currently focused side in split mode (checks document.activeElement) */
  getFocusedSide: () => FocusedSide;
}

export interface UseSearchPanelReturn {
  /** Whether the search panel is open */
  searchPanelOpen: boolean;
  /** Whether the go-to-line panel is open */
  goToLinePanelOpen: boolean;
  /** Open the search panel */
  openSearchPanel: () => void;
  /** Open the go-to-line panel */
  openGoToLinePanel: () => void;
  /** Close all panels */
  closeAllPanels: () => void;
  /** Get the currently active editor view */
  getActiveEditor: () => EditorView | null;
  /** Current view mode */
  viewMode: ViewMode;
  /** Currently focused side in split mode (null in inline mode) */
  focusedSide: FocusedSide;
}

/**
 * Hook for managing search and go-to-line panel state.
 *
 * In inline mode, returns the unified editor.
 * In split mode, returns the focused side's editor (defaults to right).
 */
export function useSearchPanel(options: UseSearchPanelOptions): UseSearchPanelReturn {
  const { viewMode, getUnifiedView, getLeftView, getRightView, getFocusedSide } = options;

  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [goToLinePanelOpen, setGoToLinePanelOpen] = useState(false);
  // Track which side was last clicked/focused in split mode
  const [clickedSide, setClickedSide] = useState<FocusedSide>(null);

  // Track last active editor for restoring focus
  const lastActiveEditorRef = useRef<EditorView | null>(null);

  // Effective focused side: only relevant in split mode
  const focusedSide = viewMode === 'split' ? clickedSide : null;

  // Track which editor was clicked in split mode
  // Uses mousedown instead of focus because readonly CodeMirror editors
  // don't receive DOM focus when clicked (tabindex=-1 on cm-scroller)
  useEffect(() => {
    if (viewMode !== 'split') {
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if click is inside left or right editor
      const leftView = getLeftView();
      const rightView = getRightView();

      if (leftView?.dom.contains(target)) {
        setClickedSide('left');
      } else if (rightView?.dom.contains(target)) {
        setClickedSide('right');
      }
      // If click is elsewhere (search panel, toolbar, etc.), preserve current clicked side
    };

    // Also check focus events for cases where focus does move (e.g., tab navigation)
    const handleFocus = () => {
      const newFocusedSide = getFocusedSide();
      if (newFocusedSide !== null) {
        setClickedSide(newFocusedSide);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('focusin', handleFocus);
    };
  }, [viewMode, getFocusedSide, getLeftView, getRightView]);

  const getActiveEditor = useCallback((): EditorView | null => {
    if (viewMode === 'inline') {
      return getUnifiedView();
    }

    // Split mode: use tracked clicked side state, default to right
    // We use the state variable instead of getFocusedSide() because
    // when the search panel is open, document.activeElement is the search input
    if (clickedSide === 'left') {
      return getLeftView();
    }
    return getRightView() ?? getLeftView();
  }, [viewMode, getUnifiedView, getLeftView, getRightView, clickedSide]);

  const openSearchPanel = useCallback(() => {
    // Store the current active editor before opening panel
    lastActiveEditorRef.current = getActiveEditor();
    setGoToLinePanelOpen(false);
    setSearchPanelOpen(true);
  }, [getActiveEditor]);

  const openGoToLinePanel = useCallback(() => {
    // Store the current active editor before opening panel
    lastActiveEditorRef.current = getActiveEditor();
    setSearchPanelOpen(false);
    setGoToLinePanelOpen(true);
  }, [getActiveEditor]);

  const closeAllPanels = useCallback(() => {
    setSearchPanelOpen(false);
    setGoToLinePanelOpen(false);

    // Restore focus to the last active editor
    if (lastActiveEditorRef.current) {
      lastActiveEditorRef.current.focus();
      lastActiveEditorRef.current = null;
    }
  }, []);

  // Handle global keyboard shortcuts for opening panels
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept if in an input (unless it's our own panel)
      const target = event.target as HTMLElement;
      const isInSearchPanel = 'closest' in target ? target.closest('.diff-search-panel, .diff-goto-panel') : null;

      if (
        !isInSearchPanel &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ctrl+F: Open search panel
      if (event.key === 'f' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openSearchPanel();
        return;
      }

      // Ctrl+G: Open go-to-line panel
      if (event.key === 'g' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openGoToLinePanel();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearchPanel, openGoToLinePanel]);

  return {
    searchPanelOpen,
    goToLinePanelOpen,
    openSearchPanel,
    openGoToLinePanel,
    closeAllPanels,
    getActiveEditor,
    viewMode,
    focusedSide,
  };
}
