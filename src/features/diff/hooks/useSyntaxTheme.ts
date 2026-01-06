import { useMemo } from 'react';
import { useThemeStore, type Theme } from '@/features/theme';
import github from 'react-syntax-highlighter/dist/esm/styles/hljs/github';
import atomOneDark from 'react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark';
import a11yDark from 'react-syntax-highlighter/dist/esm/styles/hljs/a11y-dark';

type HljsStyle = typeof github;

const THEME_TO_HLJS_STYLE: Record<Theme, HljsStyle> = {
  light: github,
  dark: atomOneDark,
  black: atomOneDark,
  'high-contrast': a11yDark,
};

/**
 * Returns an hljs syntax highlighting style that matches the current UI theme.
 * The background is set to transparent so the diff line background shows through.
 */
export function useSyntaxTheme(): HljsStyle {
  const theme = useThemeStore((state) => state.theme);

  return useMemo(() => {
    const baseStyle = THEME_TO_HLJS_STYLE[theme];
    return {
      ...baseStyle,
      hljs: {
        ...baseStyle.hljs,
        background: 'transparent',
        padding: 0,
        margin: 0,
      },
    };
  }, [theme]);
}
