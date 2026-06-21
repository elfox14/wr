'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type MatchStatusKind = 'live' | 'halftime' | 'scheduled' | 'finished' | 'delayed';

interface MatchAutoRefreshProps {
  /** Base interval hint from parent (overridden by adaptive logic) */
  intervalMs?: number;
  /** Force a full page reload after each soft refresh */
  hardReload?: boolean;
  /** Current match status kind — drives adaptive interval */
  statusKind?: MatchStatusKind;
  /** ISO date string of the match kickoff */
  matchDate?: string;
  /** Whether the match page should show a live pulse indicator */
  showPulse?: boolean;
}

function adaptiveIntervalMs(statusKind: MatchStatusKind, matchDate: string | undefined): number {
  if (statusKind === 'live') return 20_000;
  if (statusKind === 'halftime') return 45_000;
  if (statusKind === 'delayed') return 30_000;

  if (statusKind === 'scheduled') {
    if (!matchDate) return 60_000;
    const msUntilKickoff = new Date(matchDate).getTime() - Date.now();
    if (msUntilKickoff <= 30 * 60_000) return 25_000;   // ≤30 min before kickoff
    if (msUntilKickoff <= 120 * 60_000) return 60_000;  // ≤2 hours
    return 180_000;                                       // far future
  }

  if (statusKind === 'finished') {
    if (!matchDate) return 0; // stop
    const msSinceKickoff = Date.now() - new Date(matchDate).getTime();
    if (msSinceKickoff <= 60 * 60_000) return 120_000;  // ≤1h since start — still catching post-match stats
    return 0; // stop polling entirely for old finished matches
  }

  return 60_000;
}

export default function MatchAutoRefresh({
  intervalMs = 30000,
  hardReload = false,
  statusKind = 'scheduled',
  matchDate,
  showPulse = false,
}: MatchAutoRefreshProps) {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(0);
  const [pulseVisible, setPulseVisible] = useState(false);

  const doRefresh = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    lastRefreshRef.current = Date.now();
    router.refresh();
    if (showPulse) {
      setPulseVisible(true);
      window.setTimeout(() => setPulseVisible(false), 1200);
    }
    if (hardReload) {
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') window.location.reload();
      }, 1200);
    }
  }, [router, hardReload, showPulse]);

  useEffect(() => {
    const adaptiveMs = adaptiveIntervalMs(statusKind, matchDate);
    // If adaptive says 0 (old finished match), use a very long fallback or stop
    const effectiveInterval = adaptiveMs > 0
      ? Math.max(10_000, adaptiveMs)
      : 0;

    if (effectiveInterval === 0) return; // no polling for old finished matches

    // Quick initial check for live/near-kickoff
    const quickMs = statusKind === 'live' || statusKind === 'halftime' ? 3_000 : Math.min(5_000, effectiveInterval);
    const quickCheck = window.setTimeout(doRefresh, quickMs);
    const timer = window.setInterval(doRefresh, effectiveInterval);

    // Instant refresh when user returns to tab
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const sinceLastRefresh = Date.now() - lastRefreshRef.current;
      // Only refresh if enough time has passed (debounce — at least 4 seconds)
      if (sinceLastRefresh > 4_000) {
        doRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearTimeout(quickCheck);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [doRefresh, statusKind, matchDate, intervalMs]);

  if (!showPulse) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black backdrop-blur transition-all duration-500 ${
        statusKind === 'live'
          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
          : statusKind === 'halftime'
            ? 'border-amber-400/30 bg-amber-500/15 text-amber-300'
            : 'border-white/10 bg-white/5 text-slate-500'
      } ${pulseVisible ? 'opacity-100 scale-100' : 'opacity-60 scale-95'}`}
    >
      <span className={`h-2 w-2 rounded-full ${
        statusKind === 'live' ? 'animate-pulse bg-emerald-400' :
        statusKind === 'halftime' ? 'bg-amber-400' : 'bg-slate-600'
      }`} />
      {statusKind === 'live' ? 'تحديث مباشر' :
       statusKind === 'halftime' ? 'استراحة' :
       statusKind === 'finished' ? 'انتهت' : 'تحديث تلقائي'}
    </div>
  );
}
