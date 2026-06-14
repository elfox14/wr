import prisma from '@/lib/prisma';

export async function clearPlaceholderApiFootballIds() {
  const [teams, players] = await Promise.all([
    prisma.asset.updateMany({
      where: {
        type: 'TEAM',
        apiFootballId: { lte: 0 },
      },
      data: { apiFootballId: null },
    }),
    prisma.asset.updateMany({
      where: {
        type: 'PLAYER',
        apiFootballId: { lte: 0 },
      },
      data: { apiFootballId: null },
    }),
  ]);

  return {
    ok: true,
    teamsUpdated: teams.count,
    playersUpdated: players.count,
  };
}
