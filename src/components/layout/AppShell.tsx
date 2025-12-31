'use client';

import { ReactNode } from 'react';

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
      {children}
    </div>
  );
}
