'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeLiveMatchTicker from '@/components/HomeLiveMatchTicker';
import HomeTournamentStatsCard from '@/components/HomeTournamentStatsCard';
import HomeGroupStandingsWidget from '@/components/HomeGroupStandingsWidget';
import HomeWorldCupRegionsArabCard from '@/components/HomeWorldCupRegionsArabCard';
import HomeTodayMatchesCard from '@/components/home/HomeTodayMatchesCard';
import HomeQualificationScenariosCard from '@/components/home/HomeQualificationScenariosCard';
import HomeSeoSection from '@/components/home/HomeSeoSection';
import HomeLastUpdatedStrip from '@/components/home/HomeLastUpdatedStrip';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
  continent?: string | null;
  group?: string | null;
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
const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const SECOND_HALF_STATUSES = ['2H'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');
const TEXT = {
  unknownTeam: '\u0645\u0646\u062a\u062e\u0628 \u063a\u064a\u0631 \u0645\u062d\u062f\u062f',
  firstHalf: '\u0627\u0644\u0634\u0648\u0637 \u0627\u0644\u0623\u0648\u0644',
  secondHalf: '\u0627\u0644\u0634\u0648\u0637 \u0627\u0644\u062b\u0627\u0646\u064a',
  extraTime: '\u0648\u0642\u062a \u0625\u0636\u0627\u0641\u064a',
  penalties: '\u0631\u0643\u0644\u0627\u062a \u0627\u0644\u062a\u0631\u062c\u064a\u062d',
  liveNow: '\u062c\u0627\u0631\u064a\u0629 \u0627\u0644\u0622\u0646',
  halfTime: '\u0627\u0633\u062a\u0631\u0627\u062d\u0629',
  worldCup: '\u0643\u0623\u0633 \u0627\u0644\u0639\u0627\u0644\u0645 2026',
  group: '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629',
  unavailableDate: '\u0645\u0648\u0639\u062f \u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631',
  waitingKickoff: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0628\u062f\u0627\u064a\u0629',
  waitingSource: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0635\u062f\u0631',
  liveCenter: '\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629',
  heroTitle: '\u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0643\u0623\u0633 \u0627\u0644\u0639\u0627\u0644\u0645 \u0627\u0644\u0622\u0646',
  interactive: '\u0627\u0644\u0628\u062b \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a',
  matchDetails: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629',
  noMatches: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0642\u0631\u064a\u0628\u0629 \u0644\u0644\u0639\u0631\u0636 \u0627\u0644\u0622\u0646.',
  showMatches: '\u0639\u0631\u0636 \u062c\u062f\u0648\u0644 \u0627\u0644\u0645\u0628\u0627\u0631\u064a\u0627\u062a',
  todayMatches: '\u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0627\u0644\u064a\u0648\u0645',
  standings: '\u0627\u0644\u062a\u0631\u062a\u064a\u0628',
  stats: '\u0627\u0644\u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a',
  latest: '\u0623\u062d\u062f\u062b \u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a',
  statsPending: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a \u0628\u0639\u062f \u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629',
};

function formatCount(value?: number | null, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
}

function formatScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '—';
}

function normalizeStatus(match?: HomeMatch | null) {
  return String(match?.displayStatus || match?.status || '').toUpperCase();
}

