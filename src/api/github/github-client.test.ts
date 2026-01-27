import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient, GitHubAPIError, RateLimitInfo } from './github-client';
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

  describe('unauthenticated requests (S-4.1.2)', () => {
    // GC-01: Request without token succeeds
    it('proceeds without Authorization header when no token available (AC-4.1.2.1)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      const mockResponse = { login: 'testuser' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.fetch('/user');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        })
      );
      // Verify no Authorization header
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit] | undefined;
      expect(callArgs).toBeDefined();
      const callHeaders = callArgs?.[1]?.headers as Record<string, string> | undefined;
      expect(callHeaders).toBeDefined();
      expect(callHeaders).not.toHaveProperty('Authorization');
    });

    // GC-02: Request with token includes auth
    it('includes Authorization header when token is available (AC-4.1.2.1)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      const mockResponse = { login: 'testuser' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
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

    // GC-03: Rate limit headers parsed
    it('parses rate limit headers correctly (AC-4.1.2.3)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      const resetTimestamp = Math.floor(Date.now() / 1000) + 3600;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'X-RateLimit-Remaining': '45',
          'X-RateLimit-Reset': String(resetTimestamp),
          'X-RateLimit-Limit': '60',
        }),
        json: () => Promise.resolve({ data: 'test' }),
      });

      const result = await client.requestWithRateLimit('/test');

      expect(result.rateLimit).toBeDefined();
      const rateLimit = result.rateLimit;
      expect(rateLimit?.remaining).toBe(45);
      expect(rateLimit?.limit).toBe(60);
      expect(rateLimit?.reset.getTime()).toBe(resetTimestamp * 1000);
    });

    // GC-04: Rate limit headers missing
    it('returns undefined rateLimit when headers are missing (AC-4.1.2.3)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(), // No rate limit headers
        json: () => Promise.resolve({ data: 'test' }),
      });

      const result = await client.requestWithRateLimit('/test');

      expect(result.rateLimit).toBeUndefined();
    });

    // GC-05: 404 without token flags private
    it('flags 404 error as potential private repo when unauthenticated (AC-4.1.2.7)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      try {
        await client.fetch('/repos/owner/private-repo');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).isPrivateRepo).toBe(true);
      }
    });

    // GC-06: 404 with token no flag
    it('does not flag 404 as private repo when authenticated (AC-4.1.2.7)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      try {
        await client.fetch('/repos/owner/repo');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).isPrivateRepo).toBeUndefined();
      }
    });

    // GC-07: 401 no logout when unauthenticated
    it('does not trigger logout for 401 when unauthenticated (AC-4.1.2.5)', async () => {
      const mockRefreshAccessToken = vi.fn();
      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: null,
        authMethod: null,
        refreshAccessToken: mockRefreshAccessToken,
      } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      await expect(client.fetch('/user')).rejects.toThrow('Bad credentials');
      // Should not attempt refresh for unauthenticated requests
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    // GC-08: 403 without token flags private
    it('flags 403 error as potential private repo when unauthenticated (AC-4.1.2.7)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Repository access denied' }),
      });

      try {
        await client.fetch('/repos/owner/private-repo');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).isPrivateRepo).toBe(true);
      }
    });

    it('distinguishes rate limit 403 from private repo 403 (AC-4.1.2.6)', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
          'X-RateLimit-Limit': '60',
        }),
        json: () => Promise.resolve({ message: 'API rate limit exceeded' }),
      });

      try {
        await client.fetch('/repos/owner/repo');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        const apiError = error as GitHubAPIError;
        expect(apiError.isRateLimitError).toBe(true);
        expect(apiError.isPrivateRepo).toBe(false);
      }
    });

    it('token refresh only triggers when token was present (AC-4.1.2.4)', async () => {
      const mockRefreshAccessToken = vi.fn().mockResolvedValue(true);

      // No token throughout the request
      vi.mocked(useAuthStore.getState).mockImplementation(() => {
        return {
          token: null, // No token throughout
          authMethod: 'oauth',
          refreshAccessToken: mockRefreshAccessToken,
        } as never;
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      await expect(client.fetch('/user')).rejects.toThrow('Bad credentials');
      // Should NOT attempt refresh because there was no token to begin with
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
    });
  });

  describe('authenticated requests', () => {
    it('makes authenticated request with token', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      const mockResponse = { login: 'testuser' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
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
        headers: new Headers(),
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
        headers: new Headers(),
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      try {
        await client.fetch('/repos/owner/repo');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).message).toBe('Internal Server Error');
      }
    });

    it('handles 204 No Content response', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const result = await client.fetch('/repos/owner/repo/issues/1');
      expect(result).toBeUndefined();
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
            headers: new Headers(),
            json: () => Promise.resolve({ message: 'Bad credentials' }),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
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
        headers: new Headers(),
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
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      await expect(client.fetch('/user')).rejects.toThrow('Bad credentials');
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it('does not retry infinitely when retry also returns 401', async () => {
      const mockRefreshAccessToken = vi.fn().mockResolvedValue(true);

      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: 'still_invalid_token',
        authMethod: 'oauth',
        refreshAccessToken: mockRefreshAccessToken,
      } as never);

      // Both initial and retry requests return 401
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      await expect(client.fetch('/user')).rejects.toThrow('Bad credentials');
      // Refresh called once, but no infinite loop - only 2 fetch calls (initial + retry)
      expect(mockRefreshAccessToken).toHaveBeenCalledOnce();
      expect(global.fetch).toHaveBeenCalledTimes(2);
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

  it('supports isPrivateRepo flag (AC-4.1.2.9)', () => {
    const error = new GitHubAPIError(404, 'Not Found', 'Not Found');
    error.isPrivateRepo = true;

    expect(error.isPrivateRepo).toBe(true);
  });

  it('supports isRateLimitError flag (AC-4.1.2.6)', () => {
    const error = new GitHubAPIError(403, 'Forbidden', 'Rate limit exceeded');
    error.isRateLimitError = true;

    expect(error.isRateLimitError).toBe(true);
  });
});

describe('RateLimitInfo (AC-4.1.2.10)', () => {
  it('has correct interface structure', () => {
    const rateLimit: RateLimitInfo = {
      remaining: 45,
      reset: new Date(),
      limit: 60,
    };

    expect(rateLimit.remaining).toBe(45);
    expect(rateLimit.reset).toBeInstanceOf(Date);
    expect(rateLimit.limit).toBe(60);
  });
});
