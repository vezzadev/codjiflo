import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'black' | 'highcontrast';
export type DiffColorScheme = 'classic' | 'dark' | 'light' | 'protanopia' | 'deuteranopia' | 'tritanopia';

interface ThemeState {
  theme: Theme;
  diffColorScheme: DiffColorScheme;
  setTheme: (theme: Theme) => void;
  setDiffColorScheme: (scheme: DiffColorScheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      diffColorScheme: 'dark',
      setTheme: (theme: Theme) => {
        set({ theme });
      },
      setDiffColorScheme: (diffColorScheme: DiffColorScheme) => {
        set({ diffColorScheme });
      },
    }),
    {
      name: 'codjiflo-theme',
    }
  )
);
