import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Radio } from 'lucide-react';
import prisma from '@/lib/prisma';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';
import InternalAnimationPlayerV2 from '@/app/animation-live/player/InternalAnimationPlayerV2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'البث التفاعلي | MC PRIME World Cup',
  description: 'البث التفاعلي للمباراة: بطاقة المباراة، الملعب التفاعلي، الإحصائيات، والأحداث المهمة.',
};

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function getMatch(id: string) {
  return prisma.match.findUnique({ where: { id }, include: { homeTeam: true, awayTeam: true } });
}

export default async function MatchCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await params;
  const query = (await searchParams) || {};
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';
  const playerMode = String(getSingleValue(query.player) || '').toLowerCase();
  const useV2 = playerMode === 'v2';

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <section id="live-broadcast" className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-3 shadow-card sm:rounded-[1.5rem] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex min-w-0 items-center gap-2 text-base font-black text-white sm:text-xl"><Radio className="text-[#FFD700]" /> البث التفاعلي</h1>
              <div className="mt-1 text-[10px] font-black text-gray-500">
                المشغل الحالي: <span className={useV2 ? 'text-[#FFD700]' : 'text-[#0FF0FC]'}>{useV2 ? 'V2 التجريبي' : 'النسخة المستقرة'}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/match-center/${encodeURIComponent(match.id)}?player=v2#live-broadcast`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 text-sm font-black text-[#FFF7CC] transition hover:border-[#FFD700]/45 hover:bg-[#FFD700]/15 hover:text-white">
                عرض V2 هنا
              </Link>
              <Link href={`/animation-live/player-v2?dbMatchId=${encodeURIComponent(match.id)}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-black text-white transition hover:border-[#FFD700]/45">
                صفحة اختبار V2
              </Link>
              <Link href="/matches" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 text-sm font-black text-[#EAFBFF] transition hover:border-[#0FF0FC]/45 hover:bg-[#0FF0FC]/15 hover:text-white">
                العودة إلى المباريات <ArrowLeft size={16} />
              </Link>
            </div>
          </div>
          {useV2 ? (
            <InternalAnimationPlayerV2 matchId={animationMatchId} dbMatchId={match.id} />
          ) : (
            <InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} />
          )}
        </section>
      </section>
    </main>
  );
}
