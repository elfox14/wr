'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type HubFilter = 'today' | 'yesterday' | 'tomorrow' | 'latest' | 'live' | 'group' | 'all';

type HubTeam = {
  id: string;
  name: string;
  code: string | null;
  image: string | null;
  group: string | null;
  arabicName?: string | null;
  flagEmoji?: string | null;
  displayName?: string | null;
};

type HubMatch = {
  id: string;
  href: string;
  liveHref: string;
  reportHref: string;
  matchDate: string;
  statusLabel: string;
  isLive: boolean;
  isFinished: boolean;
  isScheduled: boolean;
  homeScore: number | null;
  awayScore: number | null;
  group: string | null;
  stage: string;
  hasLiveAnimation: boolean;
  hasStats: boolean;
  hasEvents: boolean;
  homeTeam: HubTeam;
  awayTeam: HubTeam;
};

type HubResponse = {
  ok: boolean;
  filter: HubFilter;
  group: string;
  q: string;
  summary: { total: number; live: number; finished: number; scheduled: number };
  matches: HubMatch[];
};

const GROUPS = 'ABCDEFGHIJKL'.split('');
const MAIN_FILTERS: Array<{ id: HubFilter; label: string }> = [
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: 'tomorrow', label: 'غدًا' },
  { id: 'latest', label: 'آخر النتائج' },
  { id: 'live', label: 'مباشر الآن' },
  { id: 'round_of_32', label: 'دور الـ 32' },
  { id: 'round_of_16', label: 'دور الـ 16' },
  { id: 'quarter_finals', label: 'ربع النهائي' },
  { id: 'semi_finals', label: 'نصف النهائي' },
  { id: 'final', label: 'النهائي' },
  { id: 'all', label: 'كل المباريات' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(value));
}

function score(match: HubMatch) {
  if (match.isScheduled) return 'vs';
  return `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`;
}

