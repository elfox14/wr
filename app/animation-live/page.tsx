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

function getMatchWindow() {
  const now = new Date();
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { now, start, end };
}

function dayHourKey(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown-time';
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function teamsKey(match: any) {
  const ids = [match.homeTeamId || match.homeTeam?.id, match.awayTeamId || match.awayTeam?.id].filter(Boolean).map(String).sort();
  return ids.length === 2 ? ids.join(':') : `${match.homeTeam?.name || 'home'}:${match.awayTeam?.name || 'away'}`.toLowerCase();
}

function duplicateFamilyKey(match: any) {
  return `teams:${teamsKey(match)}:${dayHourKey(match.matchDate)}`;
}

function rankMatch(match: any, now = new Date()) {
  const status = String(match.status || '').toUpperCase();
  const statusRank = isLiveByTime(match, now) || status === 'HT' ? 50 : status === 'FINISHED' ? 30 : 10;
  const animationRank = match.animationMatchId ? 20 : 0;
  const externalRank = match.externalId ? 5 : 0;
  return statusRank + animationRank + externalRank;
}

function dedupeMatches(matches: any[], now = new Date()) {
  const byFamily = new Map<string, any>();
  for (const match of matches) {
    const key = duplicateFamilyKey(match);
    const previous = byFamily.get(key);
    if (!previous || rankMatch(match, now) > rankMatch(previous, now)) byFamily.set(key, match);
  }
  return Array.from(byFamily.values());
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

function getLiveMinute(match: any, now = new Date()) {
  const minute = Math.floor((now.getTime() - new Date(match.matchDate).getTime()) / 60_000) + 1;
  return Math.max(1, Math.min(135, minute));
}

function isLiveByTime(match: any, now = new Date()) {
  const status = String(match.status || '').toUpperCase();
  if (status === 'LIVE' || status === 'IN_PLAY' || status === 'HT') return true;
  if (status !== 'SCHEDULED') return false;
  const minute = Math.floor((now.getTime() - new Date(match.matchDate).getTime()) / 60_000) + 1;
  return minute >= 1 && minute <= 135;
}

function statusLabel(match: any, now = new Date()) {
  const normalized = String(match.status || '').toUpperCase();
  if (normalized === 'HT') return 'استراحة بين الشوطين';
  if (isLiveByTime(match, now)) {
    const minute = getLiveMinute(match, now);
    if (minute >= 46 && minute <= 65) return 'استراحة بين الشوطين';
    if (minute > 65) return 'الشوط الثاني جارٍ';
    return `مباشر الآن - الدقيقة ${minute}`;
  }
  if (normalized === 'FINISHED') return 'انتهت';
  return 'لم تبدأ';
}

function getBroadcastHref(match: any) {
  if (match?.animationMatchId) {
    return `/animation-live/player?matchId=${encodeURIComponent(String(match.animationMatchId))}&dbMatchId=${encodeURIComponent(String(match.id))}`;
  }
  if (match?.id) {
    return `/animation-live/player?dbMatchId=${encodeURIComponent(String(match.id))}`;
  }
  return '/animation-live/player';
}

function MatchCard({ match, now }: { match: any; now: Date }) {
  const hasAnimationId = Boolean(match.animationMatchId);
  const score = `${Number(match.homeScore || 0)} - ${Number(match.awayScore || 0)}`;
  const isLive = isLiveByTime(match, now);
  const isFinished = String(match.status || '').toUpperCase() === 'FINISHED';

  return (
    <article className={`rounded-3xl border p-4 shadow-card transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.065] ${isLive ? 'border-red-500/25 bg-red-500/[0.06]' : 'border-white/10 bg-white/[0.045]'}`}>
      <div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-black">
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-gray-300">{match.groupPhase || match.stage || 'مباراة اليوم'}</span>
        <span className={`rounded-full px-3 py-1 ${isLive ? 'border border-red-400/25 bg-red-500/10 text-red-200' : 'border border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]'}`}>{statusLabel(match, now)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div>
          <TeamMiniLogo image={teamImage(match.homeTeam)} name={match.homeTeam?.name || 'الفريق الأول'} />
          <div className="line-clamp-1 text-base font-black text-white">{match.homeTeam?.name || 'الفريق الأول'}</div>
        </div>
        <div>
          <div className={`rounded-2xl border border-white/10 bg-black/45 px-4 py-2 text-xl font-black ${isLive || isFinished ? 'text-white' : 'text-[#FFD700]'}`}>{isLive || isFinished ? score : 'VS'}</div>
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

      <Link href={getBroadcastHref(match)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black">
        <Radio size={16} /> {hasAnimationId ? 'دخول البث' : 'دخول البث الداخلي'}
      </Link>
    </article>
  );
}

async function getVisibleMatches() {
  const { now, start, end } = getMatchWindow();
  const matches = await prisma.match.findMany({
    where: {
      matchDate: { gte: start, lte: end },
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT', 'FINISHED'] },
    },
    orderBy: { matchDate: 'asc' },
    include: { homeTeam: true, awayTeam: true },
  });

  return dedupeMatches(matches, now).sort((a: any, b: any) => {
    const aLive = isLiveByTime(a, now) ? 0 : 1;
    const bLive = isLiveByTime(b, now) ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
  });
}

export default async function AnimationLivePage() {
  const now = new Date();
  const visibleMatchesRaw = await getVisibleMatches();
  const visibleMatches = JSON.parse(JSON.stringify(visibleMatchesRaw));

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5 shadow-card md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[11px] font-black text-[#0FF0FC]"><Radio size={13} /> Football Animation Live</p>
              <h1 className="text-2xl font-black md:text-4xl">البث الأنيميشن - المباريات الحالية والقريبة</h1>
              <p className="mt-2 text-sm font-bold text-gray-400">يعرض المباراة الجارية حتى لو لم تتحدث حالتها بعد، ويظهر النتيجة وحالة المباراة بدون تكرار.</p>
            </div>
            <Link href="/broadcast" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"><Tv size={15} /> شاشة البث</Link>
          </div>
        </div>

        {visibleMatches.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleMatches.map((match: any) => <MatchCard key={match.id} match={match} now={now} />)}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.035] p-8 text-center">
            <p className="text-xl font-black text-white">لا توجد مباريات حالية أو قريبة في جدول المنصة</p>
            <Link href="/matches" className="mt-4 inline-flex rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-5 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black">عرض كل المباريات</Link>
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-100"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. كل الأرصدة Virtual Credits فقط.</div>
      </section>
    </main>
  );
}
