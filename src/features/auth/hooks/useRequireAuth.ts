import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../stores/useAuthStore';

/**
 * Hook that ensures the user is authenticated.
 * Redirects to login page if not authenticated.
 *
 * @returns Object with isAuthenticated status and isLoading state
 *
 * @example
 * ```tsx
 * function ProtectedPage() {
 *   const { isAuthenticated, isLoading } = useRequireAuth();
 *
 *   if (isLoading || !isAuthenticated) {
 *     return null; // or a loading spinner
 *   }
 *
 *   return <div>Protected content</div>;
 * }
 * ```
 */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    // Only redirect after hydration is complete
    if (hasHydrated && !isAuthenticated) {
      // Build the return path including current pathname and search params
      const currentSearch = searchParams.toString();
      const returnPath = currentSearch ? `${pathname}?${currentSearch}` : pathname;

      // Redirect to login with returnPath so user can return after authentication
      const loginUrl = `/login?returnPath=${encodeURIComponent(returnPath)}`;
      router.replace(loginUrl);
    }
  }, [isAuthenticated, hasHydrated, router, pathname, searchParams]);

  return {
    isAuthenticated,
    isLoading: !hasHydrated,
  };
}

/**
 * Hook that ensures the user is NOT authenticated.
 * Redirects to dashboard if already authenticated.
 * Use this for login/signup pages.
 *
 * @returns Object with isAuthenticated status and isLoading state
 *
 * @example
 * ```tsx
 * function LoginPage() {
 *   const { isAuthenticated, isLoading } = useRedirectIfAuthenticated();
 *
 *   if (isLoading || isAuthenticated) {
 *     return null; // Redirecting...
 *   }
 *
 *   return <LoginForm />;
 * }
 * ```
 */
export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    // Only redirect after hydration is complete
    if (hasHydrated && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, hasHydrated, router]);

  return { isAuthenticated, isLoading: !hasHydrated };
}
