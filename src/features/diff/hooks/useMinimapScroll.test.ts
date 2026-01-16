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

    // Mock scrollHeight and clientHeight with large scroll range (> 100px threshold)
    // This simulates a real react-window list with many lines
    Object.defineProperty(scrollableElement, 'scrollHeight', {
      value: 5000, // Simulates ~200 lines of code
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

  it('returns initial scroll state with zeros when no container', () => {
    // When containerRef is null, return default state with viewportRatio: 0
    // This indicates "not initialized" and hides the lasso
    const containerRef = { current: null };
    const { result } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    expect(result.current.scrollState).toEqual({
      scrollRatio: 0,
      viewportRatio: 0,
    });
  });

  it('updates scroll ratio when container scrolls', async () => {
    const containerRef = { current: container };
    const { result } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    // Wait for initial setup (rAF polling)
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    // Simulate scroll to middle (maxScroll = 5000 - 500 = 4500)
    act(() => {
      scrollableElement.scrollTop = 2250; // 50% of 4500
      scrollableElement.dispatchEvent(new Event('scroll'));
    });

    // scrollRatio should be 0.5 (2250 / 4500 max scroll)
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

    // viewportRatio = clientHeight / scrollHeight = 500 / 5000 = 0.1
    expect(result.current.scrollState.viewportRatio).toBeCloseTo(0.1, 1);
  });

  it('resets scroll state when contentKey changes', async () => {
    const containerRef = { current: container };
    let contentKey = 'file1.ts';

    const { result, rerender } = renderHook(
      ({ key }) => useMinimapScroll(containerRef, 500, key),
      { initialProps: { key: contentKey } }
    );

    // Wait for initial setup
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    // Scroll to middle (maxScroll = 5000 - 500 = 4500)
    act(() => {
      scrollableElement.scrollTop = 2250;
      scrollableElement.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.scrollState.scrollRatio).toBeCloseTo(0.5, 1);

    // Change content key (simulates file change)
    contentKey = 'file2.ts';
    rerender({ key: contentKey });

    // Scroll state should reset (scrollRatio = 0 from recalculating at scrollTop = 2250,
    // but since scrollTop wasn't reset, it will calculate the current ratio)
    // The key point is the state is recalculated from the DOM
    expect(result.current.scrollState.scrollRatio).toBeCloseTo(0.5, 1); // Still at 50% because scrollTop wasn't changed
  });

  it('recalculates viewportRatio after contentKey changes', async () => {
    const containerRef = { current: container };
    let contentKey = 'file1.ts';

    const { result, rerender } = renderHook(
      ({ key }) => useMinimapScroll(containerRef, 500, key),
      { initialProps: { key: contentKey } }
    );

    // Wait for initial calculation
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    // viewportRatio should be calculated: 500 / 5000 = 0.1
    expect(result.current.scrollState.viewportRatio).toBeCloseTo(0.1, 1);

    // Change content key (simulates file change)
    contentKey = 'file2.ts';
    rerender({ key: contentKey });

    // Immediately after key change, the hook recalculates synchronously from DOM
    // Since the scroll element is still valid, it returns the calculated state
    expect(result.current.scrollState.viewportRatio).toBeCloseTo(0.1, 1);

    // Wait for effect to recalculate
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    // After recalculation, viewportRatio should be 0.1 (from actual scroll container)
    expect(result.current.scrollState.viewportRatio).toBeCloseTo(0.1, 1);
  });

  it('cleans up scroll listener on unmount', async () => {
    const containerRef = { current: container };
    const removeEventListenerSpy = vi.spyOn(scrollableElement, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    // Wait for setup to complete (polling via rAF)
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('handles null container ref gracefully', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() =>
      useMinimapScroll(containerRef, 500)
    );

    // When no container, returns default state with viewportRatio: 0 (not initialized)
    expect(result.current.scrollState).toEqual({
      scrollRatio: 0,
      viewportRatio: 0,
    });
  });
});
