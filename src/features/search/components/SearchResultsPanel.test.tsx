/**
 * Tests for SearchResultsPanel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers/render';
import { SearchResultsPanel } from './SearchResultsPanel';
import { useSearchStore } from '../stores';
import { useDiffStore } from '@/features/diff';
import { DEFAULT_SEARCH_OPTIONS } from '../types';
import type { FileSearchResult } from '../types';

// Setup mock state for useDiffStore
const mockSelectFile = vi.fn();
const mockDiffState = {
  files: [
    { filename: 'src/foo.ts', patch: '', status: 'modified', additions: 1, deletions: 0, changes: 1 },
    { filename: 'src/bar.ts', patch: '', status: 'modified', additions: 1, deletions: 0, changes: 1 },
  ],
  selectFile: mockSelectFile,
};

// Mock useDiffStore
vi.mock('@/features/diff', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/diff')>();
  return {
    ...original,
    useDiffStore: vi.fn((selector?: (state: typeof mockDiffState) => unknown) => {
      if (selector) {
        return selector(mockDiffState);
      }
      return mockDiffState;
    }),
  };
});

describe('SearchResultsPanel', () => {
  const createMockResults = (): FileSearchResult[] => [
    {
      path: 'src/foo.ts',
      matches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 3, lineContent: 'foo bar baz', side: 'both' },
        { lineIndex: 5, columnStart: 4, columnEnd: 7, lineContent: 'let foo = 1', side: 'right' },
      ],
    },
    {
      path: 'src/bar.ts',
      matches: [
        { lineIndex: 10, columnStart: 0, columnEnd: 3, lineContent: 'bar qux', side: 'left' },
      ],
    },
  ];

  beforeEach(() => {
    mockSelectFile.mockClear();

    // Reset search store
    useSearchStore.setState({
      mode: 'closed',
      query: 'foo',
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

  it('renders searching state', () => {
    useSearchStore.setState({ isSearching: true });

    render(<SearchResultsPanel />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('renders empty state when no results and no query', () => {
    useSearchStore.setState({ query: '', allFilesResults: [] });

    render(<SearchResultsPanel />);

    expect(screen.getByText(/Enter a search query/i)).toBeInTheDocument();
  });

  it('renders no results message when query exists but no matches', () => {
    useSearchStore.setState({ query: 'test', allFilesResults: [] });

    render(<SearchResultsPanel />);

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders search results when available', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    expect(screen.getByText('src/foo.ts')).toBeInTheDocument();
    expect(screen.getByText('src/bar.ts')).toBeInTheDocument();
  });

  it('shows match count per file', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    expect(screen.getByText('(2 matches)')).toBeInTheDocument();
    expect(screen.getByText('(1 matches)')).toBeInTheDocument();
  });

  it('shows total match count in footer', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    expect(screen.getByText('3 matches in 2 files')).toBeInTheDocument();
  });

  it('displays the search query', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    expect(screen.getByText(/Query:/i)).toBeInTheDocument();
    expect(screen.getByText('"foo"')).toBeInTheDocument();
  });

  it('renders Clear Results button', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    expect(screen.getByRole('button', { name: /Clear Results/i })).toBeInTheDocument();
  });

  it('clears results when Clear Results is clicked', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Clear Results/i }));

    expect(useSearchStore.getState().allFilesResults).toEqual([]);
    expect(useSearchStore.getState().showResultsPanel).toBe(false);
  });

  it('shows line numbers in match rows', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    // Line index 0 should show as line 1
    expect(screen.getByText('1:')).toBeInTheDocument();
    // Line index 5 should show as line 6
    expect(screen.getByText('6:')).toBeInTheDocument();
    // Line index 10 should show as line 11
    expect(screen.getByText('11:')).toBeInTheDocument();
  });

  it('highlights matched text in results', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    const highlights = document.querySelectorAll('.search-results-match-highlight');
    expect(highlights.length).toBeGreaterThan(0);
  });

  it('navigates to file when match is clicked', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    // Click on a match row
    const matchRows = screen.getAllByRole('button');
    // Find a match row (not the Clear Results button or file header)
    const matchRow = matchRows.find(btn => btn.classList.contains('search-results-match'));
    if (matchRow) {
      fireEvent.click(matchRow);
      expect(mockSelectFile).toHaveBeenCalledWith(0);
    }
  });

  it('toggles file group expansion when header is clicked', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    // Get the first file header
    const fileHeader = screen.getByText('src/foo.ts').closest('[role="button"]');
    expect(fileHeader).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    if (fileHeader) {
      fireEvent.click(fileHeader);
      expect(fileHeader).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('handles keyboard navigation on file header', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    const fileHeader = screen.getByText('src/foo.ts').closest('[role="button"]');
    if (fileHeader) {
      // Press Enter to toggle
      fireEvent.keyDown(fileHeader, { key: 'Enter' });
      expect(fileHeader).toHaveAttribute('aria-expanded', 'false');

      // Press Space to toggle back
      fireEvent.keyDown(fileHeader, { key: ' ' });
      expect(fileHeader).toHaveAttribute('aria-expanded', 'true');
    }
  });

  it('handles keyboard navigation on match row', () => {
    useSearchStore.setState({
      query: 'foo',
      allFilesResults: createMockResults(),
      showResultsPanel: true,
    });

    render(<SearchResultsPanel />);

    const matchRows = screen.getAllByRole('button');
    const matchRow = matchRows.find(btn => btn.classList.contains('search-results-match'));

    if (matchRow) {
      fireEvent.keyDown(matchRow, { key: 'Enter' });
      expect(mockSelectFile).toHaveBeenCalled();
    }
  });
});
