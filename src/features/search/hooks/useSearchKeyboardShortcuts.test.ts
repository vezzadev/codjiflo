/**
 * Tests for useSearchKeyboardShortcuts hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSearchKeyboardShortcuts } from './useSearchKeyboardShortcuts';
import { useSearchStore } from '../stores';
import { DEFAULT_SEARCH_OPTIONS } from '../types';

describe('useSearchKeyboardShortcuts', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fireKeyDown(key: string, options: KeyboardEventInit = {}, target?: HTMLElement) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ...options,
    });
    // Set the target if provided
    if (target) {
      Object.defineProperty(event, 'target', { value: target, writable: false });
    } else {
      // Default to document.body which has hasAttribute
      Object.defineProperty(event, 'target', { value: document.body, writable: false });
    }
    window.dispatchEvent(event);
  }

  it('opens find in file on Ctrl+F', () => {
    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('f', { ctrlKey: true });

    expect(useSearchStore.getState().mode).toBe('current-file');
  });

  it('opens find in file on Meta+F (Mac)', () => {
    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('f', { metaKey: true });

    expect(useSearchStore.getState().mode).toBe('current-file');
  });

  it('opens find in all files on Ctrl+Shift+F', () => {
    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('f', { ctrlKey: true, shiftKey: true });

    expect(useSearchStore.getState().mode).toBe('all-files');
  });

  it('opens find in all files on Ctrl+Shift+F (uppercase F)', () => {
    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('F', { ctrlKey: true, shiftKey: true });

    expect(useSearchStore.getState().mode).toBe('all-files');
  });

  it('opens find in all files on Meta+Shift+F (Mac)', () => {
    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('f', { metaKey: true, shiftKey: true });

    expect(useSearchStore.getState().mode).toBe('all-files');
  });

  it('navigates to next match on F3 when in current-file mode', () => {
    useSearchStore.setState({
      mode: 'current-file',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 3, lineContent: 'foo', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 3, lineContent: 'foo', side: 'both' },
      ],
      currentMatchIndex: 0,
    });

    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('F3');

    expect(useSearchStore.getState().currentMatchIndex).toBe(1);
  });

  it('navigates to previous match on Shift+F3 when in current-file mode', () => {
    useSearchStore.setState({
      mode: 'current-file',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 3, lineContent: 'foo', side: 'both' },
        { lineIndex: 1, columnStart: 0, columnEnd: 3, lineContent: 'foo', side: 'both' },
      ],
      currentMatchIndex: 1,
    });

    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('F3', { shiftKey: true });

    expect(useSearchStore.getState().currentMatchIndex).toBe(0);
  });

  it('does not navigate matches on F3 when mode is closed', () => {
    useSearchStore.setState({
      mode: 'closed',
      currentFileMatches: [
        { lineIndex: 0, columnStart: 0, columnEnd: 3, lineContent: 'foo', side: 'both' },
      ],
      currentMatchIndex: 0,
    });

    renderHook(() => useSearchKeyboardShortcuts());

    fireKeyDown('F3');

    // Index should remain unchanged
    expect(useSearchStore.getState().currentMatchIndex).toBe(0);
  });

  it('handles Ctrl+F when focus is in input element', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    renderHook(() => useSearchKeyboardShortcuts());

    // Ctrl+F should work even when in input (it always opens search)
    fireKeyDown('f', { ctrlKey: true }, input);

    expect(useSearchStore.getState().mode).toBe('current-file');

    document.body.removeChild(input);
  });

  it('handles Ctrl+F when focus is in search input with data-search-input attribute', () => {
    const input = document.createElement('input');
    input.setAttribute('data-search-input', '');
    document.body.appendChild(input);

    renderHook(() => useSearchKeyboardShortcuts());

    // Ctrl+F should still work
    fireKeyDown('f', { ctrlKey: true }, input);

    expect(useSearchStore.getState().mode).toBe('current-file');

    document.body.removeChild(input);
  });

  it('cleans up event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useSearchKeyboardShortcuts());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
