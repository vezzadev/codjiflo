import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, getShortcutsList } from './useKeyboardShortcuts';
import { useDiffStore } from '@/features/diff';
import { DiffViewMode } from '@/features/diff/types';

vi.mock('@/features/diff', () => ({
  useDiffStore: vi.fn(),
  DiffViewMode: {
    Inline: 'inline',
    SideBySide: 'side_by_side',
    LeftOnly: 'left_only',
    RightOnly: 'right_only',
  },
}));

describe('useKeyboardShortcuts', () => {
  const mockSelectNextFile = vi.fn();
  const mockSelectPreviousFile = vi.fn();
  const mockSetViewMode = vi.fn();

  beforeEach(() => {
    vi.mocked(useDiffStore).mockImplementation((selector) => {
      const state = {
        selectNextFile: mockSelectNextFile,
        selectPreviousFile: mockSelectPreviousFile,
        setViewMode: mockSetViewMode,
      };
      return selector(state as never);
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds keydown event listener on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useKeyboardShortcuts());

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes keydown event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('calls selectNextFile when j is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    const event = new KeyboardEvent('keydown', { key: 'j' });
    window.dispatchEvent(event);

    expect(mockSelectNextFile).toHaveBeenCalledTimes(1);
  });

  it('calls selectPreviousFile when k is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);

    expect(mockSelectPreviousFile).toHaveBeenCalledTimes(1);
  });

  it('calls setViewMode with Inline when u is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    const event = new KeyboardEvent('keydown', { key: 'u' });
    window.dispatchEvent(event);

    expect(mockSetViewMode).toHaveBeenCalledWith(DiffViewMode.Inline);
  });

  it('calls setViewMode with SideBySide when s is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    const event = new KeyboardEvent('keydown', { key: 's' });
    window.dispatchEvent(event);

    expect(mockSetViewMode).toHaveBeenCalledWith(DiffViewMode.SideBySide);
  });

  it('does not trigger shortcuts when in input field', () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: 'j' });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(mockSelectNextFile).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('does not trigger shortcuts when in textarea', () => {
    renderHook(() => useKeyboardShortcuts());

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', { key: 'k' });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(mockSelectPreviousFile).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('scrolls diff region when space is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    // Create a mock diff region element
    const diffRegion = document.createElement('div');
    diffRegion.setAttribute('role', 'region');
    diffRegion.setAttribute('aria-label', 'Diff content for test.ts');
     
    diffRegion.scrollBy = vi.fn();
    document.body.appendChild(diffRegion);

    // Mock window.innerHeight
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });

    const event = new KeyboardEvent('keydown', { key: ' ' });
    window.dispatchEvent(event);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(diffRegion.scrollBy).toHaveBeenCalledWith({
      top: 640, // 800 * 0.8
      behavior: 'smooth',
    });

    document.body.removeChild(diffRegion);
  });

  it('does nothing when space is pressed without diff region', () => {
    renderHook(() => useKeyboardShortcuts());

    // Don't add a diff region element

    // This should not throw
    const event = new KeyboardEvent('keydown', { key: ' ' });
    expect(() => window.dispatchEvent(event)).not.toThrow();
  });
});

describe('getShortcutsList', () => {
  it('returns list of shortcuts including view mode shortcuts', () => {
    const shortcuts = getShortcutsList();

    expect(shortcuts).toEqual([
      { key: 'j', description: 'Next file' },
      { key: 'k', description: 'Previous file' },
      { key: 'Space', description: 'Scroll down in diff view' },
      { key: 'u', description: 'Switch to Unified diff view' },
      { key: 's', description: 'Switch to Side-by-side diff view' },
    ]);
  });
});