function teamLabel(team?: Team | null) {
  return team?.name || team?.code || TEXT.unknownTeam;
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
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
  return String(match?.id || match?.animationMatchId || `${teamLabel(match?.homeTeam)}-${teamLabel(match?.awayTeam)}-${match?.matchDate || ''}`);
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

function hasScoreData(match?: HomeMatch | null) {
  return typeof match?.homeScore === 'number' && Number.isFinite(match.homeScore) && typeof match?.awayScore === 'number' && Number.isFinite(match.awayScore);
}

function isWaitingForStartConfirmation(match: HomeMatch, now: Date) {
  return isScheduled(match) && hasKickoffPassed(match, now) && !isConfirmedLive(match) && !isHalfTime(match);
}

function displayMinute(match: HomeMatch) {
  if (isHalfTime(match) || isFinished(match)) return null;
  const minute = Number(match.minute);
  const status = normalizeStatus(match);
  if (SECOND_HALF_STATUSES.includes(status) && (!Number.isFinite(minute) || minute < 45)) return 45;
  if (!Number.isFinite(minute) || minute <= 0) return null;
  return Math.max(1, Math.min(150, Math.floor(minute)));
}

function liveStateLabel(match: HomeMatch) {
  const minute = displayMinute(match);
  const status = normalizeStatus(match);
  const minuteLabel = minute ? ` — د${formatCount(minute)}` : '';
  if (status === '1H') return `${TEXT.firstHalf}${minuteLabel}`;
  if (status === '2H') return `${TEXT.secondHalf}${minuteLabel}`;
  if (status === 'ET') return `${TEXT.extraTime}${minuteLabel}`;
  if (status === 'P' || status === 'PEN') return TEXT.penalties;
  return `${TEXT.liveNow}${minuteLabel}`;
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
  if (letter) return `${TEXT.group} ${formatCount(GROUP_LETTERS.indexOf(letter) + 1)}`;
  const number = raw.match(/(?:GROUP)?[_\s-]*(\d{1,2})/)?.[1];
  if (number) return `${TEXT.group} ${formatCount(Number(number))}`;
  return TEXT.worldCup;
}

function formatMatchDate(value?: string | Date | null) {
  if (!value) return TEXT.unavailableDate;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return TEXT.unavailableDate;
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function formatKickoffTime(value?: string | Date | null) {
  if (!value) return '—';
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
  const src = team?.image?.startsWith('http') ? team.image : getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);
  return (
    <Link href={getTeamHref(team)} className={`group/team flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition hover:border-[#FFD700]/25 hover:bg-white/[0.07] sm:border-transparent sm:bg-transparent sm:p-1.5 ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}>
      <span className="h-8 w-8 shrink-0 rounded-xl border border-white/10 bg-cover bg-center bg-no-repeat shadow-[0_8px_18px_rgba(0,0,0,0.22)] sm:h-9 sm:w-9" style={src ? { backgroundImage: `url(${src})` } : undefined}>
        {!src ? <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#FFD700]">{teamCode(team)}</span> : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-black leading-4 text-white sm:text-xs">{teamLabel(team)}</span>
        <span className="mt-0.5 block text-[9px] font-bold text-gray-500">{teamCode(team)}</span>
      </span>
    </Link>
  );
}

function ScoreBox({ value }: { value?: number | null }) {
  return <span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-[#FFD700]/35 bg-[#FFD700]/10 px-2 text-lg font-black leading-none text-[#FFD700] sm:h-10 sm:min-w-10 sm:text-xl" dir="ltr">{formatScore(value)}</span>;
}

function MatchScore({ match }: { match: HomeMatch }) {
  if (!isConfirmedLive(match) && !isHalfTime(match) && !isFinished(match)) {
    return <span className="flex h-11 min-w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/40 px-3 text-[11px] font-black text-[#FFD700]" dir="ltr">VS</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/40 px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" dir="rtl" aria-label="match score">
      <ScoreBox value={match.homeScore} />
      <span className="h-7 w-px rounded-full bg-white/15" />
      <ScoreBox value={match.awayScore} />
    </div>
  );
}

function MatchStatePill({ match, now }: { match: HomeMatch; now: Date }) {
  if (isFinished(match)) return <span className="rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-black text-gray-300">FT</span>;
  if (isHalfTime(match)) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">{TEXT.halfTime}</span>;
  if (isConfirmedLive(match)) return <span className="rounded-xl border border-[#00FF88]/25 bg-[#00FF88]/10 px-2.5 py-1.5 text-[11px] font-black text-[#00FF88]">{liveStateLabel(match)}</span>;
  if (isWaitingForStartConfirmation(match, now)) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">{TEXT.waitingKickoff}</span>;

  const parts = countdownParts(match, now);
  if (!parts.active) return <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1.5 text-[11px] font-black text-[#FFD700]">{TEXT.waitingSource}</span>;

  const visibleParts = parts.days > 0
    ? `${formatCount(parts.days)}ي ${formatCount(parts.hours)}س`
    : parts.hours > 0
      ? `${formatCount(parts.hours)}س ${formatCount(parts.minutes)}د`
      : `${formatCount(parts.minutes)}د ${formatCount(parts.seconds)}ث`;

  return (
    <span className="inline-flex items-center gap-1 rounded-xl border border-[#0FF0FC]/25 bg-[linear-gradient(90deg,rgba(15,240,252,.14),rgba(255,215,0,.10))] px-2.5 py-1.5 text-[11px] font-black text-[#BFFBFF] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
      <span className="text-[10px] leading-none">⏱</span>
      <span className="tabular-nums text-[#FFD700]">{visibleParts}</span>
    </span>
  );
}

function MatchDataNotice({ match }: { match: HomeMatch }) {
  const shouldWarn = (isConfirmedLive(match) || isHalfTime(match) || isFinished(match)) && !hasScoreData(match);
  if (!shouldWarn) return null;
  return <div className="mt-2 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-center text-[10px] font-black text-[#FFD700]">{TEXT.statsPending}</div>;
}

function MatchRow({ match, now, variant = 'normal' }: { match: HomeMatch; now: Date; variant?: 'live' | 'primary' | 'normal' }) {
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
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-center text-[10px] font-black text-gray-200">{formatMatchDate(match.matchDate)}</span>
        <span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-2.5 py-1 text-center text-[11px] font-black text-[#0FF0FC]">{formatKickoffTime(match.matchDate)}</span>
        <span className="flex justify-center sm:block"><MatchStatePill match={match} now={now} /></span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2.5">
        <TeamBadge team={match.homeTeam} align="right" />
        <MatchScore match={match} />
        <TeamBadge team={match.awayTeam} align="left" />
      </div>
      <MatchDataNotice match={match} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={getBroadcastHref(match)} className="mobile-tap inline-flex items-center justify-center rounded-xl bg-[#0FF0FC] px-3 py-2.5 text-center text-[11px] font-black text-black transition hover:bg-[#4AFAFF]">{TEXT.interactive}</Link>
        <Link href={getMatchHref(match)} className="mobile-tap inline-flex items-center justify-center rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2.5 text-center text-[11px] font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">{TEXT.matchDetails}</Link>
      </div>
    </article>
  );
}

function MatchCenter({ fallbackMatches = [], nextMatch = null, onUpdated }: { fallbackMatches?: HomeMatch[]; nextMatch?: HomeMatch | null; onUpdated?: (date: Date) => void }) {
  const [matches, setMatches] = useState<HomeMatch[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMatches() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/matches/live-card', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        const next = Array.isArray(data?.matches) ? data.matches : [];
        if (!cancelled) {
          const stamp = new Date();
          setMatches(next);
          setUpdatedAt(stamp);
          onUpdated?.(stamp);
        }
      } catch {
        if (!cancelled) setMatches([]);
      }
    }

    loadMatches();
    const timer = window.setInterval(loadMatches, MATCH_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [onUpdated]);

  const displayMatches = useMemo(() => {
    const source = matches.length ? matches : fallbackMatches;
    return uniqueMatches(source).sort((a, b) => {
      const aLive = isConfirmedLive(a) ? 0 : 1;
      const bLive = isConfirmedLive(b) ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return matchTime(a) - matchTime(b);
    }).slice(0, 5);
  }, [matches, fallbackMatches]);

  const primary = displayMatches[0] || nextMatch;
  const rest = displayMatches.filter((match) => matchKey(match) !== matchKey(primary)).slice(0, 4);

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[#FFD700]/15 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.10),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(0,0,0,0.22))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black text-[#0FF0FC]">{TEXT.liveCenter}</p>
          <h1 className="mt-0.5 text-lg font-black text-white sm:text-2xl">{TEXT.heroTitle}</h1>
        </div>
        <HomeLastUpdatedStrip updatedAt={updatedAt} compact />
      </div>
      {primary ? (
        <div className="space-y-3">
          <MatchRow match={primary} now={now} variant={isConfirmedLive(primary) ? 'live' : 'primary'} />
          {rest.length ? <div className="grid gap-2 sm:grid-cols-2">{rest.map((match) => <MatchRow key={matchKey(match)} match={match} now={now} />)}</div> : null}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-center">
          <p className="text-sm font-bold text-gray-300">{TEXT.noMatches}</p>
          <Link href="/matches" className="mt-3 inline-flex rounded-full bg-[#FFD700] px-4 py-2 text-xs font-black text-black">{TEXT.showMatches}</Link>
        </div>
      )}
    </section>
  );
}

function QuickHomeNav() {
  const items = [
    { href: '#today-matches', label: TEXT.todayMatches },
    { href: '#standings', label: TEXT.standings },
    { href: '#stats', label: TEXT.stats },
    { href: '#latest-analysis', label: TEXT.latest },
  ];

  return (
    <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="homepage quick links">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="mobile-tap rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-center text-[11px] font-black text-white transition hover:border-[#0FF0FC]/30 hover:bg-white/[0.075]">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default function HomeClientSportsLiveFocus({ upcomingMatches, tickerMatches, nextMarqueeMatch, playersCount, teamsCount, upcomingMatchesCount }: Props) {
  const safeUpcomingMatches = Array.isArray(upcomingMatches) ? (upcomingMatches as HomeMatch[]) : [];
  const safeTickerMatches = Array.isArray(tickerMatches) ? (tickerMatches as HomeMatch[]) : [];
  const safeNextMatch = nextMarqueeMatch as HomeMatch | null;
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const mergedHomeMatches = useMemo(() => uniqueMatches([...safeTickerMatches, ...safeUpcomingMatches, ...(safeNextMatch ? [safeNextMatch] : [])]), [safeTickerMatches, safeUpcomingMatches, safeNextMatch]);

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-4 px-3 pb-8 pt-3 sm:space-y-6 sm:px-4 sm:py-5 lg:px-6">
      <MatchCenter fallbackMatches={safeUpcomingMatches} nextMatch={safeNextMatch} onUpdated={setLastUpdatedAt} />
      <QuickHomeNav />
      <HomeLiveMatchTicker matches={safeTickerMatches} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start lg:gap-5">
        <div className="space-y-4 lg:col-span-2">
          <HomeTodayMatchesCard matches={mergedHomeMatches} updatedAt={lastUpdatedAt} />
          <HomeWorldCupRegionsArabCard />
        </div>
        <div id="standings" className="space-y-3 lg:col-span-1">
          <HomeGroupStandingsWidget compact />
          <HomeQualificationScenariosCard matches={mergedHomeMatches} />
        </div>
      </div>
      <div id="stats">
        <HomeTournamentStatsCard playersCount={playersCount} teamsCount={teamsCount} upcomingMatchesCount={upcomingMatchesCount} />
      </div>
      <HomeSeoSection />
    </main>
  );
}
