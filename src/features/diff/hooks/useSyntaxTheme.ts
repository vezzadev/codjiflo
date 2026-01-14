import { useMemo } from 'react';
import { useThemeStore, type Theme, type DiffColorScheme } from '@/features/theme';
import type { ShikiTheme } from '@/lib/shiki';

type W = '*';
type ThemePattern = Theme | W;
type SchemePattern = DiffColorScheme | W;

// Pattern matching: [theme, colorScheme] -> Shiki theme name (first match wins)
const THEME_PATTERNS: [ThemePattern, SchemePattern, ShikiTheme][] = [
  // High contrast always uses github-dark-high-contrast
  ['high-contrast', '*', 'github-dark-high-contrast'],
  // CodeFlow and Visual Studio schemes use VS Code themes
  ['light', 'codeflow-classic', 'light-plus'],
  ['light', 'codeflow-redgreen', 'light-plus'],
  ['light', 'visual-studio', 'light-plus'],
  ['dark', 'codeflow-classic', 'dark-plus'],
  ['dark', 'codeflow-redgreen', 'dark-plus'],
  ['dark', 'visual-studio', 'dark-plus'],
  ['black', 'codeflow-classic', 'dark-plus'],
  ['black', 'codeflow-redgreen', 'dark-plus'],
  ['black', 'visual-studio', 'dark-plus'],
  // Default: GitHub schemes use GitHub themes
  ['light', '*', 'github-light'],
  ['dark', '*', 'github-dark'],
  ['black', '*', 'github-dark'],
];

function matchTheme(theme: Theme, scheme: DiffColorScheme): ShikiTheme {
  const match = THEME_PATTERNS.find(
    ([t, s]) => (t === '*' || t === theme) && (s === '*' || s === scheme)
  );
  return match?.[2] ?? 'github-light';
}

/**
 * Returns a Shiki theme name that matches the current UI theme and diff color scheme.
 */
export function useSyntaxTheme(): ShikiTheme {
  const theme = useThemeStore((state) => state.theme);
  const diffColorScheme = useThemeStore((state) => state.diffColorScheme);

  return useMemo(() => {
    return matchTheme(theme, diffColorScheme);
  }, [theme, diffColorScheme]);
}
