/**
 * Diff Keymap Extension for CodeMirror 6
 *
 * Provides keyboard shortcuts for diff navigation (j/k for hunks).
 */

import { StateField, StateEffect, type Extension } from '@codemirror/state';
import { keymap, EditorView } from '@codemirror/view';
import type { KeyBinding } from '@codemirror/view';

/**
 * Configuration for the diff keymap.
 */
export interface DiffKeymapConfig {
  /** Hunk indices (line indices where hunks start) */
  hunkIndices?: number[];
  /** Callback when navigating to next hunk */
  onNextHunk?: (index: number) => void;
  /** Callback when navigating to previous hunk */
  onPreviousHunk?: (index: number) => void;
  /** Callback for custom page scroll */
  onPageScroll?: (direction: 'up' | 'down') => void;
  /** Context lines to show above target when scrolling */
  contextLines?: number;
}

/**
 * State effect to update hunk indices.
 */
export const setHunkIndices = StateEffect.define<number[]>();

/**
 * State field to store current hunk index and hunk positions.
 */
interface DiffNavigationState {
  hunkIndices: number[];
  currentHunkIndex: number;
}

const diffNavigationState = StateField.define<DiffNavigationState>({
  create() {
    return { hunkIndices: [], currentHunkIndex: -1 };
  },
  update(state, tr) {
    let { hunkIndices, currentHunkIndex } = state;
    for (const effect of tr.effects) {
      if (effect.is(setHunkIndices)) {
        hunkIndices = effect.value;
        // Reset current index when hunks change
        currentHunkIndex = -1;
      }
    }
    return { hunkIndices, currentHunkIndex };
  },
});

/**
 * Scrolls to a specific line with context.
 */
function scrollToLine(view: EditorView, lineIndex: number, contextLines: number): void {
  const doc = view.state.doc;
  if (lineIndex < 0 || lineIndex >= doc.lines) return;

  // Calculate target line with context
  const targetLine = Math.max(1, lineIndex + 1 - contextLines);
  const lineInfo = doc.line(targetLine);

  // Get coordinates and scroll
  const coords = view.coordsAtPos(lineInfo.from);
  if (coords) {
    view.scrollDOM.scrollTo({
      top: view.scrollDOM.scrollTop + coords.top - view.documentTop - 10,
      behavior: 'smooth',
    });
  }
}

/**
 * Creates key bindings for diff navigation.
 */
function createDiffKeyBindings(config: DiffKeymapConfig): KeyBinding[] {
  const { contextLines = 3, onNextHunk, onPreviousHunk, onPageScroll } = config;

  return [
    // j - Go to next hunk
    {
      key: 'j',
      run(view) {
        const state = view.state.field(diffNavigationState, false);
        if (!state || state.hunkIndices.length === 0) return false;

        const nextIndex = Math.min(state.currentHunkIndex + 1, state.hunkIndices.length - 1);
        const lineIndex = state.hunkIndices[nextIndex];

        if (lineIndex !== undefined) {
          scrollToLine(view, lineIndex, contextLines);
          onNextHunk?.(nextIndex);
        }

        return true;
      },
    },

    // k - Go to previous hunk
    {
      key: 'k',
      run(view) {
        const state = view.state.field(diffNavigationState, false);
        if (!state || state.hunkIndices.length === 0) return false;

        const prevIndex = Math.max(state.currentHunkIndex - 1, 0);
        const lineIndex = state.hunkIndices[prevIndex];

        if (lineIndex !== undefined) {
          scrollToLine(view, lineIndex, contextLines);
          onPreviousHunk?.(prevIndex);
        }

        return true;
      },
    },

    // PageDown - Scroll down one page
    {
      key: 'PageDown',
      run(view) {
        if (onPageScroll) {
          onPageScroll('down');
          return true;
        }

        const scrollAmount = view.scrollDOM.clientHeight - 50; // Leave some overlap
        view.scrollDOM.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        return true;
      },
    },

    // PageUp - Scroll up one page
    {
      key: 'PageUp',
      run(view) {
        if (onPageScroll) {
          onPageScroll('up');
          return true;
        }

        const scrollAmount = view.scrollDOM.clientHeight - 50;
        view.scrollDOM.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        return true;
      },
    },

    // Home - Go to start
    {
      key: 'Home',
      run(view) {
        view.scrollDOM.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      },
    },

    // End - Go to end
    {
      key: 'End',
      run(view) {
        const maxScroll = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
        view.scrollDOM.scrollTo({ top: maxScroll, behavior: 'smooth' });
        return true;
      },
    },
  ];
}

/**
 * Creates the diff keymap extension.
 *
 * Usage:
 * ```ts
 * const extensions = [
 *   createDiffKeymap({
 *     hunkIndices: [0, 15, 42],
 *     onNextHunk: (index) => console.log('Next hunk:', index),
 *   }),
 * ];
 *
 * // Update hunk indices:
 * view.dispatch({
 *   effects: setHunkIndices.of([0, 20, 55]),
 * });
 * ```
 */
export function createDiffKeymap(config: DiffKeymapConfig = {}): Extension {
  const { hunkIndices = [] } = config;

  return [
    diffNavigationState.init(() => ({ hunkIndices, currentHunkIndex: -1 })),
    keymap.of(createDiffKeyBindings(config)),
  ];
}

/**
 * Convenience export for backward compatibility.
 */
export const diffKeymap = createDiffKeymap;
