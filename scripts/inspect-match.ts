import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const matchNames = ['Sweden vs Tunisia', 'Spain vs Cape Verde', 'Belgium vs Egypt', 'South Korea vs Czech Republic'];
  
  for (const name of matchNames) {
    const [home, away] = name.split(' vs ');
    const match = await prisma.match.findFirst({
      where: {
        homeTeam: { name: home },
        awayTeam: { name: away }
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    if (!match) {
      console.log(`Match not found: ${name}`);
      continue;
    }

    console.log(`\n========================================`);
    console.log(`Match: ${name}`);
    console.log(`ID: ${match.id}`);
    console.log(`External ID: ${match.externalId}`);
    console.log(`Status: ${match.status}`);
    console.log(`Date: ${match.matchDate}`);

    const snapshots = await prisma.matchStatsSnapshot.findMany({
      where: { matchId: match.id },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        provider: true,
        providerMatchId: true,
        capturedAt: true,
        rawData: true
      }
    });

    console.log(`Snapshots count: ${snapshots.length}`);
    snapshots.forEach((snap, idx) => {
      console.log(`  [${idx + 1}] Provider: ${snap.provider} | ProviderMatchId: ${snap.providerMatchId} | CapturedAt: ${snap.capturedAt}`);
      const raw = snap.rawData as any;
      if (raw) {
        console.log(`      resolvedProviderMatchId: ${raw.resolvedProviderMatchId}`);
        console.log(`      resolvedBy: ${raw.resolvedBy}`);
        console.log(`      endpointsOk: ${JSON.stringify(raw.endpointsOk)}`);
        console.log(`      endpointsFailed: ${JSON.stringify(raw.endpointsFailed)}`);
      }
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
