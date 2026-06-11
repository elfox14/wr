import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { CalendarDays, Expand, Radio, RotateCcw, ShieldCheck, Tv } from 'lucide-react';

export const metadata: Metadata = {
  title: 'البث الأنيميشن للمباريات | MC PRIME Exchange',
  description: 'تشغيل Football Animation Live عبر iFrame داخل منصة بورصة المونديال.',
};

const allowedLanguages = new Set(['en', 'th', 'vi', 'id']);
const allowedStatsPanel = new Set(['hide', 'simple']);

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function TeamMiniLogo({ image, name }: { image?: string | null; name: string }) {
  return <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-black/40 text-2xl">{image?.startsWith('http') ? <img src={image} alt={name} className="h-full w-full object-cover" /> : <span>{image || '⚽'}</span>}</div>;
}

function MatchChoiceCard({ match }: { match: any }) {
  const linked = Boolean(match.animationMatchId);
  return (
    <Link key={match.id} href={linked ? `/animation-live?matchId=${match.animationMatchId}&lang=en&statsPanel=hide&teamPanel=1` : '/matches'} className={`rounded-2xl border p-4 transition ${linked ? 'border-[#FFD700]/25 bg-[#FFD700]/[0.06] hover:bg-[#FFD700]/10' : 'border-white/10 bg-black/25 opacity-80 hover:border-[#0FF0FC]/30'}`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-black">
        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-gray-300">{match.groupPhase || 'دور المجموعات'}</span>
        <span className={linked ? 'text-[#FFD700]' : 'text-gray-500'}>{linked ? 'بث متاح' : 'بانتظار الربط'}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div><TeamMiniLogo image={match.homeTeam.image} name={match.homeTeam.name} /><div className="line-clamp-1 text-sm font-black text-white">{match.homeTeam.name}</div></div>
        <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-[#0FF0FC]">VS</div>
        <div><TeamMiniLogo image={match.awayTeam.image} name={match.awayTeam.name} /><div className="line-clamp-1 text-sm font-black text-white">{match.awayTeam.name}</div></div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-gray-400"><CalendarDays size={13} /> {new Date(match.matchDate).toLocaleString('ar-EG')}</div>
    </Link>
  );
}

async function getAutoAnimationMatchId() {
  const liveMatch = await prisma.match.findFirst({
    where: { status: { in: ['IN_PLAY', 'LIVE'] }, animationMatchId: { not: null } },
    orderBy: { matchDate: 'asc' },
    select: { animationMatchId: true, matchDate: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });

  const match = liveMatch || await prisma.match.findFirst({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] }, animationMatchId: { not: null } },
    orderBy: { matchDate: 'asc' },
    select: { animationMatchId: true, matchDate: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });

  if (!match?.animationMatchId) return null;
  return { matchId: String(match.animationMatchId), title: `${match.homeTeam.name} × ${match.awayTeam.name}`, matchDate: match.matchDate };
}

async function getUpcomingMatches() {
  return prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    take: 16,
    select: {
      id: true,
      animationMatchId: true,
      matchDate: true,
      status: true,
      groupPhase: true,
      homeTeam: { select: { name: true, image: true, code: true } },
      awayTeam: { select: { name: true, image: true, code: true } },
    },
  });
}

