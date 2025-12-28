import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOAuthFlow } from './useOAuthFlow';

// Mock PKCE utilities
vi.mock('../utils/pkce', () => ({
  generateCodeVerifier: vi.fn(() => 'test-code-verifier'),
  generateCodeChallenge: vi.fn(() => Promise.resolve('test-code-challenge')),
  generateState: vi.fn(() => 'test-state'),
  storeOAuthState: vi.fn(),
  storeReturnOrigin: vi.fn(),
}));

// Mock config
vi.mock('../config', () => ({
  buildAuthorizationUrl: vi.fn(
    (state: string, codeChallenge: string) =>
      `https://github.com/login/oauth/authorize?state=${state}&code_challenge=${codeChallenge}`
  ),
}));

describe('useOAuthFlow', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '', origin: 'http://localhost:3000' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useOAuthFlow());

    expect(result.current.isInitiating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.initiateOAuth).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('should initiate OAuth flow and redirect', async () => {
    const { generateCodeVerifier, generateCodeChallenge, generateState, storeOAuthState } =
      await import('../utils/pkce');
    const { buildAuthorizationUrl } = await import('../config');

    const { result } = renderHook(() => useOAuthFlow());

    act(() => {
      result.current.initiateOAuth();
    });

    await waitFor(() => {
      expect(generateCodeVerifier).toHaveBeenCalled();
      expect(generateCodeChallenge).toHaveBeenCalledWith('test-code-verifier');
      expect(generateState).toHaveBeenCalled();
      expect(storeOAuthState).toHaveBeenCalledWith('test-code-verifier', 'test-state');
      expect(buildAuthorizationUrl).toHaveBeenCalledWith('test-state', 'test-code-challenge');
      expect(window.location.href).toBe(
        'https://github.com/login/oauth/authorize?state=test-state&code_challenge=test-code-challenge'
      );
    });
  });

  it('should set isInitiating to true while initiating', async () => {
    const { result } = renderHook(() => useOAuthFlow());

    expect(result.current.isInitiating).toBe(false);

    act(() => {
      result.current.initiateOAuth();
    });

    // isInitiating should be true during the async operation
    expect(result.current.isInitiating).toBe(true);

    await waitFor(() => {
      // After redirect, isInitiating stays true since we don't reach setIsInitiating(false)
      expect(window.location.href).toContain('github.com');
    });
  });

  it('should handle errors during OAuth initiation', async () => {
    const { generateCodeChallenge } = await import('../utils/pkce');
    vi.mocked(generateCodeChallenge).mockRejectedValueOnce(new Error('PKCE generation failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    const { result } = renderHook(() => useOAuthFlow());

    act(() => {
      result.current.initiateOAuth();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to initiate authentication');
      expect(result.current.isInitiating).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should clear error when clearError is called', async () => {
    const { generateCodeChallenge } = await import('../utils/pkce');
    vi.mocked(generateCodeChallenge).mockRejectedValueOnce(new Error('Failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    const { result } = renderHook(() => useOAuthFlow());

    act(() => {
      result.current.initiateOAuth();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to initiate authentication');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();

    consoleSpy.mockRestore();
  });
});
