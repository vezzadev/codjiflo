/**
 * SearchPanel Integration Tests
 *
 * Tests the integration between useSearchPanel hook and the panel components.
 * Actual CodeMirror search functionality is tested in E2E tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers';
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
    it('Escape closes search panel', () => {
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

  describe('split mode view selection', () => {
    it('uses focused side editor in split mode', () => {
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
            getFocusedSide: () => 'left',
          }}
        >
          {(hookResult) => {
            activeEditor = hookResult.getActiveEditor();
            return null;
          }}
        </TestWrapper>
      );

      expect(activeEditor).toBe(leftView);
    });

    it('defaults to right editor when no side is focused in split mode', () => {
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
