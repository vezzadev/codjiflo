/**
 * Integration tests for ShikiTokensContext multi-line comment handling.
 *
 * These tests verify that the ShikiTokensProvider correctly preserves TextMate
 * grammar state across lines when tokenizing full file content. This is critical
 * for multi-line constructs like JSDoc comments, template literals, and block
 * comments where individual lines cannot be tokenized correctly in isolation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@/tests/helpers';
import { ShikiTokensProvider, useShikiTokens, type TokenSide } from './ShikiTokensContext';
import { getHighlighter } from '@/lib/shiki';

// Pre-initialize Shiki to avoid timeout issues
beforeAll(async () => {
  await getHighlighter();
}, 30000);

/**
 * Test component that renders token information for inspection.
 */
function TokenInspector({
  lineNumber,
  side,
}: {
  lineNumber: number;
  side: TokenSide;
}) {
  const context = useShikiTokens();

  if (!context) {
    return <div data-testid="token-inspector">No context</div>;
  }

  if (!context.isReady) {
    return <div data-testid="token-inspector">Loading...</div>;
  }

  const tokens = context.getLineTokens(lineNumber, side);
  if (!tokens) {
    return <div data-testid="token-inspector">No tokens for line {lineNumber}</div>;
  }

  // Extract token colors to verify comment highlighting
  const tokenInfo = tokens.map((t) => ({
    content: t.content,
    color: t.color ?? 'none',
  }));

  return (
    <div data-testid="token-inspector">
      <span data-testid="token-count">{tokens.length}</span>
      <span data-testid="token-data">{JSON.stringify(tokenInfo)}</span>
      <span data-testid="has-full-content">{String(context.hasFullContent)}</span>
    </div>
  );
}

