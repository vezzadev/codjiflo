'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { retrieveTokenTransfer } from '@/features/auth/utils/pkce';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/Button';

/**
 * Auth Landing Page
 *
 * This page receives OAuth tokens transferred via cookie from the main domain
 * after cross-subdomain authentication (e.g., PR preview -> main domain -> PR preview).
 *
 * Flow:
 * 1. User on pr-123.codjiflo.vza.net clicks login
 * 2. OAuth redirects to codjiflo.vza.net/auth/callback
 * 3. Callback page sets token in cookie, redirects to pr-123.codjiflo.vza.net/auth/landing
 * 4. This page reads the token from cookie, stores in auth store, redirects to dashboard
 */
export default function AuthLandingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const hydrateToken = () => {
      try {
        const tokenData = retrieveTokenTransfer();

        if (!tokenData) {
          setError('Authentication session expired. Please try logging in again.');
          setIsProcessing(false);
          return;
        }

        // Hydrate the auth store with transferred tokens
        useAuthStore.setState({
          token: tokenData.accessToken,
          refreshToken: tokenData.refreshToken ?? null,
          tokenExpiresAt: tokenData.expiresAt ?? null,
          authMethod: 'oauth',
          isAuthenticated: true,
          error: null,
          isValidating: false,
        });

        // Redirect to dashboard
        router.replace('/dashboard');
      } catch (err) {
        console.error('Failed to complete authentication landing flow:', err);
        setError('An unexpected error occurred. Please try logging in again.');
        setIsProcessing(false);
      }
    };

    hydrateToken();
  }, [router]);

  if (isProcessing && !error) {
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
