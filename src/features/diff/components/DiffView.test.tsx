import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/tests/helpers';
import { DiffView } from './DiffView';
import { useDiffStore } from '../stores';
import { useCommentsStore } from '@/features/comments';
import { usePRStore } from '@/features/pr';
import { FileChangeStatus } from '@/api/types';
import { useIterationDiff, useIterationAwareFiles, useDiffPipeline, useDraftComment, useContainerHeight } from '../hooks';

// Silence unused import warnings - these are used in type assertions below
void useIterationDiff;
void useIterationAwareFiles;
void useDiffPipeline;
void useDraftComment;
void useContainerHeight;

const mockDiffContentStore = {
  computeFullFileDiff: vi.fn().mockResolvedValue(null),
  isLoadingContent: false,
};

vi.mock('../stores', () => ({
  useDiffStore: vi.fn(),
  useDiffContentStore: vi.fn(() => mockDiffContentStore),
  PR_DESCRIPTION_INDEX: -1,
}));

vi.mock('@/features/pr', () => ({
  usePRStore: vi.fn(),
}));

vi.mock('@/features/pr/components', () => ({
  PRMetadata: ({ pr }: { pr: { title: string } }) => <div data-testid="pr-metadata">{pr.title}</div>,
  PRDescription: ({ description }: { description: string }) => (
    <div data-testid="pr-description">{description || 'No description'}</div>
  ),
}));

vi.mock('@/features/comments', async () => {
  const actual = await vi.importActual('@/features/comments');
  return {
    ...actual,
    useCommentsStore: vi.fn(),
    useCommentTracking: vi.fn(), // Mock to avoid SchedulerProvider requirement
  };
});

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ owner: 'testowner', repo: 'testrepo' })),
}));

// Mock Minimap to avoid async requestAnimationFrame state updates and act() warnings
vi.mock('./Minimap', () => ({
  Minimap: () => <div data-testid="minimap-mock" />,
}));

