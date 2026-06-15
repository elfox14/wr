'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HomeTournamentStatsCard from '@/components/HomeTournamentStatsCard';
import { WORLD_CUP_2026_GROUPS, type WorldCup2026GroupKey } from '@/lib/worldCup2026GroupConfig';
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
  initialAssets?: unknown[];
  upcomingMatches?: HomeMatch[] | unknown[];
  assetsCount?: number;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  academyArticles?: unknown[];
};

const MATCH_REFRESH_MS = 60_000;

const heroActions = [
  { label: 'مباريات اليوم', href: '/matches', primary: true },
  { label: 'جدول البطولة', href: '/matches', primary: false },
  { label: 'المجموعات', href: '/groups', primary: false },
  { label: 'التحليلات', href: '/news', primary: false },
] as const;

const groupLetters = Object.keys(WORLD_CUP_2026_GROUPS) as WorldCup2026GroupKey[];

const teamRegions = [
  { title: 'المستضيفون', teams: [{ name: 'المكسيك', flag: '🇲🇽' }, { name: 'كندا', flag: '🇨🇦' }, { name: 'الولايات المتحدة', flag: '🇺🇸' }] },
  { title: 'العرب', teams: [{ name: 'قطر', flag: '🇶🇦' }, { name: 'المغرب', flag: '🇲🇦' }, { name: 'تونس', flag: '🇹🇳' }, { name: 'مصر', flag: '🇪🇬' }, { name: 'السعودية', flag: '🇸🇦' }, { name: 'العراق', flag: '🇮🇶' }, { name: 'الجزائر', flag: '🇩🇿' }, { name: 'الأردن', flag: '🇯🇴' }] },
  { title: 'أوروبا', teams: [{ name: 'التشيك', flag: '🇨🇿' }, { name: 'البوسنة والهرسك', flag: '🇧🇦' }, { name: 'سويسرا', flag: '🇨🇭' }, { name: 'اسكتلندا', flag: '🏴' }, { name: 'تركيا', flag: '🇹🇷' }, { name: 'ألمانيا', flag: '🇩🇪' }, { name: 'هولندا', flag: '🇳🇱' }, { name: 'السويد', flag: '🇸🇪' }, { name: 'بلجيكا', flag: '🇧🇪' }, { name: 'إسبانيا', flag: '🇪🇸' }, { name: 'فرنسا', flag: '🇫🇷' }, { name: 'النرويج', flag: '🇳🇴' }, { name: 'النمسا', flag: '🇦🇹' }, { name: 'البرتغال', flag: '🇵🇹' }, { name: 'إنجلترا', flag: '🏴' }, { name: 'كرواتيا', flag: '🇭🇷' }] },
  { title: 'أمريكا الجنوبية', teams: [{ name: 'البرازيل', flag: '🇧🇷' }, { name: 'باراغواي', flag: '🇵🇾' }, { name: 'الإكوادور', flag: '🇪🇨' }, { name: 'أوروغواي', flag: '🇺🇾' }, { name: 'الأرجنتين', flag: '🇦🇷' }, { name: 'كولومبيا', flag: '🇨🇴' }] },
  { title: 'أفريقيا', teams: [{ name: 'جنوب أفريقيا', flag: '🇿🇦' }, { name: 'المغرب', flag: '🇲🇦' }, { name: 'كوت ديفوار', flag: '🇨🇮' }, { name: 'تونس', flag: '🇹🇳' }, { name: 'مصر', flag: '🇪🇬' }, { name: 'السنغال', flag: '🇸🇳' }, { name: 'الجزائر', flag: '🇩🇿' }, { name: 'الكونغو الديمقراطية', flag: '🇨🇩' }, { name: 'غانا', flag: '🇬🇭' }, { name: 'الرأس الأخضر', flag: '🇨🇻' }] },
  { title: 'آسيا', teams: [{ name: 'كوريا الجنوبية', flag: '🇰🇷' }, { name: 'قطر', flag: '🇶🇦' }, { name: 'اليابان', flag: '🇯🇵' }, { name: 'إيران', flag: '🇮🇷' }, { name: 'السعودية', flag: '🇸🇦' }, { name: 'العراق', flag: '🇮🇶' }, { name: 'الأردن', flag: '🇯🇴' }, { name: 'أوزبكستان', flag: '🇺🇿' }] },
  { title: 'أمريكا الشمالية والكاريبي', teams: [{ name: 'المكسيك', flag: '🇲🇽' }, { name: 'كندا', flag: '🇨🇦' }, { name: 'الولايات المتحدة', flag: '🇺🇸' }, { name: 'هايتي', flag: '🇭🇹' }, { name: 'كوراساو', flag: '🇨🇼' }, { name: 'بنما', flag: '🇵🇦' }] },
  { title: 'أوقيانوسيا', teams: [{ name: 'أستراليا', flag: '🇦🇺' }, { name: 'نيوزيلندا', flag: '🇳🇿' }] },
] as const;

