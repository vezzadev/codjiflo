'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Root path always redirects to dashboard regardless of auth status
    // The dashboard is accessible to both authenticated and unauthenticated users
    router.replace('/dashboard');
  }, [router]);

  return (
    <div>
      <div>Redirecting...</div>
    </div>
  );
}
