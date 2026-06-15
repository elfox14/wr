'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WORLD_CUP_2026_GROUPS, type WorldCup2026GroupKey } from '@/lib/worldCup2026GroupConfig';

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

type SummaryStats = {
  totalMatches: number;
  finishedMatches: number;
  liveMatches: number;
  scheduledMatches: number;
  totalGoals: number;
  yellowCards: number;
  redCards: number;
  matchesWithCardSnapshots: number;
  latestCardsUpdatedAt: string | null;
};

type GroupStandingRow = {
  team: string;
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type GroupStanding = {
  key: WorldCup2026GroupKey;
  arName: string;
  finishedMatches: number;
  liveMatches: number;
  scheduledMatches: number;
  standings: GroupStandingRow[];
};

type Props = {
  initialAssets?: unknown[];
  upcomingMatches?: HomeMatch[];
  assetsCount?: number;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  academyArticles?: unknown[];
};

const heroActions = [
  ['مباريات اليوم', '/matches', 'primary'],
  ['جدول البطولة', '/matches'],
  ['المنتخبات', '/teams'],
  ['التحليلات', '/news'],
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

const flagByCode: Record<string, string> = {
  MEX: '🇲🇽', ZAF: '🇿🇦', RSA: '🇿🇦', KOR: '🇰🇷', CZE: '🇨🇿', CAN: '🇨🇦', BIH: '🇧🇦', BOS: '🇧🇦', QAT: '🇶🇦', SUI: '🇨🇭', CHE: '🇨🇭', BRA: '🇧🇷', MAR: '🇲🇦', HAI: '🇭🇹', SCO: '🏴', USA: '🇺🇸', USMNT: '🇺🇸', PAR: '🇵🇾', AUS: '🇦🇺', TUR: '🇹🇷', GER: '🇩🇪', DE: '🇩🇪', CUW: '🇨🇼', CW: '🇨🇼', ECU: '🇪🇨', CIV: '🇨🇮', NED: '🇳🇱', NLD: '🇳🇱', JPN: '🇯🇵', SWE: '🇸🇪', TUN: '🇹🇳', BEL: '🇧🇪', EGY: '🇪🇬', IRN: '🇮🇷', NZL: '🇳🇿', ESP: '🇪🇸', CPV: '🇨🇻', CV: '🇨🇻', KSA: '🇸🇦', SA: '🇸🇦', URU: '🇺🇾', UY: '🇺🇾', UR: '🇺🇾', URY: '🇺🇾', URUGUAY: '🇺🇾', FRA: '🇫🇷', SEN: '🇸🇳', IRQ: '🇮🇶', NOR: '🇳🇴', ARG: '🇦🇷', ALG: '🇩🇿', DZA: '🇩🇿', AUT: '🇦🇹', JOR: '🇯🇴', POR: '🇵🇹', COD: '🇨🇩', DRC: '🇨🇩', CD: '🇨🇩', UZB: '🇺🇿', COL: '🇨🇴', ENG: '🏴', CRO: '🇭🇷', GHA: '🇬🇭', PAN: '🇵🇦'
};

function formatCount(value?: number, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(value && value > 0 ? value : fallback);
}

function flagForCode(code?: string | null) {
  return flagByCode[String(code || '').trim().toUpperCase()] || '🏳️';
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

function teamLabel(team?: Team | null) {
  return team?.name || team?.code || 'منتخب غير محدد';
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
}

function teamMark(team?: Team | null) {
  if (team?.image?.startsWith('http')) {
    return <img src={team.image} alt={teamLabel(team)} className="h-full w-full object-cover" />;
  }

  return <span className="text-sm font-black text-[#FFD700]">{team?.image || teamCode(team)}</span>;
}

function scoreLabel(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? formatCount(value) : '—';
}

function matchClock(match: HomeMatch) {
  if (!isLiveMatch(match) && !match.isHalfTime) return null;
  if (typeof match.minute === 'number' && Number.isFinite(match.minute) && match.minute > 0) {
    return `${formatCount(Math.floor(match.minute))}′`;
  }
  return null;
}

function TeamScoreBadge({ team, score, align }: { team?: Team | null; score?: number | null; align: 'right' | 'left' }) {
  return (
    <div className={`mb-1.5 inline-flex items-center gap-1.5 ${align === 'left' ? 'flex-row-reverse' : ''}`}>
      <div className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.07]">
        {teamMark(team)}
      </div>
      <span className="flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 text-sm font-black text-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.08)]">
        {scoreLabel(score)}
      </span>
    </div>
  );
}

function matchGroup(match: HomeMatch) {
  return match.groupPhase || match.group || match.stage || 'كأس العالم 2026';
}

function getMatchHref(match: HomeMatch) {
  return match.id ? `/matches/${encodeURIComponent(String(match.id))}` : '/matches';
}

function getInteractiveHref(match: HomeMatch) {
  return match.animationMatchId
    ? `/animation-live?matchId=${encodeURIComponent(String(match.animationMatchId))}&lang=en&statsPanel=simple&teamPanel=1`
    : '/animation-live';
}

function normalizeStatus(match?: HomeMatch | null) {
  return String(match?.displayStatus || match?.status || '').toUpperCase();
}

function isLiveMatch(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return status === 'IN_PLAY' || status === 'LIVE' || status === 'HT' || Boolean(match?.isLiveNow && !match?.isLikelyLiveByTime);
}

function isFinishedMatch(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return status === 'FINISHED' || status === 'FT';
}

function isScheduledMatch(match?: HomeMatch | null) {
  const status = normalizeStatus(match);
  return status === 'SCHEDULED' || status === 'TIMED' || status === 'NOT_STARTED';
}

function isSameCalendarDay(value?: string | Date | null, target = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function matchTime(match: HomeMatch) {
  const date = match.matchDate ? new Date(match.matchDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function formatCountdown(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `بعد ${formatCount(days)}ي ${formatCount(hours)}س ${formatCount(minutes)}د`;
  if (hours > 0) return `بعد ${formatCount(hours)}س ${formatCount(minutes)}د ${formatCount(seconds)}ث`;
  return `بعد ${formatCount(minutes)}د ${formatCount(seconds)}ث`;
}

function matchTiming(match: HomeMatch, now: Date) {
  const status = normalizeStatus(match);
  const isConfirmedLive = Boolean(match.isLiveNow && !match.isLikelyLiveByTime);

  if (isFinishedMatch(match)) return { label: 'انتهت', live: false, waiting: false };

  if (isConfirmedLive || status === 'LIVE' || status === 'IN_PLAY' || status === 'HT') {
    return {
      label: status === 'HT' ? 'استراحة' : match.liveLabel || 'مباشر الآن',
      live: true,
      waiting: false,
    };
  }

  const date = match.matchDate ? new Date(match.matchDate) : null;
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null;

  if (!validDate) return { label: 'بانتظار المصدر', live: false, waiting: true };

  const diffMs = validDate.getTime() - now.getTime();
  if (diffMs > 0) return { label: formatCountdown(diffMs), live: false, waiting: false };

  return { label: 'بانتظار تأكيد البداية', live: false, waiting: true };
}

function InlineMatchTimer({ match }: { match: HomeMatch }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timing = matchTiming(match, now);
  const clock = matchClock(match);

  return (
    <span className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-center text-[11px] font-black ${timing.live ? 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' : timing.waiting ? 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
      <span className="min-w-0 truncate">{timing.label}</span>
      {clock ? <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] text-white">{clock}</span> : null}
    </span>
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

function UpcomingMatchCard({ match }: { match: HomeMatch }) {
  const href = getMatchHref(match);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
      <div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1 text-[11px] font-black text-[#FFD700]">{matchGroup(match)}</span>
        <InlineMatchTimer match={match} />
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
        <Link href={href} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-[11px] font-black text-gray-200 transition hover:bg-white/[0.1]">
          تفاصيل المباراة
        </Link>
        <Link href={getInteractiveHref(match)} className="rounded-xl bg-[#0FF0FC] px-3 py-2 text-center text-[11px] font-black text-black transition hover:bg-[#4AFAFF]">
          البث التفاعلي
        </Link>
      </div>
    </article>
  );
}

function StatLinkCard({ value, label, caption, href }: { value: string; label: string; caption: string; href: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-white/10 bg-black/25 p-2.5 backdrop-blur transition hover:-translate-y-0.5 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]">
      <div className="text-xl font-black text-[#FFD700] transition group-hover:text-[#0FF0FC]">{value}</div>
      <div className="mt-0.5 text-[11px] font-black text-white">{label}</div>
      <div className="mt-0.5 text-[10px] font-bold leading-4 text-gray-400">{caption}</div>
    </Link>
  );
}

function HomeMatchCenterCard({ fallbackMatches, upcomingMatchesCount }: { fallbackMatches: HomeMatch[]; upcomingMatchesCount: number }) {
  const [matches, setMatches] = useState<HomeMatch[]>([]);

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
  const now = new Date();
  const todaysMatches = sourceMatches.filter((match) => isSameCalendarDay(match.matchDate, now));
  const liveMatches = sourceMatches.filter((match) => isLiveMatch(match));
  const upcomingMatches = sourceMatches
    .filter((match) => !isFinishedMatch(match) && !isLiveMatch(match) && !match.isLikelyLiveByTime)
    .sort((a, b) => matchTime(a) - matchTime(b));
  const visibleMatches = liveMatches.length ? liveMatches : todaysMatches.length ? todaysMatches : upcomingMatches.slice(0, 4);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-card backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Match Center</p>
          <h2 className="mt-1 text-2xl font-black text-white">مركز المباريات</h2>
          <p className="mt-1 text-sm font-semibold text-gray-400">مباريات اليوم، البث التفاعلي، والنتائج المؤكدة.</p>
        </div>
        <Link href="/matches" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-gray-200 transition hover:bg-white/[0.08]">
          عرض كل المباريات
        </Link>
      </div>

      {visibleMatches.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleMatches.map((match) => <UpcomingMatchCard key={String(match.id || match.animationMatchId || `${teamLabel(match.homeTeam)}-${teamLabel(match.awayTeam)}-${match.matchDate}`)} match={match} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold text-gray-400">
          لا توجد مباريات اليوم. القادم: {formatCount(upcomingMatchesCount)} مباراة مجدولة.
        </div>
      )}
    </section>
  );
}

function TournamentExplorerCard() {
  const groups = groupLetters.slice(0, 8);
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
        {groups.map((key) => {
          const group = WORLD_CUP_2026_GROUPS[key];
          return (
            <Link key={key} href={`/groups/${encodeURIComponent(key)}`} className="rounded-xl border border-white/10 bg-black/25 p-3 transition hover:-translate-y-0.5 hover:border-[#FFD700]/30 hover:bg-white/[0.07]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-white">{group.arName}</span>
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
    ['الإحصائيات', 'ملخصات مباشرة للأهداف والبطاقات وحالة المباريات.', '/stats'],
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
            {heroActions.map(([label, href, style]) => (
              <Link key={label} href={href} className={`rounded-xl px-4 py-2 text-sm font-black transition ${style === 'primary' ? 'bg-[#0FF0FC] text-black hover:bg-[#4AFAFF]' : 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]'}`}>
                {label}
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
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response = await fetch('/api/matches/summary-stats', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.ok) setSummaryStats(data);
      } catch {
        // The hero keeps rendering with server-provided counts if the summary endpoint is unavailable.
      }
    }

    loadSummary();
    const timer = window.setInterval(loadSummary, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const statsLinks = [
    { value: formatCount(playersCount), label: 'لاعب', caption: 'قاعدة بيانات اللاعبين', href: '/players' },
    { value: formatCount(teamsCount), label: 'منتخب', caption: 'فرق البطولة', href: '/teams' },
    { value: formatCount(summaryStats?.totalGoals), label: 'هدف', caption: 'حسب نتائج المباريات', href: '/stats' },
    { value: formatCount(summaryStats?.finishedMatches), label: 'مباراة منتهية', caption: 'تُحدّث تلقائيًا', href: '/matches' },
  ];

  return (
    <main className="space-y-4">
      <HeroSection />
      <HomeMatchCenterCard fallbackMatches={upcomingMatches} upcomingMatchesCount={upcomingMatchesCount} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statsLinks.map((item) => <StatLinkCard key={item.label} {...item} />)}
      </div>
      <TournamentExplorerCard />
      <ContentHubCard />
      <WorldMapSection />
    </main>
  );
}
