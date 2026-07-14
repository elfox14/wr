'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import HomeLiveMatchTicker from '@/components/HomeLiveMatchTicker';
import HomeRoundOf32Widget from '@/components/HomeRoundOf32Widget';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';

// ─── Types ────────────────────────────────────────────────────────────────────
type Team = { id?: string | number | null; name?: string | null; code?: string | null; image?: string | null; flagUrl?: string | null; };
type HomeMatch = { id?: string | number | null; animationMatchId?: string | number | null; matchDate?: string | Date | null; status?: string | null; displayStatus?: string | null; stage?: string | null; group?: string | null; groupPhase?: string | null; homeScore?: number | null; awayScore?: number | null; homeTeam?: Team | null; awayTeam?: Team | null; isLiveNow?: boolean; isHalfTime?: boolean; isLikelyLiveByTime?: boolean; isStaleAutoFinished?: boolean; minute?: number | null; liveLabel?: string | null; };
type TournamentStatsSummary = {
  totalMatches: number;
  playedMatches: number;
  liveMatches: number;
  upcomingMatches: number;
  totalGoals: number;
  cleanSheets: number;
  playersCount: number;
  teamsCount: number;
  updatedAt: string | null;
};

type Props = {
  upcomingMatches?: HomeMatch[] | unknown[];
  tickerMatches?: HomeMatch[] | unknown[];
  nextMarqueeMatch?: HomeMatch | null | unknown;
  groupStandings?: unknown[];
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  knockoutMatches?: unknown[];
  tournamentStats?: TournamentStatsSummary | null;
};

// ─── Status helpers ───────────────────────────────────────────────────────────
const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'PEN', 'IN_PLAY', 'LIVE'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED', 'COMPLETED', 'FINAL_VERIFIED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

function status(m?: HomeMatch | null) { return String(m?.displayStatus || m?.status || '').toUpperCase(); }
function teamLabel(t?: Team | null) { return t ? getArabicTeamName(t.code, t.name) : 'منتخب'; }
function teamFlag(t?: Team | null) { const n = teamLabel(t); return t?.flagUrl || getTeamFlagUrl({ code: t?.code, name: n, image: null }, 96) || t?.image || null; }
function isFinished(m?: HomeMatch | null) { return FINISHED_STATUSES.includes(status(m)) || Boolean(m?.isStaleAutoFinished); }
function isHalfTime(m?: HomeMatch | null) { return HALF_TIME_STATUSES.includes(status(m)) || Boolean(m?.isHalfTime); }
function isScheduled(m?: HomeMatch | null) { return !isFinished(m) && SCHEDULED_STATUSES.includes(status(m)); }
function isConfirmedLive(m?: HomeMatch | null) { return !isFinished(m) && !isHalfTime(m) && (LIVE_STATUSES.includes(status(m)) || Boolean(m?.isLiveNow) || Boolean(m?.isLikelyLiveByTime)); }
function isLiveOrBreak(m?: HomeMatch | null) { return isConfirmedLive(m) || isHalfTime(m); }
function matchTime(m?: HomeMatch | null) { const d = m?.matchDate ? new Date(m.matchDate) : null; return d && Number.isFinite(d.getTime()) ? d.getTime() : Number.MAX_SAFE_INTEGER; }
function matchKey(m?: HomeMatch | null) { return String(m?.id || m?.animationMatchId || `${teamLabel(m?.homeTeam)}-${teamLabel(m?.awayTeam)}-${m?.matchDate || ''}`); }
function normalizeTeam(v?: string | number | null) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ''); }
function teamIdentity(t?: Team | null) { return normalizeTeam(t?.code || t?.name || ''); }
function pairKey(m?: HomeMatch | null) { return [teamIdentity(m?.homeTeam), teamIdentity(m?.awayTeam)].filter(Boolean).sort().join('|'); }
function isSameMatch(a?: HomeMatch | null, b?: HomeMatch | null) {
  if (!a || !b) return false;
  if (matchKey(a) && matchKey(b) && matchKey(a) === matchKey(b)) return true;
  const ap = pairKey(a); const bp = pairKey(b);
  return Boolean(ap && bp && ap === bp);
}
function choosePrimaryMatch(ticker: HomeMatch[], upcoming: HomeMatch[], next: HomeMatch | null) {
  const sorted = [...ticker].sort((a, b) => {
    const d = Number(isLiveOrBreak(b)) - Number(isLiveOrBreak(a));
    return d || matchTime(a) - matchTime(b);
  });
  const sameNext = next ? sorted.find((m) => isSameMatch(m, next)) : null;
  const live = sorted.find(isLiveOrBreak);
  const active = sorted.find((m) => !isFinished(m) && !isScheduled(m));
  return sameNext || live || active || next || upcoming[0] || sorted[0] || null;
}

