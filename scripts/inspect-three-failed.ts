import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const matchNames = ['England vs Croatia', 'Scotland vs Morocco', 'Brazil vs Haiti'];
  
  for (const name of matchNames) {
    const [home, away] = name.split(' vs ');
    let match: any = null;
    const dbMaxAttempts = 5;
    for (let attempt = 1; attempt <= dbMaxAttempts; attempt++) {
      try {
        match = await prisma.match.findFirst({
          where: {
            homeTeam: { name: home },
            awayTeam: { name: away }
          },
          include: {
            homeTeam: true,
            awayTeam: true
          }
        });
        break;
      } catch (err: any) {
        if (attempt === dbMaxAttempts) {
          throw new Error(`Failed to query database after ${dbMaxAttempts} attempts: ${err.message || err}`);
        }
        console.log(`[DB Warning] Query attempt ${attempt}/${dbMaxAttempts} failed. Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

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

    let snapshots: any[] = [];
    for (let attempt = 1; attempt <= dbMaxAttempts; attempt++) {
      try {
        snapshots = await prisma.matchStatsSnapshot.findMany({
          where: { matchId: match.id, provider: { startsWith: 'THE_STATS_API' } },
          orderBy: { capturedAt: 'desc' },
          select: {
            id: true,
            provider: true,
            providerMatchId: true,
            capturedAt: true,
            rawData: true
          }
        });
        break;
      } catch (err: any) {
        if (attempt === dbMaxAttempts) {
          throw new Error(`Failed to query database after ${dbMaxAttempts} attempts: ${err.message || err}`);
        }
        console.log(`[DB Warning] Query attempt ${attempt}/${dbMaxAttempts} failed. Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`Snapshots count (THE_STATS_API*): ${snapshots.length}`);
    snapshots.forEach((snap, idx) => {
      if (idx >= 10) return; // Only print top 10
      console.log(`  [${idx + 1}] Provider: ${snap.provider} | ProviderMatchId: ${snap.providerMatchId} | CapturedAt: ${snap.capturedAt}`);
      const raw = snap.rawData as any;
      if (raw) {
        console.log(`      resolvedProviderMatchId: ${raw.resolvedProviderMatchId}`);
        console.log(`      resolvedBy: ${raw.resolvedBy}`);
        console.log(`      endpointsOk: ${JSON.stringify(raw.endpointsOk)}`);
        console.log(`      endpointsFailed: ${JSON.stringify(raw.endpointsFailed)}`);
      }
      const candidates = [
        raw?.resolvedProviderMatchId,
        raw?.providerMatchId,
        raw?.matchId,
        raw?.source?.providerMatchId,
        raw?.normalized?.matchInfo?.providerMatchId,
        snap?.providerMatchId ? `mt_${snap.providerMatchId}` : null
      ];
      console.log(`      candidates: ${JSON.stringify(candidates)}`);
      for (const candidate of candidates) {
        console.log(`        normalize(${candidate}) -> ${normalizeProviderId(candidate)}`);
      }
    });
  }
}

function normalizeProviderId(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const digits = raw.replace(/^mt_/i, '').replace(/\D/g, '');
  if (digits.length <= 6) return null;
  const id = `mt_${digits}`;
  return id !== 'mt_' && id !== 'mt_12345' ? id : null;
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
