'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LiveOnlyRefresh({ active, intervalMs = 30_000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = window.setInterval(refresh, Math.max(15_000, intervalMs));
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active, intervalMs, router]);

  return null;
}
