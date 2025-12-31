'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { parseGitHubPRUrl } from '@/features/pr';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useRequireAuth } from '@/features/auth/hooks';
import { AppShell, Titlebar } from '@/components/layout';

export default function DashboardPage() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { isAuthenticated } = useRequireAuth();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const parsed = parseGitHubPRUrl(url);
    if (!parsed) {
      setError('Invalid GitHub PR URL. Please enter a URL like: https://github.com/owner/repo/pull/123');
      return;
    }

    router.push(`/pr/${parsed.owner}/${parsed.repo}/${String(parsed.number)}`);
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <Titlebar
        title="Dashboard"
        rightContent={
          <button
            onClick={handleLogout}
            className="btn-nav"
            aria-label="Logout"
            style={{ marginRight: '8px' }}
          >
            <LogOut size={16} />
          </button>
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

            <Button
              type="submit"
              label="Load Pull Request"
              disabled={!url.trim()}
            />
          </form>
        </div>

        <p className="dashboard-hint">
          Paste any public GitHub pull request URL to view its changes
        </p>
      </div>
    </AppShell>
  );
}
