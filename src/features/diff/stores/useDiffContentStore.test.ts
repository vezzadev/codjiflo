/**
 * Tests for useDiffContentStore (S-3.1)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useDiffContentStore } from './useDiffContentStore';
import * as api from '@/api';

// Store mock reference outside to avoid unbound-method warning
let mockGetFileContent: Mock;

// Mock the API
vi.mock('@/api', () => {
  const getFileContentFn = vi.fn();
  return {
    githubBackends: {
      file: {
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

describe('useDiffContentStore', () => {
  const mockFileContent = {
    path: 'src/test.ts',
    content: 'const x = 1;\nconst y = 2;',
    sha: 'abc123',
    size: 24,
    encoding: 'utf-8' as const,
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    mockGetFileContent = api.githubBackends.file.getFileContent as Mock;
    useDiffContentStore.setState({
      contentCache: new Map(),
      fullFileDiffs: new Map(),
      isLoadingContent: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchFileContent', () => {
    it('fetches file content successfully', async () => {
      mockGetFileContent.mockResolvedValue(mockFileContent);

      const result = await useDiffContentStore.getState().fetchFileContent(
        'owner',
        'repo',
        'src/test.ts',
        'main'
      );

      expect(result.path).toBe('src/test.ts');
      expect(result.content).toBe('const x = 1;\nconst y = 2;');
      expect(result.lines).toEqual(['const x = 1;', 'const y = 2;']);
      expect(result.language).toBe('ts'); // detectLanguage returns extension, Shiki resolves alias
      expect(useDiffContentStore.getState().isLoadingContent).toBe(false);
    });

    it('caches file content after fetch', async () => {
      mockGetFileContent.mockResolvedValue(mockFileContent);

      await useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'src/test.ts', 'main');
      await useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'src/test.ts', 'main');

      // Should only call API once due to caching
      expect(mockGetFileContent).toHaveBeenCalledTimes(1);
    });

    it('returns cached content on subsequent calls', async () => {
      mockGetFileContent.mockResolvedValue(mockFileContent);

      const result1 = await useDiffContentStore.getState().fetchFileContent(
        'owner',
        'repo',
        'src/test.ts',
        'main'
      );
      const result2 = await useDiffContentStore.getState().fetchFileContent(
        'owner',
        'repo',
        'src/test.ts',
        'main'
      );

      expect(result1).toEqual(result2);
    });

    it('uses different cache keys for different refs', async () => {
      mockGetFileContent.mockResolvedValue(mockFileContent);

      await useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'src/test.ts', 'main');
      await useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'src/test.ts', 'feature');

      expect(mockGetFileContent).toHaveBeenCalledTimes(2);
    });

    it('handles 404 error with specific message', async () => {
      mockGetFileContent.mockRejectedValue(
        new api.GitHubAPIError(404, 'Not Found', 'File not found')
      );

      await expect(
        useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'missing.ts', 'main')
      ).rejects.toThrow('File not found at this version');
    });

    it('handles 413 error with file too large message', async () => {
      mockGetFileContent.mockRejectedValue(
        new api.GitHubAPIError(413, 'Payload Too Large', 'File too large')
      );

      await expect(
        useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'large.bin', 'main')
      ).rejects.toThrow('File too large to display full content');
    });

    it('handles other API errors', async () => {
      mockGetFileContent.mockRejectedValue(
        new api.GitHubAPIError(500, 'Internal Server Error', 'Server error')
      );

      await expect(
        useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'file.ts', 'main')
      ).rejects.toThrow('Server error');
    });

    it('handles generic errors', async () => {
      mockGetFileContent.mockRejectedValue(new Error('Network failure'));

      await expect(
        useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'file.ts', 'main')
      ).rejects.toThrow('Network failure');
    });

    it('sets isLoadingContent during fetch', async () => {
      mockGetFileContent.mockImplementation(
        () =>
          new Promise((resolve) => {
            expect(useDiffContentStore.getState().isLoadingContent).toBe(true);
            resolve(mockFileContent);
          })
      );

      await useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'file.ts', 'main');

      expect(useDiffContentStore.getState().isLoadingContent).toBe(false);
    });
  });

  describe('computeFullFileDiff', () => {
    const baseContent = {
      path: 'src/test.ts',
      content: 'const x = 1;',
      sha: 'base123',
      size: 12,
      encoding: 'utf-8' as const,
    };

    const headContent = {
      path: 'src/test.ts',
      content: 'const x = 2;',
      sha: 'head123',
      size: 12,
      encoding: 'utf-8' as const,
    };

    it('computes diff between two versions', async () => {
      mockGetFileContent
        .mockResolvedValueOnce(baseContent)
        .mockResolvedValueOnce(headContent);

      const result = await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/test.ts',
        'base123',
        'head123'
      );

      expect(result.diffLines.length).toBeGreaterThan(0);
      expect(result.alignedLines.length).toBeGreaterThan(0);
      expect(result.base?.content).toBe('const x = 1;');
      expect(result.head?.content).toBe('const x = 2;');
    });

    it('caches computed diff', async () => {
      mockGetFileContent
        .mockResolvedValueOnce(baseContent)
        .mockResolvedValueOnce(headContent);

      await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/test.ts',
        'base123',
        'head123'
      );

      // Second call should use cache
      await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/test.ts',
        'base123',
        'head123'
      );

      // getFileContent called twice initially for base and head
      expect(mockGetFileContent).toHaveBeenCalledTimes(2);
    });

    it('handles new file (no base content)', async () => {
      mockGetFileContent
        .mockRejectedValueOnce(new api.GitHubAPIError(404, 'Not Found', 'Not found'))
        .mockResolvedValueOnce(headContent);

      const result = await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/test.ts',
        'base123',
        'head123'
      );

      expect(result.base).toBeNull();
      expect(result.head).not.toBeNull();
      expect(result.diffLines.every((l) => l.type === 'addition')).toBe(true);
    });

    it('handles deleted file (no head content)', async () => {
      mockGetFileContent
        .mockResolvedValueOnce(baseContent)
        .mockRejectedValueOnce(new api.GitHubAPIError(404, 'Not Found', 'Not found'));

      const result = await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/test.ts',
        'base123',
        'head123'
      );

      expect(result.base).not.toBeNull();
      expect(result.head).toBeNull();
      expect(result.diffLines.every((l) => l.type === 'deletion')).toBe(true);
    });

    it('returns empty diff when both versions fail', async () => {
      mockGetFileContent
        .mockRejectedValueOnce(new api.GitHubAPIError(404, 'Not Found', 'Not found'))
        .mockRejectedValueOnce(new api.GitHubAPIError(404, 'Not Found', 'Not found'));

      const result = await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/test.ts',
        'base123',
        'head123'
      );

      expect(result.base).toBeNull();
      expect(result.head).toBeNull();
      expect(result.diffLines).toEqual([]);
      expect(result.alignedLines).toEqual([]);
    });

    it('uses basePath for base content when provided (renamed files)', async () => {
      const oldPathContent = {
        path: 'src/old-name.ts',
        content: 'const x = 1;',
        sha: 'base123',
        size: 12,
        encoding: 'utf-8' as const,
      };

      mockGetFileContent.mockImplementation((_owner: string, _repo: string, path: string) => {
        if (path === 'src/old-name.ts') return Promise.resolve(oldPathContent);
        if (path === 'src/new-name.ts') return Promise.resolve(headContent);
        return Promise.reject(new api.GitHubAPIError(404, 'Not Found', 'Not found'));
      });

      const result = await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/new-name.ts',
        'base123',
        'head123',
        'src/old-name.ts'
      );

      expect(result.base).not.toBeNull();
      expect(result.base?.content).toBe('const x = 1;');
      expect(result.head).not.toBeNull();
      expect(result.head?.content).toBe('const x = 2;');
      // Verify it fetched base using old path
      expect(mockGetFileContent).toHaveBeenCalledWith('owner', 'repo', 'src/old-name.ts', 'base123');
      expect(mockGetFileContent).toHaveBeenCalledWith('owner', 'repo', 'src/new-name.ts', 'head123');
    });

    it('enhances diff lines with word diffs for modifications', async () => {
      mockGetFileContent
        .mockResolvedValueOnce(baseContent)
        .mockResolvedValueOnce(headContent);

      const result = await useDiffContentStore.getState().computeFullFileDiff(
        'owner',
        'repo',
        'src/test.ts',
        'base123',
        'head123'
      );

      // Should have deletion and addition lines
      const deletion = result.diffLines.find((l) => l.type === 'deletion');
      const addition = result.diffLines.find((l) => l.type === 'addition');

      expect(deletion?.wordDiff).toBeDefined();
      expect(addition?.wordDiff).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('clears all caches', async () => {
      mockGetFileContent.mockResolvedValue(mockFileContent);

      await useDiffContentStore.getState().fetchFileContent('owner', 'repo', 'test.ts', 'main');

      expect(useDiffContentStore.getState().contentCache.size).toBe(1);

      useDiffContentStore.getState().clearCache();

      expect(useDiffContentStore.getState().contentCache.size).toBe(0);
      expect(useDiffContentStore.getState().fullFileDiffs.size).toBe(0);
    });
  });
});
