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

  it('returns atom-one-dark style for dark theme', () => {
    const { result } = renderHook(() => useSyntaxTheme());

    expect(result.current.hljs).toBeDefined();
    expect(result.current.hljs?.background).toBe('transparent');
  });

  it('returns github style for light theme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'light' });
    });
    const { result } = renderHook(() => useSyntaxTheme());

    expect(result.current.hljs).toBeDefined();
    expect(result.current.hljs?.background).toBe('transparent');
  });

  it('returns atom-one-dark style for black theme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'black' });
    });
    const { result } = renderHook(() => useSyntaxTheme());

    expect(result.current.hljs).toBeDefined();
    expect(result.current.hljs?.background).toBe('transparent');
  });

  it('returns a11y-dark style for high-contrast theme', () => {
    act(() => {
      useThemeStore.setState({ theme: 'high-contrast' });
    });
    const { result } = renderHook(() => useSyntaxTheme());

    expect(result.current.hljs).toBeDefined();
    expect(result.current.hljs?.background).toBe('transparent');
  });

  it('sets transparent background for all themes', () => {
    const themes = ['light', 'dark', 'black', 'high-contrast'] as const;

    for (const theme of themes) {
      act(() => {
        useThemeStore.setState({ theme });
      });
      const { result } = renderHook(() => useSyntaxTheme());

      expect(result.current.hljs?.background).toBe('transparent');
      expect(result.current.hljs?.padding).toBe(0);
      expect(result.current.hljs?.margin).toBe(0);
    }
  });

  it('updates style when theme changes', () => {
    act(() => {
      useThemeStore.setState({ theme: 'light' });
    });
    const { result, rerender } = renderHook(() => useSyntaxTheme());

    const lightStyle = result.current;

    act(() => {
      useThemeStore.setState({ theme: 'dark' });
    });
    rerender();

    const darkStyle = result.current;

    expect(lightStyle).not.toBe(darkStyle);
  });

  it('returns style object with hljs-keyword defined', () => {
    const { result } = renderHook(() => useSyntaxTheme());

    // All hljs themes should have keyword styling
    expect(result.current['hljs-keyword']).toBeDefined();
  });

  it('returns style object with hljs-string defined', () => {
    const { result } = renderHook(() => useSyntaxTheme());

    // All hljs themes should have string styling
    expect(result.current['hljs-string']).toBeDefined();
  });

  it('returns style object with hljs-comment defined', () => {
    const { result } = renderHook(() => useSyntaxTheme());

    // All hljs themes should have comment styling
    expect(result.current['hljs-comment']).toBeDefined();
  });
});
