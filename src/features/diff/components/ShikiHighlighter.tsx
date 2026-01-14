import { useState, useEffect, useRef } from 'react';
import type { ThemedToken } from 'shiki';
import { getHighlighter, type ShikiLanguage } from '@/lib/shiki';
import { useSyntaxTheme } from '../hooks/useSyntaxTheme';
import { useShikiTokens } from './ShikiTokensContext';

interface ShikiHighlighterProps {
  code: string;
  language: string;
  showWhitespace?: boolean;
  /**
   * Line index for context-aware highlighting.
   * When provided and ShikiTokensProvider is available, uses pre-tokenized lines
   * which correctly handle multi-line constructs like block comments.
   */
  lineIndex?: number;
}

/**
 * Insert visible whitespace markers into text content.
 * Replaces spaces with · and tabs with → followed by spaces.
 */
function insertWhitespaceMarkers(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let i = 0;
  let nonWsStart = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === ' ' || char === '\t') {
      // Push any accumulated non-whitespace text
      if (i > nonWsStart) {
        result.push(text.slice(nonWsStart, i));
      }

      // Add visible whitespace marker
      result.push(
        <span key={i} className="whitespace-visible">
          {char === ' ' ? '·' : '→   '}
        </span>
      );

      nonWsStart = i + 1;
    }
    i++;
  }

  // Push remaining text
  if (nonWsStart < text.length) {
    result.push(text.slice(nonWsStart));
  }

  return result.length > 0 ? result : [text];
}

/**
 * Render Shiki tokens with optional visible whitespace markers.
 */
function renderTokens(
  tokens: ThemedToken[][],
  showWhitespace: boolean
): React.ReactNode {
  // Shiki returns tokens grouped by line, but we're rendering single lines
  // So we flatten and render all tokens inline
  return tokens.flatMap((line, lineIndex) =>
    line.map((token, tokenIndex) => {
      const content = showWhitespace
        ? insertWhitespaceMarkers(token.content)
        : token.content;

      return (
        <span
          key={`${lineIndex}-${tokenIndex}`}
          style={{ color: token.color }}
        >
          {content}
        </span>
      );
    })
  );
}

/**
 * Syntax highlighter component using Shiki (VS Code TextMate grammars).
 * Handles async initialization and provides fallback during loading.
 */
export function ShikiHighlighter({
  code,
  language,
  showWhitespace = false,
  lineIndex,
}: ShikiHighlighterProps) {
  const theme = useSyntaxTheme();
  const tokensContext = useShikiTokens();
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);

  // Use ref for cancellation check after async operations
  const cancelledRef = useRef(false);

  // Try to get pre-tokenized tokens from context (for multi-line comment support)
  const contextTokens = lineIndex !== undefined ? tokensContext?.getLineTokens(lineIndex) : null;

  useEffect(() => {
    // Skip independent tokenization if we have context tokens
    if (contextTokens) {
      return;
    }

    cancelledRef.current = false;

    void (async () => {
      const highlighter = await getHighlighter();
      if (cancelledRef.current) return;

      // Check if language is supported
      const langs = highlighter.getLoadedLanguages();
      const isSupported = langs.includes(language as ShikiLanguage);

      if (!isSupported) {
        // For unsupported languages, create a simple token for the whole content
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Race condition check after await
        if (!cancelledRef.current) {
          setTokens([[{ content: code, offset: 0 }]] as ThemedToken[][]);
        }
        return;
      }

      const result = highlighter.codeToTokens(code, {
        lang: language as ShikiLanguage,
        theme,
      });

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Race condition check after await
      if (!cancelledRef.current) {
        setTokens(result.tokens);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [code, language, theme, contextTokens]);

  // Handle empty lines consistently to maintain line height
  if (code === '') {
    return (
      <span className="diff-code" data-testid="shiki-highlighter">
        &nbsp;
      </span>
    );
  }

  // Use context tokens if available (handles multi-line constructs correctly)
  if (contextTokens) {
    return (
      <span className="diff-code" data-testid="shiki-highlighter">
        {renderTokens([contextTokens], showWhitespace)}
      </span>
    );
  }

  // While loading, show unhighlighted code to prevent layout shift
  if (!tokens) {
    return (
      <span className="diff-code" data-testid="shiki-highlighter">
        {showWhitespace ? insertWhitespaceMarkers(code) : code}
      </span>
    );
  }

  return (
    <span className="diff-code" data-testid="shiki-highlighter">
      {renderTokens(tokens, showWhitespace)}
    </span>
  );
}
