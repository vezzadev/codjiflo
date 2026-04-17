import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { oauthConfig, buildAuthorizationUrl } from './config';

describe('oauthConfig', () => {
  describe('clientId', () => {
    it('reads from NEXT_PUBLIC_GITHUB_CLIENT_ID environment variable', () => {
      // This is a read-only test of the config value
      expect(typeof oauthConfig.clientId).toBe('string');
    });
  });

  describe('redirectUri', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
      // Set the required env var for the test
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com';
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns callback URL with /auth/callback suffix', async () => {
      // Re-import to get fresh module with new env
      const { oauthConfig: freshConfig } = await import('./config');
      expect(freshConfig.redirectUri).toBe('https://test.example.com/auth/callback');
    });

    it('throws error when NEXT_PUBLIC_APP_URL is not set and not in development', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      // Set to production to avoid development fallback
      vi.stubEnv('NODE_ENV', 'production');
      // Reset modules so ./config is re-evaluated with the updated environment
      vi.resetModules();
      
      const { oauthConfig: freshConfig } = await import('./config');
      
      expect(() => freshConfig.redirectUri).toThrow(
        'Missing required environment variable NEXT_PUBLIC_APP_URL'
      );
    });
  });

  describe('scopes', () => {
    it('includes required OAuth scopes', () => {
      expect(oauthConfig.scopes).toContain('repo');
      expect(oauthConfig.scopes).toContain('read:user');
      expect(oauthConfig.scopes).toContain('actions:read');
    });

    it('has exactly 3 scopes', () => {
      expect(oauthConfig.scopes).toHaveLength(3);
    });
  });

  describe('authorizationUrl', () => {
    it('points to GitHub OAuth authorization endpoint', () => {
      expect(oauthConfig.authorizationUrl).toBe('https://github.com/login/oauth/authorize');
    });
  });

  describe('refreshThresholdMs', () => {
    it('is 5 minutes in milliseconds', () => {
      expect(oauthConfig.refreshThresholdMs).toBe(5 * 60 * 1000);
    });
  });

  describe('defaultTokenExpirySeconds', () => {
    it('is 8 hours in seconds', () => {
      expect(oauthConfig.defaultTokenExpirySeconds).toBe(8 * 60 * 60);
    });
  });
});

describe('buildAuthorizationUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Set required env vars for the function to work
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('builds authorization URL starting with GitHub OAuth endpoint', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    expect(url).toContain('https://github.com/login/oauth/authorize?');
  });

  it('includes client_id parameter', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    expect(url).toContain('client_id=');
  });

  it('includes redirect_uri parameter', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    expect(url).toContain('redirect_uri=');
  });

  it('includes scope parameter with all required scopes', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    expect(url).toContain('scope=');
    expect(url).toContain('repo');
    expect(url).toContain('read%3Auser');
    expect(url).toContain('actions%3Aread');
  });

  it('includes state parameter', () => {
    const url = buildAuthorizationUrl('my-state-value', 'test-challenge');
    expect(url).toContain('state=my-state-value');
  });

  it('includes code_challenge parameter', () => {
    const url = buildAuthorizationUrl('test-state', 'my-code-challenge');
    expect(url).toContain('code_challenge=my-code-challenge');
  });

  it('includes code_challenge_method=S256', () => {
    const url = buildAuthorizationUrl('test-state', 'test-challenge');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('properly URL-encodes special characters in state', () => {
    const url = buildAuthorizationUrl('state+with/special=chars', 'challenge123');
    expect(url).toContain('state=state%2Bwith%2Fspecial%3Dchars');
  });
});
