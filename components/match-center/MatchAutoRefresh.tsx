'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MatchAutoRefresh({ intervalMs = 30000, hardReload = false }: { intervalMs?: number; hardReload?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    // Match pages must stay fresh around kickoff even while the database row is still SCHEDULED.
    // The caller may pass 90s for calm scheduled pages, but we cap it to 25s so kickoff fallback
    // and first live provider snapshots appear quickly without requiring a manual refresh.
    const safeInterval = Math.max(10000, Math.min(intervalMs, 25000));
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      router.refresh();
      if (hardReload) {
        window.setTimeout(() => {
          if (document.visibilityState === 'visible') window.location.reload();
        }, 1200);
      }
    };
    const quickCheck = window.setTimeout(run, Math.min(5000, safeInterval));
    const timer = window.setInterval(run, safeInterval);
    return () => {
      window.clearTimeout(quickCheck);
      window.clearInterval(timer);
    };
  }, [router, intervalMs, hardReload]);

  return null;
}
