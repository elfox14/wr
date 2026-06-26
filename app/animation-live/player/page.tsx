import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';

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

export default async function AnimationLivePlayerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const dbMatchId = await resolveDbMatchId(params);

  if (dbMatchId) redirect(`/live-animation/${encodeURIComponent(dbMatchId)}`);
  redirect('/animation-live');
}
