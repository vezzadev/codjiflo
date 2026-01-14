/**
 * Context for providing pre-tokenized Shiki tokens to diff lines.
 *
 * This solves the multi-line comment highlighting issue by tokenizing full file
 * content (preserving TextMate grammar state) rather than each line independently.
 *
 * When full file content is available (iteration mode), tokens are indexed by
 * actual line numbers. When only visible diff lines are available (degraded mode),
 * tokens are indexed by array position as a fallback.
 */

import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import type { ThemedToken } from 'shiki';
import { getHighlighter, type ShikiLanguage } from '@/lib/shiki';
import { useSyntaxTheme } from '../hooks/useSyntaxTheme';

/** Side of the diff for token lookup */
export type TokenSide = 'old' | 'new';

interface ShikiTokensContextValue {
  /**
   * Get pre-tokenized tokens for a specific line.
   *
   * @param lineNumber - 1-based line number in the file (or array index if fallback mode)
   * @param side - 'old' for deletions/left side, 'new' for additions/right side
   * @returns Tokens for the line, or null if not available
   */
  getLineTokens: (lineNumber: number, side: TokenSide) => ThemedToken[] | null;

  /**
   * Legacy method for array-index based lookup (fallback mode).
   * @deprecated Use getLineTokens with side parameter instead.
   */
  getLineTokensByIndex: (index: number) => ThemedToken[] | null;

  /** Whether tokenization is complete and ready to use */
  isReady: boolean;

  /** Whether full file content is available (vs fallback to visible lines only) */
  hasFullContent: boolean;
}

const ShikiTokensContext = createContext<ShikiTokensContextValue | null>(null);

interface ShikiTokensProviderProps {
  /**
   * Full content of the "old" (base/left) file version.
   * When provided, enables accurate multi-line highlighting for deletions.
   */
  oldContent?: string;

  /**
   * Full content of the "new" (head/right) file version.
   * When provided, enables accurate multi-line highlighting for additions.
   */
  newContent?: string;

  /**
   * Fallback: Array of visible diff line contents (used when full content unavailable).
   * Tokens will be indexed by array position, not line number.
   */
  visibleLines?: string[];

  /** Language for syntax highlighting */
  language: string;
  children: React.ReactNode;
}

/** Token storage indexed by 1-based line number */
type TokensByLineNumber = Map<number, ThemedToken[]>;

/**
 * Provider that tokenizes file content to preserve multi-line state
 * (e.g., block comments, template literals) and provides per-line token access.
 *
 * Supports two modes:
 * 1. Full content mode: When oldContent/newContent provided, tokenizes complete files
 *    and indexes by line number. Works correctly even when filtering to changes only.
 * 2. Fallback mode: When only visibleLines provided, tokenizes those together and
 *    indexes by array position. May have issues with filtered multi-line constructs.
 */
export function ShikiTokensProvider({
  oldContent,
  newContent,
  visibleLines,
  language,
  children,
}: ShikiTokensProviderProps) {
  const theme = useSyntaxTheme();

  // Tokens indexed by line number for old (base) version
  const [oldTokens, setOldTokens] = useState<TokensByLineNumber | null>(null);
  // Tokens indexed by line number for new (head) version
  const [newTokens, setNewTokens] = useState<TokensByLineNumber | null>(null);
  // Fallback: tokens indexed by array position (for visible lines only mode)
  const [fallbackTokens, setFallbackTokens] = useState<ThemedToken[][] | null>(null);

  const cancelledRef = useRef(false);

  // Determine which mode we're in
  const hasFullContent = oldContent !== undefined || newContent !== undefined;

  // Memoize content to detect actual changes
  const memoizedOldContent = useMemo(() => oldContent, [oldContent]);
  const memoizedNewContent = useMemo(() => newContent, [newContent]);
  const memoizedVisibleLines = useMemo(
    () => (visibleLines ? visibleLines.join('\n') : undefined),
    [visibleLines]
  );

  useEffect(() => {
    cancelledRef.current = false;

    void (async () => {
      const highlighter = await getHighlighter();
      if (cancelledRef.current) return;

      // Check if language is supported
      const langs = highlighter.getLoadedLanguages();
      const isSupported = langs.includes(language as ShikiLanguage);

      if (hasFullContent) {
        // Full content mode: tokenize old and new versions separately
        const tokenizeContent = (content: string | undefined): TokensByLineNumber | null => {
          if (!content) return null;

          if (!isSupported) {
            // For unsupported languages, create simple tokens
            const lines = content.split('\n');
            const map = new Map<number, ThemedToken[]>();
            lines.forEach((line, idx) => {
              map.set(idx + 1, [{ content: line, offset: 0 }] as ThemedToken[]);
            });
            return map;
          }

          const result = highlighter.codeToTokens(content, {
            lang: language as ShikiLanguage,
            theme,
          });

          // Convert array to map indexed by 1-based line number
          const map = new Map<number, ThemedToken[]>();
          result.tokens.forEach((lineTokens, idx) => {
            map.set(idx + 1, lineTokens);
          });
          return map;
        };

        const oldResult = tokenizeContent(memoizedOldContent);
        const newResult = tokenizeContent(memoizedNewContent);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Race condition check
        if (!cancelledRef.current) {
          setOldTokens(oldResult);
          setNewTokens(newResult);
          setFallbackTokens(null);
        }
      } else if (memoizedVisibleLines !== undefined && visibleLines) {
        // Fallback mode: tokenize visible lines together
        if (!isSupported) {
          const simpleTokens = visibleLines.map(
            (line) => [{ content: line, offset: 0 }] as ThemedToken[]
          );
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Race condition check
          if (!cancelledRef.current) {
            setFallbackTokens(simpleTokens);
            setOldTokens(null);
            setNewTokens(null);
          }
          return;
        }

        const result = highlighter.codeToTokens(memoizedVisibleLines, {
          lang: language as ShikiLanguage,
          theme,
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Race condition check
        if (!cancelledRef.current) {
          setFallbackTokens(result.tokens);
          setOldTokens(null);
          setNewTokens(null);
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [
    memoizedOldContent,
    memoizedNewContent,
    memoizedVisibleLines,
    visibleLines,
    language,
    theme,
    hasFullContent,
  ]);

  const contextValue = useMemo<ShikiTokensContextValue>(
    () => ({
      getLineTokens: (lineNumber: number, side: TokenSide) => {
        if (hasFullContent) {
          // Full content mode: look up by line number
          const tokenMap = side === 'old' ? oldTokens : newTokens;
          if (!tokenMap) return null;
          return tokenMap.get(lineNumber) ?? null;
        }
        // Fallback mode: lineNumber is treated as array index
        // This maintains backward compatibility
        if (!fallbackTokens || lineNumber < 0 || lineNumber >= fallbackTokens.length) {
          return null;
        }
        return fallbackTokens[lineNumber] ?? null;
      },

      getLineTokensByIndex: (index: number) => {
        // Legacy fallback-only method
        if (!fallbackTokens || index < 0 || index >= fallbackTokens.length) {
          return null;
        }
        return fallbackTokens[index] ?? null;
      },

      isReady: hasFullContent
        ? oldTokens !== null || newTokens !== null
        : fallbackTokens !== null,

      hasFullContent,
    }),
    [oldTokens, newTokens, fallbackTokens, hasFullContent]
  );

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
