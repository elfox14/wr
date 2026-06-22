'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock, FileText, Play, Radio } from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = { id?: string; name?: string; code?: string; image?: string; group?: string | null };
type Match = {
  id: string;
  status: string;
  displayStatus?: string | null;
  liveLabel?: string | null;
  matchDate: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  groupPhase?: string | null;
  group?: string | null;
  stage?: string | null;
  animationMatchId?: string | number | null;
  isStaleAutoFinished?: boolean;
};

type TabKey = 'today' | 'finished' | 'group';

const GROUPS = 'ABCDEFGHIJKL'.split('').map((key, index) => ({ key, label: String(index + 1).toLocaleString('ar-EG') }));
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET', 'BT', 'P'];

function normalizeStatus(match: Match) {
  return String(match.displayStatus || match.status || '').toUpperCase();
}

function isFinished(match: Match) {
  return FINISHED_STATUSES.includes(normalizeStatus(match)) || Boolean(match.isStaleAutoFinished);
}

function isLiveStatus(match: Match) {
  return !isFinished(match) && LIVE_STATUSES.includes(normalizeStatus(match));
}

function formatScoreNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'موعد غير متوفر';
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeGroupKey(value?: string | null) {
  if (!value) return 'غير محددة';
  const cleaned = value.replace(/^group[_\s-]*/i, '').replace('Group', '').replace('المجموعة', '').trim().toUpperCase();
  return cleaned || 'غير محددة';
}

function getMatchGroup(match: Match) {
  return normalizeGroupKey(match.groupPhase || match.group || match.stage || match.homeTeam?.group || match.awayTeam?.group);
}

function matchCenterHref(match: Match) {
  return `/match-center/${encodeURIComponent(String(match.id))}`;
}

function matchDigestHref(match: Match) {
  return `/match-digests/${encodeURIComponent(String(match.id))}`;
}

function teamImage(team?: Team | null) {
  const src = getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);
  if (src) return <img src={src} alt={`علم ${team?.name || team?.code || 'منتخب'}`} className="h-full w-full object-cover" loading="lazy" />;
  return <span className="text-xs font-black text-[#FFD700]">{team?.code || team?.name?.slice(0, 3) || '---'}</span>;
}

function TeamNameWithFlag({ team, fallback }: { team?: Team | null; fallback: string }) {
  return (
    <span className="inline-flex max-w-full items-center justify-center gap-1.5">
      <span className="inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] border border-white/10 bg-black/30">{teamImage(team)}</span>
      <span className="truncate">{team?.name || fallback}</span>
    </span>
  );
}

function RtlScore({ homeScore, awayScore }: { homeScore?: number | null; awayScore?: number | null }) {
  return <span className="inline-flex items-center gap-1.5 tabular-nums" dir="rtl"><span>{formatScoreNumber(homeScore)}</span><span className="text-[#FFD700]/70">-</span><span>{formatScoreNumber(awayScore)}</span></span>;
}

