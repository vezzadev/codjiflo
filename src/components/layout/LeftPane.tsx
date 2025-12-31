'use client';

import { ReactNode } from 'react';

interface LeftPaneProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
}

/**
 * Left pane container for file explorer and properties
 */
export function LeftPane({ children, header, footer }: LeftPaneProps) {
  return (
    <section className="left-pane" id="leftPane">
      {header && <div className="left-pane-header">{header}</div>}
      <div className="file-explorer">{children}</div>
      {footer}
    </section>
  );
}
