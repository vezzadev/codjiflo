/**
 * CodeMirror Search Highlights Extension
 *
 * Provides highlighting for search matches in the diff editor.
 * Supports both "highlight all" mode and single current match highlight.
 */

import {
  StateField,
  StateEffect,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
} from '@codemirror/view';
import type { SearchMatch } from '../types';

// ============================================================================
// State Effects
// ============================================================================

/**
 * Effect to set search matches for highlighting
 */
export const setSearchMatches = StateEffect.define<{
  matches: SearchMatch[];
  currentIndex: number;
  highlightAll: boolean;
}>();

/**
 * Effect to clear all search highlights
 */
export const clearSearchMatches = StateEffect.define();

// ============================================================================
// Decorations
// ============================================================================

const searchMatchMark = Decoration.mark({ class: 'cm-searchMatch' });
const currentSearchMatchMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-current' });

// ============================================================================
// State Field
// ============================================================================

interface SearchHighlightState {
  matches: SearchMatch[];
  currentIndex: number;
  highlightAll: boolean;
}

const searchHighlightField = StateField.define<SearchHighlightState>({
  create() {
    return { matches: [], currentIndex: -1, highlightAll: true };
  },

  update(state, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatches)) {
        return {
          matches: effect.value.matches,
          currentIndex: effect.value.currentIndex,
          highlightAll: effect.value.highlightAll,
        };
      }
      if (effect.is(clearSearchMatches)) {
        return { matches: [], currentIndex: -1, highlightAll: true };
      }
    }
    return state;
  },
});

// ============================================================================
// Decoration Provider
// ============================================================================

function createDecorations(
  state: SearchHighlightState,
  doc: { line: (n: number) => { from: number; to: number } }
): DecorationSet {
  const { matches, currentIndex, highlightAll } = state;

  if (matches.length === 0) {
    return Decoration.none;
  }

  const decorations: { from: number; to: number; mark: Decoration }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!match) continue;

    const isCurrent = i === currentIndex;

    // Skip non-current matches if highlightAll is false
    if (!highlightAll && !isCurrent) continue;

    try {
      // lineIndex is 0-based, doc.line is 1-based
      const line = doc.line(match.lineIndex + 1);
      const from = line.from + match.columnStart;
      const to = line.from + match.columnEnd;

      // Ensure we don't exceed line bounds
      if (to <= line.to) {
        decorations.push({
          from,
          to,
          mark: isCurrent ? currentSearchMatchMark : searchMatchMark,
        });
      }
    } catch {
      // Line doesn't exist (might happen with stale matches)
      continue;
    }
  }

  // Sort decorations by position (required by RangeSet)
  decorations.sort((a, b) => a.from - b.from);

  return Decoration.set(
    decorations.map((d) => d.mark.range(d.from, d.to))
  );
}

const searchHighlightDecorations = EditorView.decorations.compute(
  [searchHighlightField],
  (state) => {
    const highlightState = state.field(searchHighlightField);
    return createDecorations(highlightState, state.doc);
  }
);

// ============================================================================
// Extension
// ============================================================================

/**
 * CodeMirror extension for search match highlighting
 */
export function searchHighlights(): Extension {
  return [searchHighlightField, searchHighlightDecorations];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update search highlights in an editor view
 */
export function updateSearchHighlights(
  view: EditorView,
  matches: SearchMatch[],
  currentIndex: number,
  highlightAll: boolean
): void {
  view.dispatch({
    effects: setSearchMatches.of({ matches, currentIndex, highlightAll }),
  });
}

/**
 * Clear search highlights from an editor view
 */
export function clearSearchHighlights(view: EditorView): void {
  view.dispatch({
    effects: clearSearchMatches.of(null),
  });
}
