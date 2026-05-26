'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, LogIn } from 'lucide-react';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { parseGitHubPRUrl } from '@/features/pr';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useOptionalAuth } from '@/features/auth/hooks';
import { AppShell, Titlebar } from '@/components/layout';

function DashboardContent() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const { isAuthenticated, isLoading } = useOptionalAuth();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const parsed = parseGitHubPRUrl(url);
    if (!parsed) {
      setError('Invalid GitHub PR URL. Please enter a URL like: https://github.com/owner/repo/pull/123');
      return;
    }

    router.push(`/${parsed.owner}/${parsed.repo}/${String(parsed.number)}`);
  };

  const handleLogout = () => {
    logout();
    router.replace('/dashboard');
  };

  const handleLogin = () => {
    const returnPath = encodeURIComponent(pathname);
    router.push(`/login?returnPath=${returnPath}`);
  };

  if (isLoading) {
    return null;
  }

  return (
    <AppShell>
      <Titlebar
        title="Dashboard"
        rightContent={
          isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="btn-nav"
              title="Logout"
              aria-label="Logout"
              style={{ marginRight: '8px' }}
            >
              <LogOut size={16} />
            </button>
          ) : (
            <button
              onClick={handleLogin}
              className="btn-nav"
              title="Log in with GitHub"
              aria-label="Log in with GitHub"
              style={{ marginRight: '8px' }}
            >
              <LogIn size={16} />
            </button>
          )
        }
      />

      <div className="dashboard-content">
        <div className="dashboard-card">
          <h2 className="dashboard-title">View Pull Request</h2>
          <p className="dashboard-subtitle">
            Enter a GitHub Pull Request URL to start reviewing
          </p>

          <form onSubmit={handleSubmit} className="dashboard-form">
            <Input
              id="pr-url"
              label="GitHub Pull Request URL"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError('');
              }}
              placeholder="https://github.com/owner/repo/pull/123"
              error={error}
              required
              autoFocus
            />

            <Button type="submit" isDisabled={!url.trim()}>
              Load Pull Request
            </Button>
          </form>
        </div>

        <p className="dashboard-hint">
          Paste any public GitHub pull request URL to view its changes
        </p>
      </div>
    </AppShell>
  );
}

function LoadingFallback() {
  return (
    <AppShell>
      <div className="dashboard-content">
        <div className="dashboard-card">
          <h2 className="dashboard-title">Loading...</h2>
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
