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
  { title: 'المستضيفون', names: ['المكسيك', 'كندا', 'الولايات المتحدة'] },
  { title: 'العرب', names: ['قطر', 'المغرب', 'تونس', 'مصر', 'السعودية', 'العراق', 'الجزائر', 'الأردن'] },
  { title: 'أوروبا', names: ['التشيك', 'البوسنة والهرسك', 'سويسرا', 'اسكتلندا', 'تركيا', 'ألمانيا', 'هولندا', 'السويد', 'بلجيكا', 'إسبانيا', 'فرنسا', 'النرويج', 'النمسا', 'البرتغال', 'إنجلترا', 'كرواتيا'] },
  { title: 'أمريكا الجنوبية', names: ['البرازيل', 'باراغواي', 'الإكوادور', 'أوروغواي', 'الأرجنتين', 'كولومبيا'] },
  { title: 'أفريقيا', names: ['جنوب أفريقيا', 'المغرب', 'كوت ديفوار', 'تونس', 'مصر', 'السنغال', 'الجزائر', 'الكونغو الديمقراطية', 'غانا', 'الرأس الأخضر'] },
  { title: 'آسيا', names: ['كوريا الجنوبية', 'قطر', 'اليابان', 'إيران', 'السعودية', 'العراق', 'الأردن', 'أوزبكستان'] },
  { title: 'أمريكا الشمالية والكاريبي', names: ['المكسيك', 'كندا', 'الولايات المتحدة', 'هايتي', 'كوراساو', 'بنما'] },
  { title: 'أوقيانوسيا', names: ['أستراليا', 'نيوزيلندا'] },
] as const;

function formatCount(value?: number, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(value && value > 0 ? value : fallback);
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
      label: status === 'HT' ? 'استراحة' : match.liveLabel || (match.minute ? `مباشر • ${formatCount(match.minute)}′` : 'مباشر الآن'),
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

  return (
    <span className={`min-w-0 truncate rounded-full border px-2.5 py-1 text-center text-[11px] font-black ${timing.live ? 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' : timing.waiting ? 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
      {timing.label}
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
          <div className="mb-1.5 inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.07]">
            {teamMark(match.homeTeam)}
          </div>
          <h3 className="truncate text-sm font-black text-white">{teamLabel(match.homeTeam)}</h3>
          <p className="mt-0.5 text-[11px] font-bold text-gray-500">{teamCode(match.homeTeam)}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-xs font-black text-[#0FF0FC]">
          ضد
        </div>

        <div className="min-w-0 text-left">
          <div className="mb-1.5 inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.07]">
            {teamMark(match.awayTeam)}
          </div>
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
  const todayCount = sourceMatches.filter((match) => isSameCalendarDay(match.matchDate, now)).length;
  const liveCount = sourceMatches.filter(isLiveMatch).length;
  const upcomingCount = matches.length ? sourceMatches.filter(isScheduledMatch).length : upcomingMatchesCount;
  const finishedCount = sourceMatches.filter(isFinishedMatch).length;

  const featuredMatches = useMemo(() => {
    const sorted = [...sourceMatches].sort((a, b) => matchTime(a) - matchTime(b));
    const priority = [
      ...sorted.filter(isLiveMatch),
      ...sorted.filter((match) => !isLiveMatch(match) && isSameCalendarDay(match.matchDate) && !isFinishedMatch(match)),
      ...sorted.filter((match) => !isLiveMatch(match) && !isSameCalendarDay(match.matchDate) && isScheduledMatch(match)),
      ...sorted.filter((match) => !isLiveMatch(match) && !isScheduledMatch(match)),
    ];
    const seen = new Set<string>();
    return priority.filter((match) => {
      const key = String(match.id || `${teamLabel(match.homeTeam)}-${teamLabel(match.awayTeam)}-${match.matchDate || ''}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 2);
  }, [sourceMatches]);

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:p-4" aria-label="مركز المباريات">
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
        <div className="grid gap-3 lg:grid-cols-2">
          {featuredMatches.map((match, index) => <UpcomingMatchCard key={match.id || index} match={match} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs font-bold leading-6 text-gray-400">لا توجد مباراة جاهزة للعرض الآن. سيظهر هنا أقرب لقاء عند تحديث مركز المباريات.</div>
      )}
    </section>
  );
}

