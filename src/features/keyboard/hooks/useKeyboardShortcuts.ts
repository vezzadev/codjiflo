import { useEffect, useCallback } from 'react';
import { useDiffStore } from '@/features/diff';
import { DiffViewMode } from '@/features/diff/types';

/**
 * Global keyboard shortcuts hook
 * S-1.5: AC-1.5.1 through AC-1.5.3
 * S-3.3: AC-3.3.4 (View mode keyboard shortcuts)
 */
export function useKeyboardShortcuts() {
  const selectNextFile = useDiffStore((s) => s.selectNextFile);
  const selectPreviousFile = useDiffStore((s) => s.selectPreviousFile);
  const setViewMode = useDiffStore((s) => s.setViewMode);

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

    switch (event.key.toLowerCase()) {
      // AC-1.5.1: j = Next file
      case 'j':
        event.preventDefault();
        selectNextFile();
        break;

      // AC-1.5.1: k = Previous file
      case 'k':
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

      // AC-3.3.4: u = Unified view
      case 'u':
        event.preventDefault();
        setViewMode(DiffViewMode.Inline);
        break;

      // AC-3.3.4: s = Side-by-side view
      case 's':
        event.preventDefault();
        setViewMode(DiffViewMode.SideBySide);
        break;
    }
  }, [selectNextFile, selectPreviousFile, setViewMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Returns list of available shortcuts for documentation
 * S-1.5: AC-1.5.4, AC-1.5.5
 * S-3.3: AC-3.3.4
 */
export function getShortcutsList(): { key: string; description: string }[] {
  return [
    { key: 'j', description: 'Next file' },
    { key: 'k', description: 'Previous file' },
    { key: 'Space', description: 'Scroll down in diff view' },
    { key: 'u', description: 'Switch to Unified diff view' },
    { key: 's', description: 'Switch to Side-by-side diff view' },
  ];
}
