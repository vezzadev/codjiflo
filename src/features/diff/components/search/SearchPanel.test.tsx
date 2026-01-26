/**
 * SearchPanel Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchPanel } from './SearchPanel';
import type { EditorView } from '@codemirror/view';

// Mock CodeMirror search functions
vi.mock('@codemirror/search', () => {
  const createMockCursor = () => ({
    next: vi.fn().mockReturnValue({ done: true }),
  });

  class MockSearchQuery {
    search: string;
    caseSensitive: boolean;
    wholeWord: boolean;
    regexp: boolean;

    constructor(config: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }) {
      this.search = config.search;
      this.caseSensitive = config.caseSensitive ?? false;
      this.wholeWord = config.wholeWord ?? false;
      this.regexp = config.regexp ?? false;
    }

    getCursor() {
      return createMockCursor();
    }
  }

  return {
    SearchQuery: MockSearchQuery,
    setSearchQuery: {
      of: vi.fn().mockReturnValue({ type: 'search-query' }),
    },
    findNext: vi.fn(),
    findPrevious: vi.fn(),
    getSearchQuery: vi.fn().mockReturnValue({
      search: '',
      getCursor: createMockCursor,
    }),
    openSearchPanel: vi.fn(),
    closeSearchPanel: vi.fn(),
  };
});

describe('SearchPanel', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockFocus: ReturnType<typeof vi.fn>;
  let mockEditorView: EditorView;

  const createMockEditorView = (): EditorView => {
    mockDispatch = vi.fn();
    mockFocus = vi.fn();
    mockEditorView = {
      state: {
        doc: { length: 1000 },
        selection: { main: { from: 0 } },
      },
      dispatch: mockDispatch,
      focus: mockFocus,
    } as unknown as EditorView;
    return mockEditorView;
  };

  // Create a stable mock instance
  let stableMockView: EditorView;

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    getActiveEditor: () => stableMockView,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stableMockView = createMockEditorView();
  });

  describe('rendering', () => {
    it('renders when isOpen=true', () => {
      render(<SearchPanel {...defaultProps} isOpen={true} />);

      expect(screen.getByRole('dialog', { name: 'Find in diff' })).toBeInTheDocument();
    });

    it('does not render when isOpen=false', () => {
      render(<SearchPanel {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders search input with correct placeholder', () => {
      render(<SearchPanel {...defaultProps} />);

      expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument();
    });

    it('renders Match Case checkbox', () => {
      render(<SearchPanel {...defaultProps} />);

      expect(screen.getByText('Match Case')).toBeInTheDocument();
    });

    it('renders Whole Word checkbox', () => {
      render(<SearchPanel {...defaultProps} />);

      expect(screen.getByText('Whole Word')).toBeInTheDocument();
    });

    it('renders Regex checkbox', () => {
      render(<SearchPanel {...defaultProps} />);

      expect(screen.getByText('Regex')).toBeInTheDocument();
    });

    it('renders Previous and Next buttons', () => {
      render(<SearchPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Previous match' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next match' })).toBeInTheDocument();
    });

    it('renders Close button', () => {
      render(<SearchPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('focus behavior', () => {
    it('focuses input when panel opens', () => {
      render(<SearchPanel {...defaultProps} isOpen={true} />);

      const input = screen.getByPlaceholderText('Find...');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('keyboard handling', () => {
    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<SearchPanel {...defaultProps} onClose={onClose} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('triggers find next when Enter is pressed', async () => {
      const { findNext } = await import('@codemirror/search');
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(findNext).toHaveBeenCalled();
    });

    it('triggers find previous when Shift+Enter is pressed', async () => {
      const { findPrevious } = await import('@codemirror/search');
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(findPrevious).toHaveBeenCalled();
    });
  });

  describe('button actions', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<SearchPanel {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('triggers find next when Next button is clicked', async () => {
      const { findNext } = await import('@codemirror/search');
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      const nextButton = screen.getByRole('button', { name: 'Next match' });
      fireEvent.click(nextButton);

      expect(findNext).toHaveBeenCalled();
    });

    it('triggers find previous when Previous button is clicked', async () => {
      const { findPrevious } = await import('@codemirror/search');
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      const prevButton = screen.getByRole('button', { name: 'Previous match' });
      fireEvent.click(prevButton);

      expect(findPrevious).toHaveBeenCalled();
    });

    it('disables nav buttons when search is empty', () => {
      render(<SearchPanel {...defaultProps} />);

      const nextButton = screen.getByRole('button', { name: 'Next match' });
      const prevButton = screen.getByRole('button', { name: 'Previous match' });

      expect(nextButton).toBeDisabled();
      expect(prevButton).toBeDisabled();
    });

    it('enables nav buttons when search has text', () => {
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      const nextButton = screen.getByRole('button', { name: 'Next match' });
      const prevButton = screen.getByRole('button', { name: 'Previous match' });

      expect(nextButton).not.toBeDisabled();
      expect(prevButton).not.toBeDisabled();
    });
  });

  describe('checkbox state', () => {
    it('toggles Match Case checkbox', () => {
      render(<SearchPanel {...defaultProps} />);

      const label = screen.getByText('Match Case');
      const checkbox = label.previousElementSibling as HTMLInputElement;

      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });

    it('toggles Whole Word checkbox', () => {
      render(<SearchPanel {...defaultProps} />);

      const label = screen.getByText('Whole Word');
      const checkbox = label.previousElementSibling as HTMLInputElement;

      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });

    it('toggles Regex checkbox', () => {
      render(<SearchPanel {...defaultProps} />);

      const label = screen.getByText('Regex');
      const checkbox = label.previousElementSibling as HTMLInputElement;

      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('search updates', () => {
    it('dispatches search query when input changes', () => {
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'function' } });

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('dispatches search query when option changes', () => {
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });
      mockDispatch.mockClear();

      const label = screen.getByText('Match Case');
      const checkbox = label.previousElementSibling as HTMLInputElement;
      fireEvent.click(checkbox);

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles null editor gracefully', async () => {
      const { findNext } = await import('@codemirror/search');
      render(<SearchPanel {...defaultProps} getActiveEditor={() => null} />);

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not crash and should not call findNext
      expect(findNext).not.toHaveBeenCalled();
    });
  });

  describe('panel close behavior', () => {
    it('clears search term when panel is closed and reopened', async () => {
      const { rerender } = render(<SearchPanel {...defaultProps} isOpen={true} />);

      // Type a search term
      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test search' } });
      expect(input).toHaveValue('test search');

      // Close the panel - the clear happens via queueMicrotask
      rerender(<SearchPanel {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Wait for microtask to complete (setSearchTerm is deferred)
      await Promise.resolve();

      // Reopen the panel
      rerender(<SearchPanel {...defaultProps} isOpen={true} />);

      // Search input should be empty
      const reopenedInput = screen.getByPlaceholderText('Find...');
      expect(reopenedInput).toHaveValue('');
    });

    it('closes CodeMirror search panel when panel closes', async () => {
      const { closeSearchPanel } = await import('@codemirror/search');
      const { rerender } = render(<SearchPanel {...defaultProps} isOpen={true} />);

      // Type a search term
      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Close the panel
      rerender(<SearchPanel {...defaultProps} isOpen={false} />);

      // Should have called closeSearchPanel to clear the search state
      expect(closeSearchPanel).toHaveBeenCalled();
    });
  });

  describe('debounce behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debounces match count updates during rapid typing', () => {
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');

      // Type rapidly
      fireEvent.change(input, { target: { value: 't' } });
      fireEvent.change(input, { target: { value: 'te' } });
      fireEvent.change(input, { target: { value: 'tes' } });
      fireEvent.change(input, { target: { value: 'test' } });

      // Match count should not appear immediately (debounce in progress)
      // The mock cursor returns done:true immediately, so we'd get "No results"
      expect(screen.queryByText('No results')).not.toBeInTheDocument();

      // Advance past debounce delay (150ms) and flush React updates
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // After debounce, match count updates (mock returns "No results" since cursor is empty)
      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('cancels pending debounce when input is cleared', () => {
      render(<SearchPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Find...');

      // Type something
      fireEvent.change(input, { target: { value: 'test' } });

      // Clear before debounce fires
      fireEvent.change(input, { target: { value: '' } });

      // Advance past debounce delay
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // No match count should appear (debounce was cancelled)
      expect(screen.queryByText('No results')).not.toBeInTheDocument();
      expect(screen.queryByText(/of/)).not.toBeInTheDocument();
    });
  });
});
