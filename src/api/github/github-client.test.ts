import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient, GitHubAPIError } from './github-client';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

// Mock the auth store
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetch', () => {
    it('throws error when not authenticated', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      await expect(client.fetch('/user')).rejects.toThrow(GitHubAPIError);
      await expect(client.fetch('/user')).rejects.toThrow('Not authenticated');
    });

    it('makes authenticated request with token', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      const mockResponse = { login: 'testuser' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.fetch('/user');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer ghp_test123',
            'Accept': 'application/vnd.github.v3+json',
          },
        })
      );
    });

    it('throws GitHubAPIError on non-ok response', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Resource not found' }),
      });

      await expect(client.fetch('/repos/owner/repo')).rejects.toThrow(GitHubAPIError);

      try {
        await client.fetch('/repos/owner/repo');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).status).toBe(404);
        expect((error as GitHubAPIError).message).toBe('Resource not found');
      }
    });

    it('uses statusText when response body cannot be parsed', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      try {
        await client.fetch('/repos/owner/repo');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).message).toBe('Internal Server Error');
      }
    });
  });

  describe('401 token refresh', () => {
    it('retries request after successful OAuth token refresh on 401', async () => {
      const mockRefreshAccessToken = vi.fn().mockResolvedValue(true);
      let callCount = 0;

      vi.mocked(useAuthStore.getState).mockImplementation(() => ({
        token: callCount === 0 ? 'expired_token' : 'new_token',
        authMethod: 'oauth',
        refreshAccessToken: mockRefreshAccessToken,
      }) as never);

      const mockResponse = { login: 'testuser' };
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ message: 'Bad credentials' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });
      });

      const result = await client.fetch('/user');

      expect(result).toEqual(mockResponse);
      expect(mockRefreshAccessToken).toHaveBeenCalledOnce();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws error when OAuth token refresh fails on 401', async () => {
      const mockRefreshAccessToken = vi.fn().mockResolvedValue(false);

      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: 'expired_token',
        authMethod: 'oauth',
        refreshAccessToken: mockRefreshAccessToken,
      } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      await expect(client.fetch('/user')).rejects.toThrow('Session expired. Please log in again.');
      expect(mockRefreshAccessToken).toHaveBeenCalledOnce();
    });

    it('does not attempt refresh for PAT auth on 401', async () => {
      const mockRefreshAccessToken = vi.fn();

      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: 'ghp_test123',
        authMethod: 'pat',
        refreshAccessToken: mockRefreshAccessToken,
      } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      await expect(client.fetch('/user')).rejects.toThrow('Bad credentials');
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });
  });
});

describe('GitHubAPIError', () => {
  it('has correct properties', () => {
    const error = new GitHubAPIError(401, 'Unauthorized', 'Bad credentials');

    expect(error.status).toBe(401);
    expect(error.statusText).toBe('Unauthorized');
    expect(error.message).toBe('Bad credentials');
    expect(error.name).toBe('GitHubAPIError');
  });
});