export default async function AnimationLivePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const accessKey = process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.NEXT_PUBLIC_ISPORTS_ANIMATION_ACCESS_KEY || '';
  const [autoMatch, upcomingMatches] = await Promise.all([getAutoAnimationMatchId(), getUpcomingMatches()]);
  const availableMatches = upcomingMatches.filter((match) => match.animationMatchId);
  const waitingMatches = upcomingMatches.filter((match) => !match.animationMatchId);
  const requestedMatchId = getSingleValue(params.matchId);
  const matchId = requestedMatchId || autoMatch?.matchId || '';
  const requestedLang = getSingleValue(params.lang) || 'en';
  const lang = allowedLanguages.has(requestedLang) ? requestedLang : 'en';
  const requestedStatsPanel = getSingleValue(params.statsPanel) || 'hide';
  const statsPanel = allowedStatsPanel.has(requestedStatsPanel) ? requestedStatsPanel : 'hide';
  const teamPanel = getSingleValue(params.teamPanel) === '0' ? '' : '1';

  const iframeUrl = matchId && accessKey ? new URL('https://www.isportslive8.com/football/detail.html') : null;
  if (iframeUrl) {
    iframeUrl.searchParams.set('matchId', matchId);
    iframeUrl.searchParams.set('accessKey', accessKey);
    iframeUrl.searchParams.set('lang', lang);
    iframeUrl.searchParams.set('statsPanel', statsPanel);
    if (teamPanel) iframeUrl.searchParams.set('teamPanel', teamPanel);
  }

  const missingReason = !matchId
    ? 'لا يوجد Match ID متاح للبث الآن. اربط المباراة بحقل animationMatchId أو اختر مباراة من القائمة.'
    : !accessKey
      ? 'مفتاح ISPORTS_ANIMATION_ACCESS_KEY غير مضبوط على السيرفر، لذلك لا يمكن تحميل iframe البث.'
      : '';

  return (
    <main className="min-h-screen bg-background px-2 py-2 text-white sm:px-4 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-2 sm:space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.13),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3 shadow-card md:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Radio size={13} /> Football Animation Live</p>
              <h1 className="text-xl font-black md:text-3xl">البث الأنيميشن للمباريات</h1>
              {autoMatch && !requestedMatchId && <p className="mt-1 text-[11px] font-bold text-[#FFD700]">المباراة المختارة تلقائيًا: {autoMatch.title} · {new Date(autoMatch.matchDate).toLocaleString('ar-EG')}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {iframeUrl && <Link href={iframeUrl.toString()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black"><Expand size={14} /> تكبير الشاشة</Link>}
              <Link href="/broadcast" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"><Tv size={14} /> شاشة البث</Link>
            </div>
          </div>
        </div>
        {iframeUrl && <div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-[11px] font-bold leading-5 text-[#FFD700] sm:hidden"><span className="inline-flex items-center gap-1"><RotateCcw size={13} /> يفضّل تدوير الهاتف أفقيًا أو الضغط على تكبير الشاشة.</span></div>}
        {iframeUrl ? <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_25px_90px_rgba(0,0,0,0.45)]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black text-gray-300 md:px-4"><span>Match ID: {matchId}</span><span>Language: {lang}</span><span>Stats: {statsPanel}</span><span>Team Panel: {teamPanel || 'default'}</span></div><iframe title="Football Animation Live" src={iframeUrl.toString()} className="h-[82vh] w-full border-0 bg-black sm:h-[80vh] lg:h-[78vh]" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-card md:p-5"><div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black text-[#0FF0FC]">المباريات القادمة</p><h2 className="mt-1 text-2xl font-black text-white">اختر مباراة لمتابعة البث الأنيميشن</h2>{missingReason && <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold leading-5 text-red-200">{missingReason}</p>}</div><Link href="/matches" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">كل المباريات</Link></div>{availableMatches.length > 0 && <><h3 className="mb-3 text-sm font-black text-[#FFD700]">بث أنيميشن متاح</h3><div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{availableMatches.map((match) => <MatchChoiceCard key={match.id} match={match} />)}</div></>}{waitingMatches.length > 0 && <><h3 className="mb-3 text-sm font-black text-gray-400">بانتظار الربط</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{waitingMatches.map((match) => <MatchChoiceCard key={match.id} match={match} />)}</div></>}{upcomingMatches.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-8 text-center text-sm text-gray-400">لا توجد مباريات قادمة حاليًا.</div>}</div>}
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-100"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. كل الأرصدة Virtual Credits فقط، ولا توجد مراهنات أو كريبتو أو سحب أرباح.</div>
      </section>
    </main>
  );
}