// ─── Hex to RGB ───────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '255,255,255';
}

// ─── Animated Counter (SSR safe) ─────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1.8 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || started.current || value === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        started.current = true;
        const startTime = performance.now();
        const durationMs = duration * 1000;
        const step = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(eased * value));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.1 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{display.toLocaleString('ar-EG')}</span>;
}

// ─── Live pulse dot ───────────────────────────────────────────────────────────
function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
    </span>
  );
}

// ─── Tournament Stats Bar ─────────────────────────────────────────────────────
function TournamentStatsBar({ playersCount, teamsCount, upcomingMatchesCount, groupStandings, tournamentStats }: {
  playersCount: number; teamsCount: number; upcomingMatchesCount: number; groupStandings: unknown[]; tournamentStats?: TournamentStatsSummary | null;
}) {
  const totalGoals = useMemo(() => {
    if (!Array.isArray(groupStandings)) return 0;
    const all = groupStandings.flatMap((g: any) => g?.standings || []);
    return all.reduce((sum: number, team: any) => sum + (Number(team?.goalsFor) || 0), 0);
  }, [groupStandings]);

  const playedMatches = useMemo(() => {
    if (!Array.isArray(groupStandings)) return 0;
    const all = groupStandings.flatMap((g: any) => g?.standings || []);
    return Math.floor(all.reduce((s: number, t: any) => s + (Number(t?.played) || 0), 0) / 2);
  }, [groupStandings]);

  const stats = [
    { label: 'منتخب مشارك', value: tournamentStats?.teamsCount ?? teamsCount, color: '#18E58F', icon: '🏳️' },
    { label: 'لاعب مسجل', value: tournamentStats?.playersCount ?? playersCount, color: '#F8C846', icon: '⚽' },
    { label: 'مباراة في البطولة', value: tournamentStats?.totalMatches ?? 0, color: '#7DD3FC', icon: '📅' },
    { label: 'هدف سُجّل', value: tournamentStats?.totalGoals ?? totalGoals, color: '#FF4D5E', icon: '🥅' },
    { label: 'مباراة لُعبت', value: tournamentStats?.playedMatches ?? playedMatches, color: '#C084FC', icon: '🏟️' },
    { label: 'مباراة قادمة', value: tournamentStats?.upcomingMatches ?? upcomingMatchesCount, color: '#34D399', icon: '⏳' },
  ];
  const updatedLabel = tournamentStats?.updatedAt
    ? new Date(tournamentStats.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : 'غير متوفر';

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08]"
      style={{
        background: 'linear-gradient(145deg, rgba(7,24,18,0.98) 0%, rgba(3,10,7,0.99) 100%)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#18E58F] opacity-[0.06] blur-3xl" />
        <div className="absolute -bottom-16 -right-24 h-72 w-72 rounded-full bg-[#F8C846] opacity-[0.06] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
              style={{ background: 'linear-gradient(135deg,rgba(248,200,70,0.2),rgba(248,200,70,0.08))' }}
            >🏆</motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white sm:text-lg">أرقام كأس العالم 2026</h2>
                <span className="flex items-center gap-1 rounded-full border border-[#18E58F]/30 bg-[#18E58F]/10 px-2 py-0.5 text-[9px] font-black text-[#18E58F]">
                  <LiveDot />
                  يتحدث كل ٣٠ ث
                </span>
              </div>
              <p className="text-[10px] font-bold text-gray-500">آخر تحديث موثق: {updatedLabel}</p>
            </div>
          </div>
          <Link href="/statistics" className="flex shrink-0 items-center gap-1 rounded-full border border-[#F8C846]/25 bg-[#F8C846]/10 px-3 py-1.5 text-[10px] font-black text-[#F8C846] transition-all hover:bg-[#F8C846]/20">
            كل الإحصائيات <span>←</span>
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.16 + i * 0.06 }}
              whileHover={{ y: -5, scale: 1.04 }}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] p-3 text-center sm:p-4"
              style={{
                background: `linear-gradient(150deg, rgba(${hexToRgb(stat.color)},0.09) 0%, rgba(4,14,10,0.8) 100%)`,
                boxShadow: `inset 0 0 0 1px rgba(${hexToRgb(stat.color)},0.13)`,
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `radial-gradient(circle at 50% 0%, rgba(${hexToRgb(stat.color)},0.35), transparent 70%)` }}
              />
              <div
                className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)` }}
              />
              <div className="relative">
                <div className="mb-1.5 text-xl">{stat.icon}</div>
                <div className="text-2xl font-black leading-none sm:text-[2rem]" style={{ color: stat.color, filter: `drop-shadow(0 0 8px rgba(${hexToRgb(stat.color)},0.5))` }}>
                  <AnimatedCounter value={stat.value} duration={1.5 + i * 0.1} />
                </div>
                <div className="mt-2 text-[9px] font-bold leading-tight text-gray-400">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ─── Quick Nav ────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: '/matches', label: 'المباريات', icon: '⚽', color: '#18E58F' },
  { href: '/groups', label: 'المجموعات', icon: '📊', color: '#F8C846' },
  { href: '/teams', label: 'المنتخبات', icon: '🏳️', color: '#7DD3FC' },
  { href: '/players', label: 'اللاعبون', icon: '🏃', color: '#C084FC' },
  { href: '/round-of-32', label: 'مسار البطولة', icon: '🏆', color: '#FF4D5E' },
  { href: '/statistics', label: 'الإحصائيات', icon: '📈', color: '#34D399' },
];

function QuickNavStrip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex gap-2 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: 'none' }}
    >
      {NAV_LINKS.map((link, i) => (
        <motion.div
          key={link.href}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 + i * 0.05 }}
          whileHover={{ y: -3, scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          className="shrink-0"
        >
          <Link
            href={link.href}
            className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-white/[0.07]"
            style={{ borderColor: `rgba(${hexToRgb(link.color)},0.22)` }}
          >
            <span className="text-sm">{link.icon}</span>
            {link.label}
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Hero Match Card ──────────────────────────────────────────────────────────
function HeroMatchCard({ match }: { match: HomeMatch }) {
  const live = isLiveOrBreak(match);
  const ht = isHalfTime(match);
  const done = isFinished(match);
  const homeName = teamLabel(match.homeTeam);
  const awayName = teamLabel(match.awayTeam);
  const homeF = teamFlag(match.homeTeam);
  const awayF = teamFlag(match.awayTeam);
  const stageLabel = match.groupPhase
    ? match.groupPhase.replace('Group ', 'المجموعة ').replace('GROUP_', 'المجموعة ')
    : match.stage || 'كأس العالم 2026';

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative w-full overflow-hidden rounded-[1.75rem] border border-white/10"
      style={{
        background: 'linear-gradient(160deg, rgba(10,28,20,0.97) 0%, rgba(4,12,8,0.99) 100%)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_50%,rgba(24,229,143,0.13),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_50%,rgba(248,200,70,0.10),transparent_55%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        {live && (
          <motion.div
            animate={{ opacity: [0.2, 0.55, 0.2] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,50,50,0.07),transparent_60%)]"
          />
        )}
      </div>

      <div className="relative px-5 py-7 sm:px-10 sm:py-10">
        {/* Status badge */}
        <div className="mb-6 flex justify-center">
          {live ? (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2 text-xs font-black text-red-400"
            >
              <LiveDot />
              {ht ? 'استراحة النصف' : 'مباشر الآن'}
              {match.minute && !ht && <span className="text-red-300 opacity-80">{match.minute}'</span>}
            </motion.div>
          ) : done ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-xs font-black text-gray-400">
              <span className="h-2 w-2 rounded-full bg-gray-600" /> انتهت المباراة
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#F8C846]/30 bg-[#F8C846]/[0.08] px-5 py-2 text-xs font-black text-[#F8C846]">
              <span className="h-2 w-2 rounded-full bg-[#F8C846] shadow-[0_0_8px_#F8C846]" /> {stageLabel}
            </div>
          )}
        </div>

        {/* Teams + Score */}
        <div className="flex items-center justify-center gap-3 sm:gap-8">
          <motion.div whileHover={{ scale: 1.04 }} className="flex min-w-0 flex-1 flex-col items-center gap-3">
            {homeF ? (
              <img src={homeF} alt={homeName} className="h-20 w-28 rounded-2xl border border-white/10 object-cover shadow-2xl sm:h-24 sm:w-36" />
            ) : (
              <div className="flex h-20 w-28 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl sm:h-24 sm:w-36">🏳️</div>
            )}
            <span className="text-center text-sm font-black leading-snug text-white sm:text-lg">{homeName}</span>
          </motion.div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            {live || done ? (
              <div
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-5xl font-black leading-none sm:text-7xl"
                dir="ltr"
                style={{
                  background: 'linear-gradient(180deg, #fff 0%, #F8C846 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 24px rgba(248,200,70,0.45))',
                }}
              >
                <span className="text-right">{match.awayScore ?? 0}</span>
                <span className="px-1 text-xl sm:text-3xl" style={{ WebkitTextFillColor: 'rgba(255,255,255,0.15)' }}>:</span>
                <span className="text-left">{match.homeScore ?? 0}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="text-3xl font-black text-white/20 sm:text-5xl">VS</div>
                {match.matchDate && (
                  <div className="text-[10px] font-bold text-gray-500">
                    {new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(match.matchDate))}
                  </div>
                )}
              </div>
            )}
            {live && !ht && match.minute && (
              <div className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-400">{match.minute}'</div>
            )}
          </div>

          <motion.div whileHover={{ scale: 1.04 }} className="flex min-w-0 flex-1 flex-col items-center gap-3">
            {awayF ? (
              <img src={awayF} alt={awayName} className="h-20 w-28 rounded-2xl border border-white/10 object-cover shadow-2xl sm:h-24 sm:w-36" />
            ) : (
              <div className="flex h-20 w-28 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl sm:h-24 sm:w-36">🏳️</div>
            )}
            <span className="text-center text-sm font-black leading-snug text-white sm:text-lg">{awayName}</span>
          </motion.div>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={match.id ? `/matches/${match.id}` : '#'}
            className="rounded-2xl px-7 py-3 text-sm font-black text-black transition-all hover:brightness-110 hover:shadow-lg active:scale-95"
            style={{ background: 'linear-gradient(135deg,#F8C846 0%,#ffe86b 100%)', boxShadow: '0 8px 24px rgba(248,200,70,0.32)' }}
          >
            تغطية المباراة
          </Link>
          {match.id && (
            <Link
              href={`/live-animation/${match.id}`}
              className="rounded-2xl border border-white/15 bg-white/[0.06] px-7 py-3 text-sm font-black text-white transition-all hover:bg-white/10 active:scale-95"
            >
              الملعب التفاعلي
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Top Teams Strip ──────────────────────────────────────────────────────────
function TopTeamsStrip({ groupStandings }: { groupStandings: unknown[] }) {
  const teams = useMemo(() => {
    if (!Array.isArray(groupStandings)) return [];
    return groupStandings
      .flatMap((g: any) => g?.standings || [])
      .filter((t: any) => t && ((t.goalsFor || 0) > 0 || (t.points || 0) > 0))
      .sort((a: any, b: any) => (b.points || 0) - (a.points || 0) || (b.goalsFor || 0) - (a.goalsFor || 0))
      .slice(0, 6);
  }, [groupStandings]);

  if (!teams.length) return (
    <div className="flex h-24 items-center justify-center text-xs font-bold text-gray-600">لا توجد بيانات بعد</div>
  );

  return (
    <div className="space-y-2">
      {teams.map((team: any, i) => (
        <motion.div
          key={`${team.code || team.team}-${i}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 + i * 0.06 }}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
            style={{
              background: i === 0 ? 'linear-gradient(135deg,#F8C846,#ffde6b)' : i === 1 ? 'rgba(255,255,255,0.12)' : i === 2 ? 'rgba(205,127,50,0.3)' : 'rgba(255,255,255,0.05)',
              color: i === 0 ? '#000' : '#fff',
            }}
          >{i + 1}</span>
          <div className="min-w-0 flex-1 truncate text-xs font-black text-white">{team.team || team.code || '—'}</div>
          <div className="flex shrink-0 items-center gap-3 text-right">
            <div>
              <div className="text-xs font-black text-[#18E58F]">{team.goalsFor ?? 0}</div>
              <div className="text-[8px] text-gray-600">هدف</div>
            </div>
            <div>
              <div className="text-xs font-black text-[#F8C846]">{team.points ?? 0}</div>
              <div className="text-[8px] text-gray-600">نقطة</div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, href, accentColor = '#F8C846' }: { title: string; subtitle?: string; href?: string; accentColor?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-black text-white sm:text-lg">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[10px] font-bold text-gray-500">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-black transition-all hover:opacity-80"
          style={{ borderColor: `rgba(${hexToRgb(accentColor)},0.3)`, background: `rgba(${hexToRgb(accentColor)},0.1)`, color: accentColor }}
        >
          عرض الكل ←
        </Link>
      )}
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, className, accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  const rgb = accent ? hexToRgb(accent) : '255,255,255';
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className={`group relative overflow-hidden rounded-[1.5rem] border border-white/[0.07] p-5 ${className || ''}`}
      style={{ background: 'linear-gradient(145deg, rgba(7,24,18,0.96) 0%, rgba(3,10,7,0.98) 100%)' }}
    >
      {accent && (
        <div
          className="absolute inset-x-0 top-0 h-px opacity-40 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `linear-gradient(90deg, transparent, rgba(${rgb},0.9), transparent)` }}
        />
      )}
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HomePremiumClient({
  upcomingMatches = [],
  tickerMatches = [],
  nextMarqueeMatch = null,
  groupStandings = [],
  playersCount = 0,
  teamsCount = 0,
  upcomingMatchesCount = 0,
  knockoutMatches = [],
  tournamentStats = null,
}: Props) {
  const [, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const safeTicker = Array.isArray(tickerMatches) ? tickerMatches as HomeMatch[] : [];
  const safeUpcoming = Array.isArray(upcomingMatches) ? upcomingMatches as HomeMatch[] : [];
  const safeNext = nextMarqueeMatch as HomeMatch | null;
  const primaryMatch = useMemo(() => choosePrimaryMatch(safeTicker, safeUpcoming, safeNext), [safeTicker, safeUpcoming, safeNext]);

  return (
    <main dir="rtl" className="mx-auto flex max-w-7xl flex-col gap-5 px-3 pb-14 pt-4 sm:px-4 sm:pt-6 lg:px-6">

      {/* ① Live Ticker */}
      <div className="relative -mx-3 sm:mx-0">
        <HomeLiveMatchTicker matches={safeTicker} />
      </div>

      {/* ② Quick Nav */}
      <QuickNavStrip />

      {/* ③ Tournament Stats — الأرقام الكبيرة */}
      <TournamentStatsBar
        playersCount={playersCount}
        teamsCount={teamsCount}
        upcomingMatchesCount={upcomingMatchesCount}
        groupStandings={groupStandings}
        tournamentStats={tournamentStats}
      />

      {/* ④ Hero Match + Top Teams */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* Hero Match */}
        <div>
          {primaryMatch ? (
            <HeroMatchCard match={primaryMatch} />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-64 flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02]"
            >
              <span className="text-5xl">⏳</span>
              <span className="text-sm font-bold text-gray-500">جاري انتظار المباريات...</span>
            </motion.div>
          )}
        </div>

        {/* Top Teams */}
        <Card accent="#F8C846">
          <SectionHeader title="أفضل المنتخبات" subtitle="ترتيب حسب النقاط والأهداف" href="/groups" accentColor="#F8C846" />
          <TopTeamsStrip groupStandings={groupStandings} />
        </Card>
      </section>

      {/* ⑤ Bracket Section — شجرة البطولة كاملة */}
      <section>
        <Card accent="#FF4D5E" className="p-0 overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between gap-3 p-5 pb-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 4, -4, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
                className="text-3xl"
              >🏆</motion.div>
              <div>
                <h2 className="text-base font-black text-white sm:text-lg">مسار البطولة — كأس العالم 2026</h2>
                <p className="mt-0.5 text-[10px] font-bold text-gray-500">الشجرة التفاعلية الكاملة من دور الـ 32 حتى النهائي</p>
              </div>
            </div>
            <Link
              href="/round-of-32"
              className="flex shrink-0 items-center gap-1 rounded-full border border-[#FF4D5E]/30 bg-[#FF4D5E]/10 px-3 py-1.5 text-[10px] font-black text-[#FF4D5E] transition-all hover:bg-[#FF4D5E]/20"
            >
              عرض كامل ←
            </Link>
          </div>

          {/* Embedded bracket with reduced size */}
          <div className="px-2 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="min-w-[1180px] origin-top transform scale-[0.75] md:scale-[0.8] lg:scale-[0.85] pb-0 -mb-[180px]">
              <HomeRoundOf32Widget knockoutMatches={knockoutMatches} />
            </div>
          </div>
        </Card>
      </section>

      {/* ⑥ Bottom row: Players + Matches */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">

        {/* Players */}
        <Link href="/players" className="block">
          <Card accent="#C084FC" className="transition-all hover:border-[#C084FC]/30">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.2)' }}>🏃</div>
              <div>
                <div className="text-3xl font-black" style={{ color: '#C084FC', filter: 'drop-shadow(0 0 10px rgba(192,132,252,0.5))' }}>
                  <AnimatedCounter value={actualPlayers} />
                </div>
                <div className="mt-0.5 text-xs font-bold text-gray-500">لاعب مسجل في البطولة</div>
                <div className="mt-2 text-[10px] font-black text-[#C084FC] opacity-70">استعرض دليل اللاعبين ←</div>
              </div>
            </div>
          </Card>
        </Link>

        {/* All Matches */}
        <Link href="/matches" className="block">
          <Card accent="#7DD3FC" className="transition-all hover:border-[#7DD3FC]/30">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: 'rgba(125,211,252,0.12)', border: '1px solid rgba(125,211,252,0.2)' }}>📋</div>
              <div>
                <div className="text-3xl font-black" style={{ color: '#7DD3FC', filter: 'drop-shadow(0 0 10px rgba(125,211,252,0.5))' }}>104</div>
                <div className="mt-0.5 text-xs font-bold text-gray-500">مباراة في البطولة</div>
                <div className="mt-2 text-[10px] font-black text-[#7DD3FC] opacity-70">نتائج وإحصائيات المباريات ←</div>
              </div>
            </div>
          </Card>
        </Link>

      </section>
    </main>
  );
}
