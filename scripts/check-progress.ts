import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking DB Status ---');
  
  // Retry database calls up to 5 times
  let statusCounts: any[] = [];
  const dbMaxAttempts = 5;
  for (let attempt = 1; attempt <= dbMaxAttempts; attempt++) {
    try {
      statusCounts = await prisma.match.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      } as any);
      break;
    } catch (err: any) {
      if (attempt === dbMaxAttempts) {
        throw new Error(`Failed to query database after ${dbMaxAttempts} attempts: ${err.message || err}`);
      }
      console.log(`[DB Warning] Query attempt ${attempt}/${dbMaxAttempts} failed. Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  console.log('Matches by status:');
  console.log(statusCounts);

  // 2. Snapshots in last 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const recentSnapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      capturedAt: { gte: thirtyMinAgo }
    },
    select: {
      capturedAt: true,
      provider: true,
      rawData: true,
      match: {
        select: {
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } }
        }
      }
    },
    orderBy: { capturedAt: 'desc' }
  });

  console.log(`Recent snapshots (last 30m): ${recentSnapshots.length}`);
  recentSnapshots.slice(0, 10).forEach(s => {
    const raw = s.rawData as any;
    console.log(`- ${s.capturedAt.toISOString()} | ${s.provider} | ${s.match?.homeTeam?.name} vs ${s.match?.awayTeam?.name}`);
    if (raw) {
      console.log(`    DataQuality: ${raw.dataQuality} | Counts: ${JSON.stringify(raw.counts)} | OK Endpoints: ${JSON.stringify(raw.endpointsOk)} | Failed Endpoints: ${JSON.stringify(raw.endpointsFailed)}`);
    }
  });

  // 3. MatchEvent count
  const matchEventCount = await prisma.matchEvent.count();
  console.log(`Total MatchEvents: ${matchEventCount}`);

  // 4. Duplicate events check
  const duplicateGroups: any[] = await prisma.$queryRaw`
    SELECT "matchId", "minute", "type", "playerName", COUNT(*) as cnt
    FROM "MatchEvent"
    GROUP BY "matchId", "minute", "type", "playerName"
    HAVING COUNT(*) > 1
  `;
  console.log(`Duplicate events groups count: ${duplicateGroups.length}`);
  
  if (duplicateGroups.length > 0) {
    console.log('Fetching details of duplicate groups...');
    for (const group of duplicateGroups.slice(0, 10)) {
      const rows = await prisma.matchEvent.findMany({
        where: {
          matchId: group.matchId,
          minute: group.minute,
          type: group.type,
          playerName: group.playerName
        },
        select: {
          id: true,
          matchId: true,
          minute: true,
          type: true,
          playerName: true,
          sourceName: true,
          detail: true
        }
      });
      console.log(`Duplicate Group (count: ${group.cnt}):`);
      console.log(rows);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
