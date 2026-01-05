import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'black' | 'high-contrast';
export type DiffColorScheme = 'github' | 'github-protanopia' | 'github-tritanopia' | 'visual-studio' | 'codeflow-classic' | 'codeflow-redgreen';

interface ThemeState {
  theme: Theme;
  diffColorScheme: DiffColorScheme;
  useHighContrastDiff: boolean;
  setTheme: (theme: Theme) => void;
  setDiffColorScheme: (scheme: DiffColorScheme) => void;
  setUseHighContrastDiff: (useHighContrast: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      diffColorScheme: 'github',
      useHighContrastDiff: false,
      setTheme: (theme: Theme) => {
        set({ theme });
      },
      setDiffColorScheme: (diffColorScheme: DiffColorScheme) => {
        set({ diffColorScheme });
      },
      setUseHighContrastDiff: (useHighContrastDiff: boolean) => {
        set({ useHighContrastDiff });
      },
    }),
    {
      name: 'codjiflo-theme',
    }
  )
);
