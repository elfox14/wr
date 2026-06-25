'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeTournamentStatsCard from '@/components/HomeTournamentStatsCard';
import HomeLiveMatchTicker from '@/components/HomeLiveMatchTicker';
import HomeGroupStandingsWidget from '@/components/HomeGroupStandingsWidget';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
  flagUrl?: string | null;
};

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
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  isLiveNow?: boolean;
  isHalfTime?: boolean;
  isLikelyLiveByTime?: boolean;
  isStaleAutoFinished?: boolean;
  minute?: number | null;
  liveLabel?: string | null;
};

type Props = {
  upcomingMatches?: HomeMatch[] | unknown[];
  tickerMatches?: HomeMatch[] | unknown[];
  nextMarqueeMatch?: HomeMatch | null | unknown;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

const MATCH_REFRESH_MS = 15_000;
const LIVE_POLL_LOOKBACK_MS = 3 * 60 * 60 * 1000;
const LIVE_POLL_LOOKAHEAD_MS = 30 * 60 * 1000;
const COUNTDOWN_FAST_WINDOW_MS = 10 * 60 * 1000;
const COUNTDOWN_SLOW_REFRESH_MS = 60_000;
const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const SECOND_HALF_STATUSES = ['2H'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED', 'COMPLETED', 'FINAL_VERIFIED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');

function formatCount(value?: number | null, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
}

function formatScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '0';
}

function normalizeStatus(match?: HomeMatch | null) {
  return String(match?.displayStatus || match?.status || '').toUpperCase();
}

function teamLabel(team?: Team | null) {
  if (!team) return 'منتخب غير محدد';
  return getArabicTeamName(team.code, team.name);
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
}

function teamFlag(team?: Team | null) {
  const name = teamLabel(team);
  return team?.flagUrl || getTeamFlagUrl({ code: team?.code, name, image: null }, 96) || team?.image || null;
}

function getTeamHref(team?: Team | null) {
  return team?.id ? `/teams/${encodeURIComponent(String(team.id))}` : '/teams';
}

function getMatchHref(match: HomeMatch) {
  return match.id ? `/matches/${encodeURIComponent(String(match.id))}` : '/matches';
}

function getBroadcastHref(match: HomeMatch) {
  return match.id ? `/match-center/${encodeURIComponent(String(match.id))}` : getMatchHref(match);
}

function matchKey(match?: HomeMatch | null) {
  return String(match?.id || `${teamLabel(match?.homeTeam)}-${teamLabel(match?.awayTeam)}-${match?.matchDate || ''}`);
}

function matchTime(match: HomeMatch) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  return date && Number.isFinite(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function minutesSinceKickoff(match: HomeMatch, now: Date) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 60_000) + 1;
}

function hasKickoffPassed(match: HomeMatch, now: Date) {
  const minutes = minutesSinceKickoff(match, now);
  return minutes !== null && minutes >= 1;
}

function isFinished(match?: HomeMatch | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isStaleAutoFinished);
}

function isHalfTime(match?: HomeMatch | null) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isHalfTime);
}

function isScheduled(match?: HomeMatch | null) {
  return !isFinished(match) && SCHEDULED_STATUSES.includes(normalizeStatus(match));
}

function isConfirmedLive(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return !isFinished(match) && !isHalfTime(match) && (LIVE_STATUSES.includes(status) || Boolean(match?.isLiveNow) || Boolean(match?.isLikelyLiveByTime));
}

function isWaitingForStartConfirmation(match: HomeMatch, now: Date) {
  return isScheduled(match) && hasKickoffPassed(match, now) && !isConfirmedLive(match) && !isHalfTime(match);
}

function shouldPollLiveCard(matches: HomeMatch[]) {
  const now = Date.now();
  return matches.some((match) => {
    if (!match || isFinished(match)) return false;
    if (isConfirmedLive(match) || isHalfTime(match)) return true;
    const time = matchTime(match);
    if (!Number.isFinite(time)) return false;
    return time >= now - LIVE_POLL_LOOKBACK_MS && time <= now + LIVE_POLL_LOOKAHEAD_MS;
  });
}

