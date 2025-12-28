import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  storeOAuthState,
  retrieveOAuthState,
  OAUTH_STORAGE_KEYS,
  storeReturnOrigin,
  retrieveReturnOrigin,
  storeTokenTransfer,
  retrieveTokenTransfer,
} from './pkce';

// Mock document.cookie for testing
let mockCookies: Record<string, string> = {};

const mockCookieGetter = vi.fn(() => {
  return Object.entries(mockCookies)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('; ');
});

const mockCookieSetter = vi.fn((value: string) => {
  const [cookiePart] = value.split(';');
  if (!cookiePart) return;

  const [name, val] = cookiePart.split('=');
  if (!name) return;

  const decodedName = decodeURIComponent(name);

  if (value.includes('max-age=0')) {
    // Use Reflect.deleteProperty to avoid eslint no-dynamic-delete error
    Reflect.deleteProperty(mockCookies, decodedName);
  } else {
    mockCookies[decodedName] = decodeURIComponent(val ?? '');
  }
});

Object.defineProperty(document, 'cookie', {
  get: mockCookieGetter,
  set: mockCookieSetter,
  configurable: true,
});

describe('PKCE utilities', () => {
  describe('generateCodeVerifier', () => {
    it('generates a base64url-encoded string', () => {
      const verifier = generateCodeVerifier();
      // Base64url alphabet: A-Z, a-z, 0-9, -, _
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates strings of consistent length', () => {
      const verifier = generateCodeVerifier();
      // 32 bytes → 43 chars in base64url (no padding)
      expect(verifier.length).toBe(43);
    });

    it('generates unique values each time', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('generates a base64url-encoded string', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates consistent challenges for the same verifier', async () => {
      const verifier = 'test-verifier-123';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it('generates different challenges for different verifiers', async () => {
      const challenge1 = await generateCodeChallenge('verifier-1');
      const challenge2 = await generateCodeChallenge('verifier-2');
      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('generateState', () => {
    it('generates a base64url-encoded string', () => {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates unique values each time', () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('OAuth state storage (cookies)', () => {
    beforeEach(() => {
      mockCookies = {};
      vi.clearAllMocks();
    });

    it('stores OAuth state in cookies', () => {
      const codeVerifier = 'test-verifier';
      const state = 'test-state';

      storeOAuthState(codeVerifier, state);

      expect(mockCookies[OAUTH_STORAGE_KEYS.CODE_VERIFIER]).toBe(codeVerifier);
      expect(mockCookies[OAUTH_STORAGE_KEYS.STATE]).toBe(state);
    });

    it('retrieves and clears OAuth state from cookies', () => {
      const codeVerifier = 'test-verifier';
      const state = 'test-state';

      storeOAuthState(codeVerifier, state);
      const retrieved = retrieveOAuthState();

      expect(retrieved).toEqual({ codeVerifier, state });
      expect(mockCookies[OAUTH_STORAGE_KEYS.CODE_VERIFIER]).toBeUndefined();
      expect(mockCookies[OAUTH_STORAGE_KEYS.STATE]).toBeUndefined();
    });

    it('returns null when OAuth state is not stored', () => {
      const retrieved = retrieveOAuthState();
      expect(retrieved).toBeNull();
    });

    it('returns null when only code verifier is stored', () => {
      mockCookies[OAUTH_STORAGE_KEYS.CODE_VERIFIER] = 'test';
      const retrieved = retrieveOAuthState();
      expect(retrieved).toBeNull();
    });

    it('returns null when only state is stored', () => {
      mockCookies[OAUTH_STORAGE_KEYS.STATE] = 'test';
      const retrieved = retrieveOAuthState();
      expect(retrieved).toBeNull();
    });
  });

  describe('Return origin storage', () => {
    beforeEach(() => {
      mockCookies = {};
      vi.clearAllMocks();
    });

    it('stores return origin in cookie', () => {
      const origin = 'https://pr-123.codjiflo.vza.net';

      storeReturnOrigin(origin);

      expect(mockCookies[OAUTH_STORAGE_KEYS.RETURN_ORIGIN]).toBe(origin);
    });

    it('retrieves and clears return origin', () => {
      const origin = 'https://pr-123.codjiflo.vza.net';

      storeReturnOrigin(origin);
      const retrieved = retrieveReturnOrigin();

      expect(retrieved).toBe(origin);
      expect(mockCookies[OAUTH_STORAGE_KEYS.RETURN_ORIGIN]).toBeUndefined();
    });

    it('returns null when no return origin is stored', () => {
      const retrieved = retrieveReturnOrigin();
      expect(retrieved).toBeNull();
    });
  });

  describe('Token transfer storage', () => {
    beforeEach(() => {
      mockCookies = {};
      vi.clearAllMocks();
    });

    it('stores token transfer data in cookie (base64 encoded)', () => {
      const tokenData = {
        accessToken: 'gho_test123',
        refreshToken: 'ghr_refresh456',
        expiresAt: 1234567890000,
      };

      storeTokenTransfer(tokenData);

      const storedValue = mockCookies[OAUTH_STORAGE_KEYS.TOKEN_TRANSFER];
      expect(storedValue).toBeDefined();
      // Verify it's base64 encoded
      const decoded = JSON.parse(atob(storedValue ?? '')) as typeof tokenData;
      expect(decoded).toEqual(tokenData);
    });

    it('retrieves and clears token transfer data', () => {
      const tokenData = {
        accessToken: 'gho_test123',
        refreshToken: 'ghr_refresh456',
        expiresAt: 1234567890000,
      };

      storeTokenTransfer(tokenData);
      const retrieved = retrieveTokenTransfer();

      expect(retrieved).toEqual(tokenData);
      expect(mockCookies[OAUTH_STORAGE_KEYS.TOKEN_TRANSFER]).toBeUndefined();
    });

    it('handles token data without optional fields', () => {
      const tokenData = {
        accessToken: 'gho_test123',
      };

      storeTokenTransfer(tokenData);
      const retrieved = retrieveTokenTransfer();

      expect(retrieved).toEqual(tokenData);
    });

    it('returns null when no token transfer data is stored', () => {
      const retrieved = retrieveTokenTransfer();
      expect(retrieved).toBeNull();
    });

    it('returns null and logs error for invalid base64 data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

      mockCookies[OAUTH_STORAGE_KEYS.TOKEN_TRANSFER] = 'not-valid-base64!!!';
      const retrieved = retrieveTokenTransfer();

      expect(retrieved).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to decode token transfer data');

      consoleSpy.mockRestore();
    });
  });
});
