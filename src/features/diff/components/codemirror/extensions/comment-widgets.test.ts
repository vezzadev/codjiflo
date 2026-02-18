/**
 * Unit tests for comment-widgets extension
 */

import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  commentWidgets,
  setCommentThreads,
  setDraftLineIndex,
  setShowComments,
} from './comment-widgets';
import type { ReviewThread } from '@/features/comments';

// Helper to create mock thread
function createMockThread(id: string, lineNumber: number): ReviewThread {
  return {
    id,
    path: 'test.ts',
    line: lineNumber,
    side: 'RIGHT',
    isResolved: false,
    originalLine: lineNumber,
    originalCommitId: 'abc123',
    trackedLine: null,
    comments: [
      {
        id: `comment-${id}`,
        body: `Comment in thread ${id}`,
        author: {
          id: 'user-1',
          login: 'testuser',
          avatarUrl: 'https://example.com/avatar.png',
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        path: 'test.ts',
        line: lineNumber,
        side: 'RIGHT',
        position: 1,
        originalLine: lineNumber,
        originalCommitId: 'abc123',
      },
    ],
  };
}

describe('commentWidgets', () => {
  it('creates extension with default config', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [commentWidgets()],
    });

    expect(state.doc.toString()).toBe('line1\nline2\nline3');
  });

  it('creates extension with empty threads map', () => {
    const state = EditorState.create({
      doc: 'content',
      extensions: [commentWidgets({ threadsByLine: new Map() })],
    });

    expect(state.doc.toString()).toBe('content');
  });

  it('creates extension with threads', () => {
    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(0, [createMockThread('thread-1', 1)]);
    threadsByLine.set(2, [createMockThread('thread-2', 3)]);

    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [commentWidgets({ threadsByLine })],
    });

    expect(state.doc.lines).toBe(3);
  });

  it('creates extension with showComments false', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [commentWidgets({ showComments: false })],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with draftLineIndex', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [commentWidgets({ draftLineIndex: 1 })],
    });

    expect(state.doc.toString()).toBe('line1\nline2\nline3');
  });

  it('creates extension with draftLineIndex null', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [commentWidgets({ draftLineIndex: null })],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with mount callbacks', () => {
    const onMountThread = vi.fn();
    const onUnmountThread = vi.fn();
    const onMountDraft = vi.fn();
    const onUnmountDraft = vi.fn();

    const state = EditorState.create({
      doc: 'test',
      extensions: [
        commentWidgets({
          onMountThread,
          onUnmountThread,
          onMountDraft,
          onUnmountDraft,
        }),
      ],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('creates extension with all config options', () => {
    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(1, [createMockThread('thread-1', 2)]);

    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [
        commentWidgets({
          threadsByLine,
          showComments: true,
          draftLineIndex: 0,
          onMountThread: vi.fn(),
          onUnmountThread: vi.fn(),
          onMountDraft: vi.fn(),
          onUnmountDraft: vi.fn(),
        }),
      ],
    });

    expect(state.doc.lines).toBe(3);
  });
});

describe('setCommentThreads effect', () => {
  it('can be created with threads map', () => {
    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(0, [createMockThread('thread-1', 1)]);

    const effect = setCommentThreads.of(threadsByLine);

    expect(effect.value).toBe(threadsByLine);
    expect(effect.value.size).toBe(1);
  });

  it('can be created with empty map', () => {
    const effect = setCommentThreads.of(new Map());

    expect(effect.value.size).toBe(0);
  });

  it('updates state when effect is dispatched', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [commentWidgets()],
    });

    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(1, [createMockThread('thread-1', 2)]);

    const newState = state.update({
      effects: setCommentThreads.of(threadsByLine),
    }).state;

    expect(newState.doc.toString()).toBe('line1\nline2\nline3');
  });

  it('handles multiple threads on same line', () => {
    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(0, [
      createMockThread('thread-1', 1),
      createMockThread('thread-2', 1),
    ]);

    const effect = setCommentThreads.of(threadsByLine);

    expect(effect.value.get(0)?.length).toBe(2);
  });
});

