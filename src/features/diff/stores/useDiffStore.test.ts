import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useDiffStore, PR_DESCRIPTION_INDEX } from './useDiffStore';
import { FileChangeStatus } from '@/api/types';
import * as api from '@/api';

// Store mock reference outside to avoid unbound-method warning
let mockGetFiles: Mock;

// Mock the API
vi.mock('@/api', () => {
  const getFilesFn = vi.fn();
  return {
    githubBackends: {
      review: {
        getReview: vi.fn(),
      },
      file: {
        getFiles: getFilesFn,
      },
    },
    GitHubAPIError: class GitHubAPIError extends Error {
      constructor(public status: number, public statusText: string, message: string) {
        super(message);
        this.name = 'GitHubAPIError';
      }
    },
  };
});

describe('useDiffStore', () => {
  const mockFiles = [
    {
      filename: 'src/file1.ts',
      status: FileChangeStatus.Modified,
      additions: 10,
      deletions: 5,
      changes: 15,
      patch: '@@...',
    },
    {
      filename: 'src/file2.ts',
      status: FileChangeStatus.Added,
      additions: 20,
      deletions: 0,
      changes: 20,
      patch: '@@...',
    },
    {
      filename: 'src/file3.ts',
      status: FileChangeStatus.Deleted,
      additions: 0,
      deletions: 30,
      changes: 30,
      patch: '@@...',
    },
  ];

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    mockGetFiles = api.githubBackends.file.getFiles as Mock;
    useDiffStore.setState({
      files: [],
      selectedFileIndex: PR_DESCRIPTION_INDEX,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadFiles', () => {
    it('loads files successfully', async () => {
      mockGetFiles.mockResolvedValue(mockFiles);

      await useDiffStore.getState().loadFiles('owner', 'repo', 123);

      expect(useDiffStore.getState().files).toEqual(mockFiles);
      expect(useDiffStore.getState().selectedFileIndex).toBe(PR_DESCRIPTION_INDEX);
      expect(useDiffStore.getState().isLoading).toBe(false);
      expect(useDiffStore.getState().error).toBeNull();
    });

    it('resets selectedFileIndex when loading new files', async () => {
      useDiffStore.setState({ selectedFileIndex: 2 });
      mockGetFiles.mockResolvedValue(mockFiles);

      await useDiffStore.getState().loadFiles('owner', 'repo', 123);

      expect(useDiffStore.getState().selectedFileIndex).toBe(PR_DESCRIPTION_INDEX);
    });

    it('handles 404 error with specific message', async () => {
      mockGetFiles.mockRejectedValue(new api.GitHubAPIError(404, 'Not Found', 'Not Found'));

      await useDiffStore.getState().loadFiles('owner', 'repo', 123);

      expect(useDiffStore.getState().error).toBe('Pull request not found');
      expect(useDiffStore.getState().isLoading).toBe(false);
      expect(useDiffStore.getState().files).toEqual([]);
    });

    it('handles 401 error with access denied message', async () => {
      mockGetFiles.mockRejectedValue(new api.GitHubAPIError(401, 'Unauthorized', 'Unauthorized'));

      await useDiffStore.getState().loadFiles('owner', 'repo', 123);

      expect(useDiffStore.getState().error).toBe('Access denied');
      expect(useDiffStore.getState().isLoading).toBe(false);
    });

    it('handles 403 error with access denied message', async () => {
      mockGetFiles.mockRejectedValue(new api.GitHubAPIError(403, 'Forbidden', 'Forbidden'));

      await useDiffStore.getState().loadFiles('owner', 'repo', 123);

      expect(useDiffStore.getState().error).toBe('Access denied');
      expect(useDiffStore.getState().isLoading).toBe(false);
    });

    it('handles other GitHub API errors with error message', async () => {
      mockGetFiles.mockRejectedValue(new api.GitHubAPIError(500, 'Internal Server Error', 'Server error'));

      await useDiffStore.getState().loadFiles('owner', 'repo', 123);

      expect(useDiffStore.getState().error).toBe('Server error');
      expect(useDiffStore.getState().isLoading).toBe(false);
    });

    it('handles generic errors with error message', async () => {
      mockGetFiles.mockRejectedValue(new Error('Network failure'));

      await useDiffStore.getState().loadFiles('owner', 'repo', 123);

      expect(useDiffStore.getState().error).toBe('Network failure');
      expect(useDiffStore.getState().isLoading).toBe(false);
    });
  });

  describe('selectFile', () => {
    beforeEach(() => {
      useDiffStore.setState({ files: mockFiles, selectedFileIndex: 0 });
    });

    it('selects a valid file index', () => {
      useDiffStore.getState().selectFile(1);

      expect(useDiffStore.getState().selectedFileIndex).toBe(1);
    });

    it('selects PR description index (-1)', () => {
      useDiffStore.getState().selectFile(PR_DESCRIPTION_INDEX);

      expect(useDiffStore.getState().selectedFileIndex).toBe(PR_DESCRIPTION_INDEX);
    });

    it('does not select invalid index (too negative)', () => {
      useDiffStore.getState().selectFile(-2);

      expect(useDiffStore.getState().selectedFileIndex).toBe(0);
    });

    it('allows any non-negative index (supports artifact-only files in iteration mode)', () => {
      // Issue #183: In iteration mode, artifact-only files may have indices >= files.length
      // DiffView handles missing files gracefully via useIterationAwareFiles
      useDiffStore.getState().selectFile(10);

      expect(useDiffStore.getState().selectedFileIndex).toBe(10);
    });
  });

  describe('selectNextFile', () => {
    beforeEach(() => {
      useDiffStore.setState({ files: mockFiles, selectedFileIndex: 0 });
    });

    it('moves to the next file', () => {
      useDiffStore.getState().selectNextFile();

      expect(useDiffStore.getState().selectedFileIndex).toBe(1);
    });

    it('does not go beyond the last file', () => {
      useDiffStore.setState({ selectedFileIndex: 2 }); // Last file

      useDiffStore.getState().selectNextFile();

      expect(useDiffStore.getState().selectedFileIndex).toBe(2);
    });
  });

  describe('selectPreviousFile', () => {
    beforeEach(() => {
      useDiffStore.setState({ files: mockFiles, selectedFileIndex: 2 });
    });

    it('moves to the previous file', () => {
      useDiffStore.getState().selectPreviousFile();

      expect(useDiffStore.getState().selectedFileIndex).toBe(1);
    });

    it('moves from first file to PR description', () => {
      useDiffStore.setState({ selectedFileIndex: 0 });

      useDiffStore.getState().selectPreviousFile();

      expect(useDiffStore.getState().selectedFileIndex).toBe(PR_DESCRIPTION_INDEX);
    });

    it('does not go before PR description', () => {
      useDiffStore.setState({ selectedFileIndex: PR_DESCRIPTION_INDEX });

      useDiffStore.getState().selectPreviousFile();

      expect(useDiffStore.getState().selectedFileIndex).toBe(PR_DESCRIPTION_INDEX);
    });
  });

  describe('reset', () => {
    it('resets store to initial state', () => {
      useDiffStore.setState({
        files: mockFiles,
        selectedFileIndex: 1,
        isLoading: true,
        error: 'Some error',
      });

      useDiffStore.getState().reset();

      expect(useDiffStore.getState().files).toEqual([]);
      expect(useDiffStore.getState().selectedFileIndex).toBe(PR_DESCRIPTION_INDEX);
      expect(useDiffStore.getState().isLoading).toBe(false);
      expect(useDiffStore.getState().error).toBeNull();
    });

    it('preserves viewConfig on reset', () => {
      useDiffStore.setState({
        files: mockFiles,
        viewConfig: {
          mode: 'split',
          filter: 'left',
          showFullFile: true,
          showWhitespace: true,
          showComments: false,
        },
      });

      useDiffStore.getState().reset();

      const viewConfig = useDiffStore.getState().viewConfig;
      expect(viewConfig.mode).toBe('split');
      expect(viewConfig.filter).toBe('left');
      expect(viewConfig.showFullFile).toBe(true);
      expect(viewConfig.showWhitespace).toBe(true);
      expect(viewConfig.showComments).toBe(false);
    });
  });

  // Change Navigation Tests
  describe('change navigation', () => {
    beforeEach(() => {
      useDiffStore.setState({
        files: mockFiles,
        currentChangeIndex: -1,
        totalChangeCount: 5,
      });
    });

    describe('scrollToNextChange', () => {
      it('advances to the next change', () => {
        useDiffStore.setState({ currentChangeIndex: 0 });

        useDiffStore.getState().scrollToNextChange();

        expect(useDiffStore.getState().currentChangeIndex).toBe(1);
      });

      it('advances from -1 to 0 (first change)', () => {
        useDiffStore.setState({ currentChangeIndex: -1 });

        useDiffStore.getState().scrollToNextChange();

        expect(useDiffStore.getState().currentChangeIndex).toBe(0);
      });

      it('does not advance past the last change', () => {
        useDiffStore.setState({ currentChangeIndex: 4, totalChangeCount: 5 });

        useDiffStore.getState().scrollToNextChange();

        expect(useDiffStore.getState().currentChangeIndex).toBe(4);
      });

      it('normalizes out-of-range index after view mode change', () => {
        // Simulate: user navigated to index 5 in inline mode, then switched to split mode with only 3 hunks
        useDiffStore.setState({ currentChangeIndex: 5, totalChangeCount: 3 });

        useDiffStore.getState().scrollToNextChange();

        // Should normalize to -1 and then advance to 0
        expect(useDiffStore.getState().currentChangeIndex).toBe(0);
      });
    });

    describe('scrollToPreviousChange', () => {
      it('goes back to the previous change', () => {
        useDiffStore.setState({ currentChangeIndex: 2 });

        useDiffStore.getState().scrollToPreviousChange();

        expect(useDiffStore.getState().currentChangeIndex).toBe(1);
      });

      it('does not go before index 0', () => {
        useDiffStore.setState({ currentChangeIndex: 0 });

        useDiffStore.getState().scrollToPreviousChange();

        expect(useDiffStore.getState().currentChangeIndex).toBe(0);
      });

      it('does nothing when at index -1', () => {
        useDiffStore.setState({ currentChangeIndex: -1 });

        useDiffStore.getState().scrollToPreviousChange();

        expect(useDiffStore.getState().currentChangeIndex).toBe(-1);
      });

      it('normalizes out-of-range index after view mode change', () => {
        // Simulate: user navigated to index 5 in inline mode, then switched to split mode with only 3 hunks
        useDiffStore.setState({ currentChangeIndex: 5, totalChangeCount: 3 });

        useDiffStore.getState().scrollToPreviousChange();

        // Should normalize to 2 (last valid index) and then go back to 1
        expect(useDiffStore.getState().currentChangeIndex).toBe(1);
      });
    });

    describe('resetChangeIndex', () => {
      it('resets currentChangeIndex to -1 and totalChangeCount to 0', () => {
        useDiffStore.setState({ currentChangeIndex: 3, totalChangeCount: 5 });

        useDiffStore.getState().resetChangeIndex();

        expect(useDiffStore.getState().currentChangeIndex).toBe(-1);
        expect(useDiffStore.getState().totalChangeCount).toBe(0);
      });
    });

    describe('setTotalChangeCount', () => {
      it('sets the total change count', () => {
        useDiffStore.getState().setTotalChangeCount(10);

        expect(useDiffStore.getState().totalChangeCount).toBe(10);
      });
    });
  });

  // View Config Tests (S-3.3)
  describe('viewConfig', () => {
    beforeEach(() => {
      // Reset to defaults
      useDiffStore.setState({
        viewConfig: {
          mode: 'inline',
          filter: 'both',
          showFullFile: false,
          showWhitespace: false,
          showComments: true,
        },
      });
    });

    describe('setViewMode', () => {
      it('sets view mode to split', () => {
        useDiffStore.getState().setViewMode('split');
        expect(useDiffStore.getState().viewConfig.mode).toBe('split');
      });

      it('sets view mode to inline', () => {
        useDiffStore.setState({
          viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
        });
        useDiffStore.getState().setViewMode('inline');
        expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
      });

      it('preserves other viewConfig properties', () => {
        useDiffStore.setState({
          viewConfig: {
            mode: 'inline',
            filter: 'left',
            showFullFile: true,
            showWhitespace: true,
            showComments: false,
          },
        });

        useDiffStore.getState().setViewMode('split');

        const config = useDiffStore.getState().viewConfig;
        expect(config.mode).toBe('split');
        expect(config.filter).toBe('left');
        expect(config.showFullFile).toBe(true);
        expect(config.showWhitespace).toBe(true);
        expect(config.showComments).toBe(false);
      });
    });

    describe('setContentFilter', () => {
      it('sets filter to left', () => {
        useDiffStore.getState().setContentFilter('left');
        expect(useDiffStore.getState().viewConfig.filter).toBe('left');
      });

      it('sets filter to right', () => {
        useDiffStore.getState().setContentFilter('right');
        expect(useDiffStore.getState().viewConfig.filter).toBe('right');
      });

      it('sets filter to both', () => {
        useDiffStore.setState({
          viewConfig: { ...useDiffStore.getState().viewConfig, filter: 'left' },
        });
        useDiffStore.getState().setContentFilter('both');
        expect(useDiffStore.getState().viewConfig.filter).toBe('both');
      });
    });

    describe('toggleFullFile', () => {
      it('toggles showFullFile from false to true', () => {
        useDiffStore.getState().toggleFullFile();
        expect(useDiffStore.getState().viewConfig.showFullFile).toBe(true);
      });

      it('toggles showFullFile from true to false', () => {
        useDiffStore.setState({
          viewConfig: { ...useDiffStore.getState().viewConfig, showFullFile: true },
        });
        useDiffStore.getState().toggleFullFile();
        expect(useDiffStore.getState().viewConfig.showFullFile).toBe(false);
      });
    });

    describe('toggleWhitespace', () => {
      it('toggles showWhitespace from false to true', () => {
        useDiffStore.getState().toggleWhitespace();
        expect(useDiffStore.getState().viewConfig.showWhitespace).toBe(true);
      });

      it('toggles showWhitespace from true to false', () => {
        useDiffStore.setState({
          viewConfig: { ...useDiffStore.getState().viewConfig, showWhitespace: true },
        });
        useDiffStore.getState().toggleWhitespace();
        expect(useDiffStore.getState().viewConfig.showWhitespace).toBe(false);
      });
    });
  });
});
