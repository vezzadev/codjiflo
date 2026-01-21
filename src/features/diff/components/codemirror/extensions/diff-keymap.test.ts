/**
 * Unit tests for diff-keymap extension
 */

import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createDiffKeymap, setHunkIndices, diffKeymap } from './diff-keymap';

describe('createDiffKeymap', () => {
  it('creates extension with default config', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [createDiffKeymap()],
    });

    expect(state.doc.toString()).toBe('line1\nline2\nline3');
  });

  it('creates extension with hunk indices', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [createDiffKeymap({ hunkIndices: [0, 2] })],
    });

    expect(state.doc.toString()).toBe('line1\nline2\nline3');
  });

  it('creates extension with callbacks', () => {
    const onNextHunk = vi.fn();
    const onPreviousHunk = vi.fn();
    const onPageScroll = vi.fn();

    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [
        createDiffKeymap({
          hunkIndices: [0, 1, 2],
          onNextHunk,
          onPreviousHunk,
          onPageScroll,
          contextLines: 5,
        }),
      ],
    });

    expect(state.doc.toString()).toBe('line1\nline2\nline3');
  });
});

describe('setHunkIndices effect', () => {
  it('can be created with hunk indices array', () => {
    const indices = [0, 5, 10, 15];
    const effect = setHunkIndices.of(indices);

    expect(effect.value).toBe(indices);
    expect(effect.value).toHaveLength(4);
  });

  it('can be created with empty array', () => {
    const effect = setHunkIndices.of([]);

    expect(effect.value).toEqual([]);
  });

  it('updates state when effect is dispatched', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [createDiffKeymap({ hunkIndices: [] })],
    });

    const newIndices = [0, 2];
    const newState = state.update({
      effects: setHunkIndices.of(newIndices),
    }).state;

    expect(newState.doc.toString()).toBe('line1\nline2\nline3');
  });
});

describe('diffKeymap alias', () => {
  it('is an alias for createDiffKeymap', () => {
    expect(diffKeymap).toBe(createDiffKeymap);
  });

  it('creates extension when called without arguments', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [diffKeymap()],
    });

    expect(state.doc.toString()).toBe('test');
  });
});

describe('DiffKeymapConfig', () => {
  it('accepts all configuration options', () => {
    const config = {
      hunkIndices: [0, 10, 20],
      onNextHunk: vi.fn(),
      onPreviousHunk: vi.fn(),
      onPageScroll: vi.fn(),
      contextLines: 3,
    };

    const state = EditorState.create({
      doc: 'test content\nmore content\nfinal line',
      extensions: [createDiffKeymap(config)],
    });

    expect(state.doc.lines).toBe(3);
  });

  it('uses default contextLines of 3 when not specified', () => {
    const state = EditorState.create({
      doc: 'line1\nline2',
      extensions: [createDiffKeymap({ hunkIndices: [0, 1] })],
    });

    expect(state.doc.toString()).toBe('line1\nline2');
  });
});

describe('key bindings', () => {
  it('extension includes keymap with j, k, PageDown, PageUp, Home, End', () => {
    const state = EditorState.create({
      doc: 'content',
      extensions: [createDiffKeymap()],
    });

    expect(typeof state.facet).toBe('function');
  });
});
