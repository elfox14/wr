'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AssetImage } from '@/components/ui/AssetImage';
import { CalendarDays, Clock, Radio, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react';

type BroadcastTeam = { id?: string | null; name?: string | null; image?: string | null; logo?: string | null; badge?: string | null; flag?: string | null; group?: string | null };
type BroadcastMatch = { id: string; matchDate?: string | null; groupPhase?: string | null; group?: string | null; stage?: string | null; homeTeam?: BroadcastTeam | null; awayTeam?: BroadcastTeam | null };
type BroadcastArticle = { id: string; title: string; excerpt: string; category: string; readingTime?: string };
type BroadcastStats = { teamsCount: number; playersCount: number; assetsCount: number; matchesCount: number };

function normalizeGroupKey(value?: string | null): string { if (!value) return 'غير محددة'; return value.replace('Group', '').replace('المجموعة', '').trim().toUpperCase(); }
function getCountdown(matchDate?: string | null, now = Date.now()) { if (!matchDate) return null; const diff = new Date(matchDate).getTime() - now; if (diff <= 0) return null; const totalSeconds = Math.floor(diff / 1000); return [{ label: 'يوم', value: Math.floor(totalSeconds / 86400) }, { label: 'ساعة', value: Math.floor((totalSeconds % 86400) / 3600) }, { label: 'دقيقة', value: Math.floor((totalSeconds % 3600) / 60) }, { label: 'ثانية', value: totalSeconds % 60 }]; }

export function BroadcastClient({ nextMatch, stats }: { nextMatch: BroadcastMatch | null; stats: BroadcastStats; articles: BroadcastArticle[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const countdown = useMemo(() => getCountdown(nextMatch?.matchDate, now), [nextMatch?.matchDate, now]);
  const groupKey = normalizeGroupKey(nextMatch?.groupPhase || nextMatch?.group || nextMatch?.homeTeam?.group || nextMatch?.awayTeam?.group);
  const statCards = [{ label: 'منتخب', value: stats.teamsCount || 48, icon: Trophy }, { label: 'لاعب', value: stats.playersCount || 1248, icon: Users }, { label: 'مباراة', value: stats.matchesCount || 72, icon: CalendarDays }];

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(15,240,252,0.22),transparent_28%),radial-gradient(circle_at_80%_75%,rgba(255,215,0,0.18),transparent_30%),linear-gradient(135deg,#030712,#09090f_55%,#020617)]" />
      <main className="relative z-10 flex h-screen w-screen flex-col p-8 lg:p-10">
        <header className="mb-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[#0FF0FC]/30 bg-[#0FF0FC]/10"><Radio className="text-[#0FF0FC]" size={30} /></div><div><p className="text-sm font-black tracking-[0.35em] text-[#0FF0FC]">LIVE BROADCAST</p><h1 className="text-4xl font-black leading-tight lg:text-6xl">MC PRIME World Cup</h1></div></div>
          <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-200">تغطية رياضية فقط</div>
        </header>
        <section className="grid flex-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-sm font-black text-gray-400">المباراة القادمة</p><h2 className="mt-1 text-3xl font-black text-white">Next Match</h2></div><Link href={`/groups#group-${encodeURIComponent(groupKey)}`} className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-5 py-2 text-sm font-black text-[#FFD700]">المجموعة {groupKey}</Link></div>
            {nextMatch ? <div className="grid h-[48%] grid-cols-[1fr_auto_1fr] items-center gap-8"><div className="flex flex-col items-center gap-4 text-center"><AssetImage image={nextMatch.homeTeam?.image || nextMatch.homeTeam?.logo || nextMatch.homeTeam?.badge || nextMatch.homeTeam?.flag} name={nextMatch.homeTeam?.name || 'Team'} type="TEAM" width={190} height={190} className="h-44 w-44 rounded-full border border-white/10 bg-black/50 object-cover lg:h-52 lg:w-52" /><h3 className="text-3xl font-black text-white lg:text-4xl">{nextMatch.homeTeam?.name || 'الفريق الأول'}</h3></div><div className="flex flex-col items-center gap-4"><div className="rounded-full border border-white/10 bg-black/50 px-8 py-4 text-4xl font-black text-[#FFD700]">VS</div></div><div className="flex flex-col items-center gap-4 text-center"><AssetImage image={nextMatch.awayTeam?.image || nextMatch.awayTeam?.logo || nextMatch.awayTeam?.badge || nextMatch.awayTeam?.flag} name={nextMatch.awayTeam?.name || 'Team'} type="TEAM" width={190} height={190} className="h-44 w-44 rounded-full border border-white/10 bg-black/50 object-cover lg:h-52 lg:w-52" /><h3 className="text-3xl font-black text-white lg:text-4xl">{nextMatch.awayTeam?.name || 'الفريق الثاني'}</h3></div></div> : <div className="flex h-[48%] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/30 text-2xl font-black text-gray-400">لا توجد مباراة قادمة حاليًا</div>}
            <div className="mt-7 rounded-[1.6rem] border border-[#0FF0FC]/15 bg-black/35 p-5"><div className="mb-4 flex items-center justify-between gap-4"><div className="flex items-center gap-2 text-sm font-black text-[#0FF0FC]"><Clock size={18} /> العد التنازلي</div><div className="text-sm font-bold text-gray-400">{nextMatch?.matchDate ? new Date(nextMatch.matchDate).toLocaleString('ar-EG') : '—'}</div></div>{countdown ? <div className="grid grid-cols-4 gap-3">{countdown.map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-center"><div className="font-mono text-5xl font-black leading-none text-white tabular-nums">{String(item.value).padStart(2, '0')}</div><div className="mt-2 text-sm font-black text-[#0FF0FC]">{item.label}</div></div>)}</div> : <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-center text-lg font-black text-emerald-200">بدأت أو اقتربت المباراة</div>}</div>
          </div>
          <aside className="grid gap-6"><section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl"><div className="mb-4 flex items-center gap-2 text-xl font-black"><Sparkles className="text-[#FFD700]" /> إحصائيات المنصة</div><div className="grid grid-cols-1 gap-3">{statCards.map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/35 p-4 text-center"><Icon className="mx-auto mb-3 text-[#0FF0FC]" size={22} /><div className="font-mono text-4xl font-black tabular-nums">{stat.value.toLocaleString()}</div><div className="mt-1 text-sm font-black text-gray-400">{stat.label}</div></div>; })}</div></section></aside>
        </section>
        <footer className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/35 px-5 py-3 text-sm font-bold text-gray-300"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-300" /> تغطية رياضية مباشرة للمباريات.</span><span className="text-[#0FF0FC]">worldcup.mcprim.com</span></footer>
      </main>
    </div>
  );
}
