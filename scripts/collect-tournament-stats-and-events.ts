import { runFinishedMatchesBackfill } from '../lib/finishedMatchesBackfill';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting World Cup 2026 matches statistics and events backfill...');
  
  // Retry DB connection up to 5 times
  let count = 0;
  const dbMaxAttempts = 5;
  for (let attempt = 1; attempt <= dbMaxAttempts; attempt++) {
    try {
      count = await prisma.match.count({
        where: {
          status: { in: ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'] }
        }
      });
      break;
    } catch (err: any) {
      if (attempt === dbMaxAttempts) {
        throw new Error(`Failed to connect to database after ${dbMaxAttempts} attempts: ${err.message || err}`);
      }
      console.log(`[DB Warning] Connection attempt ${attempt}/${dbMaxAttempts} failed. Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`Total finished matches in database: ${count}`);

  console.log('Running backfill...');
  const result = await runFinishedMatchesBackfill({
    limit: 120,          // Cover all matches
    lookbackDays: 60,    // Cover the entire tournament from June 11
    freshnessHours: 1,   // Refresh anything that isn't extremely recent
    timeoutMs: 30000,
    force: true,         // Force fetch and refresh
    dryRun: false,       // Apply changes
    includeRaw: true,    // Save raw responses
    stopOnRateLimit: false, // Don't stop on 429, we have retry logic
    syncAnimation: false,
    markVerified: true
  });

  console.log('\nBackfill completed!');
  console.log('Summary of processed matches:');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error('Fatal error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
