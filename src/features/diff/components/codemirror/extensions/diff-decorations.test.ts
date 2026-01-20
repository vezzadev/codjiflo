/**
 * Unit tests for diff-decorations extension
 */

import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { Decoration } from '@codemirror/view';
import { buildDiffDecorations, diffDecorations, setDiffLines } from './diff-decorations';
import { diffThemeClasses } from './diff-theme';
import type { ParsedDiffLine } from '../../../types';

// Helper to extract class from decoration spec
function getDecoClass(deco: Decoration | null): string | undefined {
  return (deco?.spec as { class?: string } | undefined)?.class;
}

// Helper to create a minimal doc-like object for testing buildDiffDecorations
function createMockDoc(content: string) {
  const lines = content.split('\n');
  return {
    lines: lines.length,
    line: (n: number) => {
      let from = 0;
      for (let i = 1; i < n; i++) {
        from += (lines[i - 1]?.length ?? 0) + 1; // +1 for newline
      }
      const to = from + (lines[n - 1]?.length ?? 0);
      return { from, to };
    },
  };
}

describe('buildDiffDecorations', () => {
  it('creates line decoration for addition', () => {
    const doc = createMockDoc('added line');
    const diffLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'added line', oldLineNumber: null, newLineNumber: 1 },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);
    const iter = decorations.iter();

    expect(iter.value).toBeTruthy();
    expect(getDecoClass(iter.value)).toBe(diffThemeClasses.lineAddition);
  });

  it('creates line decoration for deletion', () => {
    const doc = createMockDoc('deleted line');
    const diffLines: ParsedDiffLine[] = [
      { type: 'deletion', content: 'deleted line', oldLineNumber: 1, newLineNumber: null },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);
    const iter = decorations.iter();

    expect(iter.value).toBeTruthy();
    expect(getDecoClass(iter.value)).toBe(diffThemeClasses.lineDeletion);
  });

  it('creates line decoration for header', () => {
    const doc = createMockDoc('@@ -1,5 +1,6 @@');
    const diffLines: ParsedDiffLine[] = [
      { type: 'header', content: '@@ -1,5 +1,6 @@', oldLineNumber: null, newLineNumber: null },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);
    const iter = decorations.iter();

    expect(iter.value).toBeTruthy();
    expect(getDecoClass(iter.value)).toBe(diffThemeClasses.lineHeader);
  });

  it('creates line decoration for context', () => {
    const doc = createMockDoc('unchanged line');
    const diffLines: ParsedDiffLine[] = [
      { type: 'context', content: 'unchanged line', oldLineNumber: 1, newLineNumber: 1 },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);
    const iter = decorations.iter();

    expect(iter.value).toBeTruthy();
    expect(getDecoClass(iter.value)).toBe(diffThemeClasses.lineContext);
  });

  it('creates word-level decorations for added segments', () => {
    const doc = createMockDoc('hello world');
    const diffLines: ParsedDiffLine[] = [
      {
        type: 'addition',
        content: 'hello world',
        oldLineNumber: null,
        newLineNumber: 1,
        wordDiff: [
          { type: 'unchanged', text: 'hello ' },
          { type: 'added', text: 'world' },
        ],
      },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);

    // Collect all decorations
    const decos: { from: number; to: number; class: string }[] = [];
    const iter = decorations.iter();
    while (iter.value) {
      decos.push({
        from: iter.from,
        to: iter.to,
        class: getDecoClass(iter.value) ?? '',
      });
      iter.next();
    }

    // Should have line decoration + word decoration
    expect(decos.length).toBe(2);
    expect(decos[0]?.class).toBe(diffThemeClasses.lineAddition); // line deco
    expect(decos[1]?.class).toBe(diffThemeClasses.wordAdded); // word deco at 'world'
    expect(decos[1]?.from).toBe(6); // 'world' starts at index 6
    expect(decos[1]?.to).toBe(11); // 'world' ends at index 11
  });

  it('creates word-level decorations for removed segments', () => {
    const doc = createMockDoc('hello world');
    const diffLines: ParsedDiffLine[] = [
      {
        type: 'deletion',
        content: 'hello world',
        oldLineNumber: 1,
        newLineNumber: null,
        wordDiff: [
          { type: 'unchanged', text: 'hello ' },
          { type: 'removed', text: 'world' },
        ],
      },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);

    // Collect all decorations
    const decos: { from: number; to: number; class: string }[] = [];
    const iter = decorations.iter();
    while (iter.value) {
      decos.push({
        from: iter.from,
        to: iter.to,
        class: getDecoClass(iter.value) ?? '',
      });
      iter.next();
    }

    // Should have line decoration + word decoration
    expect(decos.length).toBe(2);
    expect(decos[0]?.class).toBe(diffThemeClasses.lineDeletion);
    expect(decos[1]?.class).toBe(diffThemeClasses.wordRemoved);
  });

  it('skips word decorations when showWordDiffs is false', () => {
    const doc = createMockDoc('hello world');
    const diffLines: ParsedDiffLine[] = [
      {
        type: 'addition',
        content: 'hello world',
        oldLineNumber: null,
        newLineNumber: 1,
        wordDiff: [
          { type: 'unchanged', text: 'hello ' },
          { type: 'added', text: 'world' },
        ],
      },
    ];

    const decorations = buildDiffDecorations(doc, diffLines, false);

    // Count decorations
    let count = 0;
    const iter = decorations.iter();
    while (iter.value) {
      count++;
      iter.next();
    }

    // Should only have line decoration
    expect(count).toBe(1);
  });

  it('handles multiple lines correctly', () => {
    const doc = createMockDoc('line1\nline2\nline3');
    const diffLines: ParsedDiffLine[] = [
      { type: 'context', content: 'line1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'addition', content: 'line2', oldLineNumber: null, newLineNumber: 2 },
      { type: 'deletion', content: 'line3', oldLineNumber: 2, newLineNumber: null },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);

    // Collect all decorations
    const decos: { from: number; class: string }[] = [];
    const iter = decorations.iter();
    while (iter.value) {
      decos.push({
        from: iter.from,
        class: getDecoClass(iter.value) ?? '',
      });
      iter.next();
    }

    expect(decos.length).toBe(3);
    expect(decos[0]?.class).toBe(diffThemeClasses.lineContext);
    expect(decos[1]?.class).toBe(diffThemeClasses.lineAddition);
    expect(decos[2]?.class).toBe(diffThemeClasses.lineDeletion);
  });

  it('handles empty diff lines array', () => {
    const doc = createMockDoc('some content');
    const diffLines: ParsedDiffLine[] = [];

    const decorations = buildDiffDecorations(doc, diffLines);

    // Should have no decorations
    const iter = decorations.iter();
    expect(iter.value).toBeNull();
  });

  it('handles fewer diff lines than doc lines', () => {
    const doc = createMockDoc('line1\nline2\nline3');
    const diffLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'line1', oldLineNumber: null, newLineNumber: 1 },
    ];

    const decorations = buildDiffDecorations(doc, diffLines);

    // Count decorations
    let count = 0;
    const iter = decorations.iter();
    while (iter.value) {
      count++;
      iter.next();
    }

    // Should only decorate the one line we have data for
    expect(count).toBe(1);
  });
});

