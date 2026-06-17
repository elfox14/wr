import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ArrowLeft, Radio } from 'lucide-react';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';
import GenerateMatchArticleButton from './GenerateMatchArticleButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'البث التفاعلي | MC PRIME World Cup',
  description: 'البث التفاعلي للمباراة: بطاقة المباراة، الملعب التفاعلي، الإحصائيات، والأحداث المهمة.',
};

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function getMatch(id: string) {
  return prisma.match.findUnique({ where: { id }, include: { homeTeam: true, awayTeam: true } });
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const session = await getServerSession(authOptions as any) as AdminSession;
  const canGenerateArticle = isAdmin(session);
  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        {canGenerateArticle && <GenerateMatchArticleButton matchId={match.id} />}

        <section id="live-broadcast" className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-3 shadow-card sm:rounded-[1.5rem] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex min-w-0 items-center gap-2 text-base font-black text-white sm:text-xl"><Radio className="text-[#FFD700]" /> البث التفاعلي</h1>
              <div className="mt-1 text-[10px] font-black text-[#FFD700]">المشغل التفاعلي المباشر</div>
            </div>
            <Link href="/matches" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 text-sm font-black text-[#EAFBFF] transition hover:border-[#0FF0FC]/45 hover:bg-[#0FF0FC]/15 hover:text-white">
              العودة إلى المباريات <ArrowLeft size={16} />
            </Link>
          </div>
          <InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} />
        </section>
      </section>
    </main>
  );
}
