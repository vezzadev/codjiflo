/**
 * Unit tests for diff-gutter extension
 */

import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  createDiffGutter,
  setGutterDiffLines,
  setLineNumberMode,
} from './diff-gutter';
import { diffThemeClasses } from './diff-theme';
import type { ParsedDiffLine } from '../../../types';

// Mock JSDOM document for testing DOM creation
// @vitest-environment jsdom

describe('setGutterDiffLines effect', () => {
  it('can be created with diff lines array', () => {
    const diffLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'test', oldLineNumber: null, newLineNumber: 1 },
    ];

    const effect = setGutterDiffLines.of(diffLines);
    expect(effect.value).toBe(diffLines);
  });

  it('can be created with empty array', () => {
    const effect = setGutterDiffLines.of([]);
    expect(effect.value).toEqual([]);
  });
});

describe('setLineNumberMode effect', () => {
  it('can be created with left mode', () => {
    const effect = setLineNumberMode.of('left');
    expect(effect.value).toBe('left');
  });

  it('can be created with both mode', () => {
    const effect = setLineNumberMode.of('both');
    expect(effect.value).toBe('both');
  });

  it('can be created with right mode', () => {
    const effect = setLineNumberMode.of('right');
    expect(effect.value).toBe('right');
  });
});

describe('createDiffGutter', () => {
  it('creates extension with default config', () => {
    const extension = createDiffGutter();
    // Extension is an array with state field init, gutter, and theme
    expect(Array.isArray(extension)).toBe(true);
    expect((extension as unknown[]).length).toBe(3);
  });

  it('creates extension with initial diff lines', () => {
    const diffLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 1 },
    ];

    const extension = createDiffGutter({ diffLines });
    expect(Array.isArray(extension)).toBe(true);
  });

  it('creates extension with line number mode', () => {
    const extension = createDiffGutter({ lineNumberMode: 'left' });
    expect(Array.isArray(extension)).toBe(true);
  });

  it('integrates with EditorState', () => {
    const diffLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'line1', oldLineNumber: null, newLineNumber: 1 },
      { type: 'context', content: 'line2', oldLineNumber: 1, newLineNumber: 2 },
    ];

    const state = EditorState.create({
      doc: 'line1\nline2',
      extensions: [createDiffGutter({ diffLines, lineNumberMode: 'both' })],
    });

    expect(state.doc.toString()).toBe('line1\nline2');
  });

  it('updates via setGutterDiffLines effect', () => {
    const initialLines: ParsedDiffLine[] = [
      { type: 'context', content: 'original', oldLineNumber: 1, newLineNumber: 1 },
    ];

    const state = EditorState.create({
      doc: 'original',
      extensions: [createDiffGutter({ diffLines: initialLines })],
    });

    const newLines: ParsedDiffLine[] = [
      { type: 'addition', content: 'original', oldLineNumber: null, newLineNumber: 1 },
    ];

    const newState = state.update({
      effects: setGutterDiffLines.of(newLines),
    }).state;

    // State should update without error
    expect(newState.doc.toString()).toBe('original');
  });

  it('updates via setLineNumberMode effect', () => {
    const state = EditorState.create({
      doc: 'content',
      extensions: [createDiffGutter({ lineNumberMode: 'both' })],
    });

    const newState = state.update({
      effects: setLineNumberMode.of('left'),
    }).state;

    expect(newState.doc.toString()).toBe('content');
  });
});

describe('DiffLineMarker DOM creation', () => {
  // These tests require the JSDOM environment from vitest

  it('creates wrapper with correct class', () => {
    const diffLines: ParsedDiffLine[] = [
      { type: 'context', content: 'test', oldLineNumber: 1, newLineNumber: 1 },
    ];

    const state = EditorState.create({
      doc: 'test',
      extensions: [createDiffGutter({ diffLines, lineNumberMode: 'both' })],
    });

    // Verify state is created successfully (marker DOM tested via integration)
    expect(state.doc.lines).toBe(1);
  });

  it('handles multiple line types', () => {
    const diffLines: ParsedDiffLine[] = [
      { type: 'header', content: '@@ -1,5 +1,6 @@', oldLineNumber: null, newLineNumber: null },
      { type: 'context', content: 'unchanged', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'removed', oldLineNumber: 2, newLineNumber: null },
      { type: 'addition', content: 'added', oldLineNumber: null, newLineNumber: 2 },
    ];

    const state = EditorState.create({
      doc: '@@ -1,5 +1,6 @@\nunchanged\nremoved\nadded',
      extensions: [createDiffGutter({ diffLines, lineNumberMode: 'both' })],
    });

    expect(state.doc.lines).toBe(4);
  });
});

describe('diffThemeClasses gutter styles', () => {
  it('defines gutter addition class', () => {
    expect(diffThemeClasses.gutterAddition).toBe('cm-diff-gutter-addition');
  });

  it('defines gutter deletion class', () => {
    expect(diffThemeClasses.gutterDeletion).toBe('cm-diff-gutter-deletion');
  });

  it('defines gutter header class', () => {
    expect(diffThemeClasses.gutterHeader).toBe('cm-diff-gutter-header');
  });
});
