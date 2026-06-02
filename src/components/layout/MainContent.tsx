'use client';

import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
  toolbar?: ReactNode;
  navBar?: ReactNode;
}

/**
 * Main content area with optional toolbar and navigation bar
 */
export function MainContent({ children, toolbar, navBar }: MainContentProps) {
  return (
    <main className="main-content">
      {navBar && <nav className="nav-bar">{navBar}</nav>}
      {toolbar && <div className="toolbar">{toolbar}</div>}
      <div className="diff-viewer" id="diffViewer" data-testid="diff-viewer">
        {children}
      </div>
    </main>
  );
}
