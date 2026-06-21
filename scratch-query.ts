process.env.DATABASE_URL = "postgresql://worldcup_db1_user:qNfRNawbc8BVCSbNtzfLYgRwDQz4P6pZ@dpg-d8mbvuho3t8c73bkcqk0.oregon-postgres.render.com/worldcup_db1?sslmode=require";

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Matches ---');
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const matches = await prisma.match.findMany({
    where: {
      matchDate: {
        gte: todayStart,
      },
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      statsSnapshots: {
        select: {
          id: true,
          provider: true,
          capturedAt: true,
        }
      }
    },
    orderBy: { matchDate: 'desc' }
  });

  for (const m of matches) {
    console.log(`Match ID: ${m.id} | Date: ${m.matchDate.toISOString()} | ${m.homeTeam.name} vs ${m.awayTeam.name} | Status: ${m.status} | Score: ${m.homeScore}-${m.awayScore}`);
    console.log(`  Animation ID: ${m.animationMatchId} | External ID: ${m.externalId}`);
    console.log(`  Snapshots count: ${m.statsSnapshots.length}`);
    for (const snap of m.statsSnapshots) {
      console.log(`    - Provider: ${snap.provider} | Captured: ${snap.capturedAt.toISOString()}`);
    }
  }

  console.log('\n--- Cron Run Logs ---');
  try {
    const logs = await prisma.$queryRawUnsafe(`
      SELECT * FROM "CronRunLog"
      WHERE "jobName" = 'the-stats-postmatch-final-sync'
      ORDER BY "finishedAt" DESC
      LIMIT 10
    `) as any[];
    for (const log of logs) {
      console.log(`Job: ${log.jobName} | Status: ${log.status} | Message: ${log.message} | Finished: ${log.finishedAt}`);
    }
  } catch (err: any) {
    console.log('Error querying CronRunLog:', err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
