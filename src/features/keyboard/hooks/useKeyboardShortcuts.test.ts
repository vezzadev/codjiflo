import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, getShortcutsList } from './useKeyboardShortcuts';
import { useDiffStore } from '@/features/diff';
import { useFileDisplayOrder } from '@/features/diff/hooks';
import { PR_DESCRIPTION_INDEX } from '@/features/diff/stores';
import type { IterationAwareFile } from '@/features/diff/hooks/useIterationAwareFiles';
import { FileChangeStatus } from '@/api/types';

vi.mock('@/features/diff', () => ({
  useDiffStore: vi.fn(),
}));

vi.mock('@/features/diff/hooks', () => ({
  useFileDisplayOrder: vi.fn(),
}));

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

    // Mock useFileDisplayOrder to return mock files
    vi.mocked(useFileDisplayOrder).mockReturnValue({
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
    it('navigates through files in sorted order regardless of originalIndex order (Issue #261)', () => {
      // This test verifies the fix for Issue #261: keyboard navigation follows
      // display order (grouped by folder), not originalIndex order.
      //
      // Files in display order (as returned by useFileDisplayOrder):
      // - Position 0: alpha.ts (originalIndex: 1)
      // - Position 1: middle.ts (originalIndex: 2)
      // - Position 2: zebra.ts (originalIndex: 0)
      //
      // Note: originalIndex values are non-sequential because they represent
      // positions in the original API response, not the display order.
      //
      // When on zebra.ts (originalIndex: 0, display position 2) and pressing 'w':
      // - Should navigate to middle.ts (originalIndex: 2, display position 1)
      // - NOT to the file with originalIndex - 1
      const filesInDisplayOrder: IterationAwareFile[] = [
        {
          filename: 'alpha.ts', // First alphabetically
          status: FileChangeStatus.Modified,
          additions: 5,
          deletions: 2,
          changes: 7,
          patch: '',
          originalIndex: 1, // Middle in original API order
        },
        {
          filename: 'middle.ts', // Middle alphabetically
          status: FileChangeStatus.Modified,
          additions: 5,
          deletions: 2,
          changes: 7,
          patch: '',
          originalIndex: 2, // Last in original API order
        },
        {
          filename: 'zebra.ts', // Last alphabetically
          status: FileChangeStatus.Modified,
          additions: 5,
          deletions: 2,
          changes: 7,
          patch: '',
          originalIndex: 0, // FIRST in original API order
        },
      ];

      vi.mocked(useFileDisplayOrder).mockReturnValue({
        files: filesInDisplayOrder,
        isIterationMode: false,
        totalFilesInPR: 3,
      });

      // Start on zebra.ts (originalIndex: 0, which is LAST in sorted order)
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: 0, // zebra.ts by originalIndex
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      // Press 'w' to go to previous file
      const wEvent = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(wEvent);

      // zebra.ts is at position 2 (last) in sorted array
      // Previous file should be middle.ts (originalIndex: 2)
      expect(mockSelectFile).toHaveBeenCalledWith(2);
    });

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
      vi.mocked(useFileDisplayOrder).mockReturnValue({
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

    it('navigates to PR description when s is pressed and current file is filtered out', () => {
      // Simulate a file that was selected but is now filtered out in iteration mode
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: 99, // File not in iteration-aware files list
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(event);

      // Should navigate to PR description as a safe fallback
      expect(mockSelectFile).toHaveBeenCalledWith(PR_DESCRIPTION_INDEX);
    });

    it('navigates to PR description when w is pressed and current file is filtered out', () => {
      // Simulate a file that was selected but is now filtered out in iteration mode
      vi.mocked(useDiffStore).mockImplementation((selector) => {
        const state = {
          selectedFileIndex: 99, // File not in iteration-aware files list
          selectFile: mockSelectFile,
          scrollToNextChange: mockScrollToNextChange,
          scrollToPreviousChange: mockScrollToPreviousChange,
        };
        return selector(state as never);
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      // Should navigate to PR description as a safe fallback
      expect(mockSelectFile).toHaveBeenCalledWith(PR_DESCRIPTION_INDEX);
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
      { key: 'Ctrl+F', description: 'Find in diff' },
      { key: 'Ctrl+G', description: 'Go to line' },
      { key: 'F3', description: 'Find next' },
      { key: 'Shift+F3', description: 'Find previous' },
      { key: 'i', description: 'Inline view' },
      { key: 'x', description: 'Side-by-side view' },
      { key: 'l', description: 'Left only (deletions)' },
      { key: 'o', description: 'Show both sides' },
      { key: 'r', description: 'Right only (additions)' },
      { key: 'f', description: 'Show full file' },
      { key: 'c', description: 'Show changes only' },
      { key: 'b', description: 'Toggle whitespace visibility' },
      { key: 'd', description: 'Toggle show/hide comments' },
      { key: 'p', description: 'Toggle text wrap' },
      { key: '↑/↓ (files)', description: 'Navigate files (file list focused)' },
      { key: 'PgUp/PgDn (files)', description: 'Jump 10 files (file list focused)' },
      { key: 'PgUp/PgDn (diff)', description: 'Page scroll (diff area focused)' },
      { key: 'Home/End (diff)', description: 'Jump to start/end (diff area focused)' },
    ]);
  });
});
