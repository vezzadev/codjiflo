/**
 * useSearchPanel Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchPanel, type UseSearchPanelOptions } from './useSearchPanel';
import type { EditorView } from '@codemirror/view';

describe('useSearchPanel', () => {
  // Mock EditorView instances
  const mockUnifiedView = { focus: vi.fn() } as unknown as EditorView;
  const mockLeftView = { focus: vi.fn() } as unknown as EditorView;
  const mockRightView = { focus: vi.fn() } as unknown as EditorView;

  const createOptions = (overrides: Partial<UseSearchPanelOptions> = {}): UseSearchPanelOptions => ({
    viewMode: 'inline',
    getUnifiedView: () => mockUnifiedView,
    getLeftView: () => mockLeftView,
    getRightView: () => mockRightView,
    getFocusedSide: () => null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns panels closed by default', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      expect(result.current.searchPanelOpen).toBe(false);
      expect(result.current.goToLinePanelOpen).toBe(false);
    });
  });

  describe('getActiveEditor', () => {
    it('returns unified view in inline mode', () => {
      const { result } = renderHook(() =>
        useSearchPanel(
          createOptions({
            viewMode: 'inline',
          })
        )
      );

      expect(result.current.getActiveEditor()).toBe(mockUnifiedView);
    });

    it('returns right view in split mode by default', () => {
      const { result } = renderHook(() =>
        useSearchPanel(
          createOptions({
            viewMode: 'split',
            getFocusedSide: () => null,
          })
        )
      );

      expect(result.current.getActiveEditor()).toBe(mockRightView);
    });

    it('returns left view when left editor is clicked in split mode', () => {
      // Create mock DOM elements
      const leftDom = document.createElement('div');
      const rightDom = document.createElement('div');
      document.body.appendChild(leftDom);
      document.body.appendChild(rightDom);

      const mockLeftWithDom = { focus: vi.fn(), dom: leftDom } as unknown as EditorView;
      const mockRightWithDom = { focus: vi.fn(), dom: rightDom } as unknown as EditorView;

      const { result } = renderHook(() =>
        useSearchPanel(
          createOptions({
            viewMode: 'split',
            getLeftView: () => mockLeftWithDom,
            getRightView: () => mockRightWithDom,
            getFocusedSide: () => null,
          })
        )
      );

      // Simulate click on left editor
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true });
        leftDom.dispatchEvent(event);
      });

      expect(result.current.getActiveEditor()).toBe(mockLeftWithDom);

      // Cleanup
      document.body.removeChild(leftDom);
      document.body.removeChild(rightDom);
    });

    it('returns right view when right editor is clicked in split mode', () => {
      // Create mock DOM elements
      const leftDom = document.createElement('div');
      const rightDom = document.createElement('div');
      document.body.appendChild(leftDom);
      document.body.appendChild(rightDom);

      const mockLeftWithDom = { focus: vi.fn(), dom: leftDom } as unknown as EditorView;
      const mockRightWithDom = { focus: vi.fn(), dom: rightDom } as unknown as EditorView;

      const { result } = renderHook(() =>
        useSearchPanel(
          createOptions({
            viewMode: 'split',
            getLeftView: () => mockLeftWithDom,
            getRightView: () => mockRightWithDom,
            getFocusedSide: () => null,
          })
        )
      );

      // Simulate click on right editor
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true });
        rightDom.dispatchEvent(event);
      });

      expect(result.current.getActiveEditor()).toBe(mockRightWithDom);

      // Cleanup
      document.body.removeChild(leftDom);
      document.body.removeChild(rightDom);
    });

    it('falls back to left view if right is null in split mode', () => {
      const { result } = renderHook(() =>
        useSearchPanel(
          createOptions({
            viewMode: 'split',
            getRightView: () => null,
            getFocusedSide: () => null,
          })
        )
      );

      expect(result.current.getActiveEditor()).toBe(mockLeftView);
    });
  });

  describe('openSearchPanel', () => {
    it('opens search panel', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      act(() => {
        result.current.openSearchPanel();
      });

      expect(result.current.searchPanelOpen).toBe(true);
      expect(result.current.goToLinePanelOpen).toBe(false);
    });

    it('closes go-to-line panel when opening search', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      act(() => {
        result.current.openGoToLinePanel();
      });
      expect(result.current.goToLinePanelOpen).toBe(true);

      act(() => {
        result.current.openSearchPanel();
      });

      expect(result.current.searchPanelOpen).toBe(true);
      expect(result.current.goToLinePanelOpen).toBe(false);
    });
  });

  describe('openGoToLinePanel', () => {
    it('opens go-to-line panel', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      act(() => {
        result.current.openGoToLinePanel();
      });

      expect(result.current.goToLinePanelOpen).toBe(true);
      expect(result.current.searchPanelOpen).toBe(false);
    });

    it('closes search panel when opening go-to-line', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      act(() => {
        result.current.openSearchPanel();
      });
      expect(result.current.searchPanelOpen).toBe(true);

      act(() => {
        result.current.openGoToLinePanel();
      });

      expect(result.current.goToLinePanelOpen).toBe(true);
      expect(result.current.searchPanelOpen).toBe(false);
    });
  });

  describe('closeAllPanels', () => {
    it('closes both panels', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      act(() => {
        result.current.openSearchPanel();
      });
      expect(result.current.searchPanelOpen).toBe(true);

      act(() => {
        result.current.closeAllPanels();
      });

      expect(result.current.searchPanelOpen).toBe(false);
      expect(result.current.goToLinePanelOpen).toBe(false);
    });

    it('restores focus to last active editor', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      act(() => {
        result.current.openSearchPanel();
      });

      act(() => {
        result.current.closeAllPanels();
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockUnifiedView.focus).toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('opens search panel on Ctrl+F', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      // Dispatch from a non-input element
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'f',
          ctrlKey: true,
          bubbles: true,
        });
        container.dispatchEvent(event);
      });

      expect(result.current.searchPanelOpen).toBe(true);
    });

    it('opens go-to-line panel on Ctrl+G', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'g',
          ctrlKey: true,
          bubbles: true,
        });
        container.dispatchEvent(event);
      });

      expect(result.current.goToLinePanelOpen).toBe(true);
    });

    it('does not open panel when in input field', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      // Create an input and dispatch event from it
      const input = document.createElement('input');
      container.appendChild(input);
      input.focus();

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'f',
          ctrlKey: true,
          bubbles: true,
        });
        input.dispatchEvent(event);
      });

      // Panel should not open since we're in an input
      expect(result.current.searchPanelOpen).toBe(false);
    });

    it('allows shortcut from inside search panel input', () => {
      const { result } = renderHook(() => useSearchPanel(createOptions()));

      // Create a search panel with input
      const panel = document.createElement('div');
      panel.className = 'diff-search-panel';
      const input = document.createElement('input');
      panel.appendChild(input);
      container.appendChild(panel);
      input.focus();

      // First open the panel via method
      act(() => {
        result.current.openSearchPanel();
      });
      expect(result.current.searchPanelOpen).toBe(true);

      // Now Ctrl+G should still work from inside the panel
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'g',
          ctrlKey: true,
          bubbles: true,
        });
        input.dispatchEvent(event);
      });

      expect(result.current.goToLinePanelOpen).toBe(true);
    });
  });
});
