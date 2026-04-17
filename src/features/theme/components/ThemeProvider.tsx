'use client';

import { useEffect } from 'react';
import { useThemeStore, Theme, DiffColorScheme } from '../stores/useThemeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Build the CSS class for diff colors based on theme, scheme, and HC preference
function getDiffClassName(theme: Theme, scheme: DiffColorScheme, useHighContrast: boolean): string {
  // All schemes have light/dark/black variants; high-contrast UI uses dark diff variant
  const themeSuffix = theme === 'high-contrast' ? 'dark' : theme;
  const hcSuffix = useHighContrast ? '-hc' : '';
  return `diff-${scheme}-${themeSuffix}${hcSuffix}`;
}

// All possible diff classes for removal
const ALL_DIFF_CLASSES = [
  // GitHub default
  'diff-github-light', 'diff-github-dark', 'diff-github-black',
  'diff-github-light-hc', 'diff-github-dark-hc', 'diff-github-black-hc',
  // GitHub protanopia
  'diff-github-protanopia-light', 'diff-github-protanopia-dark', 'diff-github-protanopia-black',
  'diff-github-protanopia-light-hc', 'diff-github-protanopia-dark-hc', 'diff-github-protanopia-black-hc',
  // GitHub tritanopia
  'diff-github-tritanopia-light', 'diff-github-tritanopia-dark', 'diff-github-tritanopia-black',
  'diff-github-tritanopia-light-hc', 'diff-github-tritanopia-dark-hc', 'diff-github-tritanopia-black-hc',
  // Visual Studio
  'diff-visual-studio-light', 'diff-visual-studio-dark', 'diff-visual-studio-black',
  'diff-visual-studio-light-hc', 'diff-visual-studio-dark-hc', 'diff-visual-studio-black-hc',
  // CodeFlow Classic
  'diff-codeflow-classic-light', 'diff-codeflow-classic-dark', 'diff-codeflow-classic-black',
  'diff-codeflow-classic-light-hc', 'diff-codeflow-classic-dark-hc', 'diff-codeflow-classic-black-hc',
  // CodeFlow RedGreen
  'diff-codeflow-redgreen-light', 'diff-codeflow-redgreen-dark', 'diff-codeflow-redgreen-black',
  'diff-codeflow-redgreen-light-hc', 'diff-codeflow-redgreen-dark-hc', 'diff-codeflow-redgreen-black-hc',
];

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((state) => state.theme);
  const diffColorScheme = useThemeStore((state) => state.diffColorScheme);
  const useHighContrastDiff = useThemeStore((state) => state.useHighContrastDiff);

  useEffect(() => {
    // Apply theme class to document on mount and when theme changes
    const html = document.documentElement;
    html.classList.remove('theme-dark', 'theme-black', 'theme-highcontrast');

    if (theme === 'dark') {
      html.classList.add('theme-dark');
    } else if (theme === 'black') {
      html.classList.add('theme-black');
    } else if (theme === 'high-contrast') {
      html.classList.add('theme-highcontrast');
    }
    // 'light' is default, no class needed
  }, [theme]);

  useEffect(() => {
    // Apply diff color scheme class to document
    const html = document.documentElement;
    html.classList.remove(...ALL_DIFF_CLASSES);

    const diffClass = getDiffClassName(theme, diffColorScheme, useHighContrastDiff);
    html.classList.add(diffClass);
  }, [theme, diffColorScheme, useHighContrastDiff]);

  return <>{children}</>;
}
