/**
 * SearchPanel Component
 *
 * Floating panel for searching within the diff view.
 * Supports match whole word, regex, and case-sensitive options.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { SearchQuery, setSearchQuery, findNext, findPrevious, getSearchQuery, openSearchPanel, closeSearchPanel } from '@codemirror/search';
import { SearchField, Input } from '@/components/ui';
import type { ViewMode, FocusedSide } from './useSearchPanel';
import type { ContentFilter } from '../../types';
import './search-go-to-panel.css';

export interface SearchPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Get the active editor view */
  getActiveEditor: () => EditorView | null;
  /** Current view mode */
  viewMode?: ViewMode;
  /** Currently focused side in split mode */
  focusedSide?: FocusedSide;
  /** Content filter (left/both/right) - triggers search recalculation when changed */
  contentFilter?: ContentFilter;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
}

/** Simple debounce implementation */
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): { (...args: Parameters<T>): void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };

  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  return debounced;
}

interface MatchPosition {
  /** 1-based index of the match at or before cursor position */
  currentIndex: number;
  /** Total number of matches */
  total: number;
}

/**
 * Count matches and find the current match position relative to cursor.
 * Returns the index of the last match at or before the cursor position.
 */
function countMatches(query: SearchQuery, view: EditorView): MatchPosition | null {
  try {
    const cursor = query.getCursor(view.state.doc);
    let total = 0;
    let currentIndex = 0;
    const selection = view.state.selection.main.from;
    let result = cursor.next();

    while (!result.done) {
      total++;
      if (result.value.from <= selection) {
        currentIndex = total;
      }
      result = cursor.next();
    }

    return { currentIndex, total };
  } catch {
    // Invalid regex
    return null;
  }
}

/**
 * Floating panel for find functionality.
 */
