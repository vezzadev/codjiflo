/**
 * Context for providing pre-tokenized Shiki tokens to diff lines.
 *
 * This solves the multi-line comment highlighting issue by tokenizing all lines
 * together (preserving TextMate grammar state) rather than each line independently.
 */

import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import type { ThemedToken } from 'shiki';
import { getHighlighter, type ShikiLanguage } from '@/lib/shiki';
import { useSyntaxTheme } from '../hooks/useSyntaxTheme';

interface ShikiTokensContextValue {
  /**
   * Get pre-tokenized tokens for a specific line index.
   * Returns null if tokenization is not ready or line doesn't exist.
   */
  getLineTokens: (lineIndex: number) => ThemedToken[] | null;
  /** Whether tokenization is complete and ready to use */
  isReady: boolean;
}

const ShikiTokensContext = createContext<ShikiTokensContextValue | null>(null);

interface ShikiTokensProviderProps {
  /** Array of code lines to tokenize together */
  lines: string[];
  /** Language for syntax highlighting */
  language: string;
  children: React.ReactNode;
}

/**
 * Provider that tokenizes all lines together to preserve multi-line state
 * (e.g., block comments, template literals) and provides per-line token access.
 */
export function ShikiTokensProvider({
  lines,
  language,
  children,
}: ShikiTokensProviderProps) {
  const theme = useSyntaxTheme();
  const [tokensByLine, setTokensByLine] = useState<ThemedToken[][] | null>(null);
  const cancelledRef = useRef(false);

  // Memoize the joined content to detect actual changes
  const content = useMemo(() => lines.join('\n'), [lines]);

  useEffect(() => {
    cancelledRef.current = false;

    void (async () => {
      const highlighter = await getHighlighter();
      if (cancelledRef.current) return;

      // Check if language is supported
      const langs = highlighter.getLoadedLanguages();
      const isSupported = langs.includes(language as ShikiLanguage);

      if (!isSupported) {
        // For unsupported languages, create simple tokens (one per line)
        const simpleTokens = lines.map(line => [{ content: line, offset: 0 }] as ThemedToken[]);
        if (!cancelledRef.current) {
          setTokensByLine(simpleTokens);
        }
        return;
      }

      // Tokenize all content together to preserve multi-line state
      const result = highlighter.codeToTokens(content, {
        lang: language as ShikiLanguage,
        theme,
      });

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Race condition check
      if (!cancelledRef.current) {
        setTokensByLine(result.tokens);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [content, language, theme, lines]);

  const contextValue = useMemo<ShikiTokensContextValue>(() => ({
    getLineTokens: (lineIndex: number) => {
      if (!tokensByLine || lineIndex < 0 || lineIndex >= tokensByLine.length) {
        return null;
      }
      return tokensByLine[lineIndex] ?? null;
    },
    isReady: tokensByLine !== null,
  }), [tokensByLine]);

  return (
    <ShikiTokensContext.Provider value={contextValue}>
      {children}
    </ShikiTokensContext.Provider>
  );
}

/**
 * Hook to access pre-tokenized Shiki tokens from context.
 * Returns null if not within a ShikiTokensProvider.
 */
export function useShikiTokens(): ShikiTokensContextValue | null {
  return useContext(ShikiTokensContext);
}