const hostCountries = [{ name: 'أمريكا', flag: '🇺🇸' }, { name: 'كندا', flag: '🇨🇦' }, { name: 'المكسيك', flag: '🇲🇽' }] as const;

function formatCount(value?: number | null, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
}

function formatScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '—';
}

function teamLabel(team?: Team | null) {
  return team?.name || team?.code || 'منتخب غير محدد';
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
}

function getTeamHref(team?: Team | null) {
  return team?.id ? `/teams/${encodeURIComponent(String(team.id))}` : '/teams';
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

function formatGroupLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'كأس العالم 2026';
  const groupLetter = raw.match(/^group[_\s-]*([a-z])$/i);
  if (groupLetter?.[1]) return `المجموعة ${groupLetter[1].toUpperCase()}`;
  if (/^[A-L]$/i.test(raw)) return `المجموعة ${raw.toUpperCase()}`;
  return raw.replace('GROUP_', 'المجموعة ');
}

function matchGroup(match: HomeMatch) {
  return formatGroupLabel(match.groupPhase || match.group || match.stage);
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
  return group.includes('GROUP') || /^[A-L]$/.test(group);
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
  const src = team?.image?.startsWith('http') ? team.image : getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);

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

function InlineMatchTimer({ match, now }: { match: HomeMatch; now: Date }) {
  const timing = matchTiming(match, now);
  const clock = matchClock(match, now);

  return (
    <span className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-center text-[11px] font-black ${timing.live ? 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' : timing.waiting ? 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
      <span className="min-w-0 truncate">{timing.label}</span>
      {clock ? <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] text-white">{clock}</span> : null}
    </span>
  );
}

function TeamSide({ team, align }: { team?: Team | null; align: 'right' | 'left' }) {
  return (
    <Link
      href={getTeamHref(team)}
      className={`group/team block min-w-0 rounded-2xl border border-transparent p-1.5 transition hover:border-[#FFD700]/25 hover:bg-white/[0.055] ${align === 'right' ? 'text-right' : 'text-left'}`}
      title={`فتح صفحة ${teamLabel(team)}`}
    >
      <div className={`mb-1.5 inline-flex items-center gap-1.5 ${align === 'left' ? 'flex-row-reverse' : ''}`}>
        <TeamFlag team={team} />
      </div>
      <h3 className="truncate text-sm font-black text-white transition group-hover/team:text-[#FFD700]">{teamLabel(team)}</h3>
      <p className="mt-0.5 text-[11px] font-bold text-gray-500 transition group-hover/team:text-gray-300">{teamCode(team)}</p>
    </Link>
  );
}

function ScoreBox({ value }: { value?: number | null }) {
  return (
    <span className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-2 text-lg font-black leading-none text-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.08)]" dir="ltr">
      {formatScore(value)}
    </span>
  );
}

function MatchScoreCenter({ homeScore, awayScore }: { homeScore?: number | null; awayScore?: number | null }) {
  return (
    <div className="flex min-w-[5.75rem] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/30 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" aria-label="نتيجة المباراة" dir="ltr">
      <ScoreBox value={homeScore} />
      <span className="h-6 w-px rounded-full bg-white/15" />
      <ScoreBox value={awayScore} />
    </div>
  );
}

