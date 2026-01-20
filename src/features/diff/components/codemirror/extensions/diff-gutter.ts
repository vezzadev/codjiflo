/**
 * Diff Gutter Extension for CodeMirror 6
 *
 * Custom gutter showing dual-column line numbers (old/new)
 * with proper styling for additions, deletions, and headers.
 */

import {
  StateField,
  StateEffect,
  type Extension,
} from '@codemirror/state';
import { gutter, GutterMarker, EditorView } from '@codemirror/view';
import type { ParsedDiffLine } from '../../../types';
import { diffThemeClasses } from './diff-theme';

/**
 * Configuration for the diff gutter.
 */
export interface DiffGutterConfig {
  /** Initial diff lines */
  diffLines?: ParsedDiffLine[];
  /** Line number display mode */
  lineNumberMode?: 'left' | 'both' | 'right';
  /** Show annotation column (for future use with icons) */
  showAnnotation?: boolean;
}

/**
 * State effect to update diff lines in gutter.
 */
export const setGutterDiffLines = StateEffect.define<ParsedDiffLine[]>();

/**
 * State effect to update line number mode.
 */
export const setLineNumberMode = StateEffect.define<'left' | 'both' | 'right'>();

/**
 * Gutter marker for a single line showing line numbers and background.
 */
class DiffLineMarker extends GutterMarker {
  constructor(
    private readonly oldLineNumber: number | null,
    private readonly newLineNumber: number | null,
    private readonly lineType: ParsedDiffLine['type'],
    private readonly mode: 'left' | 'both' | 'right'
  ) {
    super();
  }

  override toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-diff-gutter-wrapper';

    // Apply background color based on line type
    let bgClass = '';
    switch (this.lineType) {
      case 'addition':
        bgClass = diffThemeClasses.gutterAddition;
        break;
      case 'deletion':
        bgClass = diffThemeClasses.gutterDeletion;
        break;
      case 'header':
        bgClass = diffThemeClasses.gutterHeader;
        break;
    }

    if (bgClass) {
      wrapper.classList.add(bgClass);
    }

    // Show line numbers based on mode
    if (this.mode === 'left' || this.mode === 'both') {
      const leftSpan = document.createElement('span');
      leftSpan.className = 'cm-diff-gutter-left';
      leftSpan.textContent = this.oldLineNumber !== null ? String(this.oldLineNumber) : '';
      wrapper.appendChild(leftSpan);
    }

    if (this.mode === 'right' || this.mode === 'both') {
      const rightSpan = document.createElement('span');
      rightSpan.className = 'cm-diff-gutter-right';
      rightSpan.textContent = this.newLineNumber !== null ? String(this.newLineNumber) : '';
      wrapper.appendChild(rightSpan);
    }

    return wrapper;
  }

  override eq(other: GutterMarker): boolean {
    if (!(other instanceof DiffLineMarker)) return false;
    return (
      this.oldLineNumber === other.oldLineNumber &&
      this.newLineNumber === other.newLineNumber &&
      this.lineType === other.lineType &&
      this.mode === other.mode
    );
  }
}

/**
 * State field to store diff lines and mode for gutter.
 */
interface DiffGutterState {
  diffLines: ParsedDiffLine[];
  mode: 'left' | 'both' | 'right';
}

const diffGutterState = StateField.define<DiffGutterState>({
  create() {
    return { diffLines: [], mode: 'both' };
  },
  update(state, tr) {
    let { diffLines, mode } = state;
    for (const effect of tr.effects) {
      if (effect.is(setGutterDiffLines)) {
        diffLines = effect.value;
      } else if (effect.is(setLineNumberMode)) {
        mode = effect.value;
      }
    }
    return { diffLines, mode };
  },
});

/**
 * Custom gutter extension for diff line numbers.
 */
const diffLineNumberGutter = gutter({
  class: 'cm-diff-gutter',
  lineMarker(view, line) {
    const state = view.state.field(diffGutterState);
    const lineIndex = view.state.doc.lineAt(line.from).number - 1;
    const diffLine = state.diffLines[lineIndex];

    if (!diffLine) {
      return new DiffLineMarker(null, null, 'context', state.mode);
    }

    return new DiffLineMarker(
      diffLine.oldLineNumber,
      diffLine.newLineNumber,
      diffLine.type,
      state.mode
    );
  },
  initialSpacer: () => new DiffLineMarker(9999, 9999, 'context', 'both'),
});

/**
 * Theme extension for the diff gutter.
 */
const diffGutterTheme = EditorView.baseTheme({
  '.cm-diff-gutter': {
    width: 'auto',
    minWidth: '96px',
  },
  '.cm-diff-gutter-wrapper': {
    display: 'flex',
    width: '100%',
    lineHeight: 'var(--diff-line-height, 23px)',
    minHeight: 'var(--diff-line-height, 23px)',
  },
  '.cm-diff-gutter-left, .cm-diff-gutter-right': {
    display: 'inline-block',
    minWidth: '48px',
    textAlign: 'right',
    padding: '0 8px 0 4px',
    color: 'var(--watermark-text)',
    fontSize: '12px',
    fontFamily: 'Consolas, "Courier New", monospace',
  },
  '.cm-diff-gutter-right': {
    borderRight: '1px solid var(--control-bg)',
  },
  // Background classes
  [`.${diffThemeClasses.gutterAddition}`]: {
    backgroundColor: 'var(--diff-add-gutter)',
  },
  [`.${diffThemeClasses.gutterDeletion}`]: {
    backgroundColor: 'var(--diff-delete-gutter)',
  },
  [`.${diffThemeClasses.gutterHeader}`]: {
    backgroundColor: 'var(--diff-hunk-gutter)',
  },
});

/**
 * Creates the diff gutter extension.
 *
 * Usage:
 * ```ts
 * const extensions = [
 *   diffGutter({ diffLines: myDiffLines, lineNumberMode: 'both' }),
 * ];
 *
 * // Update diff lines:
 * view.dispatch({
 *   effects: setGutterDiffLines.of(newDiffLines),
 * });
 *
 * // Update line number mode:
 * view.dispatch({
 *   effects: setLineNumberMode.of('left'),
 * });
 * ```
 */
export function createDiffGutter(config: DiffGutterConfig = {}): Extension {
  const { diffLines = [], lineNumberMode = 'both' } = config;

  return [
    diffGutterState.init(() => ({ diffLines, mode: lineNumberMode })),
    diffLineNumberGutter,
    diffGutterTheme,
  ];
}

/**
 * Convenience export for backward compatibility.
 */
export const diffGutter = createDiffGutter;
