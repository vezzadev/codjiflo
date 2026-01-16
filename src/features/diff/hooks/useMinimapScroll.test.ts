/**
 * Unit tests for useMinimapScroll hook
 *
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMinimapScroll } from './useMinimapScroll';

describe('useMinimapScroll', () => {
  let container: HTMLDivElement;
  let scrollableElement: HTMLDivElement;

  beforeEach(() => {
    // Create a mock DOM structure similar to react-window
    container = document.createElement('div');
    scrollableElement = document.createElement('div');
    scrollableElement.style.overflow = 'auto';
    scrollableElement.style.height = '500px';

    // Mock scrollHeight and clientHeight
    Object.defineProperty(scrollableElement, 'scrollHeight', {
      value: 1000,
      writable: true,
    });
    Object.defineProperty(scrollableElement, 'clientHeight', {
      value: 500,
      writable: true,
    });

    container.appendChild(scrollableElement);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('returns initial scroll state with zeros', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    expect(result.current.scrollState).toEqual({
      scrollRatio: 0,
      viewportRatio: 1,
    });
  });

  it('updates scroll ratio when container scrolls', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    // Simulate scroll to middle
    act(() => {
      scrollableElement.scrollTop = 250;
      scrollableElement.dispatchEvent(new Event('scroll'));
    });

    // scrollRatio should be 0.5 (250 / 500 max scroll)
    expect(result.current.scrollState.scrollRatio).toBeCloseTo(0.5, 1);
  });

  it('calculates viewport ratio correctly', async () => {
    const containerRef = { current: container };
    const { result } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    // Wait for requestAnimationFrame to execute and update state
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    // viewportRatio = clientHeight / scrollHeight = 500 / 1000 = 0.5
    expect(result.current.scrollState.viewportRatio).toBeCloseTo(0.5, 1);
  });

  it('resets scroll state when contentKey changes', () => {
    const containerRef = { current: container };
    let contentKey = 'file1.ts';

    const { result, rerender } = renderHook(
      ({ key }) => useMinimapScroll(containerRef, 500, key),
      { initialProps: { key: contentKey } }
    );

    // Scroll to middle
    act(() => {
      scrollableElement.scrollTop = 250;
      scrollableElement.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.scrollState.scrollRatio).toBeCloseTo(0.5, 1);

    // Change content key (simulates file change)
    contentKey = 'file2.ts';
    rerender({ key: contentKey });

    // Scroll state should reset
    expect(result.current.scrollState.scrollRatio).toBe(0);
  });

  it('cleans up scroll listener on unmount', () => {
    const containerRef = { current: container };
    const removeEventListenerSpy = vi.spyOn(scrollableElement, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('handles null container ref gracefully', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    expect(result.current.scrollState).toEqual({
      scrollRatio: 0,
      viewportRatio: 1,
    });
  });
});
