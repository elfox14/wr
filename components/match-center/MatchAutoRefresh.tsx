'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MatchAutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const safeInterval = Math.max(10000, intervalMs);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, safeInterval);

    return () => window.clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
