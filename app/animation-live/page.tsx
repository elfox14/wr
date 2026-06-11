import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { CalendarDays, Radio, ShieldCheck, Tv } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'البث الأنيميشن للمباريات | MC PRIME Exchange',
  description: 'قائمة مباريات اليوم وروابط البث الأنيميشن داخل منصة بورصة المونديال.',
};

function getTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function teamImage(team: any) {
  return team?.image || team?.logo || team?.badge || team?.flag || '';
}

function TeamMiniLogo({ image, name }: { image?: string | null; name: string }) {
  return (
    <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40 text-2xl">
      {image?.startsWith('http') ? <img src={image} alt={name} className="h-full w-full object-cover" /> : <span>{image || '⚽'}</span>}
    </div>
  );
}

function statusLabel(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'LIVE' || normalized === 'IN_PLAY') return 'مباشر الآن';
  if (normalized === 'FINISHED') return 'انتهت';
  return 'لم تبدأ';
}

function getBroadcastHref(match: any) {
  if (match?.animationMatchId) {
    return `/animation-live/player?matchId=${encodeURIComponent(String(match.animationMatchId))}&lang=en&statsPanel=simple&teamPanel=1`;
  }
  return '/animation-live/player';
}

function MatchCard({ match }: { match: any }) {
  const hasLinkedBroadcast = Boolean(match.animationMatchId);
  const score = `${Number(match.homeScore || 0)} - ${Number(match.awayScore || 0)}`;
  const isLive = ['LIVE', 'IN_PLAY'].includes(String(match.status || '').toUpperCase());

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-card transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.065]">
      <div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-black">
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-gray-300">{match.groupPhase || match.stage || 'مباراة اليوم'}</span>
        <span className={`rounded-full px-3 py-1 ${isLive ? 'border border-red-400/25 bg-red-500/10 text-red-200' : 'border border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]'}`}>{statusLabel(match.status)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div>
          <TeamMiniLogo image={teamImage(match.homeTeam)} name={match.homeTeam?.name || 'الفريق الأول'} />
          <div className="line-clamp-1 text-base font-black text-white">{match.homeTeam?.name || 'الفريق الأول'}</div>
        </div>
        <div>
          <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-2 text-xl font-black text-[#FFD700]">{isLive ? score : 'VS'}</div>
          <div className="mt-2 text-[10px] font-bold text-gray-500">{new Date(match.matchDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div>
          <TeamMiniLogo image={teamImage(match.awayTeam)} name={match.awayTeam?.name || 'الفريق الثاني'} />
          <div className="line-clamp-1 text-base font-black text-white">{match.awayTeam?.name || 'الفريق الثاني'}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-400">
        <CalendarDays size={14} /> {new Date(match.matchDate).toLocaleString('ar-EG')}
      </div>

      <Link href={getBroadcastHref(match)} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${hasLinkedBroadcast ? 'border border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700] hover:text-black' : 'border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black'}`}>
        <Radio size={16} /> دخول البث
      </Link>
    </article>
  );
}

async function getTodayMatches() {
  const { start, end } = getTodayRange();
  return prisma.match.findMany({
    where: {
      matchDate: { gte: start, lt: end },
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'FINISHED'] },
    },
    orderBy: { matchDate: 'asc' },
    include: { homeTeam: true, awayTeam: true },
  });
}

export default async function AnimationLivePage() {
  const todayMatchesRaw = await getTodayMatches();
  const todayMatches = JSON.parse(JSON.stringify(todayMatchesRaw));

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5 shadow-card md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[11px] font-black text-[#0FF0FC]"><Radio size={13} /> Football Animation Live</p>
              <h1 className="text-2xl font-black md:text-4xl">مباريات اليوم - البث الأنيميشن</h1>
              <p className="mt-2 text-sm font-bold text-gray-400">اختر مباراة من مباريات اليوم للدخول إلى صفحة البث.</p>
            </div>
            <Link href="/broadcast" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"><Tv size={15} /> شاشة البث</Link>
          </div>
        </div>

        {todayMatches.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {todayMatches.map((match: any) => <MatchCard key={match.id} match={match} />)}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.035] p-8 text-center">
            <p className="text-xl font-black text-white">لا توجد مباريات اليوم في جدول المنصة</p>
            <Link href="/matches" className="mt-4 inline-flex rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-5 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black">عرض كل المباريات</Link>
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-100"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. كل الأرصدة Virtual Credits فقط.</div>
      </section>
    </main>
  );
}
