import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenRefresh, refreshTokenBeforeApiCall } from './useTokenRefresh';
import { useAuthStore } from '../stores/useAuthStore';

// Mock the auth store
vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('useTokenRefresh', () => {
  const mockRefreshAccessToken = vi.fn();
  const mockIsTokenExpiringSoon = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not refresh when not authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      authMethod: null,
      isAuthenticated: false,
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    renderHook(() => useTokenRefresh());

    expect(mockIsTokenExpiringSoon).not.toHaveBeenCalled();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('should not refresh for PAT authentication', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      authMethod: 'pat',
      isAuthenticated: true,
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    renderHook(() => useTokenRefresh());

    expect(mockIsTokenExpiringSoon).not.toHaveBeenCalled();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('should check token expiry on mount for OAuth auth', async () => {
    mockIsTokenExpiringSoon.mockReturnValue(false);

    vi.mocked(useAuthStore).mockReturnValue({
      authMethod: 'oauth',
      isAuthenticated: true,
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    renderHook(() => useTokenRefresh());

    // Flush pending promises
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockIsTokenExpiringSoon).toHaveBeenCalled();
  });

  it('should refresh token immediately if expiring soon', async () => {
    mockIsTokenExpiringSoon.mockReturnValue(true);
    mockRefreshAccessToken.mockResolvedValue(true);

    vi.mocked(useAuthStore).mockReturnValue({
      authMethod: 'oauth',
      isAuthenticated: true,
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    renderHook(() => useTokenRefresh());

    // Flush pending promises
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRefreshAccessToken).toHaveBeenCalled();
  });

  it('should check token on 60-second interval', async () => {
    mockIsTokenExpiringSoon.mockReturnValue(false);

    vi.mocked(useAuthStore).mockReturnValue({
      authMethod: 'oauth',
      isAuthenticated: true,
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    renderHook(() => useTokenRefresh());

    // Flush initial check
    await act(async () => {
      await Promise.resolve();
    });

    // Clear initial call
    mockIsTokenExpiringSoon.mockClear();

    // Advance 60 seconds
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(mockIsTokenExpiringSoon).toHaveBeenCalled();
  });

  it('should clean up interval on unmount', async () => {
    mockIsTokenExpiringSoon.mockReturnValue(false);

    vi.mocked(useAuthStore).mockReturnValue({
      authMethod: 'oauth',
      isAuthenticated: true,
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    const { unmount } = renderHook(() => useTokenRefresh());

    // Flush initial check
    await act(async () => {
      await Promise.resolve();
    });

    mockIsTokenExpiringSoon.mockClear();

    unmount();

    // Advance time after unmount - should not trigger any calls
    vi.advanceTimersByTime(60_000);

    expect(mockIsTokenExpiringSoon).not.toHaveBeenCalled();
  });
});

describe('refreshTokenBeforeApiCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call API directly for PAT auth', async () => {
    const mockApiCall = vi.fn().mockResolvedValue({ data: 'test' });
    const mockRefreshAccessToken = vi.fn();
    const mockIsTokenExpiringSoon = vi.fn();

    // Mock getState
    (useAuthStore as unknown as { getState: () => unknown }).getState = () => ({
      authMethod: 'pat',
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    const result = await refreshTokenBeforeApiCall(mockApiCall);

    expect(result).toEqual({ data: 'test' });
    expect(mockApiCall).toHaveBeenCalled();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('should refresh token before API call if expiring for OAuth', async () => {
    const mockApiCall = vi.fn().mockResolvedValue({ data: 'test' });
    const mockRefreshAccessToken = vi.fn().mockResolvedValue(true);
    const mockIsTokenExpiringSoon = vi.fn().mockReturnValue(true);

    (useAuthStore as unknown as { getState: () => unknown }).getState = () => ({
      authMethod: 'oauth',
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    const result = await refreshTokenBeforeApiCall(mockApiCall);

    expect(result).toEqual({ data: 'test' });
    expect(mockIsTokenExpiringSoon).toHaveBeenCalled();
    expect(mockRefreshAccessToken).toHaveBeenCalled();
    expect(mockApiCall).toHaveBeenCalled();
  });

  it('should not refresh token if not expiring soon', async () => {
    const mockApiCall = vi.fn().mockResolvedValue({ data: 'test' });
    const mockRefreshAccessToken = vi.fn();
    const mockIsTokenExpiringSoon = vi.fn().mockReturnValue(false);

    (useAuthStore as unknown as { getState: () => unknown }).getState = () => ({
      authMethod: 'oauth',
      isTokenExpiringSoon: mockIsTokenExpiringSoon,
      refreshAccessToken: mockRefreshAccessToken,
    });

    const result = await refreshTokenBeforeApiCall(mockApiCall);

    expect(result).toEqual({ data: 'test' });
    expect(mockIsTokenExpiringSoon).toHaveBeenCalled();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    expect(mockApiCall).toHaveBeenCalled();
  });
});