function countdownRefreshMs(match: HomeMatch | null, now: Date) {
  if (!match || isFinished(match)) return null;
  if (isConfirmedLive(match) || isHalfTime(match) || isWaitingForStartConfirmation(match, now)) return 1000;
  const diffMs = matchTime(match) - now.getTime();
  return diffMs > 0 && diffMs <= COUNTDOWN_FAST_WINDOW_MS ? 1000 : COUNTDOWN_SLOW_REFRESH_MS;
}

function displayMinute(match: HomeMatch) {
  if (isHalfTime(match) || isFinished(match)) return null;
  const minute = Number(match.minute);
  const status = normalizeStatus(match);
  if (SECOND_HALF_STATUSES.includes(status) && (!Number.isFinite(minute) || minute < 45)) return 45;
  if (!Number.isFinite(minute) || minute <= 0) return null;
  return Math.max(1, Math.min(150, Math.floor(minute)));
}

function uniqueMatches(list: HomeMatch[]) {
  const seen = new Set<string>();
  return list.filter((match) => {
    const key = matchKey(match);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupNumberLabel(match: HomeMatch) {
  const raw = String(match.groupPhase || match.group || match.stage || '').trim().toUpperCase();
  const letter = raw.match(/GROUP[_\s-]*([A-L])/)?.[1] || (/^[A-L]$/.test(raw) ? raw : '');
  if (letter) return `المجموعة ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`;
  const number = raw.match(/(?:GROUP|المجموعة)?[_\s-]*(\d{1,2})/)?.[1];
  if (number) return `المجموعة ${formatCount(Number(number))}`;
  return 'كأس العالم 2026';
}

function formatMatchDate(value?: string | Date | null, mounted?: boolean) {
  if (!value) return 'موعد غير متوفر';
  if (mounted === false) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'موعد غير متوفر';
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function formatKickoffTime(value?: string | Date | null, mounted?: boolean) {
  if (!value) return '—';
  if (mounted === false) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function countdownParts(match: HomeMatch, now: Date) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  const diffMs = date && Number.isFinite(date.getTime()) ? date.getTime() - now.getTime() : 0;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  return {
    active: diffMs > 0,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function TeamBadge({ team, align }: { team?: Team | null; align: 'right' | 'left' }) {
  const name = teamLabel(team);
  const src = teamFlag(team);
  return (
    <Link href={getTeamHref(team)} className={`group/team flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition hover:border-[#FFD700]/25 hover:bg-white/[0.07] sm:border-transparent sm:bg-transparent sm:p-1.5 ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}>
      <span className="h-8 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40 shadow-[0_8px_18px_rgba(0,0,0,0.22)] sm:h-9 sm:w-12">
        {src ? <img src={src} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#FFD700]">{teamCode(team)}</span>}
      </span>
      <span className="min-w-0">
        <span className="team-name-full block text-[11px] font-black leading-4 text-white sm:text-xs">{name}</span>
        <span className="mt-0.5 block text-[9px] font-bold text-gray-500">{teamCode(team)}</span>
      </span>
    </Link>
  );
}

function ScoreBox({ value }: { value?: number | null }) {
  return <span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-[#FFD700]/35 bg-[#FFD700]/10 px-2 text-lg font-black leading-none text-[#FFD700] sm:h-10 sm:min-w-10 sm:text-xl" dir="ltr">{formatScore(value)}</span>;
}

function MatchScore({ match }: { match: HomeMatch }) {
  return (
    <div className="flex items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/40 px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" dir="rtl" aria-label="النتيجة: صاحب الأرض يمين والضيف يسار">
      <ScoreBox value={match.homeScore} />
      <span className="h-7 w-px rounded-full bg-white/15" />
      <ScoreBox value={match.awayScore} />
    </div>
  );
}

function MatchStatePill({ match, now, mounted }: { match: HomeMatch; now: Date; mounted: boolean }) {
  if (isFinished(match)) return <span className="rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-black text-gray-300">انتهت</span>;
  if (isHalfTime(match)) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">استراحة</span>;
  if (isConfirmedLive(match)) {
    if (match.liveLabel) return <span className="rounded-xl border border-[#00FF88]/25 bg-[#00FF88]/10 px-2.5 py-1.5 text-[11px] font-black text-[#00FF88]">{match.liveLabel}</span>;
    const minute = displayMinute(match);
    const label = minute ? `جارية الآن - د${formatCount(minute)}` : 'جارية الآن';
    return <span className="rounded-xl border border-[#00FF88]/25 bg-[#00FF88]/10 px-2.5 py-1.5 text-[11px] font-black text-[#00FF88]">{label}</span>;
  }
  if (isWaitingForStartConfirmation(match, now)) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">بانتظار تأكيد البداية</span>;
  if (!mounted) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">قريباً</span>;
  const parts = countdownParts(match, now);
  if (!parts.active) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">بانتظار المصدر</span>;
  const visibleParts = parts.days > 0 ? `${formatCount(parts.days)}ي ${formatCount(parts.hours)}س` : parts.hours > 0 ? `${formatCount(parts.hours)}س ${formatCount(parts.minutes)}د` : `${formatCount(parts.minutes)}د ${formatCount(parts.seconds)}ث`;
  return <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-2.5 py-1.5 text-[11px] font-black text-[#0FF0FC]"><span className="h-1.5 w-1.5 rounded-full bg-[#0FF0FC] shadow-[0_0_12px_rgba(15,240,252,0.8)]" /> بعد {visibleParts}</span>;
}

function MatchRow({ match, now, mounted, variant = 'normal' }: { match: HomeMatch; now: Date; mounted: boolean; variant?: 'live' | 'primary' | 'normal' }) {
  const isPrimary = variant === 'primary' || variant === 'live';
  const shell = variant === 'live'
    ? 'border-[#00FF88]/25 bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.12),transparent_34%),rgba(0,0,0,0.30)]'
    : isPrimary
      ? 'border-[#FFD700]/25 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.12),transparent_34%),rgba(0,0,0,0.30)]'
      : 'border-white/10 bg-black/25 hover:border-[#0FF0FC]/30';

  return (
    <article className={`relative overflow-hidden rounded-[1.35rem] border p-3 transition sm:rounded-3xl sm:p-3.5 ${shell}`}>
      {isPrimary ? <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/60 to-transparent" /> : null}
      <div className="mb-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1 text-center text-[10px] font-black text-[#FFD700]">{groupNumberLabel(match)}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-center text-[10px] font-black text-gray-200">{formatMatchDate(match.matchDate, mounted)}</span>
        <span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-2.5 py-1 text-center text-[11px] font-black text-[#0FF0FC]">{formatKickoffTime(match.matchDate, mounted)}</span>
        <span className="flex justify-center sm:block"><MatchStatePill match={match} now={now} mounted={mounted} /></span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2.5">
        <TeamBadge team={match.homeTeam} align="right" />
        <MatchScore match={match} />
        <TeamBadge team={match.awayTeam} align="left" />
      </div>
      <div className="mt-3">
        <Link href={getBroadcastHref(match)} className="mobile-tap inline-flex w-full items-center justify-center rounded-xl bg-[#0FF0FC] px-3 py-2.5 text-center text-[11px] font-black text-black transition hover:bg-[#4AFAFF]">البث التفاعلي</Link>
      </div>
    </article>
  );
}

function MatchCenter({ fallbackMatches = [], nextMatch = null, liveMatches = [] }: { fallbackMatches?: HomeMatch[]; nextMatch?: HomeMatch | null; liveMatches?: HomeMatch[] }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => setMounted(true), []);

  const mergedMatches = useMemo(() => uniqueMatches([...(liveMatches.length ? liveMatches : []), ...(nextMatch ? [nextMatch] : []), ...(liveMatches.length ? [] : fallbackMatches)]), [liveMatches, nextMatch, fallbackMatches]);
  const sortedMatches = useMemo(() => [...mergedMatches].sort((a, b) => matchTime(a) - matchTime(b)), [mergedMatches]);
  const confirmedLiveMatch = sortedMatches.find((match) => isConfirmedLive(match) || isHalfTime(match)) || null;
  const waitingMatch = sortedMatches.find((match) => isWaitingForStartConfirmation(match, now)) || null;
  const nextScheduledMatch = sortedMatches.find((match) => isScheduled(match) && !isWaitingForStartConfirmation(match, now) && !isConfirmedLive(match)) || null;
  const primaryMatch = confirmedLiveMatch || waitingMatch || nextScheduledMatch || sortedMatches.find((match) => !isFinished(match)) || sortedMatches[0] || null;
  const primaryKey = primaryMatch ? matchKey(primaryMatch) : null;
  const refreshMs = countdownRefreshMs(primaryMatch, now);
  const secondaryMatches = sortedMatches.filter((match) => matchKey(match) !== primaryKey).filter((match) => isScheduled(match) && !isWaitingForStartConfirmation(match, now) && !isConfirmedLive(match) && matchTime(match) >= now.getTime()).slice(0, 2);

  useEffect(() => {
    if (!refreshMs) return;
    const timer = window.setInterval(() => setNow(new Date()), refreshMs);
    return () => window.clearInterval(timer);
  }, [primaryKey, refreshMs]);

  return (
    <section className="flex h-auto flex-col overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:rounded-3xl sm:p-4" aria-label="مباريات كأس العالم">
      <div className="flex flex-col gap-4">
        <div>{primaryMatch ? <MatchRow match={primaryMatch} now={now} mounted={mounted} variant={isConfirmedLive(primaryMatch) || isHalfTime(primaryMatch) ? 'live' : 'primary'} /> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400">لا توجد مباراة رئيسية جاهزة للعرض الآن.</div>}</div>
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">المباراتان القادمتان</div>
          <div className="grid gap-3 md:grid-cols-2">
            {secondaryMatches.map((match) => <MatchRow key={matchKey(match)} match={match} now={now} mounted={mounted} />)}
            {!secondaryMatches.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-400 md:col-span-2">لا توجد مباريات قادمة إضافية جاهزة للعرض الآن.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeClientSportsLiveFocus({ upcomingMatches = [], tickerMatches = [], nextMarqueeMatch = null, playersCount = 0, teamsCount = 0, upcomingMatchesCount = 0 }: Props) {
  const safeUpcomingMatches = Array.isArray(upcomingMatches) ? (upcomingMatches as HomeMatch[]) : [];
  const safeTickerMatches = Array.isArray(tickerMatches) ? (tickerMatches as HomeMatch[]) : [];
  const safeNextMatch = nextMarqueeMatch as HomeMatch | null;
  const pollSeedMatches = useMemo(() => uniqueMatches([...safeUpcomingMatches, ...safeTickerMatches, ...(safeNextMatch ? [safeNextMatch] : [])]), [safeUpcomingMatches, safeTickerMatches, safeNextMatch]);
  const livePollingEnabled = useMemo(() => shouldPollLiveCard(pollSeedMatches), [pollSeedMatches]);
  const [liveCardMatches, setLiveCardMatches] = useState<HomeMatch[]>([]);

  useEffect(() => {
    if (!livePollingEnabled) return;

    let cancelled = false;
    async function loadMatches() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/matches/live-card', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.matches) ? data.matches : [];
        if (!cancelled) setLiveCardMatches(list);
      } catch {
        // Keep server fallback matches.
      }
    }

    loadMatches();
    const timer = window.setInterval(loadMatches, MATCH_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [livePollingEnabled]);

  const tickerDisplayMatches = useMemo(() => uniqueMatches([...(liveCardMatches.length ? liveCardMatches : []), ...safeTickerMatches]).slice(0, 8), [liveCardMatches, safeTickerMatches]);

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-4 px-3 pb-8 pt-3 sm:space-y-6 sm:px-4 sm:py-5 lg:px-6">
      <HomeLiveMatchTicker matches={tickerDisplayMatches} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start lg:gap-5">
        <div className="lg:col-span-2"><MatchCenter fallbackMatches={safeUpcomingMatches} nextMatch={safeNextMatch} liveMatches={liveCardMatches} /></div>
        <div className="lg:col-span-1"><HomeGroupStandingsWidget compact /></div>
      </div>
      <HomeTournamentStatsCard playersCount={playersCount} teamsCount={teamsCount} upcomingMatchesCount={upcomingMatchesCount} />
    </main>
  );
}
