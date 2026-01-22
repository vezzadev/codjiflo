/**
 * Search Store
 *
 * Zustand store for managing search state across find-in-file and find-in-all-files.
 */

import { create } from 'zustand';
import type {
  SearchState,
  SearchOptions,
  SearchMatch,
  FileSearchResult,
  IterationSearchScope,
  SideFilter,
} from '../types';
import { DEFAULT_SEARCH_OPTIONS } from '../types';

export const useSearchStore = create<SearchState>()((set, get) => ({
  // Initial state
  mode: 'closed',
  query: '',
  fileFilter: '',
  fileFilterUseRegex: false,
  options: DEFAULT_SEARCH_OPTIONS,
  iterationScope: 'current-only',
  sideFilter: 'both',
  currentFileMatches: [],
  currentMatchIndex: -1,
  allFilesResults: [],
  isSearching: false,
  showResultsPanel: false,

  // Mode actions
  openFindInFile: () => {
    set({ mode: 'current-file' });
  },

  openFindInAllFiles: () => {
    set({ mode: 'all-files' });
  },

  close: () => {
    set({
      mode: 'closed',
      currentFileMatches: [],
      currentMatchIndex: -1,
    });
  },

  // Query actions
  setQuery: (query: string) => {
    set({ query, currentMatchIndex: -1 });
  },

  setFileFilter: (fileFilter: string) => {
    set({ fileFilter });
  },

  setFileFilterUseRegex: (fileFilterUseRegex: boolean) => {
    set({ fileFilterUseRegex });
  },

  // Options actions
  toggleOption: (option: keyof SearchOptions) => {
    const { options } = get();
    set({
      options: {
        ...options,
        [option]: !options[option],
      },
      currentMatchIndex: -1,
    });
  },

  setIterationScope: (iterationScope: IterationSearchScope) => {
    set({ iterationScope });
  },

  setSideFilter: (sideFilter: SideFilter) => {
    set({ sideFilter });
  },

  // Current file match actions
  setCurrentFileMatches: (matches: SearchMatch[]) => {
    const { currentMatchIndex } = get();
    // Reset to first match if there are matches and no current match
    const newIndex = matches.length > 0 && currentMatchIndex === -1 ? 0 : currentMatchIndex;
    set({
      currentFileMatches: matches,
      currentMatchIndex: Math.min(newIndex, matches.length - 1),
    });
  },

  nextMatch: () => {
    const { currentFileMatches, currentMatchIndex } = get();
    if (currentFileMatches.length === 0) return;

    const nextIndex =
      currentMatchIndex >= currentFileMatches.length - 1
        ? 0 // Wrap around
        : currentMatchIndex + 1;
    set({ currentMatchIndex: nextIndex });
  },

  previousMatch: () => {
    const { currentFileMatches, currentMatchIndex } = get();
    if (currentFileMatches.length === 0) return;

    const prevIndex =
      currentMatchIndex <= 0
        ? currentFileMatches.length - 1 // Wrap around
        : currentMatchIndex - 1;
    set({ currentMatchIndex: prevIndex });
  },

  goToMatch: (index: number) => {
    const { currentFileMatches } = get();
    if (index >= 0 && index < currentFileMatches.length) {
      set({ currentMatchIndex: index });
    }
  },

  // All files results actions
  setAllFilesResults: (results: FileSearchResult[]) => {
    set({
      allFilesResults: results,
      showResultsPanel: results.length > 0,
    });
  },

  setIsSearching: (isSearching: boolean) => {
    set({ isSearching });
  },

  clearAllFilesResults: () => {
    set({
      allFilesResults: [],
      showResultsPanel: false,
    });
  },
}));
