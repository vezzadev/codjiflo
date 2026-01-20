/**
 * Diff Decorations Extension for CodeMirror 6
 *
 * Provides line-level and word-level decorations for diff highlighting.
 * Uses StateField to manage decorations based on ParsedDiffLine[] data.
 */

import {
  StateField,
  StateEffect,
  type Extension,
  RangeSetBuilder,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import type { ParsedDiffLine } from '../../../types';
import { diffThemeClasses } from './diff-theme';

/**
 * Configuration for diff decorations.
 */
export interface DiffDecorationConfig {
  /** Initial diff lines (optional, can be set via effect) */
  diffLines?: ParsedDiffLine[];
  /** Whether to show word-level diffs */
  showWordDiffs?: boolean;
}

/**
 * State effect to update diff lines.
 */
export const setDiffLines = StateEffect.define<ParsedDiffLine[]>();

/**
 * Line decoration presets
 * Includes data-line-type attributes for E2E test selectors
 */
const lineDecorations = {
  addition: Decoration.line({
    class: diffThemeClasses.lineAddition,
    attributes: { 'data-line-type': 'addition' },
  }),
  deletion: Decoration.line({
    class: diffThemeClasses.lineDeletion,
    attributes: { 'data-line-type': 'deletion' },
  }),
  context: Decoration.line({
    class: diffThemeClasses.lineContext,
    attributes: { 'data-line-type': 'context' },
  }),
  header: Decoration.line({
    class: diffThemeClasses.lineHeader,
    attributes: { 'data-line-type': 'header' },
  }),
  spacer: Decoration.line({
    class: diffThemeClasses.lineSpacer,
    attributes: { 'data-line-type': 'spacer' },
  }),
};

/**
 * Word decoration presets
 */
const wordDecorations = {
  added: Decoration.mark({ class: diffThemeClasses.wordAdded }),
  removed: Decoration.mark({ class: diffThemeClasses.wordRemoved }),
};

/**
 * Builds decorations from diff lines.
 * Called when diff lines change or document is modified.
 */
export function buildDiffDecorations(
  doc: { line: (n: number) => { from: number; to: number }; lines: number },
  diffLines: ParsedDiffLine[],
  showWordDiffs = true
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (let i = 0; i < diffLines.length && i < doc.lines; i++) {
    const diffLine = diffLines[i];
    if (!diffLine) continue;

    const docLine = doc.line(i + 1); // CodeMirror lines are 1-indexed

    // Add line decoration based on type
    let lineDeco: Decoration;
    switch (diffLine.type) {
      case 'addition':
        lineDeco = lineDecorations.addition;
        break;
      case 'deletion':
        lineDeco = lineDecorations.deletion;
        break;
      case 'header':
        lineDeco = lineDecorations.header;
        break;
      default:
        lineDeco = lineDecorations.context;
    }
    builder.add(docLine.from, docLine.from, lineDeco);

    // Add word-level decorations if available
    if (showWordDiffs && diffLine.wordDiff && diffLine.wordDiff.length > 0) {
      let pos = docLine.from;
      for (const segment of diffLine.wordDiff) {
        const segmentEnd = pos + segment.text.length;

        // Clamp to line boundaries
        const effectiveEnd = Math.min(segmentEnd, docLine.to);

        if (segment.type === 'added' && pos < effectiveEnd) {
          builder.add(pos, effectiveEnd, wordDecorations.added);
        } else if (segment.type === 'removed' && pos < effectiveEnd) {
          builder.add(pos, effectiveEnd, wordDecorations.removed);
        }

        pos = segmentEnd;
      }
    }
  }

  return builder.finish();
}

/**
 * Creates the diff decorations StateField.
 */
function createDiffDecorationsField(config: DiffDecorationConfig = {}) {
  const { diffLines: initialLines = [], showWordDiffs = true } = config;

  return StateField.define<{ decorations: DecorationSet; diffLines: ParsedDiffLine[] }>({
    create(state) {
      const decorations = buildDiffDecorations(state.doc, initialLines, showWordDiffs);
      return { decorations, diffLines: initialLines };
    },

    update(value, tr) {
      let { decorations, diffLines } = value;
      let needsRebuild = false;

      // Check for setDiffLines effect
      for (const effect of tr.effects) {
        if (effect.is(setDiffLines)) {
          diffLines = effect.value;
          needsRebuild = true;
        }
      }

      // Rebuild if lines changed or document changed
      if (needsRebuild || tr.docChanged) {
        decorations = buildDiffDecorations(tr.state.doc, diffLines, showWordDiffs);
      }

      return { decorations, diffLines };
    },

    provide(field) {
      return EditorView.decorations.from(field, (value) => value.decorations);
    },
  });
}

/**
 * Creates the diff decorations extension.
 *
 * Usage:
 * ```ts
 * const extensions = [
 *   diffDecorations({ diffLines: myDiffLines }),
 * ];
 *
 * // Update diff lines dynamically:
 * view.dispatch({
 *   effects: setDiffLines.of(newDiffLines),
 * });
 * ```
 */
export function diffDecorations(config: DiffDecorationConfig = {}): Extension {
  return createDiffDecorationsField(config);
}
