/**
 * Tests for ShikiHighlighter component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/tests/helpers';
import { ShikiHighlighter } from './ShikiHighlighter';

// Mock useSyntaxTheme hook
vi.mock('../hooks/useSyntaxTheme', () => ({
  useSyntaxTheme: vi.fn(() => 'github-dark'),
}));

// Mock ShikiTokensContext to return null (no context available)
vi.mock('./ShikiTokensContext', () => ({
  useShikiTokens: vi.fn(() => null),
}));

// Mock the shiki module
const mockHighlighter = {
  getLoadedLanguages: vi.fn(() => ['typescript', 'javascript', 'python']),
  codeToTokens: vi.fn((code: string, options: { lang: string; theme: string }) => ({
    tokens: [[{ content: code, color: '#ff0000', offset: 0 }]],
    // Use options to prevent unused variable warning
    lang: options.lang,
  })),
};

vi.mock('@/lib/shiki', () => ({
  getHighlighter: vi.fn(() => Promise.resolve(mockHighlighter)),
}));

describe('ShikiHighlighter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty lines', () => {
    it('renders &nbsp; for empty code to maintain line height', async () => {
      render(<ShikiHighlighter code="" language="typescript" />);

      const highlighter = screen.getByTestId('shiki-highlighter');
      expect(highlighter).toBeInTheDocument();
      // &nbsp; is rendered as \u00A0
      expect(highlighter.innerHTML).toBe('&nbsp;');

      // Wait for any pending async operations to complete
      await waitFor(() => {
        // Empty code short-circuits before async, so this just ensures test cleanup
        expect(highlighter).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows unhighlighted code while loading', async () => {
      render(<ShikiHighlighter code="const x = 1;" language="typescript" />);

      // Initially shows loading state with raw code
      const highlighter = screen.getByTestId('shiki-highlighter');
      expect(highlighter).toHaveTextContent('const x = 1;');

      // Wait for highlighting to complete to avoid act() warnings
      await waitFor(() => {
        expect(mockHighlighter.codeToTokens).toHaveBeenCalled();
      });
    });

    it('shows whitespace markers in loading state when enabled', async () => {
      render(
        <ShikiHighlighter code="const x = 1;" language="typescript" showWhitespace />
      );

      const highlighter = screen.getByTestId('shiki-highlighter');
      // Should have whitespace markers
      expect(highlighter.querySelector('.whitespace-visible')).toBeInTheDocument();

      // Wait for highlighting to complete to avoid act() warnings
      await waitFor(() => {
        expect(mockHighlighter.codeToTokens).toHaveBeenCalled();
      });
    });
  });

  describe('highlighted state', () => {
    it('renders highlighted tokens after loading', async () => {
      render(<ShikiHighlighter code="const x = 1;" language="typescript" />);

      await waitFor(() => {
        expect(mockHighlighter.codeToTokens).toHaveBeenCalledWith('const x = 1;', {
          lang: 'typescript',
          theme: 'github-dark',
        });
      });

      // After loading, should have colored spans
      await waitFor(() => {
        const coloredSpan = screen.getByTestId('shiki-highlighter').querySelector('span[style]');
        expect(coloredSpan).toBeInTheDocument();
      });
    });

    it('renders whitespace markers in highlighted tokens when enabled', async () => {
      mockHighlighter.codeToTokens.mockReturnValueOnce({
        tokens: [[{ content: 'const x', color: '#ff0000', offset: 0 }]],
        lang: 'typescript',
      });

      render(
        <ShikiHighlighter code="const x" language="typescript" showWhitespace />
      );

      await waitFor(() => {
        expect(mockHighlighter.codeToTokens).toHaveBeenCalled();
      });

      // After loading, should have whitespace markers in colored spans
      await waitFor(() => {
        const highlighter = screen.getByTestId('shiki-highlighter');
        expect(highlighter.querySelector('.whitespace-visible')).toBeInTheDocument();
      });
    });
  });

  describe('unsupported languages', () => {
    it('renders plain text for unsupported languages', async () => {
      render(<ShikiHighlighter code="some code" language="unsupported-lang" />);

      await waitFor(() => {
        expect(mockHighlighter.getLoadedLanguages).toHaveBeenCalled();
      });

      // Should not call codeToTokens for unsupported languages
      await waitFor(() => {
        // codeToTokens should not be called
        const calls = mockHighlighter.codeToTokens.mock.calls.filter(
          (call) => call[1].lang === 'unsupported-lang'
        );
        expect(calls).toHaveLength(0);
      });

      // Should still show the code
      const highlighter = screen.getByTestId('shiki-highlighter');
      expect(highlighter).toHaveTextContent('some code');
    });
  });

  describe('tab handling', () => {
    it('renders tab characters as arrow markers', async () => {
      render(
        <ShikiHighlighter code={'\tindented'} language="typescript" showWhitespace />
      );

      const highlighter = screen.getByTestId('shiki-highlighter');
      const marker = highlighter.querySelector('.whitespace-visible');
      expect(marker).toBeInTheDocument();
      expect(marker).toHaveTextContent('→');

      // Wait for highlighting to complete to avoid act() warnings
      await waitFor(() => {
        expect(mockHighlighter.codeToTokens).toHaveBeenCalled();
      });
    });
  });
});
