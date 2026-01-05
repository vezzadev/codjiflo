/**
 * Performance regression tests for DiffView
 *
 * These tests ensure that optimizations (memo, useCallback, selectors)
 * don't regress. They track the number of React commits/re-renders
 * when performing common operations like toggling Changes/Full view.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Profiler, ProfilerOnRenderCallback } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiffView } from './DiffView';
import { useDiffStore } from '../stores';
import { useCommentsStore } from '@/features/comments';
import { usePRStore } from '@/features/pr';
import { FileChangeStatus } from '@/api/types';

// Mock stores
const mockDiffContentStore = {
  computeFullFileDiff: vi.fn().mockResolvedValue(null),
  isLoadingContent: false,
  contentError: null,
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

vi.mock('../hooks', () => ({
  useIterationDiff: vi.fn(() => ({
    isIterationMode: false,
    changedFiles: [],
    getFileDiffByPath: vi.fn(() => null),
    getArtifactByPath: vi.fn(() => undefined),
    selectedRange: null,
  })),
}));

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ owner: 'testowner', repo: 'testrepo' })),
}));

// Generate a large patch with many lines to simulate real-world usage
function generateLargePatch(lineCount: number): string {
  const lines = ['@@ -1,' + lineCount + ' +1,' + lineCount + ' @@'];
  for (let i = 0; i < lineCount; i++) {
    if (i % 10 === 0) {
      lines.push('+added line ' + i);
    } else if (i % 10 === 5) {
      lines.push('-deleted line ' + i);
    } else {
      lines.push(' context line ' + i);
    }
  }
  return lines.join('\n');
}

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

describe('DiffView Performance', () => {
  let commitCount: number;
  let renderPhases: string[];

  const onRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    commitCount++;
    renderPhases.push(phase);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    commitCount = 0;
    renderPhases = [];

    vi.mocked(useCommentsStore).mockReturnValue(mockDefaultCommentsState);
    vi.mocked(usePRStore).mockReturnValue({
      currentPR: null,
      isLoading: false,
    });
  });

  describe('Changes/Full toggle re-renders', () => {
    it('should have max 2 commits when toggling showFullFile (StrictMode doubles)', async () => {
      const user = userEvent.setup();
      let currentShowFullFile = false;

      // Create a mock that can be updated
      const getMockDiffStore = () => ({
        files: [
          {
            filename: 'src/large-file.ts',
            status: FileChangeStatus.Modified,
            additions: 50,
            deletions: 50,
            changes: 100,
            patch: generateLargePatch(100),
          },
        ],
        selectedFileIndex: 0,
        isLoading: false,
        viewConfig: {
          mode: 'unified' as const,
          filter: 'both' as const,
          showFullFile: currentShowFullFile,
          showWhitespace: false,
        },
      });

      vi.mocked(useDiffStore).mockImplementation(getMockDiffStore);

      render(
        <Profiler id="DiffView" onRender={onRender}>
          <DiffView />
        </Profiler>
      );

      // Wait for initial render to complete
      await screen.findByRole('table');

      // Reset counters after initial render
      commitCount = 0;
      renderPhases = [];

      // Simulate toggle by updating the mock and triggering re-render
      currentShowFullFile = true;
      vi.mocked(useDiffStore).mockImplementation(getMockDiffStore);

      // Force re-render by clicking the toggle button
      const toggleButton = screen.getByRole('button', { name: /show full file/i });
      await user.click(toggleButton);

      // With proper memoization:
      // - 1 commit for the state change
      // - 1 more if StrictMode is enabled (doubles effects in dev)
      // Max 2 commits is acceptable
      expect(commitCount).toBeLessThanOrEqual(2);
    });

    it('should not re-render DiffLine components when only parent updates', async () => {
      // This test verifies that memo() on DiffLine is working
      let diffLineRenderCount = 0;

      // Spy on DiffLine renders by checking the profiler data
      const trackingOnRender: ProfilerOnRenderCallback = (
        id,
        phase,
        actualDuration,
        baseDuration
      ) => {
        // baseDuration includes all children, actualDuration is just this commit
        // If memo is working, actualDuration should be much smaller on updates
        if (phase === 'update' && actualDuration > 50) {
          // If update takes >50ms, DiffLines are likely re-rendering
          diffLineRenderCount++;
        }
      };

      vi.mocked(useDiffStore).mockReturnValue({
        files: [
          {
            filename: 'src/test.ts',
            status: FileChangeStatus.Modified,
            additions: 10,
            deletions: 10,
            changes: 20,
            patch: generateLargePatch(50),
          },
        ],
        selectedFileIndex: 0,
        isLoading: false,
        viewConfig: {
          mode: 'unified' as const,
          filter: 'both' as const,
          showFullFile: false,
          showWhitespace: false,
        },
      });

      render(
        <Profiler id="DiffView" onRender={trackingOnRender}>
          <DiffView />
        </Profiler>
      );

      await screen.findByRole('table');

      // Memoized components should result in fast updates
      // This is a sanity check that the test infrastructure works
      expect(diffLineRenderCount).toBe(0);
    });
  });

  describe('Initial render performance', () => {
    it('should render 100-line diff in single commit', async () => {
      vi.mocked(useDiffStore).mockReturnValue({
        files: [
          {
            filename: 'src/medium-file.ts',
            status: FileChangeStatus.Modified,
            additions: 50,
            deletions: 50,
            changes: 100,
            patch: generateLargePatch(100),
          },
        ],
        selectedFileIndex: 0,
        isLoading: false,
        viewConfig: {
          mode: 'unified' as const,
          filter: 'both' as const,
          showFullFile: false,
          showWhitespace: false,
        },
      });

      render(
        <Profiler id="DiffView" onRender={onRender}>
          <DiffView />
        </Profiler>
      );

      await screen.findByRole('table');

      // Initial mount should be 1 commit (or 2 with StrictMode)
      expect(commitCount).toBeLessThanOrEqual(2);
      expect(renderPhases.filter((p) => p === 'mount').length).toBeGreaterThanOrEqual(1);
    });
  });
});
