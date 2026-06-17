import Link from 'next/link';
import prisma from '@/lib/prisma';
import InternalAnimationPlayerV2 from '@/app/animation-live/player/InternalAnimationPlayerV2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function getAutoLiveMatch() {
  const now = new Date();
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: {
      matchDate: { gte: start, lte: end },
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
    },
    orderBy: { matchDate: 'asc' },
    take: 12,
  });

  return matches.find((match) => {
    const status = String(match.status || '').toUpperCase();
    if (['IN_PLAY', 'LIVE', 'HT'].includes(status)) return true;
    const minute = Math.floor((now.getTime() - new Date(match.matchDate).getTime()) / 60_000) + 1;
    return minute >= 1 && minute <= 135;
  }) || matches[0] || null;
}

async function resolveDbMatchId(params: Record<string, string | string[] | undefined>) {
  const directDbMatchId = getSingleValue(params.dbMatchId) || getSingleValue(params.id) || '';
  if (directDbMatchId) return directDbMatchId;

  const animationMatchId = getSingleValue(params.matchId) || '';
  if (animationMatchId) {
    const numericAnimationMatchId = Number(animationMatchId);
    if (Number.isFinite(numericAnimationMatchId)) {
      const linkedMatch = await prisma.match.findFirst({
        where: { animationMatchId: numericAnimationMatchId },
        select: { id: true },
      });
      if (linkedMatch?.id) return linkedMatch.id;
    }
  }

  const autoMatch = await getAutoLiveMatch();
  return autoMatch?.id || '';
}

export default async function AnimationLivePlayerV2Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const dbMatchId = await resolveDbMatchId(params);
  const matchId = getSingleValue(params.matchId) || '';

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <div className="rounded-[1.45rem] border border-[#FFD700]/20 bg-[#FFD700]/10 p-4 sm:rounded-[1.5rem] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD700]">V2 Test Route</div>
              <h1 className="mt-1 text-xl font-black text-white">اختبار مشغل البث التفاعلي V2</h1>
              <p className="mt-2 text-xs font-bold leading-6 text-gray-300">
                هذه صفحة اختبار منفصلة ولا تغيّر صفحة المباراة الحالية.
              </p>
            </div>
            <Link href={dbMatchId ? `/match-center/${encodeURIComponent(dbMatchId)}#live-broadcast` : '/animation-live'} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-black text-white transition hover:border-[#0FF0FC]/40">
              العودة للنسخة الحالية
            </Link>
          </div>
        </div>

        {dbMatchId || matchId ? (
          <InternalAnimationPlayerV2 matchId={matchId} dbMatchId={dbMatchId} />
        ) : (
          <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-5 text-center text-sm font-bold leading-7 text-gray-300">
            لا توجد مباراة تلقائية متاحة الآن. افتح الصفحة مع <span className="text-[#FFD700]">dbMatchId</span> أو <span className="text-[#FFD700]">matchId</span> للاختبار.
          </div>
        )}
      </section>
    </main>
  );
}
