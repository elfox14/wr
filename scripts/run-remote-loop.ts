const ADMIN_SECRET = 'mcprime_api_admin_2026_x9Kp_72_safemahMAH1';
const BASE_URL = 'https://worldcup.mcprim.com';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting remote World Cup 2026 backfill loop using native fetch...');
  
  let loopCount = 1;
  while (true) {
    console.log(`\n--- Iteration ${loopCount} ---`);
    const url = `${BASE_URL}/api/cron/finished-matches-backfill?adminSecret=${ADMIN_SECRET}&limit=3&lookbackDays=60&freshnessHours=24&force=false&stopOnRateLimit=true`;
    
    console.log(`Calling remote backfill endpoint...`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: any = await response.json();
      console.log(`Response Status: OK`);
      console.log(`Candidates returned: ${result.candidates}`);
      
      const processed = result.processed || [];
      const nonSkipped = processed.filter((m: any) => !m.skipped);
      console.log(`Processed (non-skipped) matches in this batch: ${nonSkipped.length}`);
      
      if (nonSkipped.length > 0) {
        for (const match of nonSkipped) {
          console.log(`- Match: ${match.title} | ID: ${match.matchId} | Success: ${match.ok}`);
          if (!match.ok) {
            console.log(`  Failed details: ${JSON.stringify(match.endpointsFailed || match.error)}`);
          } else {
            console.log(`  Events: ${JSON.stringify(match.projections?.events)} | Players: ${match.projections?.players?.upserted}`);
          }
        }
      } else {
        console.log('No new matches processed in this batch (all candidate matches skipped or already verified).');
        
        // Let's verify if there are any remaining unfinished matches
        console.log('Backfill loop finished! No more matches to process.');
        break;
      }
      
      if (result.stoppedEarly) {
        console.log(`Stopped early due to: ${JSON.stringify(result.stoppedEarly)}`);
        console.log('Rate limit detected on remote server. Sleeping 2 minutes before retrying...');
        await sleep(120000);
      } else {
        console.log('Sleeping 10 seconds before next batch...');
        await sleep(10000);
      }
    } catch (err: any) {
      console.error('HTTP Request failed:', err.message || err);
      console.log('Sleeping 15 seconds before retrying...');
      await sleep(15000);
    }
    loopCount++;
  }
  
  console.log('\nRemote backfill execution loop complete.');
}

main();
