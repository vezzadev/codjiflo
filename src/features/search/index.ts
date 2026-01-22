// Types
export type {
  SearchMode,
  SearchOptions,
  SearchMatch,
  FileSearchResult,
  IterationSearchScope,
  SideFilter,
  SearchState,
} from './types';
export { DEFAULT_SEARCH_OPTIONS } from './types';

// Store
export { useSearchStore } from './stores';

// Components
export {
  FindInFileBar,
  SearchOptionsBar,
  IterationRangeSelect,
  SearchResultsPanel,
  FindInAllFilesModal,
} from './components';

// Hooks
export { useSearchKeyboardShortcuts, useSearchInCurrentFile } from './hooks';

// Utils
export {
  createSearchRegex,
  executeSearch,
  searchInDiffLines,
  matchesFileFilter,
} from './utils';

// CodeMirror Extensions
export {
  searchHighlights,
  updateSearchHighlights,
  clearSearchHighlights,
} from './extensions';
