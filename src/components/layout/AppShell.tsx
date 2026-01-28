'use client';

import { ReactNode, lazy, Suspense } from 'react';

const RateLimitBanner = lazy(() =>
  import('@/features/auth/components/RateLimitBanner').then((m) => ({
    default: m.RateLimitBanner,
  }))
);

interface AppShellProps {
  children: ReactNode;
}

/**
 * Main window container for the application
 * Provides the desktop-style window layout
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="window" id="mainWindow">
      <Suspense fallback={null}>
        <RateLimitBanner />
      </Suspense>
      {children}
    </div>
  );
}
