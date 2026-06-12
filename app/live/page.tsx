'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Clock, Newspaper, Radio, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';

type Team = { id: string; name: string; code?: string; image?: string; price?: number; change?: number };
type LiveMatch = { id: string; animationMatchId?: number; status: string; matchDate: string; homeScore: number; awayScore: number; homeTeam: Team | null; awayTeam: Team | null; groupPhase?: string };
type NewsItem = { id: string; title: string; body?: string; category: string; publishedAt: string; asset?: Team | null; changePercent?: number };
type Mover = { id: string; name: string; code?: string; image?: string; price: number; change: number };

type LivePayload = {
  ok: boolean;
  updatedAt: string;
  pollingSeconds?: number;
  health: { liveCount: number; upcomingCount: number; recentCount: number; linkedMatches: number; unlinkedNearMatches: number; providerMode: string };
  matches: { live: LiveMatch[]; upcoming: LiveMatch[]; recent: LiveMatch[] };
  news: { latest: NewsItem[]; match: NewsItem[]; trading: NewsItem[] };
  movers: Mover[];
};

function formatTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TeamPill({ team }: { team: Team | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {team?.image ? <img src={team.image} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-white/10" />}
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-white">{team?.name || 'غير متوفر'}</div>
        {team?.price != null && <div className="text-[11px] font-mono text-gray-500">{team.price}¢</div>}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: LiveMatch }) {
  const live = match.status === 'IN_PLAY' || match.status === 'LIVE';
  return (
    <Link href={`/matches/${match.id}`} className="block rounded-3xl border border-white/5 bg-[#111] p-4 transition hover:border-[#0FF0FC]/30 hover:bg-white/[0.04]">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-gray-500">
        <span className={`rounded-full px-3 py-1 font-black ${live ? 'bg-red-500/15 text-red-300' : 'bg-white/5 text-gray-400'}`}>{live ? 'مباشر' : match.status}</span>
        <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(match.matchDate)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamPill team={match.homeTeam} />
        <div className="rounded-2xl bg-black px-4 py-2 text-center font-mono text-xl font-black text-[#FFD700]">
          {match.homeScore} - {match.awayScore}
        </div>
        <div className="text-right"><TeamPill team={match.awayTeam} /></div>
      </div>
      {match.animationMatchId && <div className="mt-3 text-[11px] text-gray-600">iSports: {match.animationMatchId}</div>}
    </Link>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const trading = item.category === 'trading';
  const positive = Number(item.changePercent || 0) >= 0;
  const Icon = trading ? (positive ? TrendingUp : TrendingDown) : Radio;
  return (
    <div className="rounded-2xl border border-white/5 bg-[#111] p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500">
        <span className={`flex items-center gap-1 font-bold ${trading ? 'text-[#0FF0FC]' : 'text-[#FFD700]'}`}><Icon size={13} /> {trading ? 'تداول' : 'مباراة'}</span>
        <span>{formatTime(item.publishedAt)}</span>
      </div>
      <div className="text-sm font-black leading-6 text-white">{item.title}</div>
      {item.body && <p className="mt-2 max-h-16 overflow-hidden text-xs leading-5 text-gray-500">{item.body}</p>}
    </div>
  );
}

export default function LiveCenterPage() {
  const [data, setData] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastTick, setLastTick] = useState<Date | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/live-center', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load live center');
      setData(json);
      setError(null);
      setLastTick(new Date());
    } catch (err: any) {
      setError(err?.message || 'خطأ في تحميل اللايف');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, []);

  const allMatches = useMemo(() => data ? [...data.matches.live, ...data.matches.upcoming, ...data.matches.recent] : [], [data]);

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/8 bg-gradient-to-br from-[#111] to-black p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-black text-red-300"><Radio size={15} /> مركز اللايف</div>
              <h1 className="text-3xl font-black sm:text-4xl">بورصة المونديال لايف</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">متابعة تلقائية للمباريات، الأهداف، أخبار التداول، وحالة الربط مع iSports.</p>
            </div>
            <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC]"><RefreshCw size={16} /> تحديث الآن</button>
          </div>
        </section>

        {error && <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {loading && <div className="rounded-3xl border border-white/5 bg-[#111] p-10 text-center text-gray-500">جاري تحميل اللايف...</div>}

        {data && (
          <>
            <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">مباشر</div><div className="mt-2 text-2xl font-black text-red-300">{data.health.liveCount}</div></div>
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">قريبة</div><div className="mt-2 text-2xl font-black text-[#FFD700]">{data.health.upcomingCount}</div></div>
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">انتهت مؤخرًا</div><div className="mt-2 text-2xl font-black">{data.health.recentCount}</div></div>
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">مرتبطة</div><div className="mt-2 text-2xl font-black text-[#00FF88]">{data.health.linkedMatches}</div></div>
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">غير مرتبطة قريبة</div><div className="mt-2 text-2xl font-black text-orange-300">{data.health.unlinkedNearMatches}</div></div>
            </section>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <section className="lg:col-span-2">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Zap className="text-[#FFD700]" /> المباريات الحية والقريبة</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {allMatches.length ? allMatches.map((match) => <MatchCard key={match.id} match={match} />) : <div className="rounded-3xl border border-white/5 bg-[#111] p-8 text-center text-gray-500 md:col-span-2">لا توجد مباريات قريبة الآن.</div>}
                </div>
              </section>

              <aside className="space-y-8">
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Newspaper className="text-[#0FF0FC]" /> آخر الأخبار</h2>
                  <div className="space-y-3">
                    {data.news.latest.slice(0, 8).map((item) => <NewsCard key={item.id} item={item} />)}
                    {!data.news.latest.length && <div className="rounded-3xl border border-white/5 bg-[#111] p-8 text-center text-gray-500">لا توجد أخبار بعد.</div>}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Activity className="text-[#00FF88]" /> الأكثر حركة</h2>
                  <div className="space-y-2">
                    {data.movers.map((asset) => <Link key={asset.id} href={`/asset/${asset.id}`} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#111] p-3 text-sm hover:border-[#0FF0FC]/30"><span className="font-bold">{asset.name}</span><span className={asset.change >= 0 ? 'text-[#00FF88]' : 'text-red-300'} dir="ltr">{asset.change >= 0 ? '+' : ''}{asset.change}%</span></Link>)}
                  </div>
                </section>
              </aside>
            </div>

            <div className="mt-8 text-center text-xs text-gray-600">آخر تحديث: {lastTick ? formatTime(lastTick.toISOString()) : formatTime(data.updatedAt)} — يتم التحديث تلقائيًا كل 20 ثانية</div>
          </>
        )}
      </div>
    </main>
  );
}
