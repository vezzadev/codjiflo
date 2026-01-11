import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, getShortcutsList } from './useKeyboardShortcuts';
import { useDiffStore } from '@/features/diff';
import { useIterationAwareFiles } from '@/features/diff/hooks';
import { PR_DESCRIPTION_INDEX } from '@/features/diff/stores';
import type { IterationAwareFile } from '@/features/diff/hooks/useIterationAwareFiles';
import { FileChangeStatus } from '@/api/types';

vi.mock('@/features/diff', () => ({
  useDiffStore: vi.fn(),
}));

vi.mock('@/features/diff/hooks', () => ({
  useIterationAwareFiles: vi.fn(),
}));

vi.mock('@/features/diff/stores', async () => {
  const actual = await vi.importActual('@/features/diff/stores');
  return {
    ...actual,
    useDiffStore: vi.fn(),
  };
});

describe('useKeyboardShortcuts', () => {
  const mockSelectFile = vi.fn();
  const mockScrollToNextChange = vi.fn();
  const mockScrollToPreviousChange = vi.fn();

  // Mock iteration-aware files
  const mockFiles: IterationAwareFile[] = [
    {
      filename: 'file-a.txt',
      status: FileChangeStatus.Modified,
      additions: 5,
      deletions: 2,
      changes: 7,
      patch: '',
      originalIndex: 0,
    },
    {
      filename: 'file-b.txt',
      status: FileChangeStatus.Added,
      additions: 10,
      deletions: 0,
      changes: 10,
      patch: '',
      originalIndex: 5, // Non-contiguous index (artifact-only file)
    },
    {
      filename: 'file-c.txt',
      status: FileChangeStatus.Modified,
      additions: 3,
      deletions: 1,
      changes: 4,
      patch: '',
      originalIndex: 7,
    },
  ];

  beforeEach(() => {
    // Mock useDiffStore to return selectedFileIndex and selectFile
    vi.mocked(useDiffStore).mockImplementation((selector) => {
      const state = {
        selectedFileIndex: 0,
        selectFile: mockSelectFile,
        scrollToNextChange: mockScrollToNextChange,
        scrollToPreviousChange: mockScrollToPreviousChange,
      };
      return selector(state as never);
    });

    // Mock useIterationAwareFiles to return mock files
    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: mockFiles,
      isIterationMode: false,
      totalFilesInPR: 3,
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

  it('calls scrollToNextChange when j is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    const event = new KeyboardEvent('keydown', { key: 'j' });
    window.dispatchEvent(event);

    expect(mockScrollToNextChange).toHaveBeenCalledTimes(1);
  });

  it('calls scrollToPreviousChange when k is pressed', () => {
    renderHook(() => useKeyboardShortcuts());

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);

    expect(mockScrollToPreviousChange).toHaveBeenCalledTimes(1);
  });

  describe('iteration-aware file navigation (Issue #189)', () => {
    it('navigates to next file when s is pressed', () => {
      // Selected on first file (index 0)
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: 0, // file-a.txt
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event);

      // Should select file-b.txt (originalIndex 5, not 1!)
      expect(mockSelectFile).toHaveBeenCalledWith(5);
    });

    it('navigates to previous file when w is pressed', () => {
      // Selected on second file (index 5)
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: 5, // file-b.txt
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      // Should select file-a.txt (originalIndex 0)
      expect(mockSelectFile).toHaveBeenCalledWith(0);
    });

    it('navigates from PR description to first file when s is pressed', () => {
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: PR_DESCRIPTION_INDEX, // -1
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event);

      // Should select first file (originalIndex 0)
      expect(mockSelectFile).toHaveBeenCalledWith(0);
    });

    it('navigates from first file to PR description when w is pressed', () => {
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: 0, // First file
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      // Should go back to PR description
      expect(mockSelectFile).toHaveBeenCalledWith(PR_DESCRIPTION_INDEX);
    });

    it('does nothing when s is pressed on last file', () => {
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: 7, // Last file (file-c.txt)
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event);

      // Should not navigate (already at last file)
      expect(mockSelectFile).not.toHaveBeenCalled();
    });

    it('does nothing when w is pressed on PR description', () => {
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: PR_DESCRIPTION_INDEX,
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      // Should not navigate (already at start)
      expect(mockSelectFile).not.toHaveBeenCalled();
    });

    it('handles empty file list when s is pressed from PR description', () => {
      vi.mocked(useIterationAwareFiles).mockReturnValue({
        files: [],
        isIterationMode: false,
        totalFilesInPR: 0,
      });

      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: PR_DESCRIPTION_INDEX,
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event);

      // Should not navigate (no files available)
      expect(mockSelectFile).not.toHaveBeenCalled();
    });
  });

  it('does not trigger shortcuts when in input field', () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: 'j' });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(mockScrollToNextChange).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('does not trigger shortcuts when in textarea', () => {
    renderHook(() => useKeyboardShortcuts());

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', { key: 'k' });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(mockScrollToPreviousChange).not.toHaveBeenCalled();

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
  it('returns list of shortcuts', () => {
    const shortcuts = getShortcutsList();

    expect(shortcuts).toEqual([
      { key: 'j', description: 'Next change' },
      { key: 'k', description: 'Previous change' },
      { key: 's', description: 'Next file' },
      { key: 'w', description: 'Previous file' },
      { key: 'Space', description: 'Scroll down in diff view' },
      { key: 'i', description: 'Inline view' },
      { key: 'x', description: 'Side-by-side view' },
      { key: 'l', description: 'Left only (deletions)' },
      { key: 'o', description: 'Show both sides' },
      { key: 'r', description: 'Right only (additions)' },
      { key: 'f', description: 'Show full file' },
      { key: 'c', description: 'Show changes only' },
      { key: 'b', description: 'Toggle whitespace visibility' },
    ]);
  });
});
