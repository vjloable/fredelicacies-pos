'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page by default
    router.push('/home');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-16 h-16 bg-[var(--accent)] rounded-full mx-auto mb-4 animate-pulse"></div>
        <p className="text-[var(--secondary)]">Loading...</p>
      </div>
    </div>
  );
}
