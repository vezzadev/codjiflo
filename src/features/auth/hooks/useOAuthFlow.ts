import { useState, useCallback } from 'react';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  storeOAuthState,
  storeReturnOrigin,
} from '../utils/pkce';
import { buildAuthorizationUrl } from '../config';

/**
 * Hook for initiating the OAuth flow
 * Handles PKCE generation, state storage, and redirect
 */
export function useOAuthFlow() {
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

      // Build authorization URL and redirect
      const authUrl = buildAuthorizationUrl(state, codeChallenge);
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to initiate OAuth flow:', err);
      setError('Failed to initiate authentication');
      setIsInitiating(false);
    }
  }, []);

  return {
    initiateOAuth: () => void initiateOAuth(),
    isInitiating,
    error,
    clearError: () => setError(null),
  };
}
