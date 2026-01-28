import { useAuthStore } from '../stores/useAuthStore';

/**
 * Derived state hook for rate limit warning display logic.
 *
 * Returns whether a warning should be shown (remaining < 20% of limit),
 * the current remaining count, reset time, and exhaustion state.
 */
export function useRateLimitWarning() {
  const remaining = useAuthStore((state) => state.rateLimitRemaining);
  const resetTime = useAuthStore((state) => state.rateLimitReset);
  const limit = useAuthStore((state) => state.rateLimitLimit);

  const isExhausted = remaining === 0;
  const shouldWarn = remaining !== null && limit !== null && remaining < 0.2 * limit;

  return {
    shouldWarn,
    remaining,
    resetTime,
    isExhausted,
  };
}
