'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock, Filter, Play, Radio } from 'lucide-react';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = { id?: string; name?: string; code?: string; image?: string };
type Match = {
  id: string;
  status: string;
  displayStatus?: string | null;
  matchDate: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  groupPhase?: string;
  group?: string;
  stage?: string;
  animationMatchId?: string | number | null;
  isStaleAutoFinished?: boolean;
  events?: any[] | null;
};

const validFilters = ['all', 'yesterday', 'today', 'tomorrow', 'animation'];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;

function normalizeGroupKey(value?: string | null) {
  if (!value) return 'غير محددة';
  return value.replace(/^group[_\s-]*/i, '').replace('Group', '').replace('المجموعة', '').trim().toUpperCase();
}

function getMatchGroup(match: Match) {
  return normalizeGroupKey(match.groupPhase || match.group || match.stage);
}

function hasAnimation(match: Match) {
  return Boolean(match.animationMatchId);
}

function isGroupStage(match: Match) {
  const value = String(match.groupPhase || match.stage || '').toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: Match) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function elapsedMinutes(match: Match, now = new Date()) {
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now.getTime() - matchTime) / 60_000);
}

function isStaleLive(match: Match, now = new Date()) {
  const status = String(match.displayStatus || match.status || '').toUpperCase();
  if (!LIVE_STATUSES.includes(status)) return false;
  const elapsed = elapsedMinutes(match, now);
  if (elapsed === null) return false;
  return elapsed >= maxLiveMinutes(match);
}

function isFinished(match: Match, now = new Date()) {
  const value = String(match.displayStatus || match.status || '').toUpperCase();
  return FINISHED_STATUSES.includes(value) || Boolean(match.isStaleAutoFinished) || isStaleLive(match, now);
}

function isLiveStatus(match: Match, now = new Date()) {
  if (isFinished(match, now)) return false;
  const value = String(match.displayStatus || match.status || '').toUpperCase();
  return LIVE_STATUSES.includes(value);
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function isSameDay(value: string | Date, target: Date) {
  return startOfDay(new Date(value)).getTime() === startOfDay(target).getTime();
}

function formatScoreNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function RtlScore({ homeScore, awayScore }: { homeScore?: number | null; awayScore?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums" dir="rtl">
      <span>{formatScoreNumber(homeScore)}</span>
      <span className="text-[#FFD700]/70">-</span>
      <span>{formatScoreNumber(awayScore)}</span>
    </span>
  );
}

function teamImage(team?: Team | null) {
  const src = getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);
  if (src) return <img src={src} alt={`علم ${team?.name || team?.code || 'منتخب'}`} className="h-full w-full object-cover" loading="lazy" />;
  return <span className="text-xs font-black text-[#FFD700]">{team?.code || team?.name?.slice(0, 3) || '---'}</span>;
}

