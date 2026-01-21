import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/helpers";
import { DiffView } from "./DiffView";
import { useDiffStore } from "../stores";
import { useCommentsStore } from "@/features/comments";
import { FileChangeStatus } from "@/api/types";
import { useDiffPipeline } from '../hooks';
import type { ReviewThread } from '@/features/comments';

const mockDiffContentStore = {
  computeFullFileDiff: vi.fn().mockResolvedValue(null),
  isLoadingContent: false,
};

vi.mock('../stores', async () => {
  const actual = await vi.importActual('../stores');
  return {
    ...actual,
    useDiffStore: vi.fn(),
    useDiffContentStore: vi.fn(() => mockDiffContentStore),
  };
});

vi.mock('@/features/pr', () => ({
  usePRStore: vi.fn(() => ({
    prDetails: null,
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/features/comments', async () => {
  const actual = await vi.importActual('@/features/comments');
  return {
    ...actual,
    useCommentsStore: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ owner: 'testowner', repo: 'testrepo' })),
}));

// Mock Minimap
vi.mock('./Minimap', () => ({
  Minimap: () => <div data-testid="minimap-mock" />,
}));

// Mock CodeMirror components to render comments directly
vi.mock('./codemirror', async () => {
  const React = await import('react');
  const { useEffect } = React;
  const comments = await import('@/features/comments');
  const { CommentThread, CommentEditor } = comments;

  interface MockDiffLine {
    content: string;
    oldLineNumber?: number | null;
    newLineNumber?: number | null;
  }

  interface MockThread {
    id: string;
    comments: { body: string; author: { login: string } }[];
  }

  const MockUnifiedDiffEditor = ({
    diffLines,
    threadsByLineAndSide,
    currentUserLogin,
    addReply,
    editComment,
    deleteComment,
    toggleResolved,
    draftLineIndex,
    draftBody,
    isSubmittingDraft,
    submitError,
    onCancelDraft,
    onChangeDraftBody,
    onSubmitDraft,
    onVisibleRangeChange,
    showComments = true,
  }: {
    diffLines: MockDiffLine[];
    threadsByLineAndSide?: Map<string, MockThread[]>;
    currentUserLogin?: string;
    addReply?: (threadId: string, body: string) => Promise<void>;
    editComment?: (commentId: string, body: string) => Promise<void>;
    deleteComment?: (commentId: string) => Promise<void>;
    toggleResolved?: (threadId: string) => void;
    draftLineIndex?: number | null;
    draftBody?: string;
    isSubmittingDraft?: boolean;
    submitError?: string | null;
    onCancelDraft?: () => void;
    onChangeDraftBody?: (body: string) => void;
    onSubmitDraft?: () => void;
    onVisibleRangeChange?: (range: { startIndex: number; stopIndex: number }) => void;
    showComments?: boolean;
  }) => {
    useEffect(() => {
      if (onVisibleRangeChange) {
        onVisibleRangeChange({ startIndex: 0, stopIndex: Math.min(20, diffLines.length - 1) });
      }
    }, [onVisibleRangeChange, diffLines.length]);

    const allThreads: MockThread[] = [];
    if (threadsByLineAndSide) {
      threadsByLineAndSide.forEach((threads) => {
        allThreads.push(...threads);
      });
    }

    return React.createElement('div', { 'data-testid': 'unified-diff-editor', className: 'cm-scroller' },
      ...diffLines.map((line, i) =>
        React.createElement('div', { key: i, className: 'diff-line' }, line.content)
      ),
      showComments && allThreads.map((thread) =>
        React.createElement('div', {
          key: `thread-${thread.id}`,
          className: 'cm-comment-widget',
          'data-thread-id': thread.id,
        },
          React.createElement(CommentThread, {
            thread: thread as Parameters<typeof CommentThread>[0]['thread'],
            currentUserLogin: currentUserLogin ?? '',
            onReply: addReply ?? (() => Promise.resolve()),
            onEdit: editComment ?? (() => Promise.resolve()),
            onDelete: deleteComment ?? (() => Promise.resolve()),
            onToggleResolved: toggleResolved ?? (() => { /* noop */ }),
          })
        )
      ),
      draftLineIndex !== null && draftLineIndex !== undefined &&
        React.createElement('div', {
          key: 'draft',
          className: 'cm-comment-widget cm-draft-editor-widget',
          'data-draft-line': draftLineIndex,
        },
          React.createElement(CommentEditor, {
            value: draftBody ?? '',
            onChange: onChangeDraftBody ?? (() => { /* noop */ }),
            onSubmit: onSubmitDraft ?? (() => { /* noop */ }),
            onCancel: onCancelDraft ?? (() => { /* noop */ }),
            isSubmitting: isSubmittingDraft ?? false,
            submitLabel: 'Comment',
            label: 'New comment',
          }),
          submitError && React.createElement('div', { className: 'draft-comment-error' }, submitError)
        )
    );
  };

  const MockSplitDiffEditor = MockUnifiedDiffEditor;

  const MockCommentPortalManager = ({ children }: { children: (callbacks: Record<string, () => void>) => React.ReactNode }) => {
    return React.createElement(React.Fragment, null,
      children({
        onMountThread: () => { /* noop */ },
        onUnmountThread: () => { /* noop */ },
        onMountDraft: () => { /* noop */ },
        onUnmountDraft: () => { /* noop */ },
      })
    );
  };

  return {
    UnifiedDiffEditor: MockUnifiedDiffEditor,
    SplitDiffEditor: MockSplitDiffEditor,
    CommentPortalManager: MockCommentPortalManager,
  };
});

// Mock hooks
vi.mock('../hooks', async () => {
  const actual = await vi.importActual('../hooks');
  return {
    ...actual,
    useIterationDiff: vi.fn(() => ({
      isIterationMode: false,
      getFileDiffByPath: vi.fn(() => null),
      selectedRange: null,
      changedFiles: [],
      getArtifactByPath: vi.fn(() => undefined),
    })),
    useIterationAwareFiles: vi.fn(() => ({
      files: [],
      isIterationMode: false,
      totalFilesInPR: 0,
    })),
    useDiffPipeline: vi.fn(),
    useDraftComment: vi.fn(() => ({
      draftLineIndex: null,
      draftBody: '',
      isSubmittingDraft: false,
      submitError: null,
      startDraft: vi.fn(),
      cancelDraft: vi.fn(),
      setDraftBody: vi.fn(),
      submitDraft: vi.fn(),
    })),
    useContainerHeight: vi.fn(() => ({
      containerRefCallback: vi.fn(),
      containerHeight: 500,
    })),
    useScrollPreservation: vi.fn(() => ({
      attachScrollListener: vi.fn(),
      restoreScrollPosition: vi.fn(),
    })),
  };
});

describe("DiffView comments integration", () => {
  const mockThread = {
    id: "thread-1",
    path: "src/example.ts",
    line: 2,
    side: "RIGHT" as const,
    isResolved: false,
    originalLine: 2,
    originalCommitId: "abc123",
    trackedLine: null,
    comments: [
      {
        id: "comment-1",
        body: "Looks good!",
        author: {
          id: "2",
          login: "reviewer",
          avatarUrl: "https://example.com/avatar.png",
        },
        createdAt: new Date(Date.now() - 1000 * 60),
        updatedAt: new Date(Date.now() - 1000 * 60),
        path: "src/example.ts",
        line: 2,
        side: "RIGHT" as const,
        position: 2,
        originalLine: 2,
        originalCommitId: "abc123",
      },
    ],
  };

  beforeEach(() => {
    // Suppress React act() warnings that occur due to Zustand store updates
    vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      if (typeof msg === 'string' && msg.includes('act(')) return;
      console.warn(msg);
    });

    // Set up default mock values
    vi.mocked(useDiffStore).mockReturnValue({
      files: [
        {
          filename: "src/example.ts",
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: "@@ -1,1 +1,2 @@\n const foo = 'bar';\n+const added = true;",
        },
      ],
      selectedFileIndex: 0,
      isLoading: false,
      error: null,
      setFiles: vi.fn(),
      setSelectedFileIndex: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      viewMode: 'inline' as const,
      setViewMode: vi.fn(),
      showWhitespace: false,
      setShowWhitespace: vi.fn(),
      wrapMode: 'on' as const,
      setWrapMode: vi.fn(),
      contentFilter: 'both' as const,
      setContentFilter: vi.fn(),
      resetChangeIndex: vi.fn(),
      setTotalChangeCount: vi.fn(),
      viewConfig: {
        mode: 'inline' as const,
        showFullFile: false,
        setMode: vi.fn(),
        setShowFullFile: vi.fn(),
      },
    });

    vi.mocked(useCommentsStore).mockReturnValue({
      threads: [mockThread],
      isLoading: false,
      error: null,
      announcement: "",
      setThreads: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      getThreadsForFile: vi.fn(() => [mockThread]),
      addReply: vi.fn(),
      editComment: vi.fn(),
      deleteComment: vi.fn(),
      toggleResolved: vi.fn(),
      addThread: vi.fn(),
      setAnnouncement: vi.fn(),
      showComments: true,
      setShowComments: vi.fn(),
      currentUser: {
        id: '1',
        login: 'testuser',
        avatarUrl: 'https://example.com/avatar.png',
      },
      clearAnnouncement: vi.fn(),
    });

    // Create threadsByLineAndSide map for the mock
    const threadsByLineAndSide = new Map<string, ReviewThread[]>();
    threadsByLineAndSide.set(`1-RIGHT`, [mockThread]);

    vi.mocked(useDiffPipeline).mockReturnValue({
      filename: 'src/example.ts',
      isIterationMode: false,
      diffLines: [
        { content: " const foo = 'bar';", oldLineNumber: 1, newLineNumber: 1, type: 'context' as const },
        { content: "+const added = true;", oldLineNumber: null, newLineNumber: 2, type: 'addition' as const },
      ],
      alignedLines: [],
      language: 'typescript',
      viewMode: 'inline' as const,
      showWhitespace: false,
      threadsByLineAndSide,
      hunkIndices: [0],
      textWrap: 'wrap' as const,
      contentFilter: 'both' as const,
      lineNumberMode: 'both' as const,
      scrollToRowIndex: undefined,
      isFullFileChange: false,
      sourceAlignedLines: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders comment threads under the matching diff line", () => {
    render(<DiffView />);

    expect(screen.getByText("Looks good!")).toBeInTheDocument();
    expect(screen.getByText("Thread on line 2")).toBeInTheDocument();
  });
});