describe('ShikiTokensContext multi-line comment handling', () => {
  describe('full content mode (iteration mode)', () => {
    it('tokenizes JSDoc comment middle lines correctly', async () => {
      // TypeScript code with a JSDoc comment spanning 3 lines
      const tsCode = `/**
 * This is a JSDoc comment
 */
function foo() {}`;

      render(
        <ShikiTokensProvider newContent={tsCode} language="typescript">
          {/* Line 2 is " * This is a JSDoc comment" - the middle of the comment */}
          <TokenInspector lineNumber={2} side="new" />
        </ShikiTokensProvider>
      );

      // Wait for tokenization to complete
      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      // Verify we have full content mode
      expect(screen.getByTestId('has-full-content')).toHaveTextContent('true');

      // Get the token data
      const tokenData = screen.getByTestId('token-data').textContent;
      expect(tokenData).toBeTruthy();

      const tokens = JSON.parse(tokenData) as { content: string; color: string }[];

      // The entire line should be tokenized as comment
      // All tokens on this line should have the same comment color
      const fullContent = tokens.map((t) => t.content).join('');
      expect(fullContent).toBe(' * This is a JSDoc comment');

      // Verify all tokens have the same color (comment color)
      const colors = new Set(tokens.map((t) => t.color));
      expect(colors.size).toBe(1); // All tokens same color = properly recognized as comment
    });

    it('tokenizes block comment middle lines correctly', async () => {
      // JavaScript code with a block comment
      const jsCode = `/*
 * Block comment line 1
 * Block comment line 2
 */
const x = 1;`;

      render(
        <ShikiTokensProvider newContent={jsCode} language="javascript">
          {/* Line 3 is " * Block comment line 2" */}
          <TokenInspector lineNumber={3} side="new" />
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      const tokenData = screen.getByTestId('token-data').textContent;
      const tokens = JSON.parse(tokenData) as { content: string; color: string }[];

      // All tokens should be comment color
      const colors = new Set(tokens.map((t) => t.color));
      expect(colors.size).toBe(1);
    });

    it('correctly distinguishes comment lines from code lines', async () => {
      const tsCode = `/**
 * Comment line
 */
const code = true;`;

      // Render two inspectors - one for comment line, one for code line
      render(
        <ShikiTokensProvider newContent={tsCode} language="typescript">
          <div data-testid="comment-line">
            <TokenInspector lineNumber={2} side="new" />
          </div>
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      const commentTokenData = screen.getByTestId('token-data').textContent;
      const commentTokens = JSON.parse(commentTokenData) as { content: string; color: string }[];

      // Comment line should have uniform color
      const commentColors = new Set(commentTokens.map((t) => t.color));
      expect(commentColors.size).toBe(1);

      // Now render inspector for code line
      render(
        <ShikiTokensProvider newContent={tsCode} language="typescript">
          <TokenInspector lineNumber={4} side="new" />
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        const inspectors = screen.getAllByTestId('token-inspector');
        const codeInspector = inspectors[inspectors.length - 1];
        expect(codeInspector).not.toHaveTextContent('Loading...');
      });

      const inspectors = screen.getAllByTestId('token-inspector');
      expect(inspectors.length).toBeGreaterThan(0);
      const lastInspector = inspectors[inspectors.length - 1];
      expect(lastInspector).toBeDefined();
      const codeTokenData = lastInspector?.querySelector('[data-testid="token-data"]')?.textContent ?? '';

      expect(codeTokenData).not.toBe('');
      const codeTokens = JSON.parse(codeTokenData) as { content: string; color: string }[];

      // Code line should have multiple colors (keywords, strings, etc.)
      const codeColors = new Set(codeTokens.filter((t) => t.content.trim()).map((t) => t.color));
      expect(codeColors.size).toBeGreaterThan(1);
    });

    it('handles old content (deletions) separately from new content', async () => {
      const oldCode = `/**
 * Old comment
 */`;
      const newCode = `/**
 * New comment
 */`;

      render(
        <ShikiTokensProvider oldContent={oldCode} newContent={newCode} language="typescript">
          <div data-testid="old-tokens">
            <TokenInspector lineNumber={2} side="old" />
          </div>
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      const tokenData = screen.getByTestId('token-data').textContent;
      const tokens = JSON.parse(tokenData) as { content: string; color: string }[];

      // Should contain "Old comment"
      const content = tokens.map((t) => t.content).join('');
      expect(content).toContain('Old comment');
    });
  });

  describe('fallback mode (degraded mode - no full content)', () => {
    it('tokenizes visible lines together for basic multi-line support', async () => {
      // When full content is not available, we tokenize visible lines together
      const visibleLines = [
        '/**',
        ' * Comment in visible lines',
        ' */',
      ];

      render(
        <ShikiTokensProvider visibleLines={visibleLines} language="typescript">
          {/* In fallback mode, lineNumber is array index */}
          <TokenInspector lineNumber={1} side="new" />
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      // Verify we're in fallback mode (no full content)
      expect(screen.getByTestId('has-full-content')).toHaveTextContent('false');

      const tokenData = screen.getByTestId('token-data').textContent;
      const tokens = JSON.parse(tokenData) as { content: string; color: string }[];

      // Since visible lines are tokenized together, comment should be recognized
      const colors = new Set(tokens.map((t) => t.color));
      expect(colors.size).toBe(1); // All same color = comment
    });
  });

  describe('edge cases', () => {
    it('handles empty content gracefully', async () => {
      render(
        <ShikiTokensProvider newContent="" language="typescript">
          <TokenInspector lineNumber={1} side="new" />
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      expect(screen.getByTestId('token-inspector')).toHaveTextContent('No tokens for line 1');
    });

    it('returns null for non-existent line numbers', async () => {
      const tsCode = 'const x = 1;';

      render(
        <ShikiTokensProvider newContent={tsCode} language="typescript">
          <TokenInspector lineNumber={999} side="new" />
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      expect(screen.getByTestId('token-inspector')).toHaveTextContent('No tokens for line 999');
    });

    it('handles template literals spanning multiple lines', async () => {
      const tsCode = 'const str = `line 1\nline 2\nline 3`;';

      render(
        <ShikiTokensProvider newContent={tsCode} language="typescript">
          {/* Line 2 would be "line 2" inside the template literal */}
          <TokenInspector lineNumber={1} side="new" />
        </ShikiTokensProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-inspector')).not.toHaveTextContent('Loading...');
      });

      // Just verify it doesn't crash and returns tokens
      expect(screen.getByTestId('token-count')).toBeInTheDocument();
    });
  });
});
