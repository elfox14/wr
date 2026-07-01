import { PrismaClient } from '@prisma/client';
import { resolveTheStatsProviderId, defaultTheStatsQuery } from '../lib/theStatsMatchExtras';

const prisma = new PrismaClient();

async function run() {
  const matchId = 'cmqyb3clr0049g70sf95q01pp';
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true }
  });

  if (!match) {
    console.log('Match not found');
    return;
  }

  console.log(`Matching for: ${match.homeTeam.name} vs ${match.awayTeam.name} on ${match.matchDate}`);

  // Test resolution
  const query = defaultTheStatsQuery(new URLSearchParams());
  const resolved = await resolveTheStatsProviderId(match, query);
  
  console.log('Result:', JSON.stringify(resolved, null, 2));
}

run().finally(() => prisma.$disconnect());
