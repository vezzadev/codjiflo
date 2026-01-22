/**
 * Tests for FindInFileBar component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers/render';
import { FindInFileBar } from './FindInFileBar';
import { useSearchStore } from '../stores';
import { DEFAULT_SEARCH_OPTIONS } from '../types';

describe('FindInFileBar', () => {
  beforeEach(() => {
    // Reset store state
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

  it('renders nothing when mode is closed', () => {
    render(<FindInFileBar />);
    expect(screen.queryByTestId('find-in-file-bar')).not.toBeInTheDocument();
  });

  it('renders nothing when mode is all-files', () => {
    useSearchStore.setState({ mode: 'all-files' });
    render(<FindInFileBar />);
    expect(screen.queryByTestId('find-in-file-bar')).not.toBeInTheDocument();
  });

  it('renders when mode is current-file', () => {
    useSearchStore.setState({ mode: 'current-file' });
    render(<FindInFileBar />);
    expect(screen.getByTestId('find-in-file-bar')).toBeInTheDocument();
  });

  it('renders search input', () => {
    useSearchStore.setState({ mode: 'current-file' });
    render(<FindInFileBar />);
    expect(screen.getByRole('textbox', { name: /Search query/i })).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    useSearchStore.setState({ mode: 'current-file' });
    render(<FindInFileBar />);
    expect(screen.getByRole('button', { name: /Previous match/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next match/i })).toBeInTheDocument();
  });

  it('renders close button', () => {
    useSearchStore.setState({ mode: 'current-file' });
    render(<FindInFileBar />);
    expect(screen.getByRole('button', { name: /Close search/i })).toBeInTheDocument();
  });

  it('displays match counter when query exists', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 0,
    });

    render(<FindInFileBar />);

    expect(screen.getByTestId('find-in-file-counter')).toHaveTextContent('1 / 2');
  });

  it('displays 0 / 0 when no matches', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [],
      currentMatchIndex: -1,
    });

    render(<FindInFileBar />);

    expect(screen.getByTestId('find-in-file-counter')).toHaveTextContent('0 / 0');
  });

  it('does not display counter when query is empty', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: '',
    });

    render(<FindInFileBar />);

    expect(screen.getByTestId('find-in-file-counter')).toHaveTextContent('');
  });

  it('disables navigation buttons when no matches', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [],
    });

    render(<FindInFileBar />);

    expect(screen.getByRole('button', { name: /Previous match/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next match/i })).toBeDisabled();
  });

  it('enables navigation buttons when matches exist', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 0,
    });

    render(<FindInFileBar />);

    expect(screen.getByRole('button', { name: /Previous match/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Next match/i })).toBeEnabled();
  });

  it('updates query in store when typing', () => {
    useSearchStore.setState({ mode: 'current-file' });

    render(<FindInFileBar />);

    const input = screen.getByRole('textbox', { name: /Search query/i });
    fireEvent.change(input, { target: { value: 'hello' } });

    expect(useSearchStore.getState().query).toBe('hello');
  });

  it('closes search on Escape key', () => {
    useSearchStore.setState({ mode: 'current-file' });

    render(<FindInFileBar />);

    const input = screen.getByRole('textbox', { name: /Search query/i });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(useSearchStore.getState().mode).toBe('closed');
  });

  it('navigates to next match on Enter key', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 0,
    });

    render(<FindInFileBar />);

    const input = screen.getByRole('textbox', { name: /Search query/i });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useSearchStore.getState().currentMatchIndex).toBe(1);
  });

  it('navigates to previous match on Shift+Enter', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 1,
    });

    render(<FindInFileBar />);

    const input = screen.getByRole('textbox', { name: /Search query/i });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(useSearchStore.getState().currentMatchIndex).toBe(0);
  });

  it('navigates to next match on F3 key', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 0,
    });

    render(<FindInFileBar />);

    const input = screen.getByRole('textbox', { name: /Search query/i });
    fireEvent.keyDown(input, { key: 'F3' });

    expect(useSearchStore.getState().currentMatchIndex).toBe(1);
  });

  it('navigates to previous match on Shift+F3', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 1,
    });

    render(<FindInFileBar />);

    const input = screen.getByRole('textbox', { name: /Search query/i });
    fireEvent.keyDown(input, { key: 'F3', shiftKey: true });

    expect(useSearchStore.getState().currentMatchIndex).toBe(0);
  });

  it('closes search when close button is clicked', () => {
    useSearchStore.setState({ mode: 'current-file' });

    render(<FindInFileBar />);

    fireEvent.click(screen.getByTestId('find-in-file-close'));

    expect(useSearchStore.getState().mode).toBe('closed');
  });

  it('navigates to next match when next button is clicked', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 0,
    });

    render(<FindInFileBar />);

    fireEvent.click(screen.getByRole('button', { name: /Next match/i }));

    expect(useSearchStore.getState().currentMatchIndex).toBe(1);
  });

  it('navigates to previous match when previous button is clicked', () => {
    useSearchStore.setState({
      mode: 'current-file',
      query: 'test',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 4, lineContent: 'test', side: 'both' },
      ],
      currentMatchIndex: 1,
    });

    render(<FindInFileBar />);

    fireEvent.click(screen.getByRole('button', { name: /Previous match/i }));

    expect(useSearchStore.getState().currentMatchIndex).toBe(0);
  });

  it('renders search options bar with highlight all toggle', () => {
    useSearchStore.setState({ mode: 'current-file' });

    render(<FindInFileBar />);

    expect(screen.getByTitle('Highlight All Matches')).toBeInTheDocument();
  });

  it('has accessible search role', () => {
    useSearchStore.setState({ mode: 'current-file' });

    render(<FindInFileBar />);

    expect(screen.getByRole('search', { name: /Find in file/i })).toBeInTheDocument();
  });
});
