'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
};

type CountdownMatch = {
  id?: string | number | null;
  matchDate?: string | Date | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  groupPhase?: string | null;
};

type Props = {
  nextMatch: CountdownMatch | null;
};

export default function HomeHeroCountdown({ nextMatch }: Props) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!nextMatch?.matchDate) return;

    const targetTime = new Date(nextMatch.matchDate).getTime();

    const updateTimer = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [nextMatch]);

  if (!nextMatch) {
    // Fallback static welcoming hero banner if no matches are upcoming
    return (
      <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.15),transparent_40%),rgba(255,255,255,0.03)] p-6 md:p-10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-[#FFD700]/10 to-transparent blur-3xl rounded-full" />
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700] uppercase tracking-wide">
            🏆 كأس العالم 2026
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-[#0FF0FC]">
            مرحباً بك في البث التفاعلي لمونديال 2026
          </h1>
          <p className="text-sm md:text-base text-gray-400 leading-relaxed font-medium">
            تصفح التشكيلات الرسمية، تابع المباريات بالأنيميشن المباشر ثانية بثانية، وشاهد تحليلات وإحصائيات المنتخبات المصممة تكتيكياً.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link href="/matches" className="rounded-2xl bg-[#0FF0FC] px-5 py-3 text-xs font-black text-black shadow-lg shadow-[#0FF0FC]/20 transition hover:bg-[#4AFAFF] hover:scale-[1.02]">
              جدول المباريات
            </Link>
            <Link href="/teams" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black text-white transition hover:bg-white/10">
              دليل المنتخبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const homeFlag = nextMatch.homeTeam?.image || getTeamFlagUrl({ code: nextMatch.homeTeam?.code, name: nextMatch.homeTeam?.name }, 80);
  const awayFlag = nextMatch.awayTeam?.image || getTeamFlagUrl({ code: nextMatch.awayTeam?.code, name: nextMatch.awayTeam?.name }, 80);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.12),transparent_40%),rgba(255,255,255,0.03)] p-6 md:p-8 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
      <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-[#FFD700]/10 to-transparent blur-3xl rounded-full" />
      
      <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left Side: Welcoming & Match Details */}
        <div className="space-y-4 text-center lg:text-right w-full lg:w-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC] uppercase tracking-wide">
            🔥 اللقاء المرتقب
          </span>
          <h1 className="text-2xl md:text-4xl font-black leading-tight text-white">
            {nextMatch.homeTeam?.name} ضد {nextMatch.awayTeam?.name}
          </h1>
          <p suppressHydrationWarning className="text-xs md:text-sm text-gray-400 font-bold">
            {nextMatch.groupPhase ? nextMatch.groupPhase.replace('Group ', 'المجموعة ') : 'كأس العالم'} • {nextMatch.matchDate ? new Intl.DateTimeFormat('ar-EG', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(nextMatch.matchDate)) : ''}
          </p>
          
          <div className="pt-2 flex flex-wrap justify-center lg:justify-start gap-3">
            <Link href={`/matches/${nextMatch.id}`} className="rounded-2xl bg-[#FFD700] px-5 py-3 text-xs font-black text-black shadow-lg shadow-[#FFD700]/20 transition hover:bg-[#FFE55C] hover:scale-[1.02]">
              دخول المباراة
            </Link>
            <Link href="/matches" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black text-white transition hover:bg-white/10">
              جدول المباريات
            </Link>
          </div>
        </div>

        {/* Right Side: Flags & Timer */}
        <div className="flex flex-col items-center gap-6 w-full lg:w-1/2">
          {/* Flags Superposition */}
          <div className="flex items-center gap-4">
            <motion.div whileHover={{ scale: 1.05 }} className="h-16 w-16 md:h-20 md:w-20 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 shadow-lg">
              <img src={homeFlag || undefined} alt="" className="h-full w-full object-cover" />
            </motion.div>
            <span className="text-lg font-black text-gray-500">ضد</span>
            <motion.div whileHover={{ scale: 1.05 }} className="h-16 w-16 md:h-20 md:w-20 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 shadow-lg">
              <img src={awayFlag || undefined} alt="" className="h-full w-full object-cover" />
            </motion.div>
          </div>

          {/* Timer Slots */}
          {timeLeft && (
            <div className="grid grid-cols-4 gap-3 text-center" dir="ltr">
              {[
                { label: 'ثانية', val: timeLeft.seconds },
                { label: 'دقيقة', val: timeLeft.minutes },
                { label: 'ساعة', val: timeLeft.hours },
                { label: 'يوم', val: timeLeft.days },
              ].reverse().map((item, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-base md:text-xl font-black text-[#0FF0FC]">
                    {String(item.val).padStart(2, '0')}
                  </div>
                  <span className="mt-1.5 text-[9px] font-black text-gray-500 uppercase">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
