import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  KNOWN_BASE_DOMAIN,
  getBaseDomain,
  isValidReturnOrigin,
} from './cookies';

describe('Cookie utilities', () => {
  describe('KNOWN_BASE_DOMAIN', () => {
    it('is set to .vza.net', () => {
      expect(KNOWN_BASE_DOMAIN).toBe('.vza.net');
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

    it('returns .vza.net for codjiflo.vza.net', () => {
      vi.stubGlobal('window', { location: { hostname: 'codjiflo.vza.net' } });
      expect(getBaseDomain()).toBe('.vza.net');
    });

    it('returns .vza.net for pr-123.codjiflo.vza.net', () => {
      vi.stubGlobal('window', { location: { hostname: 'pr-123.codjiflo.vza.net' } });
      expect(getBaseDomain()).toBe('.vza.net');
    });

    it('returns .vza.net for deeply nested subdomains', () => {
      vi.stubGlobal('window', { location: { hostname: 'a.b.c.vza.net' } });
      expect(getBaseDomain()).toBe('.vza.net');
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

    it('returns true for exact vza.net domain', () => {
      expect(isValidReturnOrigin('https://vza.net')).toBe(true);
    });

    it('returns true for codjiflo.vza.net', () => {
      expect(isValidReturnOrigin('https://codjiflo.vza.net')).toBe(true);
    });

    it('returns true for PR preview subdomain', () => {
      expect(isValidReturnOrigin('https://pr-123.codjiflo.vza.net')).toBe(true);
    });

    it('returns true for deeply nested vza.net subdomain', () => {
      expect(isValidReturnOrigin('https://a.b.c.vza.net')).toBe(true);
    });

    it('returns false for external domains', () => {
      expect(isValidReturnOrigin('https://evil.com')).toBe(false);
    });

    it('returns false for domains that contain vza.net but are not subdomains', () => {
      expect(isValidReturnOrigin('https://vza.net.evil.com')).toBe(false);
    });

    it('returns false for similar looking domains', () => {
      expect(isValidReturnOrigin('https://fakevza.net')).toBe(false);
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
});
