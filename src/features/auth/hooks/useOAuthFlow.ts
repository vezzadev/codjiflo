import { useState, useCallback } from 'react';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  storeOAuthState,
  storeReturnOrigin,
  storeReturnPath,
} from '../utils/pkce';
import { buildAuthorizationUrl } from '../config';

/**
 * Hook for initiating the OAuth flow
 * Handles PKCE generation, state storage, and redirect
 *
 * @param overrideReturnPath - Optional path to redirect to after auth.
 *   If provided, this overrides the default behavior of using the current location.
 *   Useful when the login page receives a returnPath query parameter from a protected page.
 */
export function useOAuthFlow(overrideReturnPath?: string | null) {
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateOAuth = useCallback(async () => {
    setIsInitiating(true);
    setError(null);

    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Store state for callback verification
      storeOAuthState(codeVerifier, state);

      // Store return origin for post-auth redirect (enables PR preview auth)
      storeReturnOrigin(window.location.origin);

      // Store return path to redirect back to the original page after login
      // Use overrideReturnPath if provided (from login page query param), else use current location
      // Avoid storing /login as the return path - user should go to dashboard after login
      const currentPath = window.location.pathname + window.location.search;
      const isOnLoginPage = window.location.pathname === '/login';
      const returnPath = overrideReturnPath ?? (isOnLoginPage ? '/dashboard' : currentPath);
      storeReturnPath(returnPath);

      // Build authorization URL and redirect
      const authUrl = buildAuthorizationUrl(state, codeChallenge);
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to initiate OAuth flow:', err);
      setError('Failed to initiate authentication');
      setIsInitiating(false);
    }
  }, [overrideReturnPath]);

  return {
    initiateOAuth: () => void initiateOAuth(),
    isInitiating,
    error,
    clearError: () => setError(null),
  };
}
