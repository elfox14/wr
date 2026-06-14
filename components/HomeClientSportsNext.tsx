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
  ['مركز المباريات', 'مواعيد، نتائج، مباريات اليوم، وحالة كل مباراة عند توفر البيانات الحية.', '/matches'],
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

function getInteractiveHref(match: HomeMatch) {
  return match.animationMatchId
    ? `/animation-live?matchId=${encodeURIComponent(String(match.animationMatchId))}&lang=en&statsPanel=simple&teamPanel=1`
    : '/animation-live';
}

function formatCountdown(diffMs: number) {
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${formatCount(days)} يوم`);
  if (hours > 0) parts.push(`${formatCount(hours)} ساعة`);
  parts.push(`${formatCount(minutes)} دقيقة`);
  return parts.join(' و ');
}

function matchTiming(match: HomeMatch, now: Date) {
  const status = String(match.displayStatus || match.status || '').toUpperCase();
  const isFinished = status === 'FINISHED' || status === 'FT';
  const isConfirmedLive = Boolean(match.isLiveNow && !match.isLikelyLiveByTime);

  if (isFinished) {
    return { label: 'انتهت', detail: 'تم تحديث النتيجة', live: false, waiting: false };
  }

  if (isConfirmedLive) {
    return {
      label: 'مباشر الآن',
      detail: match.liveLabel || (match.minute ? `الدقيقة ${formatCount(match.minute)}` : 'جارية الآن'),
      live: true,
      waiting: false,
    };
  }

  const date = match.matchDate ? new Date(match.matchDate) : null;
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null;

  if (!validDate) {
    return { label: 'موعد غير متوفر', detail: 'بانتظار تحديث المصدر', live: false, waiting: true };
  }

  const diffMs = validDate.getTime() - now.getTime();
  if (diffMs > 0) {
    return { label: 'العد التنازلي', detail: `يبدأ بعد ${formatCountdown(diffMs)}`, live: false, waiting: false };
  }

  return { label: 'بانتظار تأكيد البداية', detail: 'لا نعرض زمن المباراة إلا بعد تأكيد المصدر الحي', live: false, waiting: true };
}

function MatchTimer({ match }: { match: HomeMatch }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const timing = matchTiming(match, now);

  return (
    <div className={`mt-3 rounded-2xl border px-3 py-2 text-center ${timing.live ? 'border-[#00FF88]/25 bg-[#00FF88]/10' : timing.waiting ? 'border-[#FFD700]/20 bg-[#FFD700]/10' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10'}`}>
      <div className={`text-[11px] font-black ${timing.live ? 'text-[#00FF88]' : timing.waiting ? 'text-[#FFD700]' : 'text-[#0FF0FC]'}`}>{timing.label}</div>
      <div className="mt-1 text-xs font-black text-white">{timing.detail}</div>
    </div>
  );
}

function UpcomingMatchCard({ match }: { match: HomeMatch }) {
  const href = match.id ? `/matches/${match.id}` : '/matches';

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1 text-[11px] font-black text-[#FFD700]">{matchGroup(match)}</span>
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

      <MatchTimer match={match} />

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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0FF0FC]">NEXT MATCHES</p>
          <h2 className="mt-0.5 text-base font-black text-white">المباراتان القادمتان</h2>
        </div>
        <Link href="/matches" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-black text-white transition hover:border-[#FFD700]/40 hover:bg-white/[0.14]">
          عرض الكل
        </Link>
      </div>

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

export default function HomeClientSportsNext(props: Props) {
  const upcomingMatchesCount = props.upcomingMatchesCount ?? 0;

  const stats = [
    ['48', 'منتخب', 'أكبر نسخة من البطولة'],
    ['104', 'مباراة', 'من الافتتاح إلى النهائي'],
    ['3', 'دول مستضيفة', 'أمريكا، كندا، المكسيك'],
    [formatCount(upcomingMatchesCount), 'مباراة قريبة', 'داخل مركز المباريات'],
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
              {stats.map(([value, label, caption]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/25 p-2.5 backdrop-blur">
                  <div className="text-xl font-black text-[#FFD700]">{value}</div>
                  <div className="mt-0.5 text-[11px] font-black text-white">{label}</div>
                  <div className="mt-0.5 text-[10px] font-bold leading-4 text-gray-400">{caption}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

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
      </div>
    </main>
  );
}