function TeamNameWithFlag({ team, fallback }: { team?: Team | null; fallback: string }) {
  return (
    <span className="inline-flex max-w-full items-center justify-center gap-1.5">
      <span className="inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] border border-white/10 bg-black/30">
        {teamImage(team)}
      </span>
      <span className="truncate">{team?.name || fallback}</span>
    </span>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');

  useEffect(() => {
    const filter = new URLSearchParams(window.location.search).get('filter');
    if (filter && validFilters.includes(filter)) setActiveTab(filter);

    fetch('/api/matches', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMatches(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const now = new Date();
  const today = now;
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const todayMatchesCount = matches.filter((m) => isSameDay(m.matchDate, today)).length;
  const liveMatchesCount = matches.filter((m) => isLiveStatus(m, now)).length;
  const upcomingMatchesCount = matches.filter((m) => String(m.status).toUpperCase() === 'SCHEDULED' && !isFinished(m, now)).length;
  const finishedMatchesCount = matches.filter((m) => isFinished(m, now)).length;
  const groupOptions = Array.from(new Set(matches.map(getMatchGroup).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const applySummaryFilter = (tab: string) => {
    setActiveTab(tab);
    setSelectedGroup('all');
    const url = tab === 'all' ? '/matches' : `/matches?filter=${encodeURIComponent(tab)}`;
    window.history.replaceState(null, '', url);
  };

  let filteredMatches = [...matches];
  if (activeTab === 'yesterday') filteredMatches = filteredMatches.filter((m) => isSameDay(m.matchDate, yesterday));
  if (activeTab === 'today') filteredMatches = filteredMatches.filter((m) => isSameDay(m.matchDate, today));
  if (activeTab === 'tomorrow') filteredMatches = filteredMatches.filter((m) => isSameDay(m.matchDate, tomorrow));
  if (activeTab === 'animation') filteredMatches = filteredMatches.filter((m) => hasAnimation(m) && !isFinished(m, now));
  if (selectedGroup !== 'all') filteredMatches = filteredMatches.filter((m) => getMatchGroup(m) === selectedGroup);
  filteredMatches.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  const tabs = [
    { id: 'all', label: 'الكل' },
    { id: 'yesterday', label: 'أمس' },
    { id: 'today', label: 'اليوم' },
    { id: 'tomorrow', label: 'غدًا' },
    { id: 'animation', label: 'بث تفاعلي' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir="rtl">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0FF0FC]">MC PRIME World Cup</p>
          <h1 className="text-xl font-black text-white md:text-2xl">مركز المباريات</h1>
          <p className="truncate whitespace-nowrap text-xs font-bold text-gray-400 md:text-sm">تابع المواعيد والنتائج وحالة كل مباراة.</p>
        </section>

        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <SummaryCard icon={<CalendarDays size={18} />} label="مباريات اليوم" value={todayMatchesCount} active={activeTab === 'today'} onClick={() => applySummaryFilter('today')} hint="فلتر اليوم" />
          <SummaryCard icon={<Play size={18} />} label="مباشرة الآن" value={liveMatchesCount} />
          <SummaryCard icon={<Clock size={18} />} label="المباريات المتبقية" value={upcomingMatchesCount} />
          <SummaryCard icon={<CheckCircle2 size={18} />} label="انتهت" value={finishedMatchesCount} />
        </div>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full gap-2 overflow-x-auto lg:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => applySummaryFilter(tab.id)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${
                  activeTab === tab.id ? 'bg-primary text-black' : 'border border-white/5 bg-surface text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-2">
            <Filter size={16} className="text-primary" />
            <span className="text-xs font-bold text-gray-500">المجموعة</span>
            <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)} className="bg-transparent text-sm font-bold text-white focus:outline-none">
              <option value="all">كل المجموعات</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  المجموعة {group}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredMatches.length === 0 ? (
          <EmptyMatches />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredMatches.map((match) => <MatchCard key={match.id} match={match} now={now} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ icon, label, value, active, onClick, href, hint }: { icon: ReactNode; label: string; value: number | string; active?: boolean; onClick?: () => void; href?: string; hint?: string }) {
  const interactive = Boolean(onClick || href);
  const className = `group flex min-h-[78px] flex-col items-center justify-center rounded-xl border p-2.5 text-center transition focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/40 md:min-h-[86px] md:p-3 ${
    interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[#0FF0FC]/35 hover:bg-white/[0.06]' : 'cursor-default'
  } ${active ? 'border-[#0FF0FC]/45 bg-[#0FF0FC]/10' : 'border-white/5 bg-surface'}`;
  const content = (
    <>
      <div className="mb-1 text-[#0FF0FC]">{icon}</div>
      <p className="mb-0.5 text-[9px] font-black uppercase tracking-wider text-gray-500 group-hover:text-gray-300 md:text-[10px]">{label}</p>
      <p className="text-lg font-black leading-none text-white md:text-xl">{value}</p>
      {hint ? <span className="mt-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] font-bold text-gray-400">{hint}</span> : null}
    </>
  );

  if (href) return <Link href={href} className={className}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${className} w-full`}>{content}</button>;
  return <div className={className}>{content}</div>;
}

function EmptyMatches() {
  return (
    <div className="rounded-3xl border border-white/5 bg-surface p-12 text-center">
      <CalendarDays size={64} className="mx-auto mb-6 text-gray-500" />
      <h2 className="mb-2 text-2xl font-bold text-white">لا توجد مباريات</h2>
      <p className="mx-auto max-w-md text-gray-400">لا توجد مباريات تطابق الفلتر الحالي.</p>
    </div>
  );
}

function MatchGoalscorers({ match }: { match: Match }) {
  const events = match.events || [];
  const goalEvents = events.filter(
    (e: any) => e.type === 'goal' || e.type === 'goal_inferred'
  );

  if (goalEvents.length === 0) return null;

  const homeGoals = goalEvents.filter((e: any) => {
    if (e.teamId) return String(e.teamId) === String(match.homeTeam?.id);
    if (e.teamName) return e.teamName === match.homeTeam?.name;
    return match.homeTeam?.name && e.detail?.includes(match.homeTeam.name);
  });

  const awayGoals = goalEvents.filter((e: any) => {
    if (e.teamId) return String(e.teamId) === String(match.awayTeam?.id);
    if (e.teamName) return e.teamName === match.awayTeam?.name;
    return match.awayTeam?.name && e.detail?.includes(match.awayTeam.name);
  });

  const formatScorer = (e: any) => {
    const minStr = e.minute ? ` ${e.minute}'` : '';
    if (!e.playerName) {
      if (e.detail && e.detail.includes('football-data.org')) {
        return `⚽ هدف${minStr}`;
      }
      return `⚽ ${e.detail || 'هدف'}${minStr}`;
    }
    return `⚽ ${e.playerName}${minStr}`;
  };

  return (
    <div className="mt-3.5 border-t border-white/5 pt-2.5 text-[10px] text-gray-400">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
        {/* Home scorers */}
        <div className="text-right space-y-0.5 min-w-0">
          {homeGoals.map((g: any, i: number) => (
            <div key={g.id || i} className="truncate" title={g.playerName || g.detail}>
              {formatScorer(g)}
            </div>
          ))}
        </div>

        {/* Divider icon */}
        <div className="flex items-start justify-center pt-0.5 opacity-30 select-none">
          <span>⚽</span>
        </div>

        {/* Away scorers */}
        <div className="text-left space-y-0.5 min-w-0">
          {awayGoals.map((g: any, i: number) => (
            <div key={g.id || i} className="truncate" title={g.playerName || g.detail}>
              {formatScorer(g)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, now }: { match: Match; now: Date }) {
  const live = isLiveStatus(match, now);
  const finished = isFinished(match, now);
  const scoreVisible = live || finished;
  const matchCenterHref = `/match-center/${encodeURIComponent(String(match.id))}`;
  const title = `${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'}`;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-4 transition hover:-translate-y-0.5 hover:border-[#0FF0FC]/35 hover:bg-white/[0.04]">
      <Link href={matchCenterHref} aria-label={`فتح مركز مباراة ${title}`} className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/40" />

      <div className="relative z-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded px-2 py-1 text-[11px] font-bold ${live ? 'bg-emerald-400/10 text-emerald-300' : finished ? 'bg-gray-500/10 text-gray-400' : 'bg-orange-400/10 text-orange-300'}`}>
            {live ? 'مباشرة' : finished ? 'انتهت' : 'قريبًا'}
          </span>
          <span className="text-[11px] text-gray-400">{new Date(match.matchDate).toLocaleString('ar-EG')}</span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40 md:h-14 md:w-14">
              {teamImage(match.homeTeam)}
            </div>
            <h2 className="line-clamp-1 text-sm font-black text-white md:text-base">
              <TeamNameWithFlag team={match.homeTeam} fallback="الفريق الأول" />
            </h2>
          </div>

          <div className="rounded-xl border border-white/10 bg-black px-3 py-2 text-lg font-black text-[#FFD700] md:text-xl">
            {scoreVisible ? <RtlScore homeScore={match.homeScore} awayScore={match.awayScore} /> : 'VS'}
          </div>

          <div>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40 md:h-14 md:w-14">
              {teamImage(match.awayTeam)}
            </div>
            <h2 className="line-clamp-1 text-sm font-black text-white md:text-base">
              <TeamNameWithFlag team={match.awayTeam} fallback="الفريق الثاني" />
            </h2>
          </div>
        </div>

        {/* Goal scorers section */}
        <MatchGoalscorers match={match} />
      </div>

      {hasAnimation(match) && !finished ? (
        <Link
          href={`/animation-live/player?matchId=${encodeURIComponent(String(match.animationMatchId))}&dbMatchId=${encodeURIComponent(String(match.id))}`}
          className="relative z-20 mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-2.5 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black"
        >
          <Radio size={15} /> دخول البث التفاعلي
        </Link>
      ) : null}
    </article>
  );
}
