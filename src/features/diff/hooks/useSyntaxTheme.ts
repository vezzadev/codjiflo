import { useMemo } from 'react';
import { useThemeStore, type Theme, type DiffColorScheme } from '@/features/theme';
import github from 'react-syntax-highlighter/dist/esm/styles/hljs/github';
import atomOneDark from 'react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark';
import a11yDark from 'react-syntax-highlighter/dist/esm/styles/hljs/a11y-dark';
import vs from 'react-syntax-highlighter/dist/esm/styles/hljs/vs';
import vs2015 from 'react-syntax-highlighter/dist/esm/styles/hljs/vs2015';

type HljsStyle = typeof github;
type W = '*';
type ThemePattern = Theme | W;
type SchemePattern = DiffColorScheme | W;

// Pattern matching: [theme, colorScheme] -> style (first match wins)
const STYLE_PATTERNS: [ThemePattern, SchemePattern, HljsStyle][] = [
  // High contrast always uses a11y-dark
  ['high-contrast', '*', a11yDark],
  // CodeFlow and Visual Studio schemes use VS syntax themes
  ['light', 'codeflow-classic', vs],
  ['light', 'codeflow-redgreen', vs],
  ['light', 'visual-studio', vs],
  ['dark', 'codeflow-classic', vs2015],
  ['dark', 'codeflow-redgreen', vs2015],
  ['dark', 'visual-studio', vs2015],
  ['black', 'codeflow-classic', vs2015],
  ['black', 'codeflow-redgreen', vs2015],
  ['black', 'visual-studio', vs2015],
  // Default: GitHub schemes use GitHub/Atom themes
  ['light', '*', github],
  ['dark', '*', atomOneDark],
  ['black', '*', atomOneDark],
];

function matchStyle(theme: Theme, scheme: DiffColorScheme): HljsStyle {
  const match = STYLE_PATTERNS.find(
    ([t, s]) => (t === '*' || t === theme) && (s === '*' || s === scheme)
  );
  return match?.[2] ?? github;
}

/**
 * Returns an hljs syntax highlighting style that matches the current UI theme.
 * The background is set to transparent so the diff line background shows through.
 */
export function useSyntaxTheme(): HljsStyle {
  const theme = useThemeStore((state) => state.theme);
  const diffColorScheme = useThemeStore((state) => state.diffColorScheme);

  return useMemo(() => {
    const baseStyle = matchStyle(theme, diffColorScheme);
    return {
      ...baseStyle,
      hljs: {
        ...baseStyle.hljs,
        background: 'transparent',
        padding: 0,
        margin: 0,
      },
    };
  }, [theme, diffColorScheme]);
}
