import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubFileBackend } from './file-backend';
import { githubClient } from './github-client';
import { FileChangeStatus } from '../types';

vi.mock('./github-client', () => ({
  githubClient: {
    fetch: vi.fn(),
  },
  GitHubAPIError: class GitHubAPIError extends Error {
    constructor(
      public status: number,
      public statusText: string,
      message: string,
    ) {
      super(message);
      this.name = 'GitHubAPIError';
    }
  },
}));

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

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/pulls/42/files');
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
      const base64WithNewlines = btoa('hello world').slice(0, 5) + '\n' + btoa('hello world').slice(5);
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
