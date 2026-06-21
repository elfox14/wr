'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeClientSportsLiveFocus from '@/components/HomeClientSportsLiveFocus';
import HomeDemoCommandCenter from '@/components/home-demo/HomeDemoCommandCenter';

type HomeMatch = {
  id?: string | number | null;
  animationMatchId?: string | number | null;
  matchDate?: string | Date | null;
  status?: string | null;
  displayStatus?: string | null;
  stage?: string | null;
  group?: string | null;
  groupPhase?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: any;
  awayTeam?: any;
  isLiveNow?: boolean;
  isHalfTime?: boolean;
  isLikelyLiveByTime?: boolean;
  isStaleAutoFinished?: boolean;
  minute?: number | null;
  liveLabel?: string | null;
};

const REFRESH_MS = 30_000;

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
  return response.json();
}

function normalizeLiveCardPayload(value: any): HomeMatch[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (Array.isArray(value?.matches)) return value.matches.filter(Boolean);

  return [
    value?.primaryMatch,
    value?.primary,
    value?.nextMarqueeMatch,
    ...(Array.isArray(value?.secondaryMatches) ? value.secondaryMatches : []),
    ...(Array.isArray(value?.nextMatches) ? value.nextMatches : []),
  ].filter(Boolean);
}

function uniqueMatches(list: HomeMatch[]) {
  const seen = new Set<string>();
  return list.filter((match) => {
    const key = String(match.id || match.animationMatchId || `${match.homeTeam?.name || ''}-${match.awayTeam?.name || ''}-${match.matchDate || ''}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchTime(match: HomeMatch) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  return date && Number.isFinite(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

export default function HomeDemoWithCurrentHomeCards() {
  const [homepageMatches, setHomepageMatches] = useState<HomeMatch[]>([]);
  const [demoMatches, setDemoMatches] = useState<HomeMatch[]>([]);
  const [playersCount, setPlayersCount] = useState(0);
  const [teamsCount, setTeamsCount] = useState(0);
  const [upcomingMatchesCount, setUpcomingMatchesCount] = useState(0);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [liveResult, demoResult, summaryResult] = await Promise.allSettled([
        fetchJson('/api/matches/live-card'),
        fetchJson('/api/home-demo/command-center'),
        fetchJson('/api/matches/summary-stats'),
      ]);

      if (cancelled) return;

      if (liveResult.status === 'fulfilled') {
        setHomepageMatches(normalizeLiveCardPayload(liveResult.value));
      }

      if (demoResult.status === 'fulfilled') {
        const value = demoResult.value;
        setDemoMatches(Array.isArray(value?.matches) ? value.matches : []);
      }

      if (summaryResult.status === 'fulfilled' && summaryResult.value?.ok) {
        const value = summaryResult.value;
        setPlayersCount(Number(value.playersCount || value.totalPlayers || value.assets?.players || 0));
        setTeamsCount(Number(value.teamsCount || value.totalTeams || value.assets?.teams || 0));
        setUpcomingMatchesCount(Number(value.scheduledMatches || value.upcomingMatchesCount || 0));
      }

      setLastLoadedAt(new Date().toISOString());
    }

    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const currentHomeMatches = useMemo(() => {
    return uniqueMatches([...homepageMatches, ...demoMatches]).sort((a, b) => matchTime(a) - matchTime(b)).slice(0, 8);
  }, [homepageMatches, demoMatches]);

  const nextMarqueeMatch = currentHomeMatches[0] || null;

  return (
    <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.13),transparent_30%),radial-gradient(circle_at_top_left,rgba(15,240,252,0.11),transparent_28%),linear-gradient(180deg,#06120d,#020706)] text-white">
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4 lg:px-6">
        <div className="overflow-hidden rounded-[2rem] border border-[#FFD700]/20 bg-[linear-gradient(135deg,rgba(255,215,0,0.12),rgba(15,240,252,0.06),rgba(0,0,0,0.30))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/25 bg-[#00FF88]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#00FF88]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00FF88]" /> HOME DEMO REVIEW
              </div>
              <h1 className="mt-3 max-w-3xl text-2xl font-black leading-tight sm:text-4xl">ديمو الرئيسية: الحالية أولًا ثم الإضافات</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-300">
                في الأعلى نفس ترتيب كروت الرئيسية الحالية كما هي للمقارنة، وتحتها كروت الديمو الجديدة قبل اعتماد أي نقل للرئيسية.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black">
              <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-gray-300 transition hover:text-white">الرئيسية الحالية</Link>
              <Link href="#demo-additions" className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-2 text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">انزل لكروت الديمو</Link>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-gray-400">آخر تحديث: {lastLoadedAt ? 'تم' : 'جاري التحميل'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 pt-5 sm:px-4 lg:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 text-sm font-black text-[#FFD700]">١</span>
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">كروت الرئيسية الحالية بنفس الترتيب</h2>
            <p className="mt-1 text-xs font-bold text-gray-400 sm:text-sm">Ticker ثم كارت المباراة/المجموعات ثم كارت إحصائيات البطولة.</p>
          </div>
        </div>
      </section>

      <div className="border-y border-white/5 bg-black/10">
        <HomeClientSportsLiveFocus
          upcomingMatches={currentHomeMatches}
          tickerMatches={currentHomeMatches}
          nextMarqueeMatch={nextMarqueeMatch}
          playersCount={playersCount}
          teamsCount={teamsCount}
          upcomingMatchesCount={upcomingMatchesCount}
        />
      </div>

      <section id="demo-additions" className="mx-auto max-w-7xl px-3 pb-2 pt-8 sm:px-4 lg:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-sm font-black text-[#0FF0FC]">٢</span>
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">كروت الديمو المقترحة</h2>
            <p className="mt-1 text-xs font-bold text-gray-400 sm:text-sm">الإضافات الجديدة تظهر بعد كروت الرئيسية حتى تكون المقارنة والموافقة أسهل.</p>
          </div>
        </div>
      </section>

      <HomeDemoCommandCenter />
    </main>
  );
}
