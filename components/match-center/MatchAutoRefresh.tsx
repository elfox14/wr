'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MatchAutoRefresh({ intervalMs = 30000, hardReload = false }: { intervalMs?: number; hardReload?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const safeInterval = Math.max(10000, intervalMs);
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      router.refresh();
      if (hardReload) {
        window.setTimeout(() => {
          if (document.visibilityState === 'visible') window.location.reload();
        }, 1200);
      }
    };
    const timer = window.setInterval(run, safeInterval);
    return () => window.clearInterval(timer);
  }, [router, intervalMs, hardReload]);

  return null;
}
