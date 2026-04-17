import { useAuthStore } from '../stores/useAuthStore';

/**
 * Hook for pages that work without authentication.
 * Returns authentication state without redirecting unauthenticated users.
 *
 * Use this for pages that should be accessible to both authenticated
 * and unauthenticated users, like the dashboard or public PR pages.
 *
 * @returns Object with isAuthenticated status, isLoading state, and current token
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   const { isAuthenticated, isLoading, token } = useOptionalAuth();
 *
 *   if (isLoading) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return (
 *     <div>
 *       {isAuthenticated ? <UserMenu /> : <LoginButton />}
 *       <Content />
 *     </div>
 *   );
 * }
 * ```
 */
export function useOptionalAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const token = useAuthStore((state) => state.token);

  return {
    isAuthenticated,
    isLoading: !hasHydrated,
    token,
  };
}
