'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeClientSportsNext from '@/components/HomeClientSportsNext';
import HomeTournamentStatsCard from '@/components/HomeTournamentStatsCard';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
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
  minute?: number | null;
  liveLabel?: string | null;
};

type Props = {
  upcomingMatches?: HomeMatch[];
  upcomingMatchesCount?: number;
  playersCount?: number;
  teamsCount?: number;
  [key: string]: unknown;
};

function formatCount(value?: number, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
}

function teamLabel(team?: Team | null) {
  return team?.name || team?.code || 'منتخب غير محدد';
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
}

function formatMatchDate(value?: string | Date | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'موعد غير متوفر';

  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeStatus(match?: HomeMatch | null) {
  return String(match?.displayStatus || match?.status || '').toUpperCase();
}

function matchGroup(match: HomeMatch) {
  return match.groupPhase || match.group || match.stage || 'كأس العالم 2026';
}

function matchTime(match: HomeMatch) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function elapsedMinutes(match: HomeMatch, now: Date) {
  const start = match.matchDate ? new Date(match.matchDate) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  return Math.floor((now.getTime() - start.getTime()) / 60_000);
}

function isGroupStage(match: HomeMatch) {
  const group = String(match.groupPhase || match.group || match.stage || '').toUpperCase();
  return group.includes('GROUP');
}

function isOfficialFinished(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return ['FINISHED', 'FT', 'AET', 'PEN'].includes(status);
}

function isScheduled(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(status);
}

function isStaleLive(match: HomeMatch, now: Date) {
  const elapsed = elapsedMinutes(match, now);
  if (elapsed === null) return false;
  const maxMinutes = isGroupStage(match) ? 115 : 150;
  return elapsed >= maxMinutes || (typeof match.minute === 'number' && match.minute >= maxMinutes);
}

function isLive(match: HomeMatch, now: Date) {
  if (isOfficialFinished(match) || isStaleLive(match, now)) return false;
  const status = normalizeStatus(match);
  return status === 'IN_PLAY' || status === 'LIVE' || status === 'HT' || Boolean(match.isLiveNow && !match.isLikelyLiveByTime);
}

function isFinished(match: HomeMatch, now: Date) {
  return isOfficialFinished(match) || isStaleLive(match, now);
}

function isSameCalendarDay(value?: string | Date | null, target = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function countdownParts(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function compactCountdownLabel(diffMs: number) {
  const parts = countdownParts(diffMs);
  if (parts.days > 0) return `بعد ${formatCount(parts.days)}ي ${formatCount(parts.hours)}س`;
  if (parts.hours > 0) return `بعد ${formatCount(parts.hours)}س ${formatCount(parts.minutes)}د`;
  return `بعد ${formatCount(parts.minutes)}د ${formatCount(parts.seconds)}ث`;
}

function matchTiming(match: HomeMatch, now: Date) {
  if (isFinished(match, now)) return { label: 'انتهت', live: false, waiting: false };
  if (isLive(match, now)) return { label: normalizeStatus(match) === 'HT' ? 'استراحة' : match.liveLabel || 'مباشر الآن', live: true, waiting: false };

  const date = match.matchDate ? new Date(match.matchDate) : null;
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
  if (!validDate) return { label: 'بانتظار المصدر', live: false, waiting: true };

  const diffMs = validDate.getTime() - now.getTime();
  if (diffMs > 0) return { label: compactCountdownLabel(diffMs), live: false, waiting: false };

  return { label: 'بانتظار تأكيد البداية', live: false, waiting: true };
}

function matchClock(match: HomeMatch, now: Date) {
  if (!isLive(match, now)) return null;
  if (typeof match.minute === 'number' && Number.isFinite(match.minute) && match.minute > 0) {
    return `${formatCount(Math.min(Math.floor(match.minute), 115))}′`;
  }

  const elapsed = elapsedMinutes(match, now);
  if (!elapsed || elapsed < 1) return null;
  return `${formatCount(Math.min(elapsed, isGroupStage(match) ? 115 : 150))}′`;
}

function getMatchHref(match: HomeMatch) {
  return match.id ? `/matches/${encodeURIComponent(String(match.id))}` : '/matches';
}

function getInteractiveHref(match: HomeMatch) {
  return match.animationMatchId
    ? `/animation-live?matchId=${encodeURIComponent(String(match.animationMatchId))}&lang=en&statsPanel=simple&teamPanel=1`
    : '/animation-live';
}

function TeamFlag({ team }: { team?: Team | null }) {
  const src = getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);
  return (
    <div className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.07]">
      {src ? (
        <img src={src} alt={`علم ${teamLabel(team)}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-xs font-black text-[#FFD700]">{teamCode(team)}</span>
      )}
    </div>
  );
}

function TeamScoreBadge({ team, score, align }: { team?: Team | null; score?: number | null; align: 'right' | 'left' }) {
  return (
    <div className={`mb-1.5 inline-flex items-center gap-1.5 ${align === 'left' ? 'flex-row-reverse' : ''}`}>
      <TeamFlag team={team} />
      <span className="flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 text-sm font-black text-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.08)]">
        {typeof score === 'number' && Number.isFinite(score) ? formatCount(score) : '—'}
      </span>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex min-w-[2.25rem] flex-col items-center justify-center rounded-lg border border-[#FFD700]/20 bg-black/25 px-1.5 py-1 leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className="text-[12px] font-black text-white">{formatCount(value)}</span>
      <span className="mt-0.5 text-[8px] font-black text-[#FFD700]">{label}</span>
    </span>
  );
}

function UpcomingCountdown({ diffMs }: { diffMs: number }) {
  const parts = countdownParts(diffMs);
  const units = parts.days > 0
    ? [
        { value: parts.days, label: 'يوم' },
        { value: parts.hours, label: 'س' },
        { value: parts.minutes, label: 'د' },
      ]
    : parts.hours > 0
      ? [
          { value: parts.hours, label: 'س' },
          { value: parts.minutes, label: 'د' },
          { value: parts.seconds, label: 'ث' },
        ]
      : [
          { value: parts.minutes, label: 'د' },
          { value: parts.seconds, label: 'ث' },
        ];

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-[#FFD700]/30 bg-[linear-gradient(135deg,rgba(255,215,0,0.16),rgba(15,240,252,0.08))] px-2 py-1.5 shadow-[0_0_22px_rgba(255,215,0,0.08)]">
      <span className="inline-flex items-center gap-1 text-[9px] font-black text-[#FFD700]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD700]" />
        تبدأ بعد
      </span>
      <span className="flex items-center gap-1">
        {units.map((unit) => <CountdownUnit key={unit.label} value={unit.value} label={unit.label} />)}
      </span>
    </span>
  );
}

function InlineMatchTimer({ match, now }: { match: HomeMatch; now: Date }) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
  const diffMs = validDate ? validDate.getTime() - now.getTime() : 0;

  if (diffMs > 0 && !isLive(match, now) && !isFinished(match, now)) {
    return <UpcomingCountdown diffMs={diffMs} />;
  }

  const timing = matchTiming(match, now);
  const clock = matchClock(match, now);

  return (
    <span className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-center text-[11px] font-black ${timing.live ? 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' : timing.waiting ? 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
      <span className="min-w-0 truncate">{timing.label}</span>
      {clock ? <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] text-white">{clock}</span> : null}
    </span>
  );
}

function MatchCard({ match, now }: { match: HomeMatch; now: Date }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1 text-[11px] font-black text-[#FFD700]">{matchGroup(match)}</span>
        <InlineMatchTimer match={match} now={now} />
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-gray-300">{formatMatchDate(match.matchDate)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 text-right">
          <TeamScoreBadge team={match.homeTeam} score={match.homeScore} align="right" />
          <h3 className="truncate text-sm font-black text-white">{teamLabel(match.homeTeam)}</h3>
          <p className="mt-0.5 text-[11px] font-bold text-gray-500">{teamCode(match.homeTeam)}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-xs font-black text-[#0FF0FC]">
          ضد
        </div>

        <div className="min-w-0 text-left">
          <TeamScoreBadge team={match.awayTeam} score={match.awayScore} align="left" />
          <h3 className="truncate text-sm font-black text-white">{teamLabel(match.awayTeam)}</h3>
          <p className="mt-0.5 text-[11px] font-bold text-gray-500">{teamCode(match.awayTeam)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={getMatchHref(match)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-[11px] font-black text-gray-200 transition hover:bg-white/[0.1]">
          تفاصيل المباراة
        </Link>
        <Link href={getInteractiveHref(match)} className="rounded-xl bg-[#0FF0FC] px-3 py-2 text-center text-[11px] font-black text-black transition hover:bg-[#4AFAFF]">
          البث التفاعلي
        </Link>
      </div>
    </article>
  );
}

function FixedMatchCenter({ fallbackMatches = [], upcomingMatchesCount = 0 }: { fallbackMatches?: HomeMatch[]; upcomingMatchesCount?: number }) {
  const [matches, setMatches] = useState<HomeMatch[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      try {
        const response = await fetch('/api/matches', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.matches) ? data.matches : [];
        if (!cancelled && list.length) setMatches(list);
      } catch {
        // Keep fallback matches if the full matches endpoint is unavailable.
      }
    }

    loadMatches();
    const timer = window.setInterval(loadMatches, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const sourceMatches = matches.length ? matches : fallbackMatches;
  const todayCount = sourceMatches.filter((match) => isSameCalendarDay(match.matchDate, now)).length;
  const liveCount = sourceMatches.filter((match) => isLive(match, now)).length;
  const upcomingCount = matches.length ? sourceMatches.filter((match) => isScheduled(match) && !isFinished(match, now)).length : upcomingMatchesCount;
  const finishedCount = sourceMatches.filter((match) => isFinished(match, now)).length;

  const featuredMatches = useMemo(() => {
    const sorted = [...sourceMatches].sort((a, b) => matchTime(a) - matchTime(b));
    const priority = [
      ...sorted.filter((match) => isLive(match, now)),
      ...sorted.filter((match) => !isLive(match, now) && isSameCalendarDay(match.matchDate, now) && !isFinished(match, now)),
      ...sorted.filter((match) => !isLive(match, now) && !isSameCalendarDay(match.matchDate, now) && isScheduled(match)),
      ...sorted.filter((match) => isFinished(match, now)),
    ];
    const seen = new Set<string>();
    return priority.filter((match) => {
      const key = String(match.id || `${teamLabel(match.homeTeam)}-${teamLabel(match.awayTeam)}-${match.matchDate || ''}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }, [sourceMatches, now]);

  return (
    <section className="mx-auto mb-4 max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:p-4" aria-label="مركز المباريات المصحح">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-white md:text-lg">مركز المباريات</h2>
        <Link href="/matches" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-black text-white transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.14]">عرض الكل</Link>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        <Link href="/matches?filter=today" className="rounded-xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(todayCount)}</div><div className="text-[10px] font-black text-white">اليوم</div></Link>
        <Link href="/matches?filter=live" className="rounded-xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(liveCount)}</div><div className="text-[10px] font-black text-white">مباشر</div></Link>
        <Link href="/matches?filter=upcoming" className="rounded-xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(upcomingCount)}</div><div className="text-[10px] font-black text-white">متبقية</div></Link>
        <Link href="/matches?filter=finished" className="rounded-xl border border-white/10 bg-black/25 p-2 text-center transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"><div className="text-lg font-black text-[#FFD700]">{formatCount(finishedCount)}</div><div className="text-[10px] font-black text-white">انتهت</div></Link>
      </div>

      {featuredMatches.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featuredMatches.map((match, index) => (
            <div key={match.id || index} className={index === 0 ? '' : 'hidden sm:block'}>
              <MatchCard match={match} now={now} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs font-bold leading-6 text-gray-400">لا توجد مباراة جاهزة للعرض الآن. سيظهر هنا أقرب لقاء عند تحديث مركز المباريات.</div>
      )}
    </section>
  );
}

export default function HomeClientSportsNextFixed(props: Props) {
  return (
    <>
      <FixedMatchCenter fallbackMatches={props.upcomingMatches || []} upcomingMatchesCount={props.upcomingMatchesCount || 0} />
      <HomeTournamentStatsCard playersCount={props.playersCount} teamsCount={props.teamsCount} upcomingMatchesCount={props.upcomingMatchesCount || 0} />
      <style jsx global>{`
        section[aria-label="مركز المباريات"],
        main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) {
          display: none !important;
        }
      `}</style>
      <HomeClientSportsNext {...props} />
    </>
  );
}
