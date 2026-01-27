import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOptionalAuth } from './useOptionalAuth';
import { useAuthStore } from '../stores/useAuthStore';

// Mock the auth store
vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

// Helper to mock useAuthStore with a partial state
function mockAuthStore(partialState: {
  isAuthenticated: boolean;
  hasHydrated?: boolean;
  token?: string | null;
}) {
  const state = { hasHydrated: true, token: null, ...partialState };
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    <T,>(selector: (state: { isAuthenticated: boolean; hasHydrated: boolean; token: string | null }) => T) =>
      selector(state)
  );
}

describe('useOptionalAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return isAuthenticated true when authenticated', () => {
    mockAuthStore({ isAuthenticated: true, token: 'ghp_test' });

    const { result } = renderHook(() => useOptionalAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('ghp_test');
    expect(result.current.isLoading).toBe(false);
  });

  it('should return isAuthenticated false when not authenticated', () => {
    mockAuthStore({ isAuthenticated: false });

    const { result } = renderHook(() => useOptionalAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should return isLoading true when not hydrated', () => {
    mockAuthStore({ isAuthenticated: false, hasHydrated: false });

    const { result } = renderHook(() => useOptionalAuth());

    expect(result.current.isLoading).toBe(true);
  });

  it('should return token when authenticated', () => {
    mockAuthStore({ isAuthenticated: true, token: 'github_pat_xxxx' });

    const { result } = renderHook(() => useOptionalAuth());

    expect(result.current.token).toBe('github_pat_xxxx');
  });

  it('should return null token when not authenticated', () => {
    mockAuthStore({ isAuthenticated: false, token: null });

    const { result } = renderHook(() => useOptionalAuth());

    expect(result.current.token).toBeNull();
  });

  it('should never trigger any redirects', () => {
    // This test verifies the core difference from useRequireAuth:
    // useOptionalAuth should NEVER redirect, regardless of auth state
    mockAuthStore({ isAuthenticated: false, hasHydrated: true });

    // The hook doesn't use router, so there's nothing to mock or check
    // This test documents the expected behavior
    const { result } = renderHook(() => useOptionalAuth());

    expect(result.current.isAuthenticated).toBe(false);
    // No redirect occurred - component using this hook decides what to show
  });
});
