import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/tests/helpers';
import { DiffView } from './DiffView';
import { useDiffStore } from '../stores';
import { useCommentsStore } from '@/features/comments';
import { usePRStore } from '@/features/pr';
import { FileChangeStatus } from '@/api/types';
import { useIterationDiff } from '../hooks';

const mockDiffContentStore = {
  computeFullFileDiff: vi.fn().mockResolvedValue(null),
  isLoadingContent: false,
  contentError: null,
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
  };
});

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ owner: 'testowner', repo: 'testrepo' })),
}));

// Mock useIterationDiff hook for iteration switch tests
const mockIterationDiff = {
  isIterationMode: false,
  getFileDiffByPath: vi.fn(() => null),
  selectedRange: null as { fromSnapshot: number; toSnapshot: number } | null,
  changedFiles: [],
  getArtifactByPath: vi.fn(() => undefined),
};
vi.mock('../hooks', () => ({
  useIterationDiff: vi.fn(() => mockIterationDiff),
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
  mode: 'unified' as const,
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

    vi.mocked(useCommentsStore).mockReturnValue({
      ...mockDefaultCommentsState,
      announcement: 'Comment posted.',
    });

    render(<DiffView />);

    expect(screen.getByRole('status')).toHaveTextContent('Comment posted.');
  });

  it('opens comment editor when clicking add comment button', async () => {
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

    render(<DiffView />);

    // Find and click the add comment button on a diff line
    const addCommentButtons = screen.getAllByRole('button', { name: /add comment/i });
    expect(addCommentButtons.length).toBeGreaterThan(0);

    const firstButton = addCommentButtons[0];
    if (firstButton) {
      fireEvent.click(firstButton);
    }

    // CommentEditor should now be visible
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('submits a comment successfully', async () => {
    const mockAddComment = vi.fn().mockResolvedValue(undefined);
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
      addComment: mockAddComment,
    });

    render(<DiffView />);

    // Click add comment button on a code line (index 1), not header
    const addCommentButtons = screen.getAllByRole('button', { name: /add comment/i });
    const codeLineButton = addCommentButtons[1];
    if (codeLineButton) {
      fireEvent.click(codeLineButton);
    }

    // Type a comment
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test comment' } });

    // Submit the comment (button is named "Comment")
    const submitButton = screen.getByRole('button', { name: /^comment$/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalled();
    });
  });

  it('cancels comment editing', async () => {
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

    render(<DiffView />);

    // Click add comment button
    const addCommentButtons = screen.getAllByRole('button', { name: /add comment/i });
    const firstButton = addCommentButtons[0];
    if (firstButton) {
      fireEvent.click(firstButton);
    }

    // Wait for editor to appear
    const textarea = await screen.findByRole('textbox');
    expect(textarea).toBeInTheDocument();

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Editor should be gone
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  it('handles comment submission error', async () => {
    const mockAddComment = vi.fn().mockRejectedValue(new Error('Network error'));
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
      addComment: mockAddComment,
    });

    render(<DiffView />);

    // Click add comment button
    const addCommentButtons = screen.getAllByRole('button', { name: /add comment/i });
    const codeLineButton = addCommentButtons[1];
    if (codeLineButton) {
      fireEvent.click(codeLineButton);
    }

    // Type and submit a comment
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test comment' } });

    const submitButton = screen.getByRole('button', { name: /^comment$/i });
    fireEvent.click(submitButton);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('renders existing comment threads', () => {
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
      threads: [
        {
          id: 'thread-1',
          path: 'src/index.ts',
          line: 2,
          side: 'RIGHT' as const,
          isResolved: false,
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
            },
          ],
        },
      ],
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

      render(<DiffView />);

      // Should be called with a positive number (the actual hunk count)
      await waitFor(() => {
        expect(setTotalChangeCount).toHaveBeenCalled();
        const lastCall = setTotalChangeCount.mock.calls[setTotalChangeCount.mock.calls.length - 1];
        expect(lastCall?.[0]).toBeGreaterThan(0);
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
});
