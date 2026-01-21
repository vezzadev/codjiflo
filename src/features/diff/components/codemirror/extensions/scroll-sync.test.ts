/**
 * Unit tests for scroll-sync extension
 */

import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  createScrollSync,
  scrollSync,
  createScrollSyncPair,
  syncScrollPosition,
} from './scroll-sync';

// Mock EditorView for syncScrollPosition tests
function createMockEditorView(scrollTop: number = 0, scrollLeft: number = 0) {
  return {
    scrollDOM: {
      scrollTop,
      scrollLeft,
    },
  } as unknown as Parameters<typeof syncScrollPosition>[0];
}

describe('createScrollSync', () => {
  it('creates extension with default config', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [createScrollSync()],
    });

    expect(state.doc.toString()).toBe('line1\nline2\nline3');
  });

  it('creates extension with partner set to null', () => {
    const state = EditorState.create({
      doc: 'content',
      extensions: [createScrollSync({ partner: null })],
    });

    expect(state.doc.toString()).toBe('content');
  });

  it('creates extension with direction source', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [createScrollSync({ direction: 'source' })],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with direction target', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [createScrollSync({ direction: 'target' })],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with direction bidirectional', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [createScrollSync({ direction: 'bidirectional' })],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with onScroll callback', () => {
    const onScroll = vi.fn();
    const state = EditorState.create({
      doc: 'test',
      extensions: [createScrollSync({ onScroll })],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with debounce setting', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [createScrollSync({ debounceMs: 100 })],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with all config options', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [
        createScrollSync({
          partner: null,
          direction: 'bidirectional',
          onScroll: vi.fn(),
          debounceMs: 50,
        }),
      ],
    });

    expect(state.doc.toString()).toBe('test');
  });
});

describe('scrollSync alias', () => {
  it('is an alias for createScrollSync', () => {
    expect(scrollSync).toBe(createScrollSync);
  });

  it('creates extension when called without arguments', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [scrollSync()],
    });

    expect(state.doc.toString()).toBe('test');
  });
});

describe('createScrollSyncPair', () => {
  it('returns object with left and right functions', () => {
    const pair = createScrollSyncPair();

    expect(pair).toHaveProperty('left');
    expect(pair).toHaveProperty('right');
    expect(typeof pair.left).toBe('function');
    expect(typeof pair.right).toBe('function');
  });

  it('left function creates extension with bidirectional direction', () => {
    const pair = createScrollSyncPair();
    const mockPartner = createMockEditorView();

    const extension = pair.left(mockPartner as unknown as Parameters<typeof pair.left>[0]);

    expect(extension).toBeDefined();
    expect(Array.isArray(extension)).toBe(true);
  });

  it('right function creates extension with bidirectional direction', () => {
    const pair = createScrollSyncPair();
    const mockPartner = createMockEditorView();

    const extension = pair.right(mockPartner as unknown as Parameters<typeof pair.right>[0]);

    expect(extension).toBeDefined();
    expect(Array.isArray(extension)).toBe(true);
  });
});

describe('syncScrollPosition', () => {
  it('syncs scroll position from source to target', () => {
    const source = createMockEditorView(100, 50);
    const target = createMockEditorView(0, 0);

    syncScrollPosition(source, target);

    expect(target.scrollDOM.scrollTop).toBe(100);
    expect(target.scrollDOM.scrollLeft).toBe(50);
  });

  it('uses explicit top and left when provided', () => {
    const source = createMockEditorView(100, 50);
    const target = createMockEditorView(0, 0);

    syncScrollPosition(source, target, { top: 200, left: 75 });

    expect(target.scrollDOM.scrollTop).toBe(200);
    expect(target.scrollDOM.scrollLeft).toBe(75);
  });

  it('uses source values when options are partially provided', () => {
    const source = createMockEditorView(100, 50);
    const target = createMockEditorView(0, 0);

    syncScrollPosition(source, target, { top: 150 });

    expect(target.scrollDOM.scrollTop).toBe(150);
    expect(target.scrollDOM.scrollLeft).toBe(50);
  });

  it('handles zero scroll positions', () => {
    const source = createMockEditorView(0, 0);
    const target = createMockEditorView(500, 300);

    syncScrollPosition(source, target);

    expect(target.scrollDOM.scrollTop).toBe(0);
    expect(target.scrollDOM.scrollLeft).toBe(0);
  });
});

describe('ScrollSyncConfig', () => {
  it('accepts all configuration options', () => {
    const mockPartner = createMockEditorView();
    const onScroll = vi.fn();

    const state = EditorState.create({
      doc: 'test content',
      extensions: [
        createScrollSync({
          partner: mockPartner as unknown as Parameters<typeof createScrollSync>[0]['partner'],
          direction: 'bidirectional',
          onScroll,
          debounceMs: 100,
        }),
      ],
    });

    expect(state.doc.lines).toBe(1);
  });
});
