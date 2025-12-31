import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubFileBackend, MAX_FILE_SIZE_BYTES } from './file-backend';
import { githubClient } from './github-client';
import { FileChangeStatus } from '../types';

vi.mock('./github-client', () => ({
  githubClient: {
    fetch: vi.fn(),
  },
  GitHubAPIError: class extends Error {
    constructor(public status: number, public statusText: string, message: string) {
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
    it('fetches and decodes base64 file content successfully', async () => {
      const mockResponse = {
        type: 'file',
        path: 'src/index.ts',
        sha: 'abc123',
        size: 100,
        content: btoa('console.log("hello");'),
        encoding: 'base64',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'src/index.ts', 'main');

      expect(mockFetch).toHaveBeenCalledWith(
        '/repos/owner/repo/contents/src/index.ts?ref=main'
      );
      expect(result).toEqual({
        path: 'src/index.ts',
        sha: 'abc123',
        content: 'console.log("hello");',
        size: 100,
        encoding: 'utf-8',
      });
    });

    it('handles base64 content with line breaks', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const base64WithLineBreaks = btoa(content).match(/.{1,64}/g)?.join('\n') || '';

      const mockResponse = {
        type: 'file',
        path: 'file.txt',
        sha: 'def456',
        size: 50,
        content: base64WithLineBreaks,
        encoding: 'base64',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'file.txt', 'branch');

      expect(result.content).toBe(content);
    });

    it('properly encodes file path with special characters', async () => {
      const mockResponse = {
        type: 'file',
        path: 'src/components/my component.tsx',
        sha: 'ghi789',
        size: 200,
        content: btoa('test'),
        encoding: 'base64',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await backend.getFileContent('owner', 'repo', 'src/components/my component.tsx', 'main');

      expect(mockFetch).toHaveBeenCalledWith(
        '/repos/owner/repo/contents/src/components/my%20component.tsx?ref=main'
      );
    });

    it('properly encodes ref parameter', async () => {
      const mockResponse = {
        type: 'file',
        path: 'file.txt',
        sha: 'jkl012',
        size: 50,
        content: btoa('test'),
        encoding: 'base64',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await backend.getFileContent('owner', 'repo', 'file.txt', 'feature/my-branch');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('?ref=feature%2Fmy-branch')
      );
    });

    it('throws error when content type is not file', async () => {
      const mockResponse = {
        type: 'dir',
        path: 'src',
        sha: 'mno345',
        size: 0,
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        backend.getFileContent('owner', 'repo', 'src', 'main')
      ).rejects.toThrow(/Expected file but got dir/);
    });

    it('throws error when file is too large', async () => {
      const mockResponse = {
        type: 'file',
        path: 'large.bin',
        sha: 'pqr678',
        size: MAX_FILE_SIZE_BYTES + 1, // Just over the limit
        content: btoa('large content'),
        encoding: 'base64',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        backend.getFileContent('owner', 'repo', 'large.bin', 'main')
      ).rejects.toThrow(/File too large/);
    });

    it('throws error when base64 decoding fails', async () => {
      const mockResponse = {
        type: 'file',
        path: 'corrupted.txt',
        sha: 'stu901',
        size: 100,
        content: 'invalid-base64!!!@@@###',
        encoding: 'base64',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        backend.getFileContent('owner', 'repo', 'corrupted.txt', 'main')
      ).rejects.toThrow(/Failed to decode base64 content/);
    });

    it('handles non-base64 content when encoding is not base64', async () => {
      const mockResponse = {
        type: 'file',
        path: 'plain.txt',
        sha: 'vwx234',
        size: 50,
        content: 'plain text content',
        encoding: 'utf-8',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'plain.txt', 'main');

      expect(result.content).toBe('plain text content');
      expect(result.encoding).toBe('utf-8');
    });

    it('handles empty content with encoding none', async () => {
      const mockResponse = {
        type: 'file',
        path: 'empty.txt',
        sha: 'yza567',
        size: 0,
        encoding: 'none',
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'empty.txt', 'main');

      expect(result.content).toBe('');
      expect(result.encoding).toBe('none');
    });

    it('handles files without content field', async () => {
      const mockResponse = {
        type: 'file',
        path: 'no-content.bin',
        sha: 'bcd890',
        size: 0,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await backend.getFileContent('owner', 'repo', 'no-content.bin', 'main');

      expect(result.content).toBe('');
      expect(result.encoding).toBe('none');
    });
  });
});
