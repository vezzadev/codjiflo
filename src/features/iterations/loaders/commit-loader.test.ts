/**
 * Tests for Commit Loader
 *
 * Fetches PR commits from GitHub API and transforms them into PRCommit format.
 * Tests follow TDD approach - written before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCommits } from './commit-loader';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

// Mock the auth store
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

describe('loadCommits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore.getState).mockReturnValue({
      token: 'test-token',
      rateLimitRemaining: 100,
      updateRateLimit: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('fetches commits from GitHub API', async () => {
      const mockCommits = [
        {
          sha: 'abc123',
          commit: {
            message: 'First commit\n\nWith body',
            author: { date: '2024-01-15T10:00:00Z', name: 'Test Author' },
          },
          author: { login: 'testuser' },
          parents: [{ sha: 'parent1' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 123);

      expect(result).toHaveLength(1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit).toEqual({
        sha: 'abc123',
        message: 'First commit', // Only first line
        author: 'testuser',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        parentSha: 'parent1',
      });
    });

    it('uses correct GitHub API endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadCommits('myowner', 'myrepo', 456);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/myowner/myrepo/pulls/456/commits?per_page=100',
        expect.any(Object)
      );
    });

    it('includes authorization header when token provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadCommits('owner', 'repo', 123);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }) as Record<string, string>,
        })
      );
    });

    it('works without token (unauthenticated)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: null,
        rateLimitRemaining: 60,
        updateRateLimit: vi.fn(),
      } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadCommits('owner', 'repo', 123);

      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      const callArgs = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
      expect(callArgs).toBeDefined();
      if (!callArgs) return;
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('message handling', () => {
    it('extracts only first line of commit message', async () => {
      const mockCommits = [
        {
          sha: 'sha1',
          commit: {
            message: 'Subject line\n\nDetailed body\nWith multiple lines',
            author: { date: '2024-01-15T10:00:00Z' },
          },
          author: { login: 'user' },
          parents: [{ sha: 'p1' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit?.message).toBe('Subject line');
    });

    it('handles single-line messages', async () => {
      const mockCommits = [
        {
          sha: 'sha1',
          commit: {
            message: 'Single line message',
            author: { date: '2024-01-15T10:00:00Z' },
          },
          author: { login: 'user' },
          parents: [{ sha: 'p1' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit?.message).toBe('Single line message');
    });

    it('handles CRLF line endings', async () => {
      const mockCommits = [
        {
          sha: 'sha1',
          commit: {
            message: 'Subject\r\n\r\nBody with CRLF',
            author: { date: '2024-01-15T10:00:00Z' },
          },
          author: { login: 'user' },
          parents: [{ sha: 'p1' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit?.message).toBe('Subject');
    });
  });

  describe('author handling', () => {
    it('uses login when author is present', async () => {
      const mockCommits = [
        {
          sha: 'sha1',
          commit: {
            message: 'Test',
            author: { date: '2024-01-15T10:00:00Z', name: 'Full Name' },
          },
          author: { login: 'username' },
          parents: [{ sha: 'p1' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit?.author).toBe('username');
    });

    it('uses "unknown" when author is null', async () => {
      const mockCommits = [
        {
          sha: 'sha1',
          commit: {
            message: 'Test',
            author: { date: '2024-01-15T10:00:00Z', name: 'Git Name' },
          },
          author: null,
          parents: [{ sha: 'p1' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit?.author).toBe('unknown');
    });
  });

  describe('parent handling', () => {
    it('extracts first parent sha', async () => {
      const mockCommits = [
        {
          sha: 'sha1',
          commit: {
            message: 'Test',
            author: { date: '2024-01-15T10:00:00Z' },
          },
          author: { login: 'user' },
          parents: [{ sha: 'first-parent' }, { sha: 'second-parent' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit?.parentSha).toBe('first-parent');
    });

    it('handles empty parents array (root commit)', async () => {
      const mockCommits = [
        {
          sha: 'sha1',
          commit: {
            message: 'Initial commit',
            author: { date: '2024-01-15T10:00:00Z' },
          },
          author: { login: 'user' },
          parents: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      const firstCommit = result[0];
      expect(firstCommit).toBeDefined();
      expect(firstCommit?.parentSha).toBeUndefined();
    });
  });

  describe('pagination', () => {
    it('follows Link header for pagination', async () => {
      const page1Commits = [
        {
          sha: 'sha1',
          commit: { message: 'Commit 1', author: { date: '2024-01-15T10:00:00Z' } },
          author: { login: 'user' },
          parents: [{ sha: 'p1' }],
        },
      ];

      const page2Commits = [
        {
          sha: 'sha2',
          commit: { message: 'Commit 2', author: { date: '2024-01-15T11:00:00Z' } },
          author: { login: 'user' },
          parents: [{ sha: 'sha1' }],
        },
      ];

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({
              Link: '<https://api.github.com/repos/owner/repo/pulls/1/commits?page=2&per_page=100>; rel="next"',
            }),
            json: () => Promise.resolve(page1Commits),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          json: () => Promise.resolve(page2Commits),
        });
      });

      const result = await loadCommits('owner', 'repo', 1);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]?.sha).toBe('sha1');
      expect(result[1]?.sha).toBe('sha2');
    });

    it('handles multiple pages of pagination', async () => {
      const commits1 = [{ sha: 'sha1', commit: { message: 'C1', author: { date: '2024-01-15T10:00:00Z' } }, author: { login: 'u' }, parents: [] }];
      const commits2 = [{ sha: 'sha2', commit: { message: 'C2', author: { date: '2024-01-15T11:00:00Z' } }, author: { login: 'u' }, parents: [{ sha: 'sha1' }] }];
      const commits3 = [{ sha: 'sha3', commit: { message: 'C3', author: { date: '2024-01-15T12:00:00Z' } }, author: { login: 'u' }, parents: [{ sha: 'sha2' }] }];

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ Link: '<https://api.github.com/page2>; rel="next"' }),
            json: () => Promise.resolve(commits1),
          });
        }
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ Link: '<https://api.github.com/page3>; rel="next"' }),
            json: () => Promise.resolve(commits2),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          json: () => Promise.resolve(commits3),
        });
      });

      const result = await loadCommits('owner', 'repo', 1);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it('stops when no next link is present', async () => {
      const commits = [{ sha: 'sha1', commit: { message: 'C1', author: { date: '2024-01-15T10:00:00Z' } }, author: { login: 'u' }, parents: [] }];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          Link: '<https://api.github.com/prev>; rel="prev", <https://api.github.com/last>; rel="last"',
        }),
        json: () => Promise.resolve(commits),
      });

      await loadCommits('owner', 'repo', 1);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('throws on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      await expect(loadCommits('owner', 'repo', 123)).rejects.toThrow();
    });

    it('throws on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(loadCommits('owner', 'repo', 123)).rejects.toThrow('Network error');
    });
  });

  describe('rate limit tracking', () => {
    it('calls updateRateLimit with correct values from response headers', async () => {
      const mockUpdateRateLimit = vi.fn();
      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: 'test-token',
        rateLimitRemaining: 100,
        updateRateLimit: mockUpdateRateLimit,
      } as never);

      const mockCommits = [
        {
          sha: 'sha1',
          commit: { message: 'Test', author: { date: '2024-01-15T10:00:00Z' } },
          author: { login: 'user' },
          parents: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'X-RateLimit-Remaining': '4999',
          'X-RateLimit-Reset': '1705320000',
          'X-RateLimit-Limit': '5000',
        }),
        json: () => Promise.resolve(mockCommits),
      });

      await loadCommits('owner', 'repo', 1);

      expect(mockUpdateRateLimit).toHaveBeenCalledWith({
        remaining: 4999,
        reset: new Date(1705320000 * 1000),
        limit: 5000,
      });
    });

    it('does not call updateRateLimit when headers are missing', async () => {
      const mockUpdateRateLimit = vi.fn();
      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: 'test-token',
        rateLimitRemaining: 100,
        updateRateLimit: mockUpdateRateLimit,
      } as never);

      const mockCommits = [
        {
          sha: 'sha1',
          commit: { message: 'Test', author: { date: '2024-01-15T10:00:00Z' } },
          author: { login: 'user' },
          parents: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(), // No rate limit headers
        json: () => Promise.resolve(mockCommits),
      });

      await loadCommits('owner', 'repo', 1);

      expect(mockUpdateRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('PRCommit interface', () => {
    it('has correct shape', async () => {
      const mockCommits = [
        {
          sha: 'test-sha',
          commit: {
            message: 'Test message',
            author: { date: '2024-01-15T10:00:00Z', name: 'Author Name' },
          },
          author: { login: 'author-login' },
          parents: [{ sha: 'parent-sha' }],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockCommits),
      });

      const result = await loadCommits('owner', 'repo', 1);
      expect(result).toHaveLength(1);
      const commit = result[0];
      expect(commit).toBeDefined();
      if (!commit) return;

      // Verify all required properties exist and have correct types
      expect(typeof commit.sha).toBe('string');
      expect(typeof commit.message).toBe('string');
      expect(typeof commit.author).toBe('string');
      expect(commit.createdAt).toBeInstanceOf(Date);
      expect(commit.parentSha === undefined || typeof commit.parentSha === 'string').toBe(true);
    });
  });
});
