import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDevAutoLogin } from './useDevAutoLogin';
import { useAuthStore } from '../stores/useAuthStore';

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

const validateToken = vi.fn();

interface MockState {
  isAuthenticated: boolean;
  hasHydrated: boolean;
  validateToken: typeof validateToken;
}

function mockAuthStore(partial: Partial<MockState>) {
  const state: MockState = {
    isAuthenticated: false,
    hasHydrated: true,
    validateToken,
    ...partial,
  };
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    <T,>(selector: (s: MockState) => T) => selector(state),
  );
}

const fetchMock = vi.fn();

describe('useDevAutoLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateToken.mockResolvedValue(true);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled (no fetch) outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockAuthStore({});

    const { result } = renderHook(() => useDevAutoLogin());

    expect(result.current).toBe('disabled');
    // give any stray effect a tick
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the dev token and validates it in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'gho_devtoken123' }),
    });
    mockAuthStore({});

    renderHook(() => useDevAutoLogin());

    await waitFor(() => {
      expect(validateToken).toHaveBeenCalledWith('gho_devtoken123');
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/dev-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not attempt when already authenticated', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockAuthStore({ isAuthenticated: true });

    renderHook(() => useDevAutoLogin());

    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(validateToken).not.toHaveBeenCalled();
  });

  it('does not attempt before hydration', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockAuthStore({ hasHydrated: false });

    renderHook(() => useDevAutoLogin());

    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failed when the dev-token route is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    mockAuthStore({});

    const { result } = renderHook(() => useDevAutoLogin());

    await waitFor(() => {
      expect(result.current).toBe('failed');
    });
    expect(validateToken).not.toHaveBeenCalled();
  });

  it('reports failed when the token is rejected', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'gho_bad' }),
    });
    validateToken.mockResolvedValue(false);
    mockAuthStore({});

    const { result } = renderHook(() => useDevAutoLogin());

    await waitFor(() => {
      expect(result.current).toBe('failed');
    });
  });
});