export function SearchPanel({ isOpen, onClose, getActiveEditor, viewMode, focusedSide, contentFilter }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regexp: false,
  });
  const [matchCount, setMatchCount] = useState<{ current: number; total: number } | null>(null);

  // Debounced match count update (150ms) to avoid excessive counting on rapid typing
  const debouncedCountRef = useRef(
    debounce((query: SearchQuery, view: EditorView) => {
      const matches = countMatches(query, view);
      if (matches) {
        const { total } = matches;
        if (total > 0) {
          // Automatically select the first match when typing (without moving focus)
          // This applies cm-searchMatch-selected to show the "current" position
          findNext(view);
          // Re-count to get accurate position after findNext moves selection
          const updatedMatches = countMatches(query, view);
          if (updatedMatches) {
            setMatchCount({ current: Math.max(1, updatedMatches.currentIndex), total: updatedMatches.total });
          } else {
            setMatchCount({ current: 1, total });
          }
        } else {
          setMatchCount({ current: 0, total: 0 });
        }
      } else {
        setMatchCount({ current: 0, total: 0 });
      }
    }, 150)
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    const debouncedFn = debouncedCountRef.current;
    return () => debouncedFn.cancel();
  }, []);

  // Focus input and open CodeMirror search panel state when panel opens
  useEffect(() => {
    if (isOpen) {
      // Open CodeMirror's internal search panel state to enable search highlighting
      // Our createPanel config returns a dummy element, so this is just for state
      const view = getActiveEditor();
      if (view) {
        openSearchPanel(view);
      }

      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isOpen, getActiveEditor]);

  // Clear search state and CodeMirror query when panel closes
  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    // Only clear when transitioning from open to closed
    if (prevIsOpen.current && !isOpen) {
      // Defer state clearing to avoid synchronous setState in effect
      queueMicrotask(() => {
        setSearchTerm('');
        setMatchCount(null);
      });

      const view = getActiveEditor();
      if (view) {
        // Close CodeMirror's internal search panel state (clears highlights)
        closeSearchPanel(view);
      }
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, getActiveEditor]);

  // Re-apply search when editor changes (e.g., view mode switch or focus change in split mode)
  const prevEditorRef = useRef<EditorView | null>(null);
  useEffect(() => {
    if (!isOpen || !searchTerm) return;

    const currentEditor = getActiveEditor();
    if (currentEditor && currentEditor !== prevEditorRef.current) {
      const query = new SearchQuery({
        search: searchTerm,
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
        regexp: options.regexp,
      });
      currentEditor.dispatch({
        effects: setSearchQuery.of(query),
      });
      debouncedCountRef.current(query, currentEditor);
    }
    prevEditorRef.current = currentEditor;
  }, [isOpen, searchTerm, options, getActiveEditor, focusedSide, contentFilter]);

  const updateSearch = useCallback((term: string, opts: SearchOptions) => {
    const view = getActiveEditor();
    if (!view) return;

    const query = new SearchQuery({
      search: term,
      caseSensitive: opts.caseSensitive,
      wholeWord: opts.wholeWord,
      regexp: opts.regexp,
    });

    view.dispatch({
      effects: setSearchQuery.of(query),
    });

    // Count matches (debounced to avoid excessive counting on rapid typing)
    if (term) {
      debouncedCountRef.current(query, view);
    } else {
      debouncedCountRef.current.cancel();
      setMatchCount(null);
    }
  }, [getActiveEditor]);

  const handleSearchChange = useCallback(
    (term: string) => {
      setSearchTerm(term);
      updateSearch(term, options);
    },
    [options, updateSearch]
  );

  const handleOptionChange = useCallback(
    (option: keyof SearchOptions) => {
      const newOptions = { ...options, [option]: !options[option] };
      setOptions(newOptions);
      updateSearch(searchTerm, newOptions);
    },
    [options, searchTerm, updateSearch]
  );

  const handleFindNext = useCallback(() => {
    const view = getActiveEditor();
    if (!view || !searchTerm) return;

    findNext(view);
    view.focus();

    // Update current match position
    const query = getSearchQuery(view.state);
    if (query.search) {
      const matches = countMatches(query, view);
      if (matches && matches.total > 0) {
        setMatchCount({ current: Math.max(matches.currentIndex, 1), total: matches.total });
      }
    }
  }, [getActiveEditor, searchTerm]);

  const handleFindPrevious = useCallback(() => {
    const view = getActiveEditor();
    if (!view || !searchTerm) return;

    findPrevious(view);
    view.focus();

    // Update current match position
    const query = getSearchQuery(view.state);
    if (query.search) {
      const matches = countMatches(query, view);
      if (matches && matches.total > 0) {
        setMatchCount({ current: Math.max(matches.currentIndex, 1), total: matches.total });
      }
    }
  }, [getActiveEditor, searchTerm]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          handleFindPrevious();
        } else {
          handleFindNext();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'F3') {
        event.preventDefault();
        if (event.shiftKey) {
          handleFindPrevious();
        } else {
          handleFindNext();
        }
      }
    },
    [handleFindNext, handleFindPrevious, onClose]
  );

  // Global keyboard handler for F3 and Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'F3') {
        event.preventDefault();
        if (event.shiftKey) {
          handleFindPrevious();
        } else {
          handleFindNext();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown as unknown as EventListener);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown as unknown as EventListener);
  }, [isOpen, handleFindNext, handleFindPrevious, onClose]);

  if (!isOpen) return null;

  return (
    <div className="diff-search-panel" role="dialog" aria-label="Find in diff">
      <SearchField
        value={searchTerm}
        onChange={handleSearchChange}
        aria-label="Search term"
      >
        <Input
          ref={inputRef}
          className="textbox diff-search-input"
          placeholder="Find..."
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </SearchField>

      <div className="diff-search-options">
        <label className="diff-search-option">
          <input
            type="checkbox"
            checked={options.caseSensitive}
            onChange={() => handleOptionChange('caseSensitive')}
            aria-label="Match case"
          />
          <span>Match Case</span>
        </label>
        <label className="diff-search-option">
          <input
            type="checkbox"
            checked={options.wholeWord}
            onChange={() => handleOptionChange('wholeWord')}
            aria-label="Whole word"
          />
          <span>Whole Word</span>
        </label>
        <label className="diff-search-option">
          <input
            type="checkbox"
            checked={options.regexp}
            onChange={() => handleOptionChange('regexp')}
            aria-label="Regular expression"
          />
          <span>Regex</span>
        </label>
      </div>

      <div className="diff-search-nav">
        <button
          type="button"
          className="diff-search-nav-btn"
          onClick={handleFindPrevious}
          disabled={!searchTerm}
          aria-label="Previous match"
          title="Previous match (Shift+F3)"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="diff-search-nav-btn"
          onClick={handleFindNext}
          disabled={!searchTerm}
          aria-label="Next match"
          title="Next match (F3)"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {matchCount !== null && (
        <span className="diff-search-match-count" role="status" aria-live="polite" aria-atomic="true">
          {matchCount.total > 0
            ? `${matchCount.current} of ${matchCount.total}${viewMode === 'split' && focusedSide ? ` (${focusedSide === 'left' ? 'Left' : 'Right'})` : ''}`
            : `No results${viewMode === 'split' && focusedSide ? ` (${focusedSide === 'left' ? 'Left' : 'Right'})` : ''}`}
        </span>
      )}

      <button
        type="button"
        className="btn diff-panel-close-btn"
        onClick={onClose}
        aria-label="Close"
        title="Close (Escape)"
      >
        <X size={14} />
      </button>
    </div>
  );
}
