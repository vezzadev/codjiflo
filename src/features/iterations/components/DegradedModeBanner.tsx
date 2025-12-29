/**
 * Degraded Mode Banner Component (S-4.10)
 *
 * Displays informational banner when iteration tracking is unavailable.
 */

import { Info, ExternalLink } from 'lucide-react';
import { cn } from '@/utils/cn';
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

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-amber-800">
          Iteration tracking unavailable
        </h4>
        <p className="mt-1 text-sm text-amber-700">
          This repository doesn&apos;t have the CodjiFlo GitHub Action installed.
          You&apos;re seeing commits from GitHub&apos;s default API, which means force-push
          history and iteration tracking are not available.
        </p>
        <a
          href="https://github.com/codjiflo/action#installation"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1 mt-2 text-sm font-medium',
            'text-amber-800 hover:text-amber-900 underline underline-offset-2'
          )}
        >
          Learn how to enable iteration tracking
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}
