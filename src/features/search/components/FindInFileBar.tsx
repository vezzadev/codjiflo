/**
 * FindInFileBar Component
 *
 * Compact search bar positioned at top-right of the diff area.
 * Provides find-in-current-file functionality with match navigation.
 */

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useSearchStore } from '../stores';
import { SearchOptionsBar } from './SearchOptionsBar';

export function FindInFileBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    mode,
    query,
    options,
    currentFileMatches,
    currentMatchIndex,
    setQuery,
    toggleOption,
    nextMatch,
    previousMatch,
    close,
  } = useSearchStore();

  // Auto-focus input when opened
  useEffect(() => {
    if (mode === 'current-file' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [mode]);

  // Handle keyboard shortcuts within the search bar
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          previousMatch();
        } else {
          nextMatch();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          previousMatch();
        } else {
          nextMatch();
        }
      }
    },
    [close, nextMatch, previousMatch]
  );

  if (mode !== 'current-file') {
    return null;
  }

  const matchCount = currentFileMatches.length;
  const hasMatches = matchCount > 0;
  const displayIndex = hasMatches ? currentMatchIndex + 1 : 0;

  return (
    <div className="search-bar" role="search" aria-label="Find in file" data-testid="find-in-file-bar">
      <input
        ref={inputRef}
        type="text"
        className="search-bar-input"
        placeholder="Find in file..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Search query"
        data-search-input
        data-testid="find-in-file-input"
      />

      <SearchOptionsBar
        options={options}
        onToggleOption={toggleOption}
        showHighlightAll
      />

      <div className="search-separator" aria-hidden="true" />

      <span
        className={`search-match-counter ${!hasMatches && query ? 'no-results' : ''}`}
        aria-live="polite"
        data-testid="find-in-file-counter"
      >
        {query ? `${displayIndex} / ${matchCount}` : ''}
      </span>

      <div className="search-separator" aria-hidden="true" />

      <button
        type="button"
        className="search-nav-btn"
        onClick={previousMatch}
        disabled={!hasMatches}
        aria-label="Previous match (Shift+F3)"
        title="Previous match (Shift+F3)"
      >
        <ChevronUp size={14} />
      </button>

      <button
        type="button"
        className="search-nav-btn"
        onClick={nextMatch}
        disabled={!hasMatches}
        aria-label="Next match (F3)"
        title="Next match (F3)"
      >
        <ChevronDown size={14} />
      </button>

      <button
        type="button"
        className="search-close-btn"
        onClick={close}
        aria-label="Close search (Escape)"
        title="Close (Escape)"
        data-testid="find-in-file-close"
      >
        <X size={12} />
      </button>
    </div>
  );
}
