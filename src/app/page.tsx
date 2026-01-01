'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Home page redirects based on auth status
    // Note: This may flash briefly for authenticated users before hydration,
    // but the login page handles redirecting authenticated users to dashboard
    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [isAuthenticated, router]);

  return (
    <div>
      <div>Redirecting...</div>
    </div>
  );
}
