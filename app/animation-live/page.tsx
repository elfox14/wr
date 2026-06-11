import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Radio, ShieldCheck, Tv } from 'lucide-react';

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

export default async function AnimationLivePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const accessKey = process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.NEXT_PUBLIC_ISPORTS_ANIMATION_ACCESS_KEY || '';
  const autoMatch = await getAutoAnimationMatchId();
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
    <main className="min-h-screen bg-background px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-card md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">
                <Radio size={15} /> Football Animation Live
              </p>
              <h1 className="text-3xl font-black md:text-5xl">البث الأنيميشن للمباريات</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
                يتم تشغيل البث تلقائيًا عند توفر Match ID الخاص بمزود الأنيميشن للمباراة القادمة.
              </p>
              {autoMatch && !requestedMatchId && (
                <p className="mt-2 text-xs font-bold text-[#FFD700]">
                  المباراة المختارة تلقائيًا: {autoMatch.title} · {new Date(autoMatch.matchDate).toLocaleString('ar-EG')}
                </p>
              )}
            </div>
            <Link href="/broadcast" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">
              <Tv size={16} /> شاشة البث العامة
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
              className="h-[72vh] w-full border-0 bg-black"
              allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-card">
            <Radio size={44} className="mx-auto mb-4 text-[#0FF0FC]" />
            <h2 className="text-2xl font-black text-white">لا يوجد بث أنيميشن متاح حاليًا</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-400">
              سيتم تشغيل البث هنا تلقائيًا عند إضافة Match ID الخاص بالمزود إلى إحدى المباريات القادمة.
            </p>
            <Link href="/matches" className="mt-5 inline-flex rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-5 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black">
              العودة إلى المباريات
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm font-bold leading-7 text-emerald-100">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. كل الأرصدة Virtual Credits فقط، ولا توجد مراهنات أو كريبتو أو سحب أرباح.
        </div>
      </section>
    </main>
  );
}
