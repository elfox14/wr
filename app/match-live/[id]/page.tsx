import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'البث المباشر | MC PRIME World Cup',
  description: 'ملعب تفاعلي مباشر للمباراة مع الأحداث والإحصائيات اللحظية.',
};

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: { homeTeam: true, awayTeam: true },
  });
}

function teamName(team: any, fallback: string) {
  return team?.name || team?.code || fallback;
}

export default async function MatchLivePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';
  const title = `${teamName(match.homeTeam, 'الفريق الأول')} ضد ${teamName(match.awayTeam, 'الفريق الثاني')}`;

  return (
    <main className="min-h-screen bg-[#02060d] text-white" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6">
        <header className="rounded-[1.5rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.06] p-4 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#0FF0FC]">Live Interactive Pitch</p>
              <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">الملعب التفاعلي المباشر</h1>
              <p className="mt-1 text-sm font-bold text-gray-400">{title}</p>
            </div>
            <Link
              href={`/match-center/${encodeURIComponent(match.id)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black"
            >
              العودة لإحصائيات المباراة
            </Link>
          </div>
        </header>

        <InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} />
      </section>
    </main>
  );
}
