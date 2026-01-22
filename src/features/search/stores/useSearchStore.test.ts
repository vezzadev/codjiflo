/**
 * Tests for useSearchStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore } from './useSearchStore';
import { DEFAULT_SEARCH_OPTIONS } from '../types';
import type { SearchMatch, FileSearchResult } from '../types';

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({
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
    });
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useSearchStore.getState();
      expect(state.mode).toBe('closed');
      expect(state.query).toBe('');
      expect(state.fileFilter).toBe('');
      expect(state.fileFilterUseRegex).toBe(false);
      expect(state.options).toEqual(DEFAULT_SEARCH_OPTIONS);
      expect(state.iterationScope).toBe('current-only');
      expect(state.sideFilter).toBe('both');
      expect(state.currentFileMatches).toEqual([]);
      expect(state.currentMatchIndex).toBe(-1);
      expect(state.allFilesResults).toEqual([]);
      expect(state.isSearching).toBe(false);
      expect(state.showResultsPanel).toBe(false);
    });
  });

  describe('mode actions', () => {
    it('openFindInFile sets mode to current-file', () => {
      useSearchStore.getState().openFindInFile();
      expect(useSearchStore.getState().mode).toBe('current-file');
    });

    it('openFindInAllFiles sets mode to all-files', () => {
      useSearchStore.getState().openFindInAllFiles();
      expect(useSearchStore.getState().mode).toBe('all-files');
    });

    it('close resets mode and current file state', () => {
      const mockMatches: SearchMatch[] = [
        { lineIndex: 0, columnStart: 0, columnEnd: 5, lineContent: 'test', side: 'both' },
      ];
      useSearchStore.setState({
        mode: 'current-file',
        currentFileMatches: mockMatches,
        currentMatchIndex: 0,
      });

      useSearchStore.getState().close();

      const state = useSearchStore.getState();
      expect(state.mode).toBe('closed');
      expect(state.currentFileMatches).toEqual([]);
      expect(state.currentMatchIndex).toBe(-1);
    });
  });

  describe('query actions', () => {
    it('setQuery updates query and resets match index', () => {
      useSearchStore.setState({ currentMatchIndex: 5 });
      useSearchStore.getState().setQuery('test');

      const state = useSearchStore.getState();
      expect(state.query).toBe('test');
      expect(state.currentMatchIndex).toBe(-1);
    });

    it('setFileFilter updates file filter', () => {
      useSearchStore.getState().setFileFilter('*.tsx');
      expect(useSearchStore.getState().fileFilter).toBe('*.tsx');
    });

    it('setFileFilterUseRegex updates regex flag', () => {
      useSearchStore.getState().setFileFilterUseRegex(true);
      expect(useSearchStore.getState().fileFilterUseRegex).toBe(true);
    });
  });

  describe('options actions', () => {
    it('toggleOption toggles boolean options', () => {
      expect(useSearchStore.getState().options.matchCase).toBe(false);
      useSearchStore.getState().toggleOption('matchCase');
      expect(useSearchStore.getState().options.matchCase).toBe(true);
      useSearchStore.getState().toggleOption('matchCase');
      expect(useSearchStore.getState().options.matchCase).toBe(false);
    });

    it('toggleOption resets match index', () => {
      useSearchStore.setState({ currentMatchIndex: 5 });
      useSearchStore.getState().toggleOption('matchCase');
      expect(useSearchStore.getState().currentMatchIndex).toBe(-1);
    });

    it('setIterationScope updates iteration scope', () => {
      useSearchStore.getState().setIterationScope('entire-review');
      expect(useSearchStore.getState().iterationScope).toBe('entire-review');
    });

    it('setSideFilter updates side filter', () => {
      useSearchStore.getState().setSideFilter('left');
      expect(useSearchStore.getState().sideFilter).toBe('left');
    });
  });

  describe('current file match actions', () => {
    const createMatches = (count: number): SearchMatch[] =>
      Array.from({ length: count }, (_, i) => ({
        lineIndex: i,
        columnStart: 0,
        columnEnd: 5,
        lineContent: `line ${i}`,
        side: 'both' as const,
      }));

    it('setCurrentFileMatches sets matches and initializes to first match', () => {
      const matches = createMatches(5);
      useSearchStore.getState().setCurrentFileMatches(matches);

      const state = useSearchStore.getState();
      expect(state.currentFileMatches).toEqual(matches);
      expect(state.currentMatchIndex).toBe(0);
    });

    it('setCurrentFileMatches preserves current index if valid', () => {
      const matches = createMatches(5);
      useSearchStore.setState({ currentMatchIndex: 2 });
      useSearchStore.getState().setCurrentFileMatches(matches);

      expect(useSearchStore.getState().currentMatchIndex).toBe(2);
    });

    it('setCurrentFileMatches clamps index to new length', () => {
      useSearchStore.setState({ currentMatchIndex: 10 });
      useSearchStore.getState().setCurrentFileMatches(createMatches(3));

      expect(useSearchStore.getState().currentMatchIndex).toBe(2);
    });

    it('nextMatch advances to next match', () => {
      useSearchStore.setState({
        currentFileMatches: createMatches(5),
        currentMatchIndex: 2,
      });

      useSearchStore.getState().nextMatch();
      expect(useSearchStore.getState().currentMatchIndex).toBe(3);
    });

    it('nextMatch wraps around at end', () => {
      useSearchStore.setState({
        currentFileMatches: createMatches(5),
        currentMatchIndex: 4,
      });

      useSearchStore.getState().nextMatch();
      expect(useSearchStore.getState().currentMatchIndex).toBe(0);
    });

    it('nextMatch does nothing with no matches', () => {
      useSearchStore.setState({
        currentFileMatches: [],
        currentMatchIndex: -1,
      });

      useSearchStore.getState().nextMatch();
      expect(useSearchStore.getState().currentMatchIndex).toBe(-1);
    });

    it('previousMatch goes to previous match', () => {
      useSearchStore.setState({
        currentFileMatches: createMatches(5),
        currentMatchIndex: 2,
      });

      useSearchStore.getState().previousMatch();
      expect(useSearchStore.getState().currentMatchIndex).toBe(1);
    });

    it('previousMatch wraps around at beginning', () => {
      useSearchStore.setState({
        currentFileMatches: createMatches(5),
        currentMatchIndex: 0,
      });

      useSearchStore.getState().previousMatch();
      expect(useSearchStore.getState().currentMatchIndex).toBe(4);
    });

    it('previousMatch does nothing with no matches', () => {
      useSearchStore.setState({
        currentFileMatches: [],
        currentMatchIndex: -1,
      });

      useSearchStore.getState().previousMatch();
      expect(useSearchStore.getState().currentMatchIndex).toBe(-1);
    });

    it('goToMatch sets index if valid', () => {
      useSearchStore.setState({
        currentFileMatches: createMatches(5),
        currentMatchIndex: 0,
      });

      useSearchStore.getState().goToMatch(3);
      expect(useSearchStore.getState().currentMatchIndex).toBe(3);
    });

    it('goToMatch ignores invalid index', () => {
      useSearchStore.setState({
        currentFileMatches: createMatches(5),
        currentMatchIndex: 2,
      });

      useSearchStore.getState().goToMatch(10);
      expect(useSearchStore.getState().currentMatchIndex).toBe(2);

      useSearchStore.getState().goToMatch(-1);
      expect(useSearchStore.getState().currentMatchIndex).toBe(2);
    });
  });

  describe('all files results actions', () => {
    const createResults = (): FileSearchResult[] => [
      {
        path: 'src/foo.ts',
        matches: [
          { lineIndex: 0, columnStart: 0, columnEnd: 3, lineContent: 'foo bar', side: 'both' },
        ],
      },
      {
        path: 'src/bar.ts',
        matches: [
          { lineIndex: 5, columnStart: 0, columnEnd: 3, lineContent: 'bar baz', side: 'right' },
        ],
      },
    ];

    it('setAllFilesResults sets results and shows panel', () => {
      const results = createResults();
      useSearchStore.getState().setAllFilesResults(results);

      const state = useSearchStore.getState();
      expect(state.allFilesResults).toEqual(results);
      expect(state.showResultsPanel).toBe(true);
    });

    it('setAllFilesResults hides panel when results are empty', () => {
      useSearchStore.setState({ showResultsPanel: true });
      useSearchStore.getState().setAllFilesResults([]);

      expect(useSearchStore.getState().showResultsPanel).toBe(false);
    });

    it('setIsSearching updates searching flag', () => {
      useSearchStore.getState().setIsSearching(true);
      expect(useSearchStore.getState().isSearching).toBe(true);

      useSearchStore.getState().setIsSearching(false);
      expect(useSearchStore.getState().isSearching).toBe(false);
    });

    it('clearAllFilesResults clears results and hides panel', () => {
      useSearchStore.setState({
        allFilesResults: createResults(),
        showResultsPanel: true,
      });

      useSearchStore.getState().clearAllFilesResults();

      const state = useSearchStore.getState();
      expect(state.allFilesResults).toEqual([]);
      expect(state.showResultsPanel).toBe(false);
    });
  });
});