function MatchCard({ match, now }: { match: HomeMatch; now: Date }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-h-7 min-w-7 items-center justify-center rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 text-[11px] font-black text-[#FFD700]">{matchGroup(match)}</span>
        <InlineMatchTimer match={match} now={now} />
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-gray-300">{formatMatchDate(match.matchDate)}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <TeamSide team={match.homeTeam} align="right" />
        <MatchScoreCenter homeScore={match.homeScore} awayScore={match.awayScore} />
        <TeamSide team={match.awayTeam} align="left" />
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

function HomeMatchCenterCard({ fallbackMatches = [], upcomingMatchesCount = 0 }: { fallbackMatches?: HomeMatch[]; upcomingMatchesCount?: number }) {
  const [matches, setMatches] = useState<HomeMatch[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      try {
        const response = await fetch('/api/matches', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.matches) ? data.matches : [];
        if (!cancelled) setMatches(list);
      } catch {
        // Keep server fallback matches if the full matches endpoint is unavailable.
      }
    }

    loadMatches();
    const timer = window.setInterval(loadMatches, MATCH_REFRESH_MS);
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
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:p-4" aria-label="مركز المباريات">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Match Center</p>
          <h2 className="mt-1 text-base font-black text-white md:text-lg">مركز المباريات</h2>
        </div>
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

function CountryChip({ team }: { team: { name: string; flag: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[11px] font-black text-gray-200">
      <span className="text-sm leading-none">{team.flag}</span>
      <span>{team.name}</span>
    </span>
  );
}

function TournamentExplorerCard() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-card backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Tournament Guide</p>
          <h2 className="mt-1 text-2xl font-black text-white">دليل البطولة</h2>
          <p className="mt-1 text-sm font-semibold text-gray-400">انتقل سريعًا بين المجموعات، المنتخبات، والمدن المستضيفة.</p>
        </div>
        <Link href="/groups" className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">المجموعات</Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {groupLetters.map((key) => {
          const group = WORLD_CUP_2026_GROUPS[key];
          return (
            <Link key={key} href={`/groups#group-${encodeURIComponent(key)}`} className="rounded-xl border border-white/10 bg-black/25 p-3 transition hover:-translate-y-0.5 hover:border-[#FFD700]/30 hover:bg-white/[0.07]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-white">المجموعة {group.arName}</span>
                <span className="rounded-full bg-[#FFD700]/10 px-2 py-0.5 text-[10px] font-black text-[#FFD700]">{key}</span>
              </div>
              <p className="mt-2 text-xs font-bold leading-5 text-gray-400">{group.teams.map((team) => team.arName).join('، ')}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ContentHubCard() {
  const items = [
    ['الأخبار والتحليل', 'تقارير وتحليلات رياضية منفصلة عن الجانب الترفيهي.', '/news'],
    ['الإحصائيات', 'ملخصات مباشرة للأهداف والبطاقات وحالة المباريات.', '/matches'],
    ['المنتخبات', 'بطاقات المنتخبات، اللاعبين، والمعلومات الأساسية.', '/teams'],
  ] as const;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-card backdrop-blur">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Content Hub</p>
        <h2 className="mt-1 text-2xl font-black text-white">مركز المحتوى</h2>
        <p className="mt-1 text-sm font-semibold text-gray-400">كل ما يخص البطولة من مباريات، منتخبات، وتحليل.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map(([title, body, href]) => (
          <Link key={title} href={href} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-0.5 hover:border-[#0FF0FC]/30 hover:bg-white/[0.07]">
            <h3 className="font-black text-white">{title}</h3>
            <p className="mt-2 text-xs font-bold leading-6 text-gray-400">{body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function WorldMapSection() {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.12),transparent_30%),rgba(255,255,255,0.04)] p-4 shadow-card backdrop-blur">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0FF0FC]">Global Stage</p>
          <h2 className="mt-1 text-2xl font-black text-white">خريطة المنتخبات</h2>
          <p className="mt-1 text-sm font-semibold text-gray-400">استعراض سريع للمناطق الكروية المشاركة في كأس العالم 2026.</p>
        </div>
        <Link href="/teams" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-gray-200 transition hover:bg-white/[0.08]">كل المنتخبات</Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {teamRegions.map((region) => (
          <div key={region.title} className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <h3 className="mb-2 text-sm font-black text-[#FFD700]">{region.title}</h3>
            <div className="flex flex-wrap gap-1.5">
              {region.teams.map((team) => <CountryChip key={`${region.title}-${team.name}`} team={team} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.14),transparent_26%),linear-gradient(135deg,rgba(3,28,21,0.98),rgba(1,12,10,0.98))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)] sm:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/70 to-transparent" />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#FFD700]">
            World Cup 2026 Live Hub
          </div>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            منصة كأس العالم 2026
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-gray-300 md:text-lg">
            مباريات، منتخبات، مجموعات، إحصائيات، أخبار وتحليل رياضي في تجربة واحدة، مع فصل واضح بين المحتوى الكروي والجانب الترفيهي الافتراضي.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {heroActions.map((action) => (
              <Link key={action.label} href={action.href} className={`rounded-xl px-4 py-2 text-sm font-black transition ${action.primary ? 'bg-[#0FF0FC] text-black hover:bg-[#4AFAFF]' : 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]'}`}>
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid min-w-[260px] gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Hosts</div>
          <div className="grid gap-2">
            {hostCountries.map((host) => (
              <div key={host.name} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="text-xl">{host.flag}</span>
                <span className="text-sm font-black text-white">{host.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeClientSportsNext({ upcomingMatches = [], playersCount = 0, teamsCount = 0, upcomingMatchesCount = 0 }: Props) {
  const safeUpcomingMatches = Array.isArray(upcomingMatches) ? (upcomingMatches as HomeMatch[]) : [];

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4 lg:px-6">
      <HeroSection />
      <HomeMatchCenterCard fallbackMatches={safeUpcomingMatches} upcomingMatchesCount={upcomingMatchesCount} />
      <HomeTournamentStatsCard playersCount={playersCount} teamsCount={teamsCount} upcomingMatchesCount={upcomingMatchesCount} />
      <TournamentExplorerCard />
      <ContentHubCard />
      <WorldMapSection />
    </main>
  );
}
