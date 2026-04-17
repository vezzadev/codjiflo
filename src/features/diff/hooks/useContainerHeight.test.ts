/**
 * Unit tests for useContainerHeight hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContainerHeight } from './useContainerHeight';

describe('useContainerHeight', () => {
  // Mock ResizeObserver
  let mockObserve: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();

    // Setup ResizeObserver mock as a class
    class MockResizeObserver {
      observe = mockObserve;
      unobserve = vi.fn();
      disconnect = mockDisconnect;
    }

    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    // Mock requestAnimationFrame to run immediately
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial default height of 600', () => {
    const { result } = renderHook(() => useContainerHeight());
    expect(result.current.containerHeight).toBe(600);
  });

  it('returns containerRefCallback function', () => {
    const { result } = renderHook(() => useContainerHeight());
    expect(typeof result.current.containerRefCallback).toBe('function');
  });

  it('returns scrollContainerRef with null initial value', () => {
    const { result } = renderHook(() => useContainerHeight());
    expect(result.current.scrollContainerRef).toBeDefined();
    expect(result.current.scrollContainerRef.current).toBeNull();
  });

  it('calls observe on ResizeObserver when node is provided', () => {
    const { result } = renderHook(() => useContainerHeight());

    const mockNode = document.createElement('div');
    Object.defineProperty(mockNode, 'clientHeight', { value: 500 });

    act(() => {
      result.current.containerRefCallback(mockNode);
    });

    expect(mockObserve).toHaveBeenCalledWith(mockNode);
  });

  it('updates containerHeight from node clientHeight', () => {
    const { result } = renderHook(() => useContainerHeight());

    const mockNode = document.createElement('div');
    Object.defineProperty(mockNode, 'clientHeight', { value: 800 });

    act(() => {
      result.current.containerRefCallback(mockNode);
    });

    expect(result.current.containerHeight).toBe(800);
  });

  it('sets scrollContainerRef.current to the provided node', () => {
    const { result } = renderHook(() => useContainerHeight());

    const mockNode = document.createElement('div');
    Object.defineProperty(mockNode, 'clientHeight', { value: 500 });

    act(() => {
      result.current.containerRefCallback(mockNode);
    });

    expect(result.current.scrollContainerRef.current).toBe(mockNode);
  });
});
