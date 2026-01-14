/**
 * Tests for Shiki highlighter wrapper
 */

import { describe, it, expect, vi } from 'vitest';

// Mock shiki's createHighlighter before importing our module
const mockHighlighter = {
  getLoadedLanguages: vi.fn(() => ['typescript', 'javascript']),
  codeToTokens: vi.fn(),
};

vi.mock('shiki', () => ({
  createHighlighter: vi.fn(() => Promise.resolve(mockHighlighter)),
}));

// Import after mocking
import { getHighlighter, isHighlighterReady, preloadHighlighter } from './shiki';

describe('shiki wrapper', () => {
  // Note: These tests run against a singleton that persists across tests.
  // We can't reset the module state, so tests verify behavior given that state.

  describe('getHighlighter', () => {
    it('returns the highlighter instance', async () => {
      const highlighter = await getHighlighter();
      expect(highlighter).toBe(mockHighlighter);
    });

    it('returns the same instance on subsequent calls', async () => {
      const first = await getHighlighter();
      const second = await getHighlighter();
      expect(first).toBe(second);
    });
  });

  describe('isHighlighterReady', () => {
    it('returns true after highlighter is initialized', async () => {
      await getHighlighter();
      expect(isHighlighterReady()).toBe(true);
    });
  });

  describe('preloadHighlighter', () => {
    it('does not throw when called', () => {
      expect(() => preloadHighlighter()).not.toThrow();
    });
  });
});
