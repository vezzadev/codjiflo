'use client';

import { useEffect } from 'react';
import { useThemeStore } from '../stores/useThemeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    // Apply theme class to document on mount and when theme changes
    const html = document.documentElement;
    html.classList.remove('theme-light', 'theme-black', 'theme-highcontrast');

    if (theme === 'light') {
      html.classList.add('theme-light');
    } else if (theme === 'black') {
      html.classList.add('theme-black');
    } else if (theme === 'highcontrast') {
      html.classList.add('theme-highcontrast');
    }
    // 'dark' is default, no class needed
  }, [theme]);

  return <>{children}</>;
}
