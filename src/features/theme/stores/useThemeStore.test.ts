/**
 * Unit tests for useThemeStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useThemeStore } from './useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useThemeStore.setState({
        theme: 'light',
        diffColorScheme: 'codeflow-classic',
        useHighContrastDiff: false,
      });
    });
  });

  describe('initial state', () => {
    it('has light theme by default', () => {
      expect(useThemeStore.getState().theme).toBe('light');
    });

    it('has codeflow-classic diff color scheme by default', () => {
      expect(useThemeStore.getState().diffColorScheme).toBe('codeflow-classic');
    });

    it('has high contrast diff disabled by default', () => {
      expect(useThemeStore.getState().useHighContrastDiff).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('sets theme to dark', () => {
      act(() => {
        useThemeStore.getState().setTheme('dark');
      });

      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('sets theme to black', () => {
      act(() => {
        useThemeStore.getState().setTheme('black');
      });

      expect(useThemeStore.getState().theme).toBe('black');
    });

    it('sets theme to high-contrast', () => {
      act(() => {
        useThemeStore.getState().setTheme('high-contrast');
      });

      expect(useThemeStore.getState().theme).toBe('high-contrast');
    });

    it('sets theme back to light', () => {
      act(() => {
        useThemeStore.getState().setTheme('dark');
        useThemeStore.getState().setTheme('light');
      });

      expect(useThemeStore.getState().theme).toBe('light');
    });
  });

  describe('setDiffColorScheme', () => {
    it('sets diff color scheme to visual-studio', () => {
      act(() => {
        useThemeStore.getState().setDiffColorScheme('visual-studio');
      });

      expect(useThemeStore.getState().diffColorScheme).toBe('visual-studio');
    });

    it('sets diff color scheme to github-protanopia', () => {
      act(() => {
        useThemeStore.getState().setDiffColorScheme('github-protanopia');
      });

      expect(useThemeStore.getState().diffColorScheme).toBe('github-protanopia');
    });

    it('sets diff color scheme to github-tritanopia', () => {
      act(() => {
        useThemeStore.getState().setDiffColorScheme('github-tritanopia');
      });

      expect(useThemeStore.getState().diffColorScheme).toBe('github-tritanopia');
    });

    it('sets diff color scheme to codeflow-classic', () => {
      act(() => {
        useThemeStore.getState().setDiffColorScheme('codeflow-classic');
      });

      expect(useThemeStore.getState().diffColorScheme).toBe('codeflow-classic');
    });

    it('sets diff color scheme to codeflow-redgreen', () => {
      act(() => {
        useThemeStore.getState().setDiffColorScheme('codeflow-redgreen');
      });

      expect(useThemeStore.getState().diffColorScheme).toBe('codeflow-redgreen');
    });
  });

  describe('setUseHighContrastDiff', () => {
    it('enables high contrast diff', () => {
      act(() => {
        useThemeStore.getState().setUseHighContrastDiff(true);
      });

      expect(useThemeStore.getState().useHighContrastDiff).toBe(true);
    });

    it('disables high contrast diff', () => {
      act(() => {
        useThemeStore.getState().setUseHighContrastDiff(true);
        useThemeStore.getState().setUseHighContrastDiff(false);
      });

      expect(useThemeStore.getState().useHighContrastDiff).toBe(false);
    });
  });
});
