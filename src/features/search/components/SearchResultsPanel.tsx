/**
 * SearchResultsPanel Component
 *
 * Displays search results in the bottom panel as a collapsible list grouped by file.
 */

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useSearchStore } from '../stores';
import { useDiffStore } from '@/features/diff';
import type { FileSearchResult, SearchMatch } from '../types';

interface FileGroupProps {
  result: FileSearchResult;
  onMatchClick: (match: SearchMatch, filePath: string) => void;
}

function FileGroup({ result, onMatchClick }: FileGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="search-results-file">
      <div
        className="search-results-file-header"
        onClick={toggleExpanded}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <span className={`search-results-file-expander ${isExpanded ? '' : 'collapsed'}`}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="search-results-file-path">{result.path}</span>
        <span className="search-results-file-count">({result.matches.length} matches)</span>
      </div>

      <div className={`search-results-matches ${isExpanded ? '' : 'collapsed'}`}>
        {result.matches.map((match, idx) => (
          <MatchRow
            key={`${match.lineIndex}-${match.columnStart}-${idx}`}
            match={match}
            filePath={result.path}
            onMatchClick={onMatchClick}
          />
        ))}
      </div>
    </div>
  );
}

interface MatchRowProps {
  match: SearchMatch;
  filePath: string;
  onMatchClick: (match: SearchMatch, filePath: string) => void;
}

function MatchRow({ match, filePath, onMatchClick }: MatchRowProps) {
  const handleClick = useCallback(() => {
    onMatchClick(match, filePath);
  }, [match, filePath, onMatchClick]);

  // Highlight the matched portion in the line content
  const highlightedContent = useMemo(() => {
    const before = match.lineContent.slice(0, match.columnStart);
    const matched = match.lineContent.slice(match.columnStart, match.columnEnd);
    const after = match.lineContent.slice(match.columnEnd);

    return (
      <>
        {before}
        <span className="search-results-match-highlight">{matched}</span>
        {after}
      </>
    );
  }, [match]);

  return (
    <div
      className="search-results-match"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <span className="search-results-match-line">{match.lineIndex + 1}:</span>
      <span className="search-results-match-content">{highlightedContent}</span>
    </div>
  );
}

export function SearchResultsPanel() {
  const { allFilesResults, query, clearAllFilesResults, isSearching } = useSearchStore();
  const { files, selectFile } = useDiffStore();

  // Calculate total match count
  const totalMatches = useMemo(() => {
    return allFilesResults.reduce((sum, result) => sum + result.matches.length, 0);
  }, [allFilesResults]);

  // Handle clicking on a match - navigate to file and line
  const handleMatchClick = useCallback(
    (_match: SearchMatch, filePath: string) => {
      // Find the file index
      const fileIndex = files.findIndex((f) => f.filename === filePath);
      if (fileIndex >= 0) {
        selectFile(fileIndex);
        // TODO: Scroll to match line - this would require passing the line to the diff view
      }
    },
    [files, selectFile]
  );

  if (isSearching) {
    return (
      <div className="search-results-empty">
        Searching...
      </div>
    );
  }

  if (allFilesResults.length === 0) {
    return (
      <div className="search-results-empty">
        {query ? 'No results found' : 'Enter a search query to find matches across all files'}
      </div>
    );
  }

  return (
    <div className="search-results-panel">
      <div className="search-results-header">
        <span className="search-results-query">
          Query: <strong>&quot;{query}&quot;</strong>
        </span>
        <button
          type="button"
          className="search-results-clear"
          onClick={clearAllFilesResults}
        >
          Clear Results
        </button>
      </div>

      <div className="search-results-list">
        {allFilesResults.map((result) => (
          <FileGroup
            key={result.path}
            result={result}
            onMatchClick={handleMatchClick}
          />
        ))}
      </div>

      <div className="search-results-footer">
        {totalMatches} matches in {allFilesResults.length} files
      </div>
    </div>
  );
}
