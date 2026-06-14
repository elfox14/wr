'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

const featureCards = [
  ['المجموعات', 'عرض مجموعات كأس العالم 2026 وترتيب المنتخبات داخل كل مجموعة.', '/groups'],
  ['دليل المنتخبات', 'صفحات خاصة لكل منتخب تشمل المعلومات الأساسية، الأداء، أبرز الأسماء، والتحليل المتاح.', '/teams'],
  ['الأخبار والتحليل', 'تقارير رياضية وتحليل فني منفصل عن أي جانب ترفيهي أو افتراضي.', '/news'],
  ['الإحصائيات', 'أرقام البطولة، المنتخبات، المباريات، والأداء عند توفر مصادر موثوقة.', '/players'],
  ['البث التفاعلي', 'متابعة تفاعلية للمباريات عند توفر البيانات الحية والرسوم الزمنية.', '/animation-live'],
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

function matchScore(match: HomeMatch) {
  return `${Number(match.homeScore || 0)} - ${Number(match.awayScore || 0)}`;
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

function UpcomingMatchesStrip({ matches }: { matches: HomeMatch[] }) {
  const [liveMatches, setLiveMatches] = useState<HomeMatch[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveCard() {
      try {
        const response = await fetch('/api/matches/live-card', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data?.matches)) setLiveMatches(data.matches);
      } catch {
        // Keep the server-rendered fallback matches if the live-card endpoint is unavailable.
      }
    }

    loadLiveCard();
    const timer = window.setInterval(loadLiveCard, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const nextMatches = useMemo(() => (liveMatches?.length ? liveMatches : matches).slice(0, 2), [liveMatches, matches]);

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:p-4">
      {nextMatches.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {nextMatches.map((match, index) => (
            <UpcomingMatchCard key={match.id || index} match={match} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs font-bold leading-6 text-gray-400">
          لا توجد مباريات قادمة متاحة الآن. سيتم عرض أقرب مباراتين هنا عند تحديث مركز المباريات.
        </div>
      )}
    </section>
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

  const featuredMatch = useMemo(() => {
    const sorted = [...sourceMatches].sort((a, b) => matchTime(a) - matchTime(b));
    return sorted.find(isLiveMatch) || sorted.find((match) => isSameCalendarDay(match.matchDate) && !isFinishedMatch(match)) || sorted.find(isScheduledMatch) || sorted[0];
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

      {featuredMatch ? <UpcomingMatchCard match={featuredMatch} /> : (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs font-bold leading-6 text-gray-400">لا توجد مباراة جاهزة للعرض الآن. سيظهر هنا أقرب لقاء عند تحديث مركز المباريات.</div>
      )}
    </section>
  );
}

function SmartFeatureGrid() {
  return (
    <section className="mt-5" aria-label="روابط أقسام كأس العالم 2026">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {featureCards.map(([title, text, href]) => (
          <Link
            key={title}
            href={href}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-black text-white">{title}</h3>
              <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">2026</span>
            </div>
            <p className="mt-2 text-xs font-bold leading-6 text-gray-400">{text}</p>
          </Link>
        ))}
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
        <UpcomingMatchesStrip matches={props.upcomingMatches ?? []} />

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

        <HomeMatchCenterCard fallbackMatches={props.upcomingMatches ?? []} upcomingMatchesCount={upcomingMatchesCount} />
        <SmartFeatureGrid />
      </div>
    </main>
  );
}
