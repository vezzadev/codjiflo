import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

/**
 * Status of the local-dev GitHub CLI auto-login.
 * - `disabled`: not a local dev build (production / preview / E2E) — never attempts.
 * - `attempting`: fetching `gh auth token` and validating it.
 * - `failed`: the GitHub CLI is unavailable / not logged in, or the token was rejected.
 */
export type DevAutoLoginStatus = 'disabled' | 'attempting' | 'failed';

/**
 * Local-dev convenience: when running `npm run dev`, sign in automatically using
 * the GitHub CLI's OAuth token served by the dev-only `/api/auth/dev-token`
 * route — skipping the OAuth client-secret flow, which is exercised only in PR
 * previews. On failure the status becomes `failed` and the login page falls back
 * to the normal OAuth / PAT options.
 *
 * In production / preview builds `process.env.NODE_ENV` is statically `'production'`,
 * so the dev branch is dead-code-eliminated and this hook is a no-op. E2E runs a
 * production build and seeds its own auth state, so it is never affected.
 */
export function useDevAutoLogin(): DevAutoLoginStatus {
  const isDevBuild = process.env.NODE_ENV === 'development';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const validateToken = useAuthStore((s) => s.validateToken);
  const [status, setStatus] = useState<DevAutoLoginStatus>(
    isDevBuild ? 'attempting' : 'disabled',
  );

  useEffect(() => {
    if (!isDevBuild || !hasHydrated || isAuthenticated) {
      return;
    }

    // Abort on unmount so we neither keep an in-flight fetch nor setStatus on an
    // unmounted component. `signal.aborted` stays a plain boolean (not narrowed),
    // unlike a captured `let` flag.
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/auth/dev-token', { signal: controller.signal });
        if (!res.ok) {
          throw new Error('dev token unavailable');
        }
        const { token } = (await res.json()) as { token?: string };
        if (!token) {
          throw new Error('empty dev token');
        }
        const ok = await validateToken(token);
        if (!ok && !controller.signal.aborted) {
          setStatus('failed');
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus('failed');
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isDevBuild, hasHydrated, isAuthenticated, validateToken]);

  return status;
}