function Flag({ team }: { team: HubTeam }) {
  return (
    <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/35 text-xl">
      {team.image ? (
        <img src={team.image} alt={`علم ${team.name}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-label={`علم ${team.name}`}>{team.flagEmoji || '🏳️'}</span>
      )}
    </span>
  );
}

function TeamName({ team, align = 'right' }: { team: HubTeam; align?: 'right' | 'left' }) {
  return <b className={`block text-sm font-black leading-5 text-white sm:text-base ${align === 'left' ? 'text-left' : 'text-right'}`}>{team.name}</b>;
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-black transition ${active ? 'border-[#18E58F]/50 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]'}`}>{children}</button>;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center"><span className="block text-[11px] font-black text-slate-400">{label}</span><b className="mt-1 block text-2xl font-black text-white tabular-nums">{new Intl.NumberFormat('ar-EG').format(value)}</b></div>;
}

function MatchCard({ match }: { match: HubMatch }) {
  const tone = match.isLive ? 'border-[#18E58F]/35 bg-[#18E58F]/10' : match.isFinished ? 'border-sky-300/20 bg-sky-300/8' : 'border-white/10 bg-white/[0.045]';
  return (
    <article className={`rounded-[1.35rem] border p-3 shadow-[0_14px_36px_rgba(0,0,0,.22)] transition hover:-translate-y-0.5 hover:border-[#18E58F]/35 ${tone}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-black text-slate-300">{match.group || match.stage || 'المباراة'}</span>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${match.isLive ? 'bg-[#18E58F] text-black' : match.isFinished ? 'bg-sky-300/15 text-sky-100' : 'bg-white/10 text-white'}`}>{match.statusLabel}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0 text-right">
          <div className="mb-1 flex items-center gap-2">
            <Flag team={match.homeTeam} />
            <TeamName team={match.homeTeam} />
          </div>
          <p className="text-[11px] font-bold text-slate-500">{match.homeTeam.code || '—'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-center">
          <b className="block text-xl font-black text-[#F8C846] tabular-nums">{score(match)}</b>
          <span className="mt-1 block text-[10px] font-bold text-slate-500">{formatDate(match.matchDate)}</span>
        </div>
        <div className="min-w-0 text-left">
          <div className="mb-1 flex items-center justify-end gap-2">
            <TeamName team={match.awayTeam} align="left" />
            <Flag team={match.awayTeam} />
          </div>
          <p className="text-[11px] font-bold text-slate-500">{match.awayTeam.code || '—'}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={match.href} className="rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black">صفحة المباراة</Link>
        {match.hasLiveAnimation ? <Link href={match.liveHref} className="rounded-xl border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-xs font-black text-sky-100">الملعب التفاعلي</Link> : null}
        <Link href={match.reportHref} className="rounded-xl border border-[#F8C846]/30 bg-[#F8C846]/10 px-3 py-2 text-xs font-black text-[#F8C846]">المقالات</Link>
        {match.hasStats ? <span className="mr-auto rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold text-slate-400">إحصائيات محفوظة</span> : null}
      </div>
    </article>
  );
}

export default function MatchesHubClient() {
  const [filter, setFilter] = useState<HubFilter>('today');
  const [group, setGroup] = useState('A');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<HubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ filter, group, limit: filter === 'all' ? '120' : filter === 'latest' ? '24' : '18' });
    if (query.trim()) params.set('q', query.trim());
    return `/api/matches-hub?${params.toString()}`;
  }, [filter, group, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(endpoint, { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('فشل تحميل المباريات')))
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(String(err?.message || err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint]);

  const matches = data?.matches || [];

  return (
    <main className="min-h-screen bg-[#04110D] px-3 py-5 text-white sm:px-5" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_70px_rgba(0,0,0,.30)] sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black text-[#18E58F]">مركز مباريات كأس العالم</p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">المباريات والنتائج</h1>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-400">
                صفحة خفيفة تعرض آخر المباريات والنتائج حسب اليوم أو المجموعة، وتفتح التفاصيل داخل صفحة المباراة فقط.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
              <SummaryCard label="المعروضة" value={data?.summary.total || 0} />
              <SummaryCard label="مباشر" value={data?.summary.live || 0} />
              <SummaryCard label="انتهت" value={data?.summary.finished || 0} />
              <SummaryCard label="قادمة" value={data?.summary.scheduled || 0} />
            </div>
          </div>
        </header>

        <section className="sticky top-0 z-30 rounded-[1.35rem] border border-white/10 bg-[#04110D]/95 p-3 shadow-xl backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MAIN_FILTERS.map((item) => (
              <FilterButton key={item.id} active={filter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}
              </FilterButton>
            ))}
            <FilterButton active={filter === 'group'} onClick={() => setFilter('group')}>
              المجموعات
            </FilterButton>
          </div>
          {filter === 'group' ? (
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">
              {GROUPS.map((item) => (
                <button
                  key={item}
                  onClick={() => setGroup(item)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    group === item ? 'border-[#F8C846]/50 bg-[#F8C846] text-black' : 'border-white/10 bg-white/[0.04] text-slate-200'
                  }`}
                >
                  Group {item}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم منتخب..."
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-[#18E58F]/40"
            />
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">
              {filter === 'today' ? 'مباريات اليوم' :
               filter === 'yesterday' ? 'مباريات أمس' :
               filter === 'tomorrow' ? 'مباريات الغد' :
               filter === 'latest' ? 'آخر النتائج' :
               filter === 'live' ? 'المباشر الآن' :
               filter === 'round_of_32' ? 'مباريات دور الـ 32' :
               filter === 'round_of_16' ? 'مباريات دور الـ 16' :
               filter === 'quarter_finals' ? 'مباريات ربع النهائي' :
               filter === 'semi_finals' ? 'مباريات نصف النهائي' :
               filter === 'final' ? 'النهائي والمركز الثالث' :
               filter === 'group' ? `مباريات Group ${group}` :
               'كل المباريات'}
            </h2>
            {loading ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">جاري التحميل...</span> : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm font-black text-rose-100">
              {error}
            </div>
          ) : null}

          {!loading && !error && !matches.length ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
              <p className="font-black text-white">لا توجد مباريات في هذا الفلتر</p>
              <p className="mt-2 text-sm font-bold text-slate-400">جرّب فلتر آخر أو ابحث باسم منتخب.</p>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
