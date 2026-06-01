import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import {
  validateClientCredentials,
  isValidCredentials,
  exchangeCodeForToken,
  refreshAccessToken,
} from './utils';

// Mock NextResponse.json to return a predictable structure for testing
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: unknown, init?: ResponseInit) => ({
      data,
      status: init?.status ?? 200,
    })),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('auth utils', () => {
  const originalEnv = process.env;

  // Get typed reference to mocked NextResponse.json for expectations
  // Using a function to access the mock after vi.mock setup
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const getJsonMock = () => NextResponse.json as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateClientCredentials', () => {
    it('returns credentials when both env vars are set', async () => {
      process.env.GITHUB_APP_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_APP_CLIENT_SECRET = 'test-client-secret';

      const result = await validateClientCredentials();

      expect(isValidCredentials(result)).toBe(true);
      if (isValidCredentials(result)) {
        expect(result.clientId).toBe('test-client-id');
        expect(result.clientSecret).toBe('test-client-secret');
      }
    });

    it('returns error response when GITHUB_APP_CLIENT_ID is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      process.env.GITHUB_APP_CLIENT_ID = '';
      process.env.GITHUB_APP_CLIENT_SECRET = 'test-client-secret';

      const result = await validateClientCredentials();

      expect(isValidCredentials(result)).toBe(false);
      expect(getJsonMock()).toHaveBeenCalledWith(
        { error: 'Server configuration error' },
        { status: 500 }
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GITHUB_APP_CLIENT_ID')
      );
      consoleSpy.mockRestore();
    });

    it('returns error response when GITHUB_APP_CLIENT_SECRET is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      process.env.GITHUB_APP_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_APP_CLIENT_SECRET = '';

      const result = await validateClientCredentials();

      expect(isValidCredentials(result)).toBe(false);
      expect(getJsonMock()).toHaveBeenCalledWith(
        { error: 'Server configuration error' },
        { status: 500 }
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GITHUB_APP_CLIENT_SECRET')
      );
      consoleSpy.mockRestore();
    });

    it('returns error response when both env vars are missing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      process.env.GITHUB_APP_CLIENT_ID = '';
      process.env.GITHUB_APP_CLIENT_SECRET = '';

      const result = await validateClientCredentials();

      expect(isValidCredentials(result)).toBe(false);
      expect(getJsonMock()).toHaveBeenCalledWith(
        { error: 'Server configuration error' },
        { status: 500 }
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GITHUB_APP_CLIENT_ID')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('exchangeCodeForToken', () => {
    it('returns token response on successful exchange', async () => {
      const mockTokenResponse = {
        access_token: 'ghu_test_access_token',
        refresh_token: 'ghr_test_refresh_token',
        expires_in: 28800,
        refresh_token_expires_in: 15897600,
        token_type: 'bearer',
        scope: 'repo,user',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });

      await exchangeCodeForToken({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        code: 'test-code',
        codeVerifier: 'test-verifier',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            code: 'test-code',
            code_verifier: 'test-verifier',
          }),
        }
      );

      expect(getJsonMock()).toHaveBeenCalledWith({
        access_token: 'ghu_test_access_token',
        refresh_token: 'ghr_test_refresh_token',
        expires_in: 28800,
        refresh_token_expires_in: 15897600,
        token_type: 'bearer',
        scope: 'repo,user',
      });
    });

    it('returns 502 error when GitHub responds with non-OK status', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      });

      await exchangeCodeForToken({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        code: 'test-code',
        codeVerifier: 'test-verifier',
      });

      expect(getJsonMock()).toHaveBeenCalledWith(
        { error: 'Failed to token exchange with GitHub' },
        { status: 502 }
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns 400 error when GitHub returns OAuth error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        }),
      });

      await exchangeCodeForToken({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        code: 'invalid-code',
        codeVerifier: 'test-verifier',
      });

      expect(getJsonMock()).toHaveBeenCalledWith(
        {
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        },
        { status: 400 }
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('returns token response on successful refresh', async () => {
      const mockTokenResponse = {
        access_token: 'ghu_new_access_token',
        refresh_token: 'ghr_new_refresh_token',
        expires_in: 28800,
        refresh_token_expires_in: 15897600,
        token_type: 'bearer',
        scope: 'repo,user',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });

      await refreshAccessToken({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'ghr_test_refresh_token',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            grant_type: 'refresh_token',
            refresh_token: 'ghr_test_refresh_token',
          }),
        }
      );

      expect(getJsonMock()).toHaveBeenCalledWith({
        access_token: 'ghu_new_access_token',
        refresh_token: 'ghr_new_refresh_token',
        expires_in: 28800,
        refresh_token_expires_in: 15897600,
        token_type: 'bearer',
        scope: 'repo,user',
      });
    });

    it('returns 502 error when GitHub responds with non-OK status', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve('Service temporarily unavailable'),
      });

      await refreshAccessToken({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'ghr_test_refresh_token',
      });

      expect(getJsonMock()).toHaveBeenCalledWith(
        { error: 'Failed to token refresh with GitHub' },
        { status: 502 }
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns 400 error when refresh token is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'The refresh token is invalid.',
        }),
      });

      await refreshAccessToken({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'invalid-refresh-token',
      });

      expect(getJsonMock()).toHaveBeenCalledWith(
        {
          error: 'invalid_grant',
          error_description: 'The refresh token is invalid.',
        },
        { status: 400 }
      );
    });
  });
});
