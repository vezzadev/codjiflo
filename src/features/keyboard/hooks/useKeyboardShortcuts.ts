import { useEffect, useCallback } from 'react';
import { useDiffStore } from '@/features/diff';
import { useFileDisplayOrder } from '@/features/diff/hooks';
import { PR_DESCRIPTION_INDEX } from '@/features/diff/stores';

/**
 * Global keyboard shortcuts hook
 * S-1.5: AC-1.5.1 through AC-1.5.3
 * M4: Iteration-aware file navigation (Issue #189)
 */
export function useKeyboardShortcuts() {
  const selectedFileIndex = useDiffStore((s) => s.selectedFileIndex);
  const selectFile = useDiffStore((s) => s.selectFile);
  const scrollToNextChange = useDiffStore((s) => s.scrollToNextChange);
  const scrollToPreviousChange = useDiffStore((s) => s.scrollToPreviousChange);
  // Issue #261: Use display order (grouped by folder) for navigation
  const { files } = useFileDisplayOrder();

  // Iteration-aware file navigation (Issue #189)
  // Navigate through the same file list that FileList displays
  const selectNextFile = useCallback(() => {
    // If on PR description, go to first file
    if (selectedFileIndex === PR_DESCRIPTION_INDEX) {
      const firstFile = files[0];
      if (firstFile) {
        selectFile(firstFile.originalIndex);
      }
      return;
    }

    // Find current position in visible files
    const currentPos = files.findIndex((f) => f.originalIndex === selectedFileIndex);

    if (currentPos >= 0 && currentPos < files.length - 1) {
      // Current file found and not the last one - go to next
      const nextFile = files[currentPos + 1];
      if (nextFile) {
        selectFile(nextFile.originalIndex);
      }
    } else if (currentPos === -1 && selectedFileIndex !== PR_DESCRIPTION_INDEX) {
      // Current file filtered out (e.g., iteration switch) - go to PR description
      selectFile(PR_DESCRIPTION_INDEX);
    }
  }, [selectedFileIndex, files, selectFile]);

  const selectPreviousFile = useCallback(() => {
    // Find current position in visible files
    const currentPos = files.findIndex((f) => f.originalIndex === selectedFileIndex);

    if (currentPos > 0) {
      // Go to previous file in the list
      const prevFile = files[currentPos - 1];
      if (prevFile) {
        selectFile(prevFile.originalIndex);
      }
    } else if (currentPos === 0 || (currentPos === -1 && selectedFileIndex !== PR_DESCRIPTION_INDEX)) {
      // If at first file OR current file filtered out - go to PR description
      selectFile(PR_DESCRIPTION_INDEX);
    }
    // If selectedFileIndex is PR_DESCRIPTION_INDEX, do nothing (already at start)
  }, [selectedFileIndex, files, selectFile]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // AC-1.5.3: Don't trigger if user is in an input field
    const target = event.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    ) {
      return;
    }

    switch (event.key) {
      // j = Next change (within file)
      case 'j':
        event.preventDefault();
        scrollToNextChange();
        break;

      // k = Previous change (within file)
      case 'k':
        event.preventDefault();
        scrollToPreviousChange();
        break;

      // s = Next file (iteration-aware)
      case 's':
        event.preventDefault();
        selectNextFile();
        break;

      // w = Previous file (iteration-aware)
      case 'w':
        event.preventDefault();
        selectPreviousFile();
        break;

      // AC-1.5.2: Space = Scroll down in diff view
      case ' ': {
        event.preventDefault();
        const diffRegion = document.querySelector('[role="region"][aria-label^="Diff content"]');
        if (diffRegion) {
          diffRegion.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        }
        break;
      }
    }
  }, [selectNextFile, selectPreviousFile, scrollToNextChange, scrollToPreviousChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Returns list of available shortcuts for documentation
 * S-1.5: AC-1.5.4, AC-1.5.5
 */
export function getShortcutsList(): { key: string; description: string }[] {
  return [
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
    { key: 'd', description: 'Toggle show/hide comments' },
  ];
}
