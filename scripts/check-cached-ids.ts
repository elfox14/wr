import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: { provider: { startsWith: 'THE_STATS_API' } },
    select: {
      matchId: true,
      provider: true,
      providerMatchId: true,
      rawData: true,
      match: {
        select: {
          externalId: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } }
        }
      }
    }
  });

  console.log(`Found ${snapshots.length} snapshots:`);
  for (const s of snapshots) {
    const raw = s.rawData as any;
    const resolvedId = raw?.resolvedProviderMatchId || raw?.providerMatchId || s.providerMatchId;
    console.log(
      `Match: ${s.match.homeTeam.name} vs ${s.match.awayTeam.name} | ProviderMatchId: ${s.providerMatchId} | ResolvedId: ${resolvedId} | MatchExternalId: ${s.match.externalId}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
