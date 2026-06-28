import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  console.log(`Current Time (UTC): ${now.toISOString()}`);
  console.log(`Live Window Start: ${liveWindowStart.toISOString()}`);
  console.log(`Upcoming Until: ${upcomingUntil.toISOString()}`);

  const ACTIVE_HOME_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', 'LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'HT'];

  // Try connecting with retry
  for (let i = 0; i < 3; i++) {
    try {
      await prisma.$connect();
      break;
    } catch (e) {
      console.log(`Retry ${i+1} failed...`);
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const upcomingMatches = await prisma.match.findMany({
    where: {
      status: { in: ACTIVE_HOME_STATUSES },
      matchDate: { gte: liveWindowStart, lte: upcomingUntil },
    },
    orderBy: { matchDate: 'asc' },
    include: {
      homeTeam: true,
      awayTeam: true,
    }
  });

  console.log(`\nUpcoming matches found (${upcomingMatches.length}):`);
  upcomingMatches.forEach(m => {
    console.log(`- [${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name} | Stage: ${m.stage} | Date: ${m.matchDate.toISOString()} | Status: ${m.status}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
