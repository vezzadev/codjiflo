import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRowFocus, useIsRowFocusActive } from './useRowFocus';
import { useDiffStore } from '../stores/useDiffStore';

describe('useRowFocus', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useDiffStore.setState({ focusedRowIndex: null });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('focusedRowIndex state', () => {
    it('returns null when no row is focused', () => {
      const { result } = renderHook(() => useRowFocus(10));
      expect(result.current.focusedRowIndex).toBeNull();
    });

    it('updates focusedRowIndex when setFocusedRow is called', () => {
      const { result } = renderHook(() => useRowFocus(10));

      act(() => {
        result.current.setFocusedRow(5);
      });

      expect(result.current.focusedRowIndex).toBe(5);
    });

    it('clears focusedRowIndex when clearRowFocus is called', () => {
      const { result } = renderHook(() => useRowFocus(10));

      act(() => {
        result.current.setFocusedRow(5);
      });
      expect(result.current.focusedRowIndex).toBe(5);

      act(() => {
        result.current.clearRowFocus();
      });
      expect(result.current.focusedRowIndex).toBeNull();
    });
  });

  describe('handleRowClick', () => {
    it('sets focusedRowIndex when a row is clicked', () => {
      const { result } = renderHook(() => useRowFocus(10));

      const mockEvent = {
        target: document.createElement('span'),
        clientX: 100,
        clientY: 50,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleRowClick(mockEvent, 3);
      });

      expect(result.current.focusedRowIndex).toBe(3);
    });

    it('does not set focus when clicking on a button', () => {
      const { result } = renderHook(() => useRowFocus(10));

      const button = document.createElement('button');
      const mockEvent = {
        target: button,
        clientX: 100,
        clientY: 50,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleRowClick(mockEvent, 3);
      });

      expect(result.current.focusedRowIndex).toBeNull();
    });

    it('does not set focus when clicking on a link', () => {
      const { result } = renderHook(() => useRowFocus(10));

      const link = document.createElement('a');
      const mockEvent = {
        target: link,
        clientX: 100,
        clientY: 50,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleRowClick(mockEvent, 3);
      });

      expect(result.current.focusedRowIndex).toBeNull();
    });

    it('does not set focus when clicking inside a button', () => {
      const { result } = renderHook(() => useRowFocus(10));

      const button = document.createElement('button');
      const span = document.createElement('span');
      button.appendChild(span);
      document.body.appendChild(button);

      const mockEvent = {
        target: span,
        clientX: 100,
        clientY: 50,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleRowClick(mockEvent, 3);
      });

      expect(result.current.focusedRowIndex).toBeNull();

      document.body.removeChild(button);
    });
  });

  describe('handleRowKeyDown', () => {
    it('moves focus to previous row on ArrowUp', () => {
      const { result } = renderHook(() => useRowFocus(10));

      // Set initial focus
      act(() => {
        result.current.setFocusedRow(5);
      });

      const preventDefault = vi.fn();
      const mockEvent = {
        key: 'ArrowUp',
        preventDefault,
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleRowKeyDown(mockEvent, 5);
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(result.current.focusedRowIndex).toBe(4);
    });

    it('moves focus to next row on ArrowDown', () => {
      const { result } = renderHook(() => useRowFocus(10));

      // Set initial focus
      act(() => {
        result.current.setFocusedRow(5);
      });

      const preventDefault = vi.fn();
      const mockEvent = {
        key: 'ArrowDown',
        preventDefault,
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleRowKeyDown(mockEvent, 5);
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(result.current.focusedRowIndex).toBe(6);
    });

    it('does not move focus above first row', () => {
      const { result } = renderHook(() => useRowFocus(10));

      // Set initial focus to first row
      act(() => {
        result.current.setFocusedRow(0);
      });

      const preventDefault = vi.fn();
      const mockEvent = {
        key: 'ArrowUp',
        preventDefault,
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleRowKeyDown(mockEvent, 0);
      });

      // Should not prevent default if at first row
      expect(preventDefault).not.toHaveBeenCalled();
      expect(result.current.focusedRowIndex).toBe(0);
    });

    it('does not move focus below last row', () => {
      const { result } = renderHook(() => useRowFocus(10));

      // Set initial focus to last row
      act(() => {
        result.current.setFocusedRow(9);
      });

      const preventDefault = vi.fn();
      const mockEvent = {
        key: 'ArrowDown',
        preventDefault,
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleRowKeyDown(mockEvent, 9);
      });

      // Should not prevent default if at last row
      expect(preventDefault).not.toHaveBeenCalled();
      expect(result.current.focusedRowIndex).toBe(9);
    });

    it('clears focus on Escape', () => {
      // Mock window.getSelection
      const mockGetSelection = vi.spyOn(window, 'getSelection').mockReturnValue({
        removeAllRanges: vi.fn(),
      } as unknown as Selection);

      const { result } = renderHook(() => useRowFocus(10));

      // Set initial focus
      act(() => {
        result.current.setFocusedRow(5);
      });

      const preventDefault = vi.fn();
      const mockEvent = {
        key: 'Escape',
        preventDefault,
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleRowKeyDown(mockEvent, 5);
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(result.current.focusedRowIndex).toBeNull();
      expect(mockGetSelection).toHaveBeenCalled();

      mockGetSelection.mockRestore();
    });

    it('allows other keys to pass through', () => {
      const { result } = renderHook(() => useRowFocus(10));

      // Set initial focus
      act(() => {
        result.current.setFocusedRow(5);
      });

      const preventDefault = vi.fn();
      const mockEvent = {
        key: 'ArrowLeft',
        preventDefault,
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleRowKeyDown(mockEvent, 5);
      });

      // Should not prevent default for arrow left
      expect(preventDefault).not.toHaveBeenCalled();
      // Focus should remain unchanged
      expect(result.current.focusedRowIndex).toBe(5);
    });
  });

  describe('registerRowRef', () => {
    it('registers and unregisters row refs', () => {
      const { result } = renderHook(() => useRowFocus(10));

      const mockElement = document.createElement('tr');

      // Register a ref
      act(() => {
        result.current.registerRowRef(3, mockElement);
      });

      // Unregister by passing null
      act(() => {
        result.current.registerRowRef(3, null);
      });

      // No error should occur
    });
  });
});

describe('useIsRowFocusActive', () => {
  beforeEach(() => {
    useDiffStore.setState({ focusedRowIndex: null });
  });

  it('returns false when no row is focused', () => {
    const { result } = renderHook(() => useIsRowFocusActive());
    expect(result.current).toBe(false);
  });

  it('returns true when a row is focused', () => {
    useDiffStore.setState({ focusedRowIndex: 5 });

    const { result } = renderHook(() => useIsRowFocusActive());
    expect(result.current).toBe(true);
  });

  it('updates when focus state changes', () => {
    const { result } = renderHook(() => useIsRowFocusActive());
    expect(result.current).toBe(false);

    act(() => {
      useDiffStore.setState({ focusedRowIndex: 3 });
    });
    expect(result.current).toBe(true);

    act(() => {
      useDiffStore.setState({ focusedRowIndex: null });
    });
    expect(result.current).toBe(false);
  });
});
