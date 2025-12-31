/**
 * Degraded Mode Banner Component (S-4.10)
 *
 * Displays informational banner when iteration tracking is unavailable.
 */

import { Info, ExternalLink } from 'lucide-react';
import { useIterationStore } from '../stores';

interface DegradedModeBannerProps {
  className?: string;
}

/**
 * Banner shown when repository doesn't have CodjiFlo GitHub Action.
 * Provides information about limitations and setup instructions.
 */
export function DegradedModeBanner({ className }: DegradedModeBannerProps) {
  const { isDegraded, isLoading } = useIterationStore();

  // Don't show during loading or when not degraded
  if (isLoading || !isDegraded) {
    return null;
  }

  const classes = ['degraded-banner', className].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
    >
      <Info className="degraded-banner-icon" aria-hidden />
      <div className="degraded-banner-content">
        <h4 className="degraded-banner-title">
          Iteration tracking unavailable
        </h4>
        <p className="degraded-banner-text">
          This repository doesn&apos;t have the CodjiFlo GitHub Action installed.
          You&apos;re seeing commits from GitHub&apos;s default API, which means force-push
          history and iteration tracking are not available.
        </p>
        <a
          href="https://github.com/codjiflo/action#installation"
          target="_blank"
          rel="noopener noreferrer"
          className="degraded-banner-link"
        >
          Learn how to enable iteration tracking
          <ExternalLink size={14} aria-hidden />
        </a>
      </div>
    </div>
  );
}
