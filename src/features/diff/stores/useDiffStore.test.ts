import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useDiffStore, PR_DESCRIPTION_INDEX } from './useDiffStore';
import { FileChangeStatus } from '@/api/types';
import { DiffViewMode, DiffContentFilter, DiffDisplayMode, WhitespaceBehavior } from '../types';
import * as api from '@/api';

// Store mock reference outside to avoid unbound-method warning
let mockGetFiles: Mock;
let mockGetFileContent: Mock;

// Mock the API
vi.mock('@/api', () => {
  const getFilesFn = vi.fn();
  const getFileContentFn = vi.fn();
  return {
    githubBackends: {
      review: {
        getReview: vi.fn(),
      },
      file: {
        getFiles: getFilesFn,
        getFileContent: getFileContentFn,
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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    mockGetFileContent = api.githubBackends.file.getFileContent as Mock;
    useDiffStore.setState({
      files: [],
      selectedFileIndex: PR_DESCRIPTION_INDEX,
      isLoading: false,
      error: null,
      viewMode: DiffViewMode.Inline,
      contentFilter: DiffContentFilter.Both,
      displayMode: DiffDisplayMode.ChangesOnly,
      whitespace: WhitespaceBehavior.None,
      fileContentCache: new Map(),
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

    it('does not select invalid index (out of bounds)', () => {
      useDiffStore.getState().selectFile(10);

      expect(useDiffStore.getState().selectedFileIndex).toBe(0);
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

  describe('view mode management', () => {
    it('sets view mode to SideBySide', () => {
      useDiffStore.getState().setViewMode(DiffViewMode.SideBySide);

      expect(useDiffStore.getState().viewMode).toBe(DiffViewMode.SideBySide);
    });

    it('sets view mode to LeftOnly', () => {
      useDiffStore.getState().setViewMode(DiffViewMode.LeftOnly);

      expect(useDiffStore.getState().viewMode).toBe(DiffViewMode.LeftOnly);
    });

    it('sets view mode to RightOnly', () => {
      useDiffStore.getState().setViewMode(DiffViewMode.RightOnly);

      expect(useDiffStore.getState().viewMode).toBe(DiffViewMode.RightOnly);
    });

    it('sets content filter to Left', () => {
      useDiffStore.getState().setContentFilter(DiffContentFilter.Left);

      expect(useDiffStore.getState().contentFilter).toBe(DiffContentFilter.Left);
    });

    it('sets content filter to Right', () => {
      useDiffStore.getState().setContentFilter(DiffContentFilter.Right);

      expect(useDiffStore.getState().contentFilter).toBe(DiffContentFilter.Right);
    });

    it('sets display mode to FullFile', () => {
      useDiffStore.getState().setDisplayMode(DiffDisplayMode.FullFile);

      expect(useDiffStore.getState().displayMode).toBe(DiffDisplayMode.FullFile);
    });

    it('sets whitespace to Ignore', () => {
      useDiffStore.getState().setWhitespace(WhitespaceBehavior.Ignore);

      expect(useDiffStore.getState().whitespace).toBe(WhitespaceBehavior.Ignore);
    });

    it('sets whitespace to None', () => {
      useDiffStore.getState().setWhitespace(WhitespaceBehavior.None);

      expect(useDiffStore.getState().whitespace).toBe(WhitespaceBehavior.None);
    });
  });

  describe('full file content', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      mockGetFileContent = api.githubBackends.file.getFileContent as Mock;
    });

    it('loads and caches file content', async () => {
      mockGetFileContent.mockResolvedValue('file content');

      await useDiffStore
        .getState()
        .loadFullFileContent('owner', 'repo', 'file.ts', 'base123', 'head456');

      expect(mockGetFileContent).toHaveBeenCalledTimes(2); // base and head
      expect(mockGetFileContent).toHaveBeenCalledWith('owner', 'repo', 'file.ts', 'base123');
      expect(mockGetFileContent).toHaveBeenCalledWith('owner', 'repo', 'file.ts', 'head456');

      const cache = useDiffStore.getState().fileContentCache;
      expect(cache.has('file.ts:base123:head456')).toBe(true);
    });

    it('uses cached content on second call', async () => {
      mockGetFileContent.mockResolvedValue('file content');

      // First call
      await useDiffStore
        .getState()
        .loadFullFileContent('owner', 'repo', 'file.ts', 'base123', 'head456');

      const callCount = mockGetFileContent.mock.calls.length;

      // Second call - should use cache
      await useDiffStore
        .getState()
        .loadFullFileContent('owner', 'repo', 'file.ts', 'base123', 'head456');

      expect(mockGetFileContent.mock.calls.length).toBe(callCount); // No additional calls
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

    it('preserves view preferences on reset', () => {
      useDiffStore.getState().setViewMode(DiffViewMode.SideBySide);
      useDiffStore.getState().setContentFilter(DiffContentFilter.Right);
      useDiffStore.getState().setDisplayMode(DiffDisplayMode.FullFile);

      const viewMode = useDiffStore.getState().viewMode;
      const contentFilter = useDiffStore.getState().contentFilter;
      const displayMode = useDiffStore.getState().displayMode;

      useDiffStore.getState().reset();

      expect(useDiffStore.getState().viewMode).toBe(viewMode);
      expect(useDiffStore.getState().contentFilter).toBe(contentFilter);
      expect(useDiffStore.getState().displayMode).toBe(displayMode);
    });
  });
});
