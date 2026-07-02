'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import HomeLiveMatchTicker from '@/components/HomeLiveMatchTicker';
import HomeGroupStandingsWidget from '@/components/HomeGroupStandingsWidget';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';

// Types (reused for compatibility)
type Team = { id?: string | number | null; name?: string | null; code?: string | null; image?: string | null; flagUrl?: string | null; };
type HomeMatch = { id?: string | number | null; animationMatchId?: string | number | null; matchDate?: string | Date | null; status?: string | null; displayStatus?: string | null; stage?: string | null; group?: string | null; groupPhase?: string | null; homeScore?: number | null; awayScore?: number | null; homeTeam?: Team | null; awayTeam?: Team | null; isLiveNow?: boolean; isHalfTime?: boolean; isLikelyLiveByTime?: boolean; isStaleAutoFinished?: boolean; minute?: number | null; liveLabel?: string | null; };
type Props = { upcomingMatches?: HomeMatch[] | unknown[]; tickerMatches?: HomeMatch[] | unknown[]; nextMarqueeMatch?: HomeMatch | null | unknown; groupStandings?: unknown[]; playersCount?: number; teamsCount?: number; upcomingMatchesCount?: number; };

// Helpers
const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'PEN', 'IN_PLAY', 'LIVE'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED', 'COMPLETED', 'FINAL_VERIFIED'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

function status(match?: HomeMatch | null) { return String(match?.displayStatus || match?.status || '').toUpperCase(); }
function teamLabel(team?: Team | null) { return team ? getArabicTeamName(team.code, team.name) : 'منتخب غير محدد'; }
function teamCode(team?: Team | null) { return team?.code || team?.name?.slice(0, 3) || '---'; }
function teamFlag(team?: Team | null) { const name = teamLabel(team); return team?.flagUrl || getTeamFlagUrl({ code: team?.code, name, image: null }, 96) || team?.image || null; }
function isFinished(match?: HomeMatch | null) { return FINISHED_STATUSES.includes(status(match)) || Boolean(match?.isStaleAutoFinished); }
function isHalfTime(match?: HomeMatch | null) { return HALF_TIME_STATUSES.includes(status(match)) || Boolean(match?.isHalfTime); }
function isScheduled(match?: HomeMatch | null) { return !isFinished(match) && SCHEDULED_STATUSES.includes(status(match)); }
function isConfirmedLive(match?: HomeMatch | null) { return !isFinished(match) && !isHalfTime(match) && (LIVE_STATUSES.includes(status(match)) || Boolean(match?.isLiveNow) || Boolean(match?.isLikelyLiveByTime)); }
function isLiveOrBreak(match?: HomeMatch | null) { return isConfirmedLive(match) || isHalfTime(match); }

// --- Subcomponents ---

