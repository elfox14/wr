'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WatchAutoRefresh({ enabled, intervalMs = 30000 }: { enabled: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => router.refresh(), Math.max(15000, intervalMs));
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}
