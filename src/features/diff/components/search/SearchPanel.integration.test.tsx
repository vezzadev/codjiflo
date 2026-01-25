/**
 * SearchPanel Integration Tests
 *
 * Tests the integration between useSearchPanel hook and the panel components.
 * Actual CodeMirror search functionality is tested in E2E tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@/tests/helpers';
import { SearchPanel } from './SearchPanel';
import { GoToLinePanel } from './GoToLinePanel';
import { useSearchPanel, type UseSearchPanelOptions } from './useSearchPanel';
import type { EditorView } from '@codemirror/view';
import type { ReactNode } from 'react';

// Mock CodeMirror search module
vi.mock('@codemirror/search', () => {
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
      return { next: () => ({ done: true }) };
    }
  }

  return {
    SearchQuery: MockSearchQuery,
    setSearchQuery: { of: vi.fn().mockReturnValue({ type: 'search-query' }) },
    findNext: vi.fn(),
    findPrevious: vi.fn(),
    getSearchQuery: vi.fn().mockReturnValue({
      search: '',
      getCursor: () => ({ next: () => ({ done: true }) }),
    }),
  };
});

// ============================================================================
// Test Wrapper Component
// ============================================================================

interface TestWrapperProps {
  children: (props: {
    searchPanelOpen: boolean;
    goToLinePanelOpen: boolean;
    closeAllPanels: () => void;
    getActiveEditor: () => EditorView | null;
  }) => ReactNode;
  options?: Partial<UseSearchPanelOptions>;
}

function TestWrapper({ children, options = {} }: TestWrapperProps) {
  const mockEditorView = {
    state: {
      doc: { lines: 100, line: (n: number) => ({ from: (n - 1) * 10 }) },
      selection: { main: { from: 0 } },
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorView;

  const defaultOptions: UseSearchPanelOptions = {
    viewMode: 'inline',
    getUnifiedView: () => mockEditorView,
    getLeftView: () => null,
    getRightView: () => null,
    getFocusedSide: () => null,
    ...options,
  };

  const hookResult = useSearchPanel(defaultOptions);

  return <>{children(hookResult)}</>;
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('SearchPanel Integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('panel state management', () => {
    it('SearchPanel renders when isOpen=true', () => {
      render(
        <TestWrapper>
          {(hookResult) => (
            <SearchPanel
              isOpen={true}
              onClose={hookResult.closeAllPanels}
              getActiveEditor={hookResult.getActiveEditor}
            />
          )}
        </TestWrapper>
      );

      expect(screen.getByRole('dialog', { name: 'Find in diff' })).toBeInTheDocument();
    });

    it('GoToLinePanel renders when isOpen=true', () => {
      render(
        <TestWrapper>
          {(hookResult) => (
            <GoToLinePanel
              isOpen={true}
              onClose={hookResult.closeAllPanels}
              getActiveEditor={hookResult.getActiveEditor}
            />
          )}
        </TestWrapper>
      );

      expect(screen.getByRole('dialog', { name: 'Go to line' })).toBeInTheDocument();
    });
  });

  describe('Escape key behavior', () => {
    it('Escape closes search panel when input is focused', () => {
      const onClose = vi.fn();

      render(
        <SearchPanel
          isOpen={true}
          onClose={onClose}
          getActiveEditor={() =>
            ({
              state: {
                doc: { length: 1000 },
                selection: { main: { from: 0 } },
              },
              dispatch: vi.fn(),
              focus: vi.fn(),
            } as unknown as EditorView)
          }
        />
      );

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('Escape closes search panel even when input is not focused (global handler)', () => {
      const onClose = vi.fn();

      render(
        <SearchPanel
          isOpen={true}
          onClose={onClose}
          getActiveEditor={() =>
            ({
              state: {
                doc: { length: 1000 },
                selection: { main: { from: 0 } },
              },
              dispatch: vi.fn(),
              focus: vi.fn(),
            } as unknown as EditorView)
          }
        />
      );

      // Blur the input so it's not focused
      const input = screen.getByPlaceholderText('Find...');
      input.blur();

      // Fire Escape on the window (global handler)
      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('Escape closes go-to-line panel', () => {
      const onClose = vi.fn();

      render(
        <GoToLinePanel
          isOpen={true}
          onClose={onClose}
          getActiveEditor={() =>
            ({
              state: {
                doc: { lines: 100, line: (n: number) => ({ from: (n - 1) * 10 }) },
                selection: { main: { from: 0 } },
              },
              dispatch: vi.fn(),
              focus: vi.fn(),
            } as unknown as EditorView)
          }
        />
      );

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Search panel options persistence', () => {
    it('maintains checkbox state across typing', () => {
      render(
        <SearchPanel
          isOpen={true}
          onClose={vi.fn()}
          getActiveEditor={() =>
            ({
              state: {
                doc: { length: 1000 },
                selection: { main: { from: 0 } },
              },
              dispatch: vi.fn(),
              focus: vi.fn(),
            } as unknown as EditorView)
          }
        />
      );

      // Toggle Match Case
      const matchCaseLabel = screen.getByText('Match Case');
      const checkbox = matchCaseLabel.previousElementSibling as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      // Type in search
      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Checkbox should still be checked
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('side label in split mode', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('displays "(Left)" when focused on left side in split mode', async () => {
      render(
        <SearchPanel
          isOpen={true}
          onClose={vi.fn()}
          getActiveEditor={() =>
            ({
              state: {
                doc: {
                  length: 1000,
                },
                selection: { main: { from: 0 } },
              },
              dispatch: vi.fn(),
              focus: vi.fn(),
            } as unknown as EditorView)
          }
          viewMode="split"
          focusedSide="left"
        />
      );

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Flush debounce timer (150ms) and React updates
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('(Left)');
    });

    it('displays "(Right)" when focused on right side in split mode', async () => {
      render(
        <SearchPanel
          isOpen={true}
          onClose={vi.fn()}
          getActiveEditor={() =>
            ({
              state: {
                doc: {
                  length: 1000,
                },
                selection: { main: { from: 0 } },
              },
              dispatch: vi.fn(),
              focus: vi.fn(),
            } as unknown as EditorView)
          }
          viewMode="split"
          focusedSide="right"
        />
      );

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Flush debounce timer and React updates
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('(Right)');
    });

    it('does not display side label in inline mode', async () => {
      render(
        <SearchPanel
          isOpen={true}
          onClose={vi.fn()}
          getActiveEditor={() =>
            ({
              state: {
                doc: {
                  length: 1000,
                },
                selection: { main: { from: 0 } },
              },
              dispatch: vi.fn(),
              focus: vi.fn(),
            } as unknown as EditorView)
          }
          viewMode="inline"
          focusedSide={null}
        />
      );

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Flush debounce timer and React updates
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      const status = screen.getByRole('status');
      expect(status).not.toHaveTextContent('(Left)');
      expect(status).not.toHaveTextContent('(Right)');
    });
  });

  describe('split mode view selection', () => {
    it('uses clicked side editor in split mode', () => {
      // Create mock DOM elements for click detection
      const leftDom = document.createElement('div');
      const rightDom = document.createElement('div');
      document.body.appendChild(leftDom);
      document.body.appendChild(rightDom);

      const leftView = { id: 'left', dom: leftDom } as unknown as EditorView;
      const rightView = { id: 'right', dom: rightDom } as unknown as EditorView;

      let activeEditor: EditorView | null = null;
      // Use object wrapper to avoid TypeScript narrowing issues with closure assignment
      const hookRef: { getActiveEditor: (() => EditorView | null) | null } = { getActiveEditor: null };

      render(
        <TestWrapper
          options={{
            viewMode: 'split',
            getUnifiedView: () => null,
            getLeftView: () => leftView,
            getRightView: () => rightView,
            getFocusedSide: () => null,
          }}
        >
          {(hookResult) => {
            hookRef.getActiveEditor = hookResult.getActiveEditor;
            activeEditor = hookResult.getActiveEditor();
            return null;
          }}
        </TestWrapper>
      );

      // Default should be right
      expect(activeEditor).toBe(rightView);

      // Simulate click on left editor
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true });
        leftDom.dispatchEvent(event);
      });

      // Now getActiveEditor should return left
      expect(hookRef.getActiveEditor).not.toBeNull();
      expect(hookRef.getActiveEditor?.()).toBe(leftView);

      // Cleanup
      document.body.removeChild(leftDom);
      document.body.removeChild(rightDom);
    });

    it('defaults to right editor when no side is clicked in split mode', () => {
      const leftView = { id: 'left' } as unknown as EditorView;
      const rightView = { id: 'right' } as unknown as EditorView;

      let activeEditor: EditorView | null = null;

      render(
        <TestWrapper
          options={{
            viewMode: 'split',
            getUnifiedView: () => null,
            getLeftView: () => leftView,
            getRightView: () => rightView,
            getFocusedSide: () => null,
          }}
        >
          {(hookResult) => {
            activeEditor = hookResult.getActiveEditor();
            return null;
          }}
        </TestWrapper>
      );

      expect(activeEditor).toBe(rightView);
    });
  });
});
