import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubFileBackend } from './file-backend';
import { githubClient } from './github-client';
import { FileChangeStatus } from '../types';

vi.mock('./github-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./github-client')>();
  return {
    ...actual,
    githubClient: {
      fetch: vi.fn(),
    },
  };
});

describe('GitHubFileBackend', () => {
  let backend: GitHubFileBackend;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const mockFetch = vi.mocked(githubClient.fetch);

  beforeEach(() => {
    backend = new GitHubFileBackend();
    vi.clearAllMocks();
  });

  describe('getFiles', () => {
    it('fetches and transforms file data correctly', async () => {
      const mockFiles = [
        {
          filename: 'src/index.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15,
          patch: '@@ -1,3 +1,4 @@\n+import foo',
        },
      ];

      mockFetch.mockResolvedValue(mockFiles);

      const result = await backend.getFiles('owner', 'repo', 42);

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/pulls/42/files?per_page=100&page=1');
      expect(result).toEqual([
        {
          filename: 'src/index.ts',
          status: FileChangeStatus.Modified,
          additions: 10,
          deletions: 5,
          changes: 15,
          patch: '@@ -1,3 +1,4 @@\n+import foo',
        },
      ]);
    });

    it('maps added status correctly', async () => {
      const mockFiles = [{ filename: 'new.ts', status: 'added', additions: 10, deletions: 0, changes: 10 }];
      mockFetch.mockResolvedValue(mockFiles);

      const [first] = await backend.getFiles('owner', 'repo', 1);
      expect(first?.status).toBe(FileChangeStatus.Added);
    });

    it('maps removed status correctly', async () => {
      const mockFiles = [{ filename: 'old.ts', status: 'removed', additions: 0, deletions: 10, changes: 10 }];
      mockFetch.mockResolvedValue(mockFiles);

      const [first] = await backend.getFiles('owner', 'repo', 1);
      expect(first?.status).toBe(FileChangeStatus.Deleted);
    });

    it('maps renamed status correctly', async () => {
      const mockFiles = [
        {
          filename: 'new-name.ts',
          status: 'renamed',
          previous_filename: 'old-name.ts',
          additions: 0,
          deletions: 0,
          changes: 0,
        },
      ];
      mockFetch.mockResolvedValue(mockFiles);

      const [first] = await backend.getFiles('owner', 'repo', 1);
      expect(first?.status).toBe(FileChangeStatus.Renamed);
      expect(first?.previousFilename).toBe('old-name.ts');
    });

    it('handles missing patch', async () => {
      const mockFiles = [{ filename: 'binary.png', status: 'modified', additions: 0, deletions: 0, changes: 0 }];
      mockFetch.mockResolvedValue(mockFiles);

      const [first] = await backend.getFiles('owner', 'repo', 1);
      expect(first?.patch).toBe('');
    });

    it('paginates when more than 100 files exist', async () => {
      // Create 150 mock files split across 2 pages
      const page1Files = Array.from({ length: 100 }, (_, i) => ({
        filename: `file-${String(i).padStart(3, '0')}.ts`,
        status: 'modified' as const,
        additions: 1,
        deletions: 0,
        changes: 1,
      }));
      const page2Files = Array.from({ length: 50 }, (_, i) => ({
        filename: `file-${String(i + 100).padStart(3, '0')}.ts`,
        status: 'renamed' as const,
        previous_filename: `old-${String(i + 100).padStart(3, '0')}.ts`,
        additions: 0,
        deletions: 0,
        changes: 0,
      }));

      // First call returns 100 items, second call returns 50
      mockFetch
        .mockResolvedValueOnce(page1Files)
        .mockResolvedValueOnce(page2Files);

      const result = await backend.getFiles('owner', 'repo', 1);

      expect(result).toHaveLength(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/pulls/1/files?per_page=100&page=1');
      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/pulls/1/files?per_page=100&page=2');
      // Verify page 2 files have correct status
      expect(result[100]?.status).toBe(FileChangeStatus.Renamed);
      expect(result[100]?.previousFilename).toBe('old-100.ts');
    });

    it('fetches all files in single request when 100 or fewer', async () => {
      const mockFiles = Array.from({ length: 30 }, (_, i) => ({
        filename: `file-${i}.ts`,
        status: 'modified' as const,
        additions: 1,
        deletions: 0,
        changes: 1,
      }));

      mockFetch.mockResolvedValueOnce(mockFiles);

      const result = await backend.getFiles('owner', 'repo', 1);

      expect(result).toHaveLength(30);
      // Should only make one request since fewer than 100 returned
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/pulls/1/files?per_page=100&page=1');
    });

    it('handles exactly 100 files with empty second page', async () => {
      const page1Files = Array.from({ length: 100 }, (_, i) => ({
        filename: `file-${String(i).padStart(3, '0')}.ts`,
        status: 'modified' as const,
        additions: 1,
        deletions: 0,
        changes: 1,
      }));

      mockFetch
        .mockResolvedValueOnce(page1Files)
        .mockResolvedValueOnce([]);

      const result = await backend.getFiles('owner', 'repo', 1);

      expect(result).toHaveLength(100);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFileContent', () => {
    it('fetches and decodes base64 file content correctly', async () => {
      const mockResponse = {
        path: 'src/index.ts',
        sha: 'abc123',
        content: btoa('const x = 1;'),
        encoding: 'base64',
        size: 12,
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'src/index.ts', 'main');

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/contents/src/index.ts?ref=main');
      expect(result).toEqual({
        path: 'src/index.ts',
        sha: 'abc123',
        content: 'const x = 1;',
        size: 12,
        encoding: 'utf-8',
      });
    });

    it('handles base64 content with line breaks', async () => {
      // GitHub API sometimes returns base64 with newlines
      const base64 = btoa('hello world');
      const base64WithNewlines = base64.match(/.{1,4}/g)?.join('\n') ?? base64;
      const mockResponse = {
        path: 'test.txt',
        sha: 'def456',
        content: base64WithNewlines,
        encoding: 'base64',
        size: 11,
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'test.txt', 'feature');

      expect(result.content).toBe('hello world');
    });

    it('handles file with no content', async () => {
      const mockResponse = {
        path: 'empty.ts',
        sha: 'xyz789',
        size: 0,
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'empty.ts', 'main');

      expect(result.encoding).toBe('none');
      expect(result.content).toBe('');
    });

    it('handles file with non-base64 content', async () => {
      const mockResponse = {
        path: 'plain.txt',
        sha: 'abc000',
        content: 'plain text content',
        encoding: 'none',
        size: 18,
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'plain.txt', 'main');

      expect(result.content).toBe('plain text content');
    });

    it('throws error for directory type', async () => {
      const mockResponse = {
        path: 'src',
        sha: 'dir123',
        type: 'dir',
        size: 0,
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(backend.getFileContent('owner', 'repo', 'src', 'main')).rejects.toThrow(
        'Expected file but got dir at path: src'
      );
    });

    it('throws error for files exceeding size limit', async () => {
      const mockResponse = {
        path: 'large.bin',
        sha: 'large123',
        content: 'some content',
        encoding: 'base64',
        size: 2 * 1024 * 1024, // 2MB, exceeds 1MB limit
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(backend.getFileContent('owner', 'repo', 'large.bin', 'main')).rejects.toThrow(
        'File too large'
      );
    });

    it('throws error for invalid base64 content', async () => {
      const mockResponse = {
        path: 'invalid.ts',
        sha: 'inv123',
        content: '!!!invalid-base64!!!',
        encoding: 'base64',
        size: 20,
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(backend.getFileContent('owner', 'repo', 'invalid.ts', 'main')).rejects.toThrow(
        'Failed to decode base64 content'
      );
    });

    it('URL-encodes path segments correctly', async () => {
      const mockResponse = {
        path: 'src/my file.ts',
        sha: 'space123',
        content: btoa('content'),
        encoding: 'base64',
        size: 7,
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await backend.getFileContent('owner', 'repo', 'src/my file.ts', 'main');

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/contents/src/my%20file.ts?ref=main');
    });

    it('URL-encodes ref correctly', async () => {
      const mockResponse = {
        path: 'test.ts',
        sha: 'ref123',
        content: btoa('content'),
        encoding: 'base64',
        size: 7,
        type: 'file',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await backend.getFileContent('owner', 'repo', 'test.ts', 'feature/my-branch');

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/contents/test.ts?ref=feature%2Fmy-branch');
    });
  });
});
