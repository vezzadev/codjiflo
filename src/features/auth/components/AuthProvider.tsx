'use client';

import { useTokenRefresh } from '../hooks/useTokenRefresh';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider component that handles automatic token refresh.
 * Mount at app root level to enable periodic token refresh for OAuth users.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  useTokenRefresh();
  return <>{children}</>;
}