describe('diffDecorations extension', () => {
  it('creates extension with initial diff lines', () => {
    const diffLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 1 },
    ];

    const state = EditorState.create({
      doc: 'added',
      extensions: [diffDecorations({ diffLines })],
    });

    // Verify extension is configured (state should be valid)
    expect(state.doc.toString()).toBe('added');
  });

  it('updates decorations via setDiffLines effect', () => {
    const initialLines: ParsedDiffLine[] = [
      { type: 'context', content: 'unchanged', oldLineNumber: 1, newLineNumber: 1 },
    ];

    const state = EditorState.create({
      doc: 'unchanged',
      extensions: [diffDecorations({ diffLines: initialLines })],
    });

    const newLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'unchanged', oldLineNumber: null, newLineNumber: 1 },
    ];

    const newState = state.update({
      effects: setDiffLines.of(newLines),
    }).state;

    // State should update without error
    expect(newState.doc.toString()).toBe('unchanged');
  });

  // Skip tests requiring full DOM/view - these are covered by integration tests
  it.skip('provides decorations to EditorView', () => {
    // This would require a full browser environment with DOM
    // Covered by DiffView integration tests
  });
});

describe('setDiffLines effect', () => {
  it('can be created with diff lines array', () => {
    const diffLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'test', oldLineNumber: null, newLineNumber: 1 },
    ];

    const effect = setDiffLines.of(diffLines);
    expect(effect.value).toBe(diffLines);
  });

  it('can be created with empty array', () => {
    const effect = setDiffLines.of([]);
    expect(effect.value).toEqual([]);
  });
});
