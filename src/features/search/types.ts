/**
 * Search Feature Types
 *
 * Types for find-in-file and find-in-all-files functionality.
 */

// ============================================================================
// Search Mode
// ============================================================================

export type SearchMode = 'closed' | 'current-file' | 'all-files';

// ============================================================================
// Search Options
// ============================================================================

export interface SearchOptions {
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  highlightAll: boolean;
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  matchCase: false,
  matchWholeWord: false,
  useRegex: false,
  highlightAll: true,
};

// ============================================================================
// Search Results
// ============================================================================

export interface SearchMatch {
  /** Line index within the diff (0-based) */
  lineIndex: number;
  /** Column start position (0-based) */
  columnStart: number;
  /** Column end position (0-based) */
  columnEnd: number;
  /** Full content of the matched line */
  lineContent: string;
  /** Which side of the diff the match is on */
  side: 'left' | 'right' | 'both';
}

export interface FileSearchResult {
  /** File path */
  path: string;
  /** All matches in this file */
  matches: SearchMatch[];
  /** Artifact ID if from iteration data */
  artifactId?: number;
}

// ============================================================================
// All-Files Search Scope
// ============================================================================

export type IterationSearchScope =
  | 'current-only'
  | 'current-and-previous'
  | 'current-and-later'
  | 'entire-review';

export type SideFilter = 'both' | 'left' | 'right';

// ============================================================================
// Store State
// ============================================================================

export interface SearchState {
  // Mode
  mode: SearchMode;

  // Query and filters
  query: string;
  fileFilter: string;
  fileFilterUseRegex: boolean;
  options: SearchOptions;
  iterationScope: IterationSearchScope;
  sideFilter: SideFilter;

  // Current file results
  currentFileMatches: SearchMatch[];
  currentMatchIndex: number;

  // All files results
  allFilesResults: FileSearchResult[];
  isSearching: boolean;
  showResultsPanel: boolean;

  // Actions
  openFindInFile: () => void;
  openFindInAllFiles: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  setFileFilter: (filter: string) => void;
  setFileFilterUseRegex: (useRegex: boolean) => void;
  toggleOption: (option: keyof SearchOptions) => void;
  setIterationScope: (scope: IterationSearchScope) => void;
  setSideFilter: (filter: SideFilter) => void;
  setCurrentFileMatches: (matches: SearchMatch[]) => void;
  nextMatch: () => void;
  previousMatch: () => void;
  goToMatch: (index: number) => void;
  setAllFilesResults: (results: FileSearchResult[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  clearAllFilesResults: () => void;
}
