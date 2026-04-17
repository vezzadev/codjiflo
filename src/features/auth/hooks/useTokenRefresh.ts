import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

/**
 * Hook for automatic token refresh
 * Checks token expiry and refreshes before it expires
 * Should be mounted at the app root level
 */
export function useTokenRefresh() {
  const { authMethod, isTokenExpiringSoon, refreshAccessToken, isAuthenticated } = useAuthStore();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only handle token refresh for OAuth authentication
    if (!isAuthenticated || authMethod !== 'oauth') {
      return;
    }

    const checkAndRefresh = async () => {
      if (isTokenExpiringSoon()) {
        await refreshAccessToken();
      }
    };

    // Check immediately on mount
    void checkAndRefresh();

    // Set up interval to check periodically (every 60 seconds)
    const intervalId = setInterval(() => {
      void checkAndRefresh();
    }, 60_000);

    refreshTimeoutRef.current = intervalId;

    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
    };
  }, [authMethod, isAuthenticated, isTokenExpiringSoon, refreshAccessToken]);
}

/**
 * Utility function to refresh token before making an API call if needed.
 * Call this before authenticated requests to ensure the token is valid.
 * Note: This is a standalone utility, not a React hook.
 */
export async function refreshTokenBeforeApiCall<T>(
  apiCall: () => Promise<T>
): Promise<T> {
  const { isTokenExpiringSoon, refreshAccessToken, authMethod } = useAuthStore.getState();

  // Check if we need to refresh before making the API call
  if (authMethod === 'oauth' && isTokenExpiringSoon()) {
    await refreshAccessToken();
  }

  return apiCall();
}
