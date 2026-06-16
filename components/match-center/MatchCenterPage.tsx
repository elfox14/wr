import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Radio } from 'lucide-react';
import prisma from '@/lib/prisma';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'البث التفاعلي | MC PRIME World Cup',
  description: 'البث التفاعلي للمباراة: بطاقة المباراة، الملعب التفاعلي، الإحصائيات، والأحداث المهمة.',
};

async function getMatch(id: string) {
  return prisma.match.findUnique({ where: { id }, include: { homeTeam: true, awayTeam: true } });
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 sm:px-4">
          <Link href="/matches" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-black text-gray-300 transition hover:border-[#0FF0FC]/30 hover:text-white">
            <ArrowLeft size={16} /> العودة إلى المباريات
          </Link>
          <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-[11px] font-black text-[#FFD700]">البث التفاعلي</span>
        </div>

        <section id="live-broadcast" className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-3 shadow-card sm:rounded-[1.5rem] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h1 className="flex min-w-0 items-center gap-2 text-base font-black text-white sm:text-xl"><Radio className="text-[#FFD700]" /> البث التفاعلي</h1>
          </div>
          <InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} />
        </section>
      </section>
    </main>
  );
}