// Mock CodeMirror components to avoid JSDOM issues with CodeMirror 6
// These mocks render diff content and comment UI directly without needing real CodeMirror
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

  interface UnifiedEditorProps {
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
  }

  interface SplitEditorProps {
    alignedLines: { left: MockDiffLine | null; right: MockDiffLine | null }[];
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
  }

  // Mock UnifiedDiffEditor that renders diff content and comments directly
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
  }: UnifiedEditorProps) => {
    // Emit initial visible range
    useEffect(() => {
      if (onVisibleRangeChange) {
        onVisibleRangeChange({ startIndex: 0, stopIndex: Math.min(20, diffLines.length - 1) });
      }
    }, [onVisibleRangeChange, diffLines.length]);

    // Collect all threads
    const allThreads: MockThread[] = [];
    if (threadsByLineAndSide) {
      threadsByLineAndSide.forEach((threads) => {
        allThreads.push(...threads);
      });
    }

    return React.createElement('div', { 'data-testid': 'unified-diff-editor', className: 'cm-scroller' },
      // Diff lines
      ...diffLines.map((line, i) =>
        React.createElement('div', { key: i, className: 'diff-line' }, line.content)
      ),
      // Render comment threads directly
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
      // Render draft editor directly
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

  // Mock SplitDiffEditor (similar pattern)
  const MockSplitDiffEditor = ({
    alignedLines,
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
  }: SplitEditorProps) => {
    useEffect(() => {
      if (onVisibleRangeChange) {
        onVisibleRangeChange({ startIndex: 0, stopIndex: Math.min(20, alignedLines.length - 1) });
      }
    }, [onVisibleRangeChange, alignedLines.length]);

    const allThreads: MockThread[] = [];
    if (threadsByLineAndSide) {
      threadsByLineAndSide.forEach((threads) => {
        allThreads.push(...threads);
      });
    }

    return React.createElement('div', { 'data-testid': 'split-diff-editor', className: 'cm-scroller' },
      ...alignedLines.map((pair, i) =>
        React.createElement('div', { key: i, className: 'diff-line-pair' },
          React.createElement('span', null, pair.left?.content ?? ''),
          React.createElement('span', null, pair.right?.content ?? '')
        )
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

  // Mock CommentPortalManager - just render children directly, mocks handle the UI
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

// Mock useIterationDiff hook for iteration switch tests
const mockIterationDiff = {
  isIterationMode: false,
  getFileDiffByPath: vi.fn(() => null),
  selectedRange: null as { fromSnapshot: number; toSnapshot: number } | null,
  changedFiles: [],
  getArtifactByPath: vi.fn(() => undefined),
};

// Mock useIterationAwareFiles hook
const mockIterationAwareFiles = {
  files: [],
  isIterationMode: false,
  totalFilesInPR: 0,
};

// Mock useDiffPipeline hook
const mockDiffPipeline = {
  diffLines: [],
  alignedLines: [],
  language: 'typescript',
  viewMode: 'inline' as const,
  showWhitespace: false,
  contentFilter: 'both' as const,
  lineNumberMode: 'both' as const,
  textWrap: 'nowrap' as const,
  hunkIndices: [],
  scrollToRowIndex: undefined,
  isFullFileChange: false,
  threadsByLineAndSide: new Map(),
  filename: undefined as string | undefined,
  isIterationMode: false,
  sourceAlignedLines: null,
  _isLoadingFullFile: false,
  _fullFileError: null as string | null,
};

// Mock useDraftComment hook
const mockDraftComment = {
  draftLineIndex: null as number | null,
  draftSide: null as 'LEFT' | 'RIGHT' | null,
  draftBody: '',
  isSubmitting: false,
  submitError: null as string | null,
  startComment: vi.fn(),
  cancelDraft: vi.fn(),
  setDraftBody: vi.fn(),
  submitComment: vi.fn().mockResolvedValue(undefined),
};

// Mock useContainerHeight hook
const mockContainerHeight = {
  containerHeight: 600,
  containerRefCallback: vi.fn(),
  scrollContainerRef: { current: null },
};

vi.mock('../hooks', () => ({
  useIterationDiff: vi.fn(() => mockIterationDiff),
  useIterationAwareFiles: vi.fn(() => mockIterationAwareFiles),
  useDiffPipeline: vi.fn(() => mockDiffPipeline),
  useDraftComment: vi.fn(() => mockDraftComment),
  useContainerHeight: vi.fn(() => mockContainerHeight),
}));

const mockDefaultCommentsState = {
  threads: [],
  isLoading: false,
  error: null,
  announcement: '',
  currentUser: { id: 'user-1', login: 'testuser', avatarUrl: 'https://example.com/avatar.png' },
  addComment: vi.fn().mockResolvedValue(undefined),
  addReply: vi.fn().mockResolvedValue(undefined),
  editComment: vi.fn().mockResolvedValue(undefined),
  deleteComment: vi.fn().mockResolvedValue(undefined),
  toggleResolved: vi.fn(),
  clearAnnouncement: vi.fn(),
};

// Default viewConfig for all tests
const mockDefaultViewConfig = {
  mode: 'inline' as const,
  filter: 'both' as const,
  showFullFile: false,
  showWhitespace: false,
};

// Default diff store state for all tests
const mockDefaultDiffState = {
  files: [],
  selectedFileIndex: 0,
  isLoading: false,
  viewConfig: mockDefaultViewConfig,
  currentChangeIndex: -1,
  totalChangeCount: 0,
  setTotalChangeCount: vi.fn(),
  resetChangeIndex: vi.fn(),
};

describe('DiffView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCommentsStore).mockReturnValue(mockDefaultCommentsState);
    vi.mocked(usePRStore).mockReturnValue({
      currentPR: null,
      isLoading: false,
    });
    // Reset pipeline hooks to defaults
    vi.mocked(useDiffPipeline).mockReturnValue({ ...mockDiffPipeline });
    vi.mocked(useDraftComment).mockReturnValue({ ...mockDraftComment });
    vi.mocked(useContainerHeight).mockReturnValue({ ...mockContainerHeight });
    vi.mocked(useIterationDiff).mockReturnValue({ ...mockIterationDiff });
    vi.mocked(useIterationAwareFiles).mockReturnValue({ ...mockIterationAwareFiles });
  });

  it('shows loading state', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      isLoading: true,
    });

    render(<DiffView />);

    expect(screen.getByRole('status', { name: /Loading diff/i })).toBeInTheDocument();
  });

  it('shows empty state when no file selected', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
    });

    render(<DiffView />);

    expect(screen.getByText(/Select a file to view diff/i)).toBeInTheDocument();
  });

  it('shows message when file has no patch', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'binary.png',
          status: FileChangeStatus.Modified,
          additions: 0,
          deletions: 0,
          changes: 0,
          patch: '',
        },
      ],
    });

    render(<DiffView />);

    expect(screen.getByText(/No diff available/i)).toBeInTheDocument();
    expect(screen.getByText(/binary file or too large/i)).toBeInTheDocument();
  });

  it('renders diff content with file header', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [
        { type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'addition', content: '+added line', oldLineNumber: null, newLineNumber: 2 },
      ],
    });

    render(<DiffView />);

    expect(screen.getByRole('heading', { name: 'src/index.ts' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Diff content for src\/index.ts/i })).toBeInTheDocument();
  });

  it('displays comment loading state', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [{ type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 }],
    });

    vi.mocked(useCommentsStore).mockReturnValue({
      ...mockDefaultCommentsState,
      isLoading: true,
    });

    render(<DiffView />);

    expect(screen.getByText(/Loading comments/i)).toBeInTheDocument();
  });

  it('displays comment error', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [{ type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 }],
    });

    vi.mocked(useCommentsStore).mockReturnValue({
      ...mockDefaultCommentsState,
      error: 'Failed to load comments',
    });

    render(<DiffView />);

    expect(screen.getByText(/Failed to load comments/i)).toBeInTheDocument();
  });

  it('displays announcements in aria-live region', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [{ type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 }],
    });

    vi.mocked(useCommentsStore).mockReturnValue({
      ...mockDefaultCommentsState,
      announcement: 'Comment posted.',
    });

    render(<DiffView />);

    expect(screen.getByRole('status')).toHaveTextContent('Comment posted.');
  });

  it('submits a comment successfully', async () => {
    const mockSubmitComment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [
        { type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'addition', content: '+added line', oldLineNumber: null, newLineNumber: 2 },
      ],
    });

    vi.mocked(useDraftComment).mockReturnValue({
      ...mockDraftComment,
      draftLineIndex: 1,
      draftSide: 'RIGHT',
      draftBody: 'Test comment',
      submitComment: mockSubmitComment,
    });

    render(<DiffView />);

    // Submit button should be visible when draft is active
    const submitButton = screen.getByRole('button', { name: /^comment$/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitComment).toHaveBeenCalled();
    });
  });

  it('cancels comment editing', async () => {
    const mockCancelDraft = vi.fn();
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [
        { type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'addition', content: '+added line', oldLineNumber: null, newLineNumber: 2 },
      ],
    });

    vi.mocked(useDraftComment).mockReturnValue({
      ...mockDraftComment,
      draftLineIndex: 1,
      draftSide: 'RIGHT',
      draftBody: '',
      cancelDraft: mockCancelDraft,
    });

    render(<DiffView />);

    // With draft active, editor should be showing
    const textarea = await screen.findByRole('textbox');
    expect(textarea).toBeInTheDocument();

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Should call cancelDraft
    await waitFor(() => {
      expect(mockCancelDraft).toHaveBeenCalled();
    });
  });

  it('handles comment submission error', async () => {
    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [
        { type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'addition', content: '+added line', oldLineNumber: null, newLineNumber: 2 },
      ],
    });

    // Configure draft with an error state
    vi.mocked(useDraftComment).mockReturnValue({
      ...mockDraftComment,
      draftLineIndex: 1,
      draftSide: 'RIGHT',
      draftBody: 'Test comment',
      submitError: 'Network error',
    });

    render(<DiffView />);

    // Error message should appear in the comment editor
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('renders existing comment threads', () => {
    const thread = {
      id: 'thread-1',
      path: 'src/index.ts',
      line: 2,
      side: 'RIGHT' as const,
      isResolved: false,
      originalLine: 2,
      originalCommitId: 'abc123',
      trackedLine: null,
      comments: [
        {
          id: 'comment-1',
          body: 'This is a test comment',
          author: { id: 'user-1', login: 'testuser', avatarUrl: 'https://example.com/avatar.png' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          path: 'src/index.ts',
          line: 2,
          side: 'RIGHT' as const,
          position: 1,
          originalLine: 2,
          originalCommitId: 'abc123',
        },
      ],
    };

    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    // Configure pipeline with thread mapped to the correct line index
    const threadMap = new Map<string, typeof thread[]>();
    threadMap.set('1-RIGHT', [thread]); // index 1 is the addition line

    vi.mocked(useDiffPipeline).mockReturnValue({
      ...mockDiffPipeline,
      filename: 'src/index.ts',
      diffLines: [
        { type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'addition', content: '+added line', oldLineNumber: null, newLineNumber: 2 },
      ],
      threadsByLineAndSide: threadMap,
    });

    vi.mocked(useCommentsStore).mockReturnValue({
      ...mockDefaultCommentsState,
      threads: [thread],
    });

    render(<DiffView />);

    expect(screen.getByText('This is a test comment')).toBeInTheDocument();
  });

  it('clears announcement after timeout', () => {
    vi.useFakeTimers();
    const clearAnnouncement = vi.fn();

    vi.mocked(useDiffStore).mockReturnValue({
      ...mockDefaultDiffState,
      files: [
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1,3 +1,4 @@\n context\n+added line',
        },
      ],
    });

    vi.mocked(useCommentsStore).mockReturnValue({
      ...mockDefaultCommentsState,
      announcement: 'Comment posted.',
      clearAnnouncement,
    });

    render(<DiffView />);

    // Fast forward past the announcement timeout (4000ms)
    vi.advanceTimersByTime(4100);

    expect(clearAnnouncement).toHaveBeenCalled();

    vi.useRealTimers();
  });

  describe('Change navigation disabled for full file changes', () => {
    it('disables change navigation for added files', async () => {
      const setTotalChangeCount = vi.fn();
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/new-file.ts',
            status: FileChangeStatus.Added,
            additions: 10,
            deletions: 0,
            changes: 10,
            patch: '@@ -0,0 +1,3 @@\n+line 1\n+line 2\n+line 3',
          },
        ],
        setTotalChangeCount,
      });

      render(<DiffView />);

      await waitFor(() => {
        expect(setTotalChangeCount).toHaveBeenCalledWith(0);
      });
    });

    it('disables change navigation for deleted files', async () => {
      const setTotalChangeCount = vi.fn();
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/old-file.ts',
            status: FileChangeStatus.Deleted,
            additions: 0,
            deletions: 10,
            changes: 10,
            patch: '@@ -1,3 +0,0 @@\n-line 1\n-line 2\n-line 3',
          },
        ],
        setTotalChangeCount,
      });

      render(<DiffView />);

      await waitFor(() => {
        expect(setTotalChangeCount).toHaveBeenCalledWith(0);
      });
    });

    it('enables change navigation for modified files', async () => {
      const setTotalChangeCount = vi.fn();
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/index.ts',
            status: FileChangeStatus.Modified,
            additions: 1,
            deletions: 1,
            changes: 2,
            patch: '@@ -1,3 +1,3 @@\n context\n-old line\n+new line',
          },
        ],
        setTotalChangeCount,
      });

      // Pipeline has hunkIndices for a modified file
      vi.mocked(useDiffPipeline).mockReturnValue({
        ...mockDiffPipeline,
        filename: 'src/index.ts',
        diffLines: [
          { type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'deletion', content: '-old line', oldLineNumber: 2, newLineNumber: null },
          { type: 'addition', content: '+new line', oldLineNumber: null, newLineNumber: 2 },
        ],
        hunkIndices: [1], // One hunk starting at index 1
      });

      render(<DiffView />);

      // Should be called with a positive number (the actual hunk count)
      await waitFor(() => {
        expect(setTotalChangeCount).toHaveBeenCalled();
        const lastCall = setTotalChangeCount.mock.calls[setTotalChangeCount.mock.calls.length - 1];
        expect(lastCall?.[0]).toBeGreaterThan(0);
      });
    });
  });

  describe('Change navigation in iteration mode (Issue #140)', () => {
    // Issue #140: J/K navigation not working in iteration mode with full file view
    // The bug was that isFullFileChange used PR-level file status, not iteration-level status

    it('enables navigation for Added file with context lines in iteration diff', async () => {
      // Scenario: File was added to PR overall, but in iteration mode it shows
      // modifications (has context lines), so navigation should be enabled
      const setTotalChangeCount = vi.fn();
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/new-file.ts',
            status: FileChangeStatus.Added, // PR-level status: Added
            additions: 100,
            deletions: 0,
            changes: 100,
            patch: '@@ -0,0 +1,3 @@\n+line 1\n+line 2\n+line 3',
          },
        ],
        setTotalChangeCount,
      });

      // Mock iteration mode with diff that has context lines (file modified between iterations)
      vi.mocked(useIterationDiff).mockReturnValue({
        ...mockIterationDiff,
        isIterationMode: true,
        selectedRange: { fromSnapshot: 2, toSnapshot: 3 },
        getFileDiffByPath: vi.fn(() => ({
          diffLines: [
            { type: 'context' as const, content: '// existing line', oldLineNumber: 1, newLineNumber: 1 },
            { type: 'deletion' as const, content: '// old line', oldLineNumber: 2, newLineNumber: null },
            { type: 'addition' as const, content: '// new line', oldLineNumber: null, newLineNumber: 2 },
            { type: 'context' as const, content: '// another existing', oldLineNumber: 3, newLineNumber: 3 },
          ],
          alignedLines: [],
          base: { path: 'src/new-file.ts', ref: 'base123', content: '// existing line\n// old line\n// another existing', lines: [], language: 'typescript' },
          head: { path: 'src/new-file.ts', ref: 'head456', content: '// existing line\n// new line\n// another existing', lines: [], language: 'typescript' },
        })),
      });

      // Pipeline configured for iteration mode with hunks enabled
      vi.mocked(useDiffPipeline).mockReturnValue({
        ...mockDiffPipeline,
        filename: 'src/new-file.ts',
        isIterationMode: true,
        diffLines: [
          { type: 'context', content: '// existing line', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'deletion', content: '// old line', oldLineNumber: 2, newLineNumber: null },
          { type: 'addition', content: '// new line', oldLineNumber: null, newLineNumber: 2 },
          { type: 'context', content: '// another existing', oldLineNumber: 3, newLineNumber: 3 },
        ],
        hunkIndices: [1], // One hunk starting at index 1 (the deletion/addition)
      });

      render(<DiffView />);

      // Should enable navigation (hunk count > 0) because iteration diff has context lines
      await waitFor(() => {
        expect(setTotalChangeCount).toHaveBeenCalled();
        const lastCall = setTotalChangeCount.mock.calls[setTotalChangeCount.mock.calls.length - 1];
        expect(lastCall?.[0]).toBeGreaterThan(0);
      });
    });

    it('disables navigation for Added file with no context lines in iteration diff', async () => {
      // Scenario: File was added in this iteration range (no context = entirely new)
      const setTotalChangeCount = vi.fn();
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/brand-new-file.ts',
            status: FileChangeStatus.Added,
            additions: 50,
            deletions: 0,
            changes: 50,
            patch: '@@ -0,0 +1,3 @@\n+line 1\n+line 2\n+line 3',
          },
        ],
        setTotalChangeCount,
      });

      // Mock iteration mode with diff that has NO context lines (file entirely added)
      vi.mocked(useIterationDiff).mockReturnValue({
        ...mockIterationDiff,
        isIterationMode: true,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        getFileDiffByPath: vi.fn(() => ({
          diffLines: [
            { type: 'addition' as const, content: '// line 1', oldLineNumber: null, newLineNumber: 1 },
            { type: 'addition' as const, content: '// line 2', oldLineNumber: null, newLineNumber: 2 },
            { type: 'addition' as const, content: '// line 3', oldLineNumber: null, newLineNumber: 3 },
          ],
          alignedLines: [],
          base: null,
          head: { path: 'src/brand-new-file.ts', ref: 'head456', content: '// line 1\n// line 2\n// line 3', lines: [], language: 'typescript' },
        })),
      });

      render(<DiffView />);

      // Should disable navigation (0 hunks) because entire file is added
      await waitFor(() => {
        expect(setTotalChangeCount).toHaveBeenCalledWith(0);
      });
    });

    it('respects PR-level status when not in iteration mode', async () => {
      // Verify original behavior still works: Added files disable navigation in non-iteration mode
      const setTotalChangeCount = vi.fn();
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/new-file.ts',
            status: FileChangeStatus.Added,
            additions: 10,
            deletions: 0,
            changes: 10,
            patch: '@@ -0,0 +1,3 @@\n+line 1\n+line 2\n+line 3',
          },
        ],
        setTotalChangeCount,
      });

      // Not in iteration mode
      vi.mocked(useIterationDiff).mockReturnValue({
        ...mockIterationDiff,
        isIterationMode: false,
        selectedRange: null,
        getFileDiffByPath: vi.fn(() => null),
      });

      render(<DiffView />);

      // Should disable navigation based on PR-level Added status
      await waitFor(() => {
        expect(setTotalChangeCount).toHaveBeenCalledWith(0);
      });
    });
  });

  describe('Change navigation reset on iteration switch', () => {
    it('calls resetChangeIndex when iteration selectedRange changes', async () => {
      const resetChangeIndex = vi.fn();
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/index.ts',
            status: FileChangeStatus.Modified,
            additions: 1,
            deletions: 1,
            changes: 2,
            patch: '@@ -1,3 +1,3 @@\n context\n-old line\n+new line',
          },
        ],
        resetChangeIndex,
      });

      // Initial render with no iteration selected
      vi.mocked(useIterationDiff).mockReturnValue({
        ...mockIterationDiff,
        selectedRange: null,
      });

      const { rerender } = render(<DiffView />);

      // resetChangeIndex called on initial render
      expect(resetChangeIndex).toHaveBeenCalled();
      const initialCallCount = resetChangeIndex.mock.calls.length;

      // Simulate iteration switch by changing selectedRange
      vi.mocked(useIterationDiff).mockReturnValue({
        ...mockIterationDiff,
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
      });

      rerender(<DiffView />);

      // resetChangeIndex should be called again due to selectedRange change
      await waitFor(() => {
        expect(resetChangeIndex.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('PR Description view', () => {
    it('displays PR metadata and description when PR description is selected', () => {
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        selectedFileIndex: -1, // PR_DESCRIPTION_INDEX
      });

      vi.mocked(usePRStore).mockReturnValue({
        currentPR: {
          id: 1,
          number: 123,
          title: 'Test PR Title',
          description: 'Test PR description content',
          state: 'open',
          author: { id: 'user-1', displayName: 'testuser', avatarUrl: 'https://example.com/avatar.png' },
          sourceBranch: 'feature/test',
          targetBranch: 'main',
          htmlUrl: 'https://github.com/test/repo/pull/123',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
        isLoading: false,
      });

      render(<DiffView />);

      expect(screen.getByTestId('pr-metadata')).toHaveTextContent('Test PR Title');
      expect(screen.getByTestId('pr-description')).toHaveTextContent('Test PR description content');
    });

    it('shows loading state when PR is loading and description is selected', () => {
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        selectedFileIndex: -1, // PR_DESCRIPTION_INDEX
      });

      vi.mocked(usePRStore).mockReturnValue({
        currentPR: null,
        isLoading: true,
      });

      render(<DiffView />);

      expect(screen.getByRole('status', { name: /Loading diff/i })).toBeInTheDocument();
    });

    it('shows fallback message when currentPR is null', () => {
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        selectedFileIndex: -1, // PR_DESCRIPTION_INDEX
      });

      vi.mocked(usePRStore).mockReturnValue({
        currentPR: null,
        isLoading: false,
      });

      render(<DiffView />);

      expect(screen.getByText(/No PR data available/i)).toBeInTheDocument();
    });
  });

  describe('keyboard scrolling', () => {
    const setupKeyboardTest = () => {
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [
          {
            filename: 'src/index.ts',
            status: FileChangeStatus.Modified,
            additions: 1,
            deletions: 0,
            changes: 1,
            patch: '@@ -1,3 +1,4 @@\n context\n+added line',
          },
        ],
      });

      vi.mocked(useDiffPipeline).mockReturnValue({
        ...mockDiffPipeline,
        filename: 'src/index.ts',
        diffLines: [
          { type: 'context', content: ' context', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'addition', content: '+added line', oldLineNumber: null, newLineNumber: 2 },
        ],
      });
    };

    // Helper to get the scrollable CodeMirror element inside the diff region
    const getScrollableList = (diffRegion: HTMLElement): HTMLElement => {
      const scrollable = diffRegion.querySelector('.cm-scroller');
      if (!scrollable) {
        throw new Error('CodeMirror scroller not found');
      }
      return scrollable as HTMLElement;
    };

    it('PageDown scrolls the diff content area by a page minus 3 lines for context', () => {
      setupKeyboardTest();
      render(<DiffView />);

      const diffRegion = screen.getByRole('region', { name: /Diff content for src\/index.ts/i });
      const scrollable = getScrollableList(diffRegion);
      scrollable.scrollBy = vi.fn();

      // Focus the diff area and press PageDown
      fireEvent.keyDown(diffRegion, { key: 'PageDown' });

      // Should scroll down by (floor(containerHeight / LINE_HEIGHT) - 3) * LINE_HEIGHT
      // containerHeight = 600, LINE_HEIGHT = 23
      // floor(600 / 23) = 26 lines, 26 - 3 = 23 lines, 23 * 23 = 529px
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(scrollable.scrollBy).toHaveBeenCalledWith({ top: 529, behavior: 'smooth' });
    });

    it('PageUp scrolls the diff content area up by a page minus 3 lines for context', () => {
      setupKeyboardTest();
      render(<DiffView />);

      const diffRegion = screen.getByRole('region', { name: /Diff content for src\/index.ts/i });
      const scrollable = getScrollableList(diffRegion);
      scrollable.scrollBy = vi.fn();

      // Focus the diff area and press PageUp
      fireEvent.keyDown(diffRegion, { key: 'PageUp' });

      // Should scroll up by (floor(containerHeight / LINE_HEIGHT) - 3) * LINE_HEIGHT
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(scrollable.scrollBy).toHaveBeenCalledWith({ top: -529, behavior: 'smooth' });
    });

    it('Home scrolls to the top of the diff content area', () => {
      setupKeyboardTest();
      render(<DiffView />);

      const diffRegion = screen.getByRole('region', { name: /Diff content for src\/index.ts/i });
      const scrollable = getScrollableList(diffRegion);
      scrollable.scrollTo = vi.fn();

      // Focus the diff area and press Home
      fireEvent.keyDown(diffRegion, { key: 'Home' });

      // Should scroll to top
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(scrollable.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('End scrolls to the bottom of the diff content area', () => {
      setupKeyboardTest();
      render(<DiffView />);

      const diffRegion = screen.getByRole('region', { name: /Diff content for src\/index.ts/i });
      const scrollable = getScrollableList(diffRegion);
      // Mock scrollHeight and clientHeight properties
      Object.defineProperty(scrollable, 'scrollHeight', { value: 5000, configurable: true });
      Object.defineProperty(scrollable, 'clientHeight', { value: 600, configurable: true });
      scrollable.scrollTo = vi.fn();

      // Focus the diff area and press End
      fireEvent.keyDown(diffRegion, { key: 'End' });

      // Should scroll to bottom (scrollHeight - clientHeight positions last content at bottom)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(scrollable.scrollTo).toHaveBeenCalledWith({ top: 4400, behavior: 'smooth' });
    });
  });

  describe('Issue #183: Artifact-only files', () => {
    // Files that exist in artifact but not in GitHub API (e.g., modified then reverted)
    // should still display their diff when selected

    it('should display diff for artifact-only file in iteration mode', async () => {
      // GitHub files array is empty - file A was modified then reverted
      vi.mocked(useDiffStore).mockReturnValue({
        ...mockDefaultDiffState,
        files: [], // No GitHub files
        selectedFileIndex: 0, // Artifact-only file gets index 0
      });

      // Iteration mode is active with artifact-only file
      vi.mocked(useIterationDiff).mockReturnValue({
        isIterationMode: true,
        getFileDiffByPath: vi.fn((path) => {
          if (path === 'artifact-only.txt') {
            return {
              base: { path: 'artifact-only.txt', ref: 'abc123', content: 'original content', lines: ['original content'], language: 'text' },
              head: { path: 'artifact-only.txt', ref: 'def456', content: 'modified content', lines: ['modified content'], language: 'text' },
              diffLines: [
                { type: 'context' as const, content: ' original content', oldLineNumber: 1, newLineNumber: null },
                { type: 'addition' as const, content: '+modified content', oldLineNumber: null, newLineNumber: 1 },
              ],
              alignedLines: [],
            };
          }
          return null;
        }),
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        changedFiles: [],
        getArtifactByPath: vi.fn(() => undefined),
      });

      // Iteration-aware files includes the artifact-only file
      vi.mocked(useIterationAwareFiles).mockReturnValue({
        files: [
          {
            filename: 'artifact-only.txt',
            status: FileChangeStatus.Modified,
            additions: 1,
            deletions: 1,
            changes: 2,
            patch: '',
            originalIndex: 0,
            artifactId: 1,
          },
        ],
        isIterationMode: true,
        totalFilesInPR: 0,
      });

      // Configure pipeline with the artifact-only file's diff
      vi.mocked(useDiffPipeline).mockReturnValue({
        ...mockDiffPipeline,
        filename: 'artifact-only.txt',
        isIterationMode: true,
        diffLines: [
          { type: 'context', content: ' original content', oldLineNumber: 1, newLineNumber: null },
          { type: 'addition', content: '+modified content', oldLineNumber: null, newLineNumber: 1 },
        ],
      });

      render(<DiffView />);

      // Should show the diff content, not empty state
      await waitFor(() => {
        expect(screen.getByText(/modified content/)).toBeInTheDocument();
      });
    });
  });
});
