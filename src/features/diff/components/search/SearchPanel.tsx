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
  type ChangeEvent,
} from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { SearchQuery, setSearchQuery, findNext, findPrevious, getSearchQuery } from '@codemirror/search';
import './search-go-to-panel.css';

export interface SearchPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Get the active editor view */
  getActiveEditor: () => EditorView | null;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
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
export function SearchPanel({ isOpen, onClose, getActiveEditor }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regexp: false,
  });
  const [matchCount, setMatchCount] = useState<{ current: number; total: number } | null>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Clear search when panel closes
  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    // Only clear when transitioning from open to closed
    if (prevIsOpen.current && !isOpen) {
      const view = getActiveEditor();
      if (view) {
        // Clear the search query
        view.dispatch({
          effects: setSearchQuery.of(new SearchQuery({ search: '' })),
        });
      }
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, getActiveEditor]);

  // Reset match count when panel closes (outside effect to avoid cascading renders)
  if (!isOpen && matchCount !== null) {
    // Use a microtask to defer state update
    queueMicrotask(() => setMatchCount(null));
  }

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

    // Count matches
    if (term) {
      const matches = countMatches(query, view);
      if (matches) {
        const { currentIndex, total } = matches;
        setMatchCount(total > 0 ? { current: Math.max(1, currentIndex), total } : { current: 0, total: 0 });
      } else {
        setMatchCount({ current: 0, total: 0 });
      }
    } else {
      setMatchCount(null);
    }
  }, [getActiveEditor]);

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const term = event.target.value;
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
        // After findNext, cursor moved forward so add 1 to get correct position
        setMatchCount({ current: Math.min(matches.currentIndex + 1, matches.total), total: matches.total });
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

  // Global F3 handler
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F3') {
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
  }, [isOpen, handleFindNext, handleFindPrevious]);

  if (!isOpen) return null;

  return (
    <div className="diff-search-panel" role="dialog" aria-label="Find in diff">
      <input
        ref={inputRef}
        type="text"
        className="textbox diff-search-input"
        placeholder="Find..."
        value={searchTerm}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        aria-label="Search term"
      />

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
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="diff-search-nav-btn"
          onClick={handleFindNext}
          disabled={!searchTerm}
          aria-label="Next match"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {matchCount !== null && (
        <span className="diff-search-match-count" aria-live="polite" aria-atomic="true">
          {matchCount.total > 0
            ? `${matchCount.current} of ${matchCount.total}`
            : 'No results'}
        </span>
      )}

      <button
        type="button"
        className="btn diff-panel-close-btn"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
}