function StatBox({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-center">
      <div className="text-lg font-black text-[#FFD700]">{value}</div>
      <div className="mt-0.5 text-[10px] font-black text-white">{label}</div>
      <div className="mt-0.5 text-[9px] font-bold text-gray-500">{note}</div>
    </div>
  );
}

function buildFallbackStanding(group: WorldCup2026GroupKey): GroupStanding {
  const data = WORLD_CUP_2026_GROUPS[group];
  return {
    key: group,
    arName: data.arName,
    finishedMatches: 0,
    liveMatches: 0,
    scheduledMatches: 0,
    standings: data.teams.map((team) => ({
      team: team.name,
      code: team.codes[0],
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    })),
  };
}

function SmartFeatureGrid() {
  const [selectedGroup, setSelectedGroup] = useState<WorldCup2026GroupKey>('A');
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [groupStandings, setGroupStandings] = useState<GroupStanding[]>([]);
  const selectedGroupData = WORLD_CUP_2026_GROUPS[selectedGroup];
  const selectedStanding = groupStandings.find((group) => group.key === selectedGroup) || buildFallbackStanding(selectedGroup);

  useEffect(() => {
    let cancelled = false;

    async function loadSummaryStats() {
      try {
        const response = await fetch('/api/matches/summary-stats', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.ok) setSummaryStats(data);
      } catch {
        // Keep fallback values if the summary endpoint is unavailable.
      }
    }

    async function loadGroupStandings() {
      try {
        const response = await fetch('/api/groups/standings', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.ok && Array.isArray(data.groups)) setGroupStandings(data.groups);
      } catch {
        // Keep fallback group standings if the endpoint is unavailable.
      }
    }

    loadSummaryStats();
    loadGroupStandings();
    const timer = window.setInterval(() => {
      loadSummaryStats();
      loadGroupStandings();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const stats = {
    totalMatches: summaryStats?.totalMatches ?? 104,
    finishedMatches: summaryStats?.finishedMatches ?? 0,
    liveMatches: summaryStats?.liveMatches ?? 0,
    totalGoals: summaryStats?.totalGoals ?? 0,
    yellowCards: summaryStats?.yellowCards ?? 0,
    redCards: summaryStats?.redCards ?? 0,
  };

  return (
    <section className="mt-5" aria-label="أقسام كأس العالم 2026 التفاعلية">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07] md:col-span-2 xl:col-span-3">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white md:text-lg">المجموعات</h3>
              <p className="mt-1 text-[11px] font-black text-[#FFD700]">المجموعة {selectedGroup} — {selectedStanding.arName}</p>
            </div>
            <Link href={`/groups?group=${selectedGroup}`} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-black text-[#FFD700] transition hover:border-[#FFD700]/35 hover:bg-[#FFD700]/10">عرض تفاصيل المجموعة</Link>
          </div>

          <div className="mb-3 grid grid-cols-6 gap-1.5 md:grid-cols-12">
            {groupLetters.map((group) => (
              <button key={group} type="button" onClick={() => setSelectedGroup(group)} className={`rounded-lg border py-1.5 text-center text-[10px] font-black transition ${selectedGroup === group ? 'border-[#0FF0FC]/45 bg-[#0FF0FC]/15 text-[#0FF0FC]' : 'border-white/10 bg-black/25 text-gray-300 hover:border-[#0FF0FC]/35 hover:text-[#0FF0FC]'}`}>
                {group}
              </button>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <StatBox value={formatCount(selectedStanding.finishedMatches)} label="منتهية" note="في المجموعة" />
            <StatBox value={formatCount(selectedStanding.liveMatches)} label="مباشرة" note="الآن" />
            <StatBox value={formatCount(selectedStanding.scheduledMatches)} label="قادمة" note="متبقية" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/25">
            <table className="min-w-[760px] w-full text-right text-[11px] font-bold text-gray-300">
              <thead className="bg-white/[0.04] text-[10px] font-black text-gray-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">المنتخب</th>
                  <th className="px-3 py-2 text-center">لعب</th>
                  <th className="px-3 py-2 text-center">فاز</th>
                  <th className="px-3 py-2 text-center">تعادل</th>
                  <th className="px-3 py-2 text-center">خسر</th>
                  <th className="px-3 py-2 text-center">له</th>
                  <th className="px-3 py-2 text-center">عليه</th>
                  <th className="px-3 py-2 text-center">فرق</th>
                  <th className="px-3 py-2 text-center">نقاط</th>
                </tr>
              </thead>
              <tbody>
                {selectedStanding.standings.map((row, index) => (
                  <tr key={`${selectedGroup}-${row.code}`} className="border-t border-white/10">
                    <td className="px-3 py-2 text-[#0FF0FC]">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-8 items-center justify-center rounded-lg bg-[#0FF0FC]/10 text-[10px] font-black text-[#0FF0FC]">{row.code}</span>
                        <span className="font-black text-white">{row.team}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">{formatCount(row.played)}</td>
                    <td className="px-3 py-2 text-center">{formatCount(row.won)}</td>
                    <td className="px-3 py-2 text-center">{formatCount(row.drawn)}</td>
                    <td className="px-3 py-2 text-center">{formatCount(row.lost)}</td>
                    <td className="px-3 py-2 text-center">{formatCount(row.goalsFor)}</td>
                    <td className="px-3 py-2 text-center">{formatCount(row.goalsAgainst)}</td>
                    <td className="px-3 py-2 text-center">{row.goalDifference > 0 ? '+' : ''}{formatCount(row.goalDifference)}</td>
                    <td className="px-3 py-2 text-center text-[#FFD700]">{formatCount(row.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[10px] font-bold text-gray-500">الترتيب محسوب من نتائج المباريات المنتهية فقط. قبل بداية مباريات المجموعة تظهر الأرقام صفرية.</p>
        </article>

        <Link href="/teams" className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-black text-white">دليل المنتخبات</h3>
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">48 منتخب</span>
          </div>
          <p className="mt-2 text-xs font-bold leading-6 text-gray-400">تصنيف سريع للمنتخبات حسب الاستضافة والمنطقة الجغرافية.</p>
          <div className="mt-3 space-y-2">
            {teamRegions.map((region) => (
              <div key={region.title} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                <div className="mb-1 text-[10px] font-black text-[#0FF0FC]">{region.title}</div>
                <p className="text-[11px] font-bold leading-5 text-gray-300">{region.names.join('، ')}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] font-black text-[#FFD700]">استكشف المنتخبات ←</div>
        </Link>

        <Link href="/news" className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-black text-white">الأخبار والتحليل</h3>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-200">تحليل رياضي</span>
          </div>
          <p className="mt-2 text-xs font-bold leading-6 text-gray-400">أخبار البطولة وتحليل فني رياضي فقط، بعيدًا عن أي توصيات أو جانب تجاري.</p>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-black text-[#0FF0FC]">آخر التغطيات</p>
            <p className="mt-1 text-xs font-bold leading-5 text-white">تقارير، قراءة تكتيكية، ومتابعة يومية عند توفر المصادر.</p>
          </div>
          <div className="mt-3 text-[11px] font-black text-[#FFD700]">قراءة التحليلات ←</div>
        </Link>

        <Link href="/players" className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-black text-white">الإحصائيات</h3>
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">Data</span>
          </div>
          <p className="mt-2 text-xs font-bold leading-6 text-gray-400">أرقام فعلية من قاعدة بيانات المباريات وآخر لقطات الإحصائيات المتاحة.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatBox value={formatCount(stats.totalMatches)} label="مباراة" note="إجمالي الجدول" />
            <StatBox value={formatCount(stats.finishedMatches)} label="انتهت" note="حسب الحالة" />
            <StatBox value={formatCount(stats.totalGoals)} label="هدف" note="من النتائج" />
            <StatBox value={formatCount(stats.liveMatches)} label="مباشر" note="الآن" />
            <StatBox value={formatCount(stats.yellowCards)} label="صفراء" note="آخر Snapshot" />
            <StatBox value={formatCount(stats.redCards)} label="حمراء" note="آخر Snapshot" />
          </div>
          <div className="mt-3 text-[11px] font-black text-[#FFD700]">عرض الإحصائيات ←</div>
        </Link>

        <Link href="/animation-live" className="group relative overflow-hidden rounded-2xl border border-red-400/20 bg-red-500/[0.055] p-4 transition duration-200 hover:-translate-y-1 hover:border-red-300/45 hover:bg-red-500/[0.08]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-300/50 to-transparent opacity-70" />
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-black text-white">البث التفاعلي</h3>
            <span className="rounded-full border border-red-300/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-black text-red-100">LIVE</span>
          </div>
          <p className="mt-2 text-xs font-bold leading-6 text-gray-300">متابعة مرئية للمباريات الجارية والقريبة عند توفر بيانات حية ورسوم زمنية.</p>
          <div className="mt-3 rounded-xl border border-red-300/15 bg-black/25 p-3 text-center">
            <span className="inline-flex items-center gap-2 text-[11px] font-black text-red-100"><span className="h-2 w-2 animate-pulse rounded-full bg-red-300" /> صفحة البث المباشر</span>
          </div>
          <div className="mt-3 text-[11px] font-black text-[#FFD700]">دخول البث الآن ←</div>
        </Link>

        <Link href="/matches" className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-black text-white">الدول المستضيفة</h3>
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">3 دول</span>
          </div>
          <p className="mt-2 text-xs font-bold leading-6 text-gray-400">أمريكا، كندا، والمكسيك ضمن نسخة تاريخية موزعة على ثلاث دول مستضيفة.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['أمريكا', 'كندا', 'المكسيك'].map((country) => <span key={country} className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-center text-[10px] font-black text-gray-300">{country}</span>)}
          </div>
          <div className="mt-3 text-[11px] font-black text-[#FFD700]">متابعة الجدول ←</div>
        </Link>
      </div>
    </section>
  );
}

export default function HomeClientSportsNext(props: Props) {
  const upcomingMatchesCount = props.upcomingMatchesCount ?? 0;

  const stats = [
    { value: '48', label: 'منتخب', caption: 'دليل المنتخبات المشاركة', href: '/teams' },
    { value: '104', label: 'مباراة', caption: 'من الافتتاح إلى النهائي', href: '/matches' },
    { value: '3', label: 'دول مستضيفة', caption: 'أمريكا، كندا، المكسيك', href: '/matches' },
    { value: formatCount(upcomingMatchesCount), label: 'أقرب المباريات', caption: 'داخل مركز المباريات', href: '/matches' },
  ] as const;

  return (
    <main dir="rtl" className="relative overflow-hidden bg-[#050505] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(15,240,252,0.1),transparent_26%),radial-gradient(circle_at_80%_12%,rgba(255,215,0,0.08),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(0,128,96,0.08),transparent_28%)]" />

      <div className="relative mx-auto max-w-7xl">
        <HomeMatchCenterCard fallbackMatches={props.upcomingMatches ?? []} upcomingMatchesCount={upcomingMatchesCount} />

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07111f] shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#07111f] via-[#081826] to-black" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/55 to-transparent" />
          <div className="absolute -right-16 top-2 h-40 w-40 rounded-full bg-[#0FF0FC]/10 blur-3xl" />
          <div className="absolute -left-16 bottom-2 h-40 w-40 rounded-full bg-[#FFD700]/7 blur-3xl" />

          <div className="relative z-10 p-4 sm:p-5 lg:p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0FF0FC]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00FF88]" />
              WORLD CUP 2026 LIVE CENTER
            </div>

            <h1 className="mt-3 max-w-4xl text-xl font-black leading-snug tracking-tight text-white md:text-2xl lg:text-3xl">
              كل شيء عن كأس العالم 2026 في مكان واحد
            </h1>

            <p className="mt-2 max-w-4xl text-xs font-semibold leading-6 text-gray-300 md:text-sm md:leading-7">
              تابع البطولة لحظة بلحظة: مباريات اليوم، النتائج، الأخبار، التحليلات الفنية، الإحصائيات، المنتخبات، الملاعب، والمدن المستضيفة في تجربة رياضية واحدة.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {heroActions.map(([label, href, variant]) => (
                <Link
                  key={href + label}
                  href={href}
                  className={
                    variant === 'primary'
                      ? 'rounded-xl bg-[#0FF0FC] px-4 py-2 text-[11px] font-black text-black shadow-[0_0_18px_rgba(15,240,252,0.18)] transition hover:-translate-y-0.5 hover:bg-[#4AFAFF]'
                      : 'rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:border-[#FFD700]/40 hover:bg-white/[0.14]'
                  }
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <StatLinkCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </section>

        <SmartFeatureGrid />
      </div>
    </main>
  );
}
