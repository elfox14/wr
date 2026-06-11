import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { CalendarDays, Radio, ShieldCheck, Tv } from 'lucide-react';

export const metadata: Metadata = {
  title: 'البث الأنيميشن للمباريات | MC PRIME Exchange',
  description: 'تشغيل Football Animation Live عبر iFrame داخل منصة بورصة المونديال.',
};

const allowedLanguages = new Set(['en', 'th', 'vi', 'id']);
const allowedStatsPanel = new Set(['hide', 'simple']);

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function getAutoAnimationMatchId() {
  const match = await prisma.match.findFirst({
    where: {
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] },
      animationMatchId: { not: null },
    },
    orderBy: { matchDate: 'asc' },
    select: {
      animationMatchId: true,
      matchDate: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  if (!match?.animationMatchId) return null;

  return {
    matchId: String(match.animationMatchId),
    title: `${match.homeTeam.name} × ${match.awayTeam.name}`,
    matchDate: match.matchDate,
  };
}

async function getUpcomingMatches() {
  return prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    take: 12,
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

function animationHref(animationMatchId?: number | null) {
  if (!animationMatchId) return '/matches';
  return `/animation-live?matchId=${animationMatchId}&lang=en&statsPanel=simple&teamPanel=1`;
}

export default async function AnimationLivePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const accessKey = process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.NEXT_PUBLIC_ISPORTS_ANIMATION_ACCESS_KEY || '';
  const [autoMatch, upcomingMatches] = await Promise.all([getAutoAnimationMatchId(), getUpcomingMatches()]);
  const requestedMatchId = getSingleValue(params.matchId);
  const matchId = requestedMatchId || autoMatch?.matchId || '';
  const requestedLang = getSingleValue(params.lang) || 'en';
  const lang = allowedLanguages.has(requestedLang) ? requestedLang : 'en';
  const requestedStatsPanel = getSingleValue(params.statsPanel) || 'simple';
  const statsPanel = allowedStatsPanel.has(requestedStatsPanel) ? requestedStatsPanel : 'simple';
  const teamPanel = getSingleValue(params.teamPanel) === '0' ? '' : '1';

  const iframeUrl = matchId && accessKey ? new URL('https://www.isportslive8.com/football/detail.html') : null;

  if (iframeUrl) {
    iframeUrl.searchParams.set('matchId', matchId);
    iframeUrl.searchParams.set('accessKey', accessKey);
    iframeUrl.searchParams.set('lang', lang);
    iframeUrl.searchParams.set('statsPanel', statsPanel);
    if (teamPanel) iframeUrl.searchParams.set('teamPanel', teamPanel);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-4 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] p-4 shadow-card md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1.5 text-[11px] font-black text-[#0FF0FC]">
                <Radio size={14} /> Football Animation Live
              </p>
              <h1 className="text-2xl font-black md:text-4xl">البث الأنيميشن للمباريات</h1>
              {autoMatch && !requestedMatchId && (
                <p className="mt-2 text-xs font-bold text-[#FFD700]">
                  المباراة المختارة تلقائيًا: {autoMatch.title} · {new Date(autoMatch.matchDate).toLocaleString('ar-EG')}
                </p>
              )}
            </div>
            <Link href="/broadcast" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">
              <Tv size={15} /> شاشة البث العامة
            </Link>
          </div>
        </div>

        {iframeUrl ? (
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-black text-gray-300 md:px-5">
              <span>Match ID: {matchId}</span>
              <span>Language: {lang}</span>
              <span>Stats: {statsPanel}</span>
              <span>Team Panel: {teamPanel || 'default'}</span>
            </div>
            <iframe
              title="Football Animation Live"
              src={iframeUrl.toString()}
              className="h-[76vh] w-full border-0 bg-black"
              allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-card md:p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black text-[#0FF0FC]">المباريات القادمة</p>
                <h2 className="mt-1 text-2xl font-black text-white">اختر مباراة لمتابعة البث الأنيميشن</h2>
              </div>
              <Link href="/matches" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">
                كل المباريات
              </Link>
            </div>

            {upcomingMatches.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {upcomingMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={animationHref(match.animationMatchId)}
                    className={`rounded-2xl border p-4 transition ${match.animationMatchId ? 'border-[#FFD700]/25 bg-[#FFD700]/[0.06] hover:bg-[#FFD700]/10' : 'border-white/10 bg-black/25 hover:border-[#0FF0FC]/30'}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-black">
                      <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-gray-300">{match.groupPhase || 'دور المجموعات'}</span>
                      <span className={match.animationMatchId ? 'text-[#FFD700]' : 'text-gray-500'}>{match.animationMatchId ? 'بث متاح' : 'بانتظار Match ID'}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                      <div>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl">{match.homeTeam.image || '⚽'}</div>
                        <div className="line-clamp-1 text-sm font-black text-white">{match.homeTeam.name}</div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-[#0FF0FC]">VS</div>
                      <div>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl">{match.awayTeam.image || '⚽'}</div>
                        <div className="line-clamp-1 text-sm font-black text-white">{match.awayTeam.name}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-gray-400">
                      <CalendarDays size={13} /> {new Date(match.matchDate).toLocaleString('ar-EG')}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-8 text-center text-sm text-gray-400">
                لا توجد مباريات قادمة حاليًا.
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-bold leading-6 text-emerald-100">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. كل الأرصدة Virtual Credits فقط، ولا توجد مراهنات أو كريبتو أو سحب أرباح.
        </div>
      </section>
    </main>
  );
}
