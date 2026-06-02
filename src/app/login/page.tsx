'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useOAuthFlow, useRedirectIfAuthenticated, useDevAutoLogin } from '@/features/auth/hooks';
import { isValidReturnPath } from '@/features/auth/utils/pkce';
import { TextField, Label, Input, Text, Tooltip, TooltipTrigger } from '@/components/ui';
import { Button } from '@/components/Button';
import { AppShell } from '@/components/layout';
import { Info } from 'lucide-react';

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
  // Local-dev only: auto sign-in with the GitHub CLI token (no-op in prod/E2E).
  const devAutoLogin = useDevAutoLogin();
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

  // While the dev CLI auto-login is in flight, show a minimal signing-in state
  // instead of flashing the OAuth/PAT login UI. Dead-code-eliminated in prod.
  if (devAutoLogin === 'attempting') {
    return (
      <AppShell>
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <div className="logo">
                <Image src="/codjiflo.svg" alt="CodjiFlo" width={48} height={48} />
              </div>
              <h1 className="login-title">Signing in…</h1>
              <p className="login-subtitle">Using your GitHub CLI session</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
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
            >
              {isInitiating ? 'Redirecting...' : 'Login with GitHub'}
            </Button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <Button
              variant="ghost"
              type="button"
              onPress={() => { setShowPATSection(!showPATSection); }}
              className="btn-link"
              style={{ width: '100%', textAlign: 'center' }}
            >
              {showPATSection ? 'Hide' : 'Use'} Personal Access Token
            </Button>

            {showPATSection && (
              <form onSubmit={handlePATSubmit} className="login-form">
                <TextField
                  type="password"
                  value={tokenInput}
                  onChange={handleInputChange}
                  isInvalid={!!error}
                  isDisabled={isValidating}
                  isRequired
                  className="form-group"
                >
                  <div className="label-with-tip">
                    <Label className="label">Personal Access Token</Label>
                    <TooltipTrigger delay={200}>
                      <Button
                        variant="ghost"
                        type="button"
                        className="field-tip-trigger"
                        aria-label="Tip: paste the output of gh auth token"
                      >
                        <Info size={14} aria-hidden="true" />
                      </Button>
                      <Tooltip className="field-tip" placement="top">
                        Tip: paste the output of <code>gh auth token</code>
                      </Tooltip>
                    </TooltipTrigger>
                  </div>
                  <Input
                    id="pat"
                    className="textbox"
                    placeholder="ghp_xxxxxxxxxxxx or github_pat_xxxxxxxxxxxx"
                    style={{ width: '100%' }}
                  />
                  {error ? (
                    <Text
                      slot="errorMessage"
                      role="alert"
                      aria-live="polite"
                      style={{ marginTop: '4px', fontSize: '12px', color: 'var(--badge-merged, #d32f2f)' }}
                    >
                      {error}
                    </Text>
                  ) : (
                    <Text slot="description" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--control-disabled-fg)' }}>
                      Your token must start with &apos;ghp_&apos;, &apos;github_pat_&apos;, or &apos;gho_&apos;
                    </Text>
                  )}
                </TextField>

                <Button
                  type="submit"
                  isDisabled={isValidating || !tokenInput.trim()}
                >
                  {isValidating ? 'Validating...' : 'Connect with PAT'}
                </Button>
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
