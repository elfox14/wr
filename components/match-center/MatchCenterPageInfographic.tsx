import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import MatchStatsInfographic from './MatchStatsInfographic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getMatch(id: string) {
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 10 },
    },
  });
  if (!match) return null;
  const players = await prisma.asset.findMany({
    where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } },
    select: { id: true, name: true, code: true, image: true, teamId: true },
    take: 80,
  });
  return { ...match, squadPlayers: players };
}

export default async function MatchCenterPageInfographic({ matchId }: { matchId: string }) {
  const match = await getMatch(matchId);
  if (!match) notFound();
  return <MatchStatsInfographic match={match} />;
}
