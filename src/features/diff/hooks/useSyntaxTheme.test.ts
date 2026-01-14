import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyntaxTheme } from './useSyntaxTheme';
import { useThemeStore } from '@/features/theme';

describe('useSyntaxTheme', () => {
  beforeEach(() => {
    act(() => {
      useThemeStore.setState({ theme: 'dark', diffColorScheme: 'github' });
    });
  });

  it('returns github-dark theme for dark theme with github scheme', () => {
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('github-dark');
  });

  it('returns github-light theme for light theme with github scheme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'light', diffColorScheme: 'github' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('github-light');
  });

  it('returns github-dark theme for black theme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'black', diffColorScheme: 'github' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('github-dark');
  });

  it('returns github-dark-high-contrast theme for high-contrast theme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'high-contrast' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('github-dark-high-contrast');
  });

  it('returns light-plus theme for light theme with visual-studio scheme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'light', diffColorScheme: 'visual-studio' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('light-plus');
  });

  it('returns dark-plus theme for dark theme with visual-studio scheme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'dark', diffColorScheme: 'visual-studio' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('dark-plus');
  });

  it('returns light-plus theme for light theme with codeflow-classic scheme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'light', diffColorScheme: 'codeflow-classic' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('light-plus');
  });

  it('returns dark-plus theme for dark theme with codeflow-redgreen scheme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'dark', diffColorScheme: 'codeflow-redgreen' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('dark-plus');
  });

  it('returns dark-plus theme for black theme with visual-studio scheme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'black', diffColorScheme: 'visual-studio' });
    });
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe('dark-plus');
  });

  it('updates theme when UI theme changes', () => {
    act(() => {
      useThemeStore.setState({ theme: 'light', diffColorScheme: 'github' });
    });
    const { result, rerender } = renderHook(() => useSyntaxTheme());

    expect(result.current).toBe('github-light');

    act(() => {
      useThemeStore.setState({ theme: 'dark' });
    });
    rerender();

    expect(result.current).toBe('github-dark');
  });

  it('updates theme when diff color scheme changes', () => {
    act(() => {
      useThemeStore.setState({ theme: 'dark', diffColorScheme: 'github' });
    });
    const { result, rerender } = renderHook(() => useSyntaxTheme());

    expect(result.current).toBe('github-dark');

    act(() => {
      useThemeStore.setState({ diffColorScheme: 'visual-studio' });
    });
    rerender();

    expect(result.current).toBe('dark-plus');
  });
});
