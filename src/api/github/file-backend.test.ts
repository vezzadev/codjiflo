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
    it('fetches and decodes base64 file content', async () => {
      // "Hello, World!" in base64
      const mockResponse = {
        name: 'example.ts',
        path: 'src/example.ts',
        sha: 'abc123',
        size: 13,
        type: 'file',
        content: 'SGVsbG8sIFdvcmxkIQ==',
        encoding: 'base64',
        download_url: 'https://example.com/file.ts',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'src/example.ts', 'main');

      expect(mockFetch).toHaveBeenCalledWith(
        '/repos/owner/repo/contents/src/example.ts?ref=main'
      );
      expect(result).toEqual({
        path: 'src/example.ts',
        sha: 'abc123',
        content: 'Hello, World!',
        size: 13,
        encoding: 'utf-8',
      });
    });

    it('handles base64 content with line breaks', async () => {
      // Base64 content with line breaks (common in GitHub API responses)
      const mockResponse = {
        name: 'example.ts',
        path: 'src/example.ts',
        sha: 'abc123',
        size: 13,
        type: 'file',
        content: 'SGVs\nbG8s\nIFdv\ncmxk\nIQ==',
        encoding: 'base64',
        download_url: 'https://example.com/file.ts',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'src/example.ts', 'main');

      expect(result.content).toBe('Hello, World!');
    });

    it('encodes special characters in path', async () => {
      const mockResponse = {
        name: 'file with spaces.ts',
        path: 'src/dir with spaces/file with spaces.ts',
        sha: 'abc123',
        size: 5,
        type: 'file',
        content: 'aGVsbG8=', // "hello"
        encoding: 'base64',
        download_url: null,
      };

      mockFetch.mockResolvedValue(mockResponse);

      await backend.getFileContent('owner', 'repo', 'src/dir with spaces/file with spaces.ts', 'main');

      expect(mockFetch).toHaveBeenCalledWith(
        '/repos/owner/repo/contents/src/dir%20with%20spaces/file%20with%20spaces.ts?ref=main'
      );
    });

    it('throws error for directory type', async () => {
      const mockResponse = {
        name: 'src',
        path: 'src',
        sha: 'abc123',
        size: 0,
        type: 'dir',
        download_url: null,
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(backend.getFileContent('owner', 'repo', 'src', 'main'))
        .rejects.toThrow('Expected file but got dir at path: src');
    });

    it('throws error for file too large', async () => {
      const mockResponse = {
        name: 'large.bin',
        path: 'large.bin',
        sha: 'abc123',
        size: 2 * 1024 * 1024, // 2MB, exceeds 1MB limit
        type: 'file',
        content: '',
        encoding: 'base64',
        download_url: null,
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(backend.getFileContent('owner', 'repo', 'large.bin', 'main'))
        .rejects.toThrow('File too large');
    });

    it('handles file with no content', async () => {
      const mockResponse = {
        name: 'empty.ts',
        path: 'src/empty.ts',
        sha: 'abc123',
        size: 0,
        type: 'file',
        // No content property
        download_url: null,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'src/empty.ts', 'main');

      expect(result).toEqual({
        path: 'src/empty.ts',
        sha: 'abc123',
        content: '',
        size: 0,
        encoding: 'none',
      });
    });

    it('handles non-base64 content', async () => {
      const mockResponse = {
        name: 'plain.txt',
        path: 'plain.txt',
        sha: 'abc123',
        size: 5,
        type: 'file',
        content: 'hello',
        encoding: 'none', // Not base64
        download_url: null,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'plain.txt', 'main');

      expect(result.content).toBe('hello');
    });

    it('throws error for invalid base64 content', async () => {
      const mockResponse = {
        name: 'corrupted.ts',
        path: 'corrupted.ts',
        sha: 'abc123',
        size: 10,
        type: 'file',
        content: '!!!invalid-base64!!!',
        encoding: 'base64',
        download_url: null,
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(backend.getFileContent('owner', 'repo', 'corrupted.ts', 'main'))
        .rejects.toThrow('Failed to decode base64 content');
    });
  });
});
