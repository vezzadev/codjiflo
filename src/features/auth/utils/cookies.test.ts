import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  KNOWN_BASE_DOMAIN,
  getBaseDomain,
  isValidReturnOrigin,
  isValidReturnPath,
} from './cookies';

describe('Cookie utilities', () => {
  describe('KNOWN_BASE_DOMAIN', () => {
    it('is set to .codjiflo.net', () => {
      expect(KNOWN_BASE_DOMAIN).toBe('.codjiflo.net');
    });
  });

  describe('getBaseDomain', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns undefined for localhost', () => {
      vi.stubGlobal('window', { location: { hostname: 'localhost' } });
      expect(getBaseDomain()).toBeUndefined();
    });

    it('returns undefined for 127.0.0.1', () => {
      vi.stubGlobal('window', { location: { hostname: '127.0.0.1' } });
      expect(getBaseDomain()).toBeUndefined();
    });

    it('returns .codjiflo.net for the apex codjiflo.net', () => {
      vi.stubGlobal('window', { location: { hostname: 'codjiflo.net' } });
      expect(getBaseDomain()).toBe('.codjiflo.net');
    });

    it('returns .codjiflo.net for pr-123.codjiflo.net', () => {
      vi.stubGlobal('window', { location: { hostname: 'pr-123.codjiflo.net' } });
      expect(getBaseDomain()).toBe('.codjiflo.net');
    });

    it('returns .codjiflo.net for deeply nested subdomains', () => {
      vi.stubGlobal('window', { location: { hostname: 'a.b.c.codjiflo.net' } });
      expect(getBaseDomain()).toBe('.codjiflo.net');
    });

    it('returns undefined for unknown domains', () => {
      vi.stubGlobal('window', { location: { hostname: 'example.com' } });
      expect(getBaseDomain()).toBeUndefined();
    });

    it('returns undefined for SSR (no window)', () => {
      vi.stubGlobal('window', undefined);
      expect(getBaseDomain()).toBeUndefined();
    });
  });

  describe('isValidReturnOrigin', () => {
    it('returns true for localhost', () => {
      expect(isValidReturnOrigin('http://localhost:3000')).toBe(true);
    });

    it('returns true for localhost without port', () => {
      expect(isValidReturnOrigin('http://localhost')).toBe(true);
    });

    it('returns true for 127.0.0.1', () => {
      expect(isValidReturnOrigin('http://127.0.0.1:3000')).toBe(true);
    });

    it('returns true for exact codjiflo.net domain', () => {
      expect(isValidReturnOrigin('https://codjiflo.net')).toBe(true);
    });

    it('returns true for a codjiflo.net subdomain', () => {
      expect(isValidReturnOrigin('https://app.codjiflo.net')).toBe(true);
    });

    it('returns true for PR preview subdomain', () => {
      expect(isValidReturnOrigin('https://pr-123.codjiflo.net')).toBe(true);
    });

    it('returns true for deeply nested codjiflo.net subdomain', () => {
      expect(isValidReturnOrigin('https://a.b.c.codjiflo.net')).toBe(true);
    });

    it('returns false for external domains', () => {
      expect(isValidReturnOrigin('https://evil.com')).toBe(false);
    });

    it('returns false for domains that contain codjiflo.net but are not subdomains', () => {
      expect(isValidReturnOrigin('https://codjiflo.net.evil.com')).toBe(false);
    });

    it('returns false for similar looking domains', () => {
      expect(isValidReturnOrigin('https://fakecodjiflo.net')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isValidReturnOrigin('not-a-url')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidReturnOrigin('')).toBe(false);
    });

    it('returns false for javascript: protocol', () => {
      expect(isValidReturnOrigin('javascript:alert(1)')).toBe(false);
    });
  });

  describe('isValidReturnPath', () => {
    it('returns true for simple paths', () => {
      expect(isValidReturnPath('/dashboard')).toBe(true);
    });

    it('returns true for paths with segments', () => {
      expect(isValidReturnPath('/owner/repo/123')).toBe(true);
    });

    it('returns true for paths with query strings', () => {
      expect(isValidReturnPath('/owner/repo/123?file=test.ts')).toBe(true);
    });

    it('returns true for paths with hash', () => {
      expect(isValidReturnPath('/dashboard#section')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isValidReturnPath('')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isValidReturnPath(null as unknown as string)).toBe(false);
      expect(isValidReturnPath(undefined as unknown as string)).toBe(false);
    });

    it('returns false for protocol-relative URLs', () => {
      expect(isValidReturnPath('//evil.com/path')).toBe(false);
    });

    it('returns false for absolute URLs with protocol', () => {
      expect(isValidReturnPath('https://evil.com/path')).toBe(false);
    });

    it('returns false for paths containing protocol schemes', () => {
      expect(isValidReturnPath('/redirect?url=https://evil.com')).toBe(false);
    });

    it('returns false for javascript: protocol', () => {
      expect(isValidReturnPath('javascript:alert(1)')).toBe(false);
    });

    it('returns false for relative paths without leading slash', () => {
      expect(isValidReturnPath('dashboard')).toBe(false);
    });
  });
});
