import { PrismaClient } from '@prisma/client';

const ADMIN_SECRET = 'mcprime_api_admin_2026_x9Kp_72_safemahMAH1';
const BASE_URL = 'https://worldcup.mcprim.com';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Querying finished matches from database...');
  let matches: any[] = [];
  const dbMaxAttempts = 5;
  for (let attempt = 1; attempt <= dbMaxAttempts; attempt++) {
    try {
      matches = await prisma.match.findMany({
        where: {
          status: { in: ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'] }
        },
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } }
        },
        orderBy: { matchDate: 'asc' } // Oldest first
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

  console.log(`Found ${matches.length} finished matches to force backfill.`);
  
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const label = `${match.homeTeam?.name} vs ${match.awayTeam?.name}`;
    console.log(`\n[${i + 1}/${matches.length}] Processing: ${label} (ID: ${match.id})`);

    const url = `${BASE_URL}/api/cron/finished-matches-backfill?adminSecret=${ADMIN_SECRET}&matchId=${match.id}&force=true&stopOnRateLimit=false&syncAnimation=false`;

    let attempt = 1;
    const maxAttempts = 3;
    let ok = false;
    
    while (attempt <= maxAttempts && !ok) {
      try {
        console.log(`  Calling remote backfill endpoint (attempt ${attempt}/${maxAttempts})...`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result: any = await response.json();
        const p = result.processed?.[0] || {};
        
        if (result.ok && p.ok) {
          console.log(`  Success! Mark Verified: ${p.markedFinalVerified}`);
          const counts = p.counts || {};
          console.log(`  Quality: ${p.quality?.dataQuality} | Stats: ${counts.stats} | Events: ${counts.detailedEvents} | Players: ${counts.playerStats}`);
          successCount++;
          ok = true;
        } else {
          console.log(`  Failed to collect: ${p.error || 'No useful data returned'}`);
          console.log(`  Endpoints failed: ${JSON.stringify(p.endpointsFailed || [])}`);
          attempt++;
          if (attempt <= maxAttempts) {
            console.log('  Waiting 15 seconds before retry...');
            await sleep(15000);
          }
        }
      } catch (err: any) {
        console.error(`  Error during call:`, err.message || err);
        attempt++;
        if (attempt <= maxAttempts) {
          console.log('  Waiting 15 seconds before retry...');
          await sleep(15000);
        }
      }
    }

    if (!ok) {
      failCount++;
      console.log(`  [Warning] Failed to backfill: ${label}`);
    }

    // Sleep 15 seconds between matches to stay well within the API rate limits
    if (i < matches.length - 1) {
      console.log('Waiting 15 seconds before next match...');
      await sleep(15000);
    }
  }

  console.log('\n--- Final Summary ---');
  console.log(`Total Matches Processed: ${matches.length}`);
  console.log(`Successfully Backfilled: ${successCount}`);
  console.log(`Failed/Skipped: ${failCount}`);
}

main()
  .catch(e => console.error('Fatal error:', e))
  .finally(() => prisma.$disconnect());