describe('setDraftLineIndex effect', () => {
  it('can be created with line index', () => {
    const effect = setDraftLineIndex.of(5);

    expect(effect.value).toBe(5);
  });

  it('can be created with null', () => {
    const effect = setDraftLineIndex.of(null);

    expect(effect.value).toBeNull();
  });

  it('can be created with zero', () => {
    const effect = setDraftLineIndex.of(0);

    expect(effect.value).toBe(0);
  });

  it('updates state when effect is dispatched', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [commentWidgets({ draftLineIndex: null })],
    });

    const newState = state.update({
      effects: setDraftLineIndex.of(1),
    }).state;

    expect(newState.doc.toString()).toBe('line1\nline2\nline3');
  });

  it('can clear draft by setting to null', () => {
    const state = EditorState.create({
      doc: 'line1\nline2',
      extensions: [commentWidgets({ draftLineIndex: 0 })],
    });

    const newState = state.update({
      effects: setDraftLineIndex.of(null),
    }).state;

    expect(newState.doc.toString()).toBe('line1\nline2');
  });
});

describe('setShowComments effect', () => {
  it('can be created with true', () => {
    const effect = setShowComments.of(true);

    expect(effect.value).toBe(true);
  });

  it('can be created with false', () => {
    const effect = setShowComments.of(false);

    expect(effect.value).toBe(false);
  });

  it('updates state when effect is dispatched', () => {
    const state = EditorState.create({
      doc: 'test content',
      extensions: [commentWidgets({ showComments: true })],
    });

    const newState = state.update({
      effects: setShowComments.of(false),
    }).state;

    expect(newState.doc.toString()).toBe('test content');
  });

  it('can toggle comments visibility', () => {
    const state = EditorState.create({
      doc: 'line1\nline2',
      extensions: [commentWidgets({ showComments: false })],
    });

    const state2 = state.update({
      effects: setShowComments.of(true),
    }).state;

    const state3 = state2.update({
      effects: setShowComments.of(false),
    }).state;

    expect(state3.doc.toString()).toBe('line1\nline2');
  });
});

describe('CommentWidgetConfig', () => {
  it('accepts undefined for optional fields', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [
        commentWidgets({
          threadsByLine: undefined,
          showComments: undefined,
          draftLineIndex: undefined,
          onMountThread: undefined,
          onUnmountThread: undefined,
          onMountDraft: undefined,
          onUnmountDraft: undefined,
        }),
      ],
    });

    expect(state.doc.toString()).toBe('test');
  });
});

describe('multiple effects combined', () => {
  it('handles multiple effects in single dispatch', () => {
    const state = EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [commentWidgets()],
    });

    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(0, [createMockThread('thread-1', 1)]);

    const newState = state.update({
      effects: [
        setCommentThreads.of(threadsByLine),
        setDraftLineIndex.of(1),
        setShowComments.of(true),
      ],
    }).state;

    expect(newState.doc.lines).toBe(3);
  });
});

describe('thread with resolved status', () => {
  it('handles resolved thread', () => {
    const thread = createMockThread('thread-1', 1);
    thread.isResolved = true;

    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(0, [thread]);

    const state = EditorState.create({
      doc: 'line1\nline2',
      extensions: [commentWidgets({ threadsByLine, showComments: true })],
    });

    expect(state.doc.toString()).toBe('line1\nline2');
  });
});

describe('thread with multiple comments', () => {
  it('handles thread with multiple comments', () => {
    const thread = createMockThread('thread-1', 1);
    thread.comments.push({
      id: 'reply-1',
      body: 'Reply to comment',
      author: {
        id: 'user-2',
        login: 'otheruser',
        avatarUrl: 'https://example.com/avatar2.png',
      },
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      path: 'test.ts',
      line: 1,
      side: 'RIGHT',
      position: 1,
      originalLine: 1,
      originalCommitId: 'abc123',
    });

    const threadsByLine: Map<number, ReviewThread[]> = new Map();
    threadsByLine.set(0, [thread]);

    const state = EditorState.create({
      doc: 'single line',
      extensions: [commentWidgets({ threadsByLine, showComments: true })],
    });

    expect(state.doc.toString()).toBe('single line');
  });
});
