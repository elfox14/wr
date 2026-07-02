import prisma from '../lib/prisma';

async function check() {
  const matches = await prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'TIMED', 'NOT_STARTED'] } },
    orderBy: { matchDate: 'asc' },
    select: { id: true, matchDate: true, externalId: true, homeTeamId: true, awayTeamId: true, status: true, stage: true }
  });
  console.log('Upcoming matches:', matches.length);
  matches.forEach(m => console.log(`${m.externalId}: ${m.homeTeamId} vs ${m.awayTeamId} on ${m.matchDate} (stage: ${m.stage})`));
  await prisma.$disconnect();
}
check();
