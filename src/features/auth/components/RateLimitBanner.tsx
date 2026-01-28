'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useRateLimitWarning } from '../hooks/useRateLimitWarning';
import { useAuthStore } from '../stores/useAuthStore';
import { formatTimeUntil } from '@/utils/time';

/**
 * Banner that warns users when GitHub API rate limit is running low.
 * Dismissible (except when exhausted), with login CTA for unauthenticated users.
 *
 * Reappears when remaining drops 5 below the value at which it was dismissed.
 */
export function RateLimitBanner() {
  const { shouldWarn, remaining, resetTime, isExhausted } = useRateLimitWarning();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [dismissedAtRemaining, setDismissedAtRemaining] = useState<number | null>(null);

  if (!shouldWarn) {
    return null;
  }

  // Check if dismissed and whether it should reappear
  if (dismissedAtRemaining !== null && !isExhausted) {
    if (remaining === null || remaining > dismissedAtRemaining - 5) {
      return null;
    }
  }

  const handleDismiss = () => {
    setDismissedAtRemaining(remaining);
  };

  if (isExhausted) {
    const resetTimeStr = resetTime ? formatTimeUntil(resetTime) : 'soon';
    return (
      <div className="rate-limit-banner rate-limit-banner-exhausted" role="alert" aria-live="assertive">
        <span className="rate-limit-banner-message">
          Rate limit exceeded. Resets in {resetTimeStr}.
          {!isAuthenticated && (
            <>
              {' '}<Link href="/login" className="rate-limit-banner-link">Sign in</Link> for 5,000 requests/hour.
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="rate-limit-banner" role="alert" aria-live="polite">
      <span className="rate-limit-banner-message">
        {isAuthenticated ? (
          <>{remaining} API requests remaining.</>
        ) : (
          <>
            {remaining} requests remaining.{' '}
            <Link href="/login" className="rate-limit-banner-link">Sign in</Link> for 5,000 requests/hour.
          </>
        )}
      </span>
      <button
        className="rate-limit-banner-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss rate limit warning"
      >
        <X size={14} />
      </button>
    </div>
  );
}
