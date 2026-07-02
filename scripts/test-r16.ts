import prisma from '../lib/prisma';

async function check() {
  const r16 = await prisma.match.findMany({
    where: { stage: 'round_of_16' },
    orderBy: { matchDate: 'asc' },
    select: { id: true, matchDate: true, externalId: true, homeTeamId: true, awayTeamId: true, status: true }
  });
  console.log('R16 matches:', r16.length);
  r16.forEach(m => console.log(`${m.externalId}: ${m.homeTeamId} vs ${m.awayTeamId} on ${m.matchDate}`));
  await prisma.$disconnect();
}
check();
