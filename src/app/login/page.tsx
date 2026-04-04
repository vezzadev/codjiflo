'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useOAuthFlow, useRedirectIfAuthenticated } from '@/features/auth/hooks';
import { isValidReturnPath } from '@/features/auth/utils/pkce';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { AppShell } from '@/components/layout';

function LoginContent() {
  const [tokenInput, setTokenInput] = useState('');
  const [showPATSection, setShowPATSection] = useState(false);
  const { validateToken, error, isValidating, clearError } = useAuthStore();
  const searchParams = useSearchParams();
  const rawReturnPath = searchParams.get('returnPath');
  // Validate returnPath to prevent open redirect attacks
  const returnPath = rawReturnPath && isValidReturnPath(rawReturnPath) ? rawReturnPath : null;
  const { initiateOAuth, isInitiating } = useOAuthFlow(returnPath);
  const { isAuthenticated } = useRedirectIfAuthenticated();
  const router = useRouter();

  const handleOAuthLogin = () => {
    initiateOAuth();
  };

  const handlePATSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    void (async () => {
      const success = await validateToken(tokenInput);
      if (success) {
        // Redirect to the original page the user was trying to access, or dashboard
        // Validate returnPath to prevent open redirect attacks
        const redirectTo = returnPath && isValidReturnPath(returnPath) ? returnPath : '/dashboard';
        router.replace(redirectTo);
      }
    })();
  };

  const handleInputChange = (value: string) => {
    setTokenInput(value);
    if (error) {
      clearError();
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo">
              <Image
                src="/codjiflo.svg"
                alt="CodjiFlo"
                width={48}
                height={48}
              />
            </div>
            <h1 className="login-title">Connect to GitHub</h1>
            <p className="login-subtitle">
              Sign in to start reviewing pull requests
            </p>
          </div>

          <div className="login-actions">
            <Button
              type="button"
              onPress={handleOAuthLogin}
              isDisabled={isInitiating}
            >{isInitiating ? 'Redirecting...' : 'Login with GitHub'}</Button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              onClick={() => setShowPATSection(!showPATSection)}
              className="btn-link"
              style={{ width: '100%', textAlign: 'center' }}
            >
              {showPATSection ? 'Hide' : 'Use'} Personal Access Token
            </button>

            {showPATSection && (
              <form onSubmit={handlePATSubmit} className="login-form">
                <Input
                  id="pat"
                  label="Personal Access Token"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  {...(error && { error })}
                  disabled={isValidating}
                  placeholder="ghp_xxxxxxxxxxxx or github_pat_xxxxxxxxxxxx"
                  helperText="Your token must start with 'ghp_', 'github_pat_', or 'gho_'"
                  required
                />

                <Button
                  type="submit"
                  isDisabled={isValidating || !tokenInput.trim()}
                >{isValidating ? 'Validating...' : 'Connect with PAT'}</Button>
              </form>
            )}
          </div>

          <div className="login-footer">
            <p>
              Don&apos;t have a GitHub account?{' '}
              <a
                href="https://github.com/signup"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create one
              </a>
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LoadingFallback() {
  return (
    <AppShell>
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo">
              <Image
                src="/codjiflo.svg"
                alt="CodjiFlo"
                width={48}
                height={48}
              />
            </div>
            <h1 className="login-title">Loading...</h1>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}