function HeroMatchCard({ match, now }: { match: HomeMatch; now: Date }) {
  const isLive = isLiveOrBreak(match);
  const homeName = teamLabel(match.homeTeam);
  const awayName = teamLabel(match.awayTeam);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl sm:p-10"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.15)_0%,transparent_70%)] opacity-50" />
      
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        {isLive ? (
          <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-4 py-1.5 text-xs font-black text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" /> مباشر
          </motion.div>
        ) : (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-black text-gray-300">
            المباراة الأهم
          </div>
        )}

        <div className="flex w-full max-w-2xl items-center justify-between gap-4">
          <div className="flex flex-1 flex-col items-center gap-3">
            <img src={teamFlag(match.homeTeam) || ''} alt={homeName} className="h-16 w-24 rounded-lg object-cover shadow-lg sm:h-20 sm:w-32" />
            <span className="text-sm font-black text-white sm:text-xl">{homeName}</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            {isLive || isFinished(match) ? (
              <div className="flex items-center gap-3 text-4xl font-black text-[#FFD700] sm:text-6xl" dir="ltr">
                <span>{match.homeScore || 0}</span>
                <span className="text-gray-600">-</span>
                <span>{match.awayScore || 0}</span>
              </div>
            ) : (
              <div className="text-2xl font-black text-gray-500 sm:text-4xl">VS</div>
            )}
            {isLive && match.minute && (
              <span className="mt-2 text-sm font-bold text-green-400">{match.minute}'</span>
            )}
          </div>

          <div className="flex flex-1 flex-col items-center gap-3">
            <img src={teamFlag(match.awayTeam) || ''} alt={awayName} className="h-16 w-24 rounded-lg object-cover shadow-lg sm:h-20 sm:w-32" />
            <span className="text-sm font-black text-white sm:text-xl">{awayName}</span>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link href={match.id ? `/matches/${match.id}` : '#'} className="rounded-2xl bg-[#FFD700] px-8 py-3 text-sm font-black text-black transition hover:bg-[#ffe66b]">
            تغطية المباراة
          </Link>
          <Link href={match.id ? `/live-animation/${match.id}` : '#'} className="rounded-2xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/10">
            الملعب التفاعلي
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function BentoCard({ children, title, subtitle, className, href }: { children: React.ReactNode; title: string; subtitle?: string; className?: string; href?: string }) {
  const content = (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className={`group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md transition-colors hover:bg-white/[0.04] ${className || ''}`}>
      <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10 mb-4">
        <h3 className="text-lg font-black text-white">{title}</h3>
        {subtitle && <p className="text-xs font-bold text-gray-400">{subtitle}</p>}
      </div>
      <div className="relative z-10 flex-1">{children}</div>
    </motion.div>
  );
  return href ? <Link href={href} className="block h-full">{content}</Link> : content;
}

export default function HomePremiumClient({ upcomingMatches = [], tickerMatches = [], nextMarqueeMatch = null, groupStandings = [], playersCount = 0, teamsCount = 0, upcomingMatchesCount = 0 }: Props) {
  const [now, setNow] = useState(() => new Date());
  
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const primaryMatch = nextMarqueeMatch as HomeMatch | null || (upcomingMatches[0] as HomeMatch) || null;

  return (
    <main dir="rtl" className="mx-auto flex max-w-7xl flex-col gap-6 px-3 pb-12 pt-4 sm:px-4 sm:pt-6 lg:px-6">
      
      {/* Ticker Section */}
      <div className="relative -mx-3 mb-2 sm:mx-0">
        <HomeLiveMatchTicker matches={Array.isArray(tickerMatches) ? tickerMatches as HomeMatch[] : []} />
      </div>

      {/* Hero Section */}
      <section className="relative w-full">
        {primaryMatch ? (
          <HeroMatchCard match={primaryMatch} now={now} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-[2rem] border border-white/10 bg-black/40 backdrop-blur-xl">
            <span className="text-xl font-bold text-gray-500">جاري انتظار المباريات...</span>
          </div>
        )}
      </section>

      {/* Bento Grid */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Knockout Path */}
        <BentoCard 
          title="مسار البطولة" 
          subtitle="تتبع طريق الكأس من دور الـ 32"
          href="/round-of-32"
          className="lg:col-span-2"
        >
          <div className="relative flex h-full min-h-[160px] items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.1),transparent_70%),#0a0a0a]">
             <div className="z-10 flex flex-col items-center gap-3 text-center">
               <span className="text-5xl">🏆</span>
               <span className="inline-block rounded-full bg-[#FFD700] px-4 py-2 text-xs font-black text-black shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                 اكتشف الشجرة التفاعلية
               </span>
             </div>
          </div>
        </BentoCard>

        {/* Top Standings */}
        <BentoCard 
          title="ترتيب المجموعات" 
          subtitle="أبرز المنافسات في دور المجموعات"
          href="/groups"
        >
          <div className="h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-black/50">
             <HomeGroupStandingsWidget compact initialGroups={Array.isArray(groupStandings) ? groupStandings : []} />
          </div>
        </BentoCard>

        {/* Global Stats */}
        <BentoCard 
          title="أرقام وإحصائيات" 
          subtitle="نظرة عامة على البطولة"
          className="lg:col-span-1"
        >
          <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-4 text-center">
              <span className="text-3xl font-black text-[#0FF0FC]">{teamsCount}</span>
              <span className="mt-1 text-[10px] font-bold text-gray-400">منتخباً</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-4 text-center">
              <span className="text-3xl font-black text-[#FFD700]">{playersCount}</span>
              <span className="mt-1 text-[10px] font-bold text-gray-400">لاعباً مسجلاً</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-4 text-center sm:col-span-1 lg:col-span-2">
              <span className="text-3xl font-black text-[#00FF88]">{upcomingMatchesCount}</span>
              <span className="mt-1 text-[10px] font-bold text-gray-400">مباراة متبقية</span>
            </div>
          </div>
        </BentoCard>

        {/* Additional CTA */}
        <BentoCard 
          title="أحدث النتائج" 
          subtitle="تفاصيل جميع المباريات"
          href="/matches"
          className="lg:col-span-2"
        >
          <div className="flex h-[120px] items-center justify-between rounded-2xl bg-gradient-to-l from-[#FFD700]/10 to-transparent p-6">
            <div>
              <h4 className="text-lg font-black text-[#FFD700]">مركز المباريات</h4>
              <p className="mt-1 max-w-xs text-xs text-gray-400">شاهد جميع الأهداف، الإحصائيات، ومسار كل منتخب بالتفصيل.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFD700] text-black">
              ←
            </div>
          </div>
        </BentoCard>
      </section>

    </main>
  );
}
