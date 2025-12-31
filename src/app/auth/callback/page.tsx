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
import { AppShell } from '@/components/layout';
import { Button } from '@/components/Button';

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
      <AppShell>
        <div className="auth-status-container">
          <div className="auth-status-card">
            <div className="spinner" />
            <p className="auth-status-text">Completing authentication...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="auth-status-container">
          <div className="auth-status-card">
            <h1 className="auth-error-title">Authentication Failed</h1>
            <p className="auth-error-message">{error}</p>
            <Button
              onClick={() => router.push('/login')}
              label="Back to Login"
            />
          </div>
        </div>
      </AppShell>
    );
  }

  return null;
}

function LoadingFallback() {
  return (
    <AppShell>
      <div className="auth-status-container">
        <div className="auth-status-card">
          <div className="spinner" />
          <p className="auth-status-text">Loading...</p>
        </div>
      </div>
    </AppShell>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
