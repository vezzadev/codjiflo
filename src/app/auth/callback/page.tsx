'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import {
  retrieveOAuthState,
  retrieveReturnOrigin,
  storeTokenTransfer,
  isValidReturnOrigin,
} from '@/features/auth/utils/pkce';
import { oauthConfig } from '@/features/auth/config';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const { handleOAuthCallback } = useAuthStore();

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        setError(errorDescription ?? errorParam);
        setIsProcessing(false);
        return;
      }

      if (!code || !state) {
        setError('Missing authorization code or state parameter');
        setIsProcessing(false);
        return;
      }

      const storedState = retrieveOAuthState();
      if (!storedState) {
        setError('OAuth session expired. Please try logging in again.');
        setIsProcessing(false);
        return;
      }

      if (state !== storedState.state) {
        setError('Invalid state parameter. This may be a CSRF attack.');
        setIsProcessing(false);
        return;
      }

      // Check if we need to redirect to a different origin (PR preview subdomain)
      const returnOrigin = retrieveReturnOrigin();
      const currentOrigin = window.location.origin;
      const needsCrossOriginRedirect = returnOrigin && returnOrigin !== currentOrigin;

      // Validate return origin to prevent open redirect attacks
      if (needsCrossOriginRedirect && !isValidReturnOrigin(returnOrigin)) {
        console.error('Invalid return origin:', returnOrigin);
        setError('Invalid redirect destination. Please try logging in again.');
        setIsProcessing(false);
        return;
      }

      try {
        if (needsCrossOriginRedirect) {
          // Cross-origin flow: exchange token here, then redirect with token in cookie
          const response = await fetch('/api/auth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              code_verifier: storedState.codeVerifier,
            }),
          });

          // Check HTTP status before parsing JSON
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error('Token endpoint error:', response.status, errorText);
            setError(`Authentication failed (HTTP ${String(response.status)})`);
            setIsProcessing(false);
            return;
          }

          const data = (await response.json()) as TokenResponse;

          if (data.error) {
            setError(data.error_description ?? data.error);
            setIsProcessing(false);
            return;
          }

          if (!data.access_token) {
            setError('No access token received');
            setIsProcessing(false);
            return;
          }

          // Calculate expiry
          const expiresIn = data.expires_in ?? oauthConfig.defaultTokenExpirySeconds;
          const expiresAt = Date.now() + expiresIn * 1000;

          // Store tokens in transfer cookie for cross-origin pickup
          storeTokenTransfer({
            accessToken: data.access_token,
            ...(data.refresh_token && { refreshToken: data.refresh_token }),
            expiresAt,
          });

          // Redirect to return origin's landing page
          window.location.href = `${returnOrigin}/auth/landing`;
        } else {
          // Same-origin flow: use existing store method
          const success = await handleOAuthCallback(code, storedState.codeVerifier);
          if (success) {
            router.replace('/dashboard');
          } else {
            setError('Failed to complete authentication');
            setIsProcessing(false);
          }
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('An unexpected error occurred during authentication');
        setIsProcessing(false);
      }
    };

    void processCallback();
  }, [searchParams, handleOAuthCallback, router]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Authentication Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
