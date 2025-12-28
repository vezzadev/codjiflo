'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { retrieveTokenTransfer } from '@/features/auth/utils/pkce';

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
