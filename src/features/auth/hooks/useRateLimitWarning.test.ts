import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRateLimitWarning } from './useRateLimitWarning';
import { useAuthStore } from '../stores/useAuthStore';

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

function mockAuthStore(partialState: {
  rateLimitRemaining: number | null;
  rateLimitReset?: Date | null;
  rateLimitLimit: number | null;
}) {
  const state = { rateLimitReset: null, ...partialState };
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    <T,>(selector: (s: typeof state) => T) => selector(state)
  );
}

describe('useRateLimitWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns shouldWarn false when rate limit info is null', () => {
    mockAuthStore({ rateLimitRemaining: null, rateLimitLimit: null });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(false);
    expect(result.current.isExhausted).toBe(false);
  });

  it('returns shouldWarn false when remaining is above 20% threshold', () => {
    mockAuthStore({ rateLimitRemaining: 50, rateLimitLimit: 60 });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(false);
    expect(result.current.remaining).toBe(50);
  });

  it('returns shouldWarn true when remaining is below 20% threshold', () => {
    mockAuthStore({ rateLimitRemaining: 11, rateLimitLimit: 60 });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(true);
    expect(result.current.isExhausted).toBe(false);
  });

  it('returns shouldWarn false at exactly 20% boundary (12 is 20% of 60)', () => {
    // 12 is exactly 20% of 60, so remaining < 0.2 * limit means 12 < 12 = false
    mockAuthStore({ rateLimitRemaining: 12, rateLimitLimit: 60 });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(false);
  });

  it('returns shouldWarn true just below 20% boundary', () => {
    mockAuthStore({ rateLimitRemaining: 11, rateLimitLimit: 60 });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(true);
  });

  it('returns isExhausted true when remaining is 0', () => {
    const resetTime = new Date('2026-01-28T00:00:00Z');
    mockAuthStore({ rateLimitRemaining: 0, rateLimitLimit: 60, rateLimitReset: resetTime });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(true);
    expect(result.current.isExhausted).toBe(true);
    expect(result.current.resetTime).toEqual(resetTime);
  });

  it('returns correct remaining and resetTime values', () => {
    const resetTime = new Date('2026-01-28T01:00:00Z');
    mockAuthStore({ rateLimitRemaining: 5, rateLimitLimit: 60, rateLimitReset: resetTime });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.remaining).toBe(5);
    expect(result.current.resetTime).toEqual(resetTime);
  });

  it('handles authenticated user rate limits (5000 limit)', () => {
    mockAuthStore({ rateLimitRemaining: 999, rateLimitLimit: 5000 });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(true);
  });

  it('handles authenticated user above threshold (5000 limit)', () => {
    mockAuthStore({ rateLimitRemaining: 1001, rateLimitLimit: 5000 });

    const { result } = renderHook(() => useRateLimitWarning());

    expect(result.current.shouldWarn).toBe(false);
  });
});
