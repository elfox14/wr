import prisma from '../lib/prisma';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let match = null;
  const dbMaxAttempts = 5;
  
  for (let attempt = 1; attempt <= dbMaxAttempts; attempt++) {
    try {
      match = await prisma.match.findFirst({
        where: {
          homeTeam: { name: 'England' },
          awayTeam: { name: 'Croatia' }
        }
      });
      break;
    } catch (err: any) {
      if (attempt === dbMaxAttempts) {
        throw new Error(`Failed to query database after ${dbMaxAttempts} attempts: ${err.message || err}`);
      }
      console.log(`[DB Warning] Query attempt ${attempt}/${dbMaxAttempts} failed. Retrying in 5 seconds...`);
      await sleep(5000);
    }
  }

  if (!match) {
    console.error('Match not found');
    return;
  }

  console.log('Match found:', {
    id: match.id,
    matchDate: match.matchDate,
    externalId: match.externalId
  });

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
    console.log(`\n--- Snapshot [${idx + 1}] ---`);
    console.log(`  Provider: ${snap.provider} | ProviderMatchId: ${snap.providerMatchId} | CapturedAt: ${snap.capturedAt}`);
    const raw = snap.rawData as any;
    if (raw) {
      console.log(`  resolvedProviderMatchId: ${raw.resolvedProviderMatchId}`);
      console.log(`  resolvedBy: ${raw.resolvedBy}`);
      console.log(`  endpointsOk: ${JSON.stringify(raw.endpointsOk)}`);
      console.log(`  endpointsFailed: ${JSON.stringify(raw.endpointsFailed)}`);
      console.log(`  endpoints: ${JSON.stringify(raw.endpoints)}`);
    }
  });
}

main().finally(() => prisma.$disconnect());