function SummaryCard({ icon, label, value, active, onClick }: { icon: ReactNode; label: string; value: number | string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-2xl border p-4 text-right transition ${active ? 'border-[#0FF0FC]/50 bg-[#0FF0FC]/10' : 'border-white/10 bg-white/[0.04] hover:border-white/20'}`}>
      <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-black/30 p-2 text-[#0FF0FC]">{icon}</div>
      <p className="text-2xl font-black text-white">{typeof value === 'number' ? value.toLocaleString('ar-EG') : value}</p>
      <p className="mt-1 text-xs font-bold text-gray-500">{label}</p>
    </button>
  );
}

function statusBadge(match: Match) {
  if (isFinished(match)) return <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">انتهت</span>;
  if (isLiveStatus(match)) return <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">{match.liveLabel || 'مباشر'}</span>;
  return <span className="rounded-full bg-[#FFD700]/15 px-3 py-1 text-xs font-black text-[#FFD700]">قادمة</span>;
}

function MatchCard({ match }: { match: Match }) {
  const group = getMatchGroup(match);
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.06]">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-gray-500">
        <span>{formatDateTime(match.matchDate)}</span>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">المجموعة {group}</span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div className="min-w-0">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">{teamImage(match.homeTeam)}</div>
          <p className="truncate text-sm font-black text-white"><TeamNameWithFlag team={match.homeTeam} fallback="الفريق الأول" /></p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xl font-black text-[#FFD700]">
          <RtlScore homeScore={match.homeScore} awayScore={match.awayScore} />
        </div>
        <div className="min-w-0">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">{teamImage(match.awayTeam)}</div>
          <p className="truncate text-sm font-black text-white"><TeamNameWithFlag team={match.awayTeam} fallback="الفريق الثاني" /></p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        {statusBadge(match)}
        <div className="flex gap-2">
          <Link href={matchCenterHref(match)} className="rounded-xl bg-[#0FF0FC] px-4 py-2 text-xs font-black text-black">مركز المباراة</Link>
          <Link href={matchDigestHref(match)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white"><FileText size={13} className="inline" /> ملخص</Link>
        </div>
      </div>
    </article>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [selectedGroup, setSelectedGroup] = useState('A');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    const group = params.get('group');
    if (filter === 'finished' || filter === 'group' || filter === 'today') setActiveTab(filter);
    if (group) setSelectedGroup(group.toUpperCase().slice(0, 1));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('filter', activeTab);
    if (activeTab === 'group') params.set('group', selectedGroup);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `/matches?${query}` : '/matches');
    setLoading(true);
    fetch(`/api/matches?${query}`, { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMatches(Array.isArray(data) ? data : []))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error(error);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeTab, selectedGroup]);

  const liveCount = useMemo(() => matches.filter(isLiveStatus).length, [matches]);
  const finishedCount = useMemo(() => matches.filter(isFinished).length, [matches]);
  const pageTitle = activeTab === 'finished' ? 'آخر ٤٠ مباراة منتهية' : activeTab === 'group' ? `مباريات المجموعة ${selectedGroup}` : 'مباريات اليوم';
  const pageHint = activeTab === 'finished'
    ? 'يعرض هذا التبويب آخر ٤٠ مباراة منتهية فقط لتقليل الضغط.'
    : activeTab === 'group'
      ? 'اضغط رقم المجموعة لتحديث القائمة بدون تحميل كل البطولة.'
      : 'الصفحة الافتراضية تعرض مباريات اليوم فقط.';

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir="rtl">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0FF0FC]">MC PRIME World Cup</p>
          <h1 className="mt-2 text-2xl font-black text-white">{pageTitle}</h1>
          <p className="mt-2 text-sm font-bold text-gray-400">{pageHint}</p>
        </section>

        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <SummaryCard icon={<CalendarDays size={18} />} label="مباريات اليوم" value="اليوم" active={activeTab === 'today'} onClick={() => setActiveTab('today')} />
          <SummaryCard icon={<CheckCircle2 size={18} />} label="انتهت ٤٠" value={finishedCount || '40'} active={activeTab === 'finished'} onClick={() => setActiveTab('finished')} />
          <SummaryCard icon={<Radio size={18} />} label="مباشرة في القائمة" value={liveCount} />
          <SummaryCard icon={<Clock size={18} />} label="المعروض الآن" value={matches.length} />
        </div>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-gray-400"><Play size={14} className="text-[#0FF0FC]" /> المجموعات — اضغط رقم المجموعة للاستدعاء</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {GROUPS.map((group) => (
              <button
                key={group.key}
                onClick={() => { setSelectedGroup(group.key); setActiveTab('group'); }}
                className={`min-w-12 rounded-2xl border px-4 py-3 text-sm font-black transition ${activeTab === 'group' && selectedGroup === group.key ? 'border-[#0FF0FC]/60 bg-[#0FF0FC]/15 text-[#0FF0FC]' : 'border-white/10 bg-black/30 text-white hover:border-white/30'}`}
              >
                {group.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : matches.length ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => <MatchCard key={match.id} match={match} />)}
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-10 text-center">
            <h2 className="text-2xl font-black text-white">لا توجد مباريات في هذا العرض</h2>
            <p className="mt-3 text-sm font-bold text-gray-500">جرب تاب انتهت ٤٠ أو اضغط رقم مجموعة آخر.</p>
          </section>
        )}
      </main>
    </div>
  );
}
