import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { apiFootballFetch } from '../lib/apiFootball';
import { importOfficialSquad } from '../lib/officialSquadImport';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('--- STARTING PLAYER WIPE AND RESEED ---');

  // 1. Delete all existing player-related data
  console.log('Deleting player-related holdings...');
  await prisma.holding.deleteMany({ where: { asset: { type: 'PLAYER' } } });
  
  console.log('Deleting player-related transactions...');
  await prisma.transaction.deleteMany({ where: { asset: { type: 'PLAYER' } } });
  
  console.log('Deleting player-related market news...');
  await prisma.marketNews.deleteMany({ where: { asset: { type: 'PLAYER' } } });
  
  console.log('Deleting player-related price history...');
  await prisma.priceHistory.deleteMany({ where: { asset: { type: 'PLAYER' } } });
  
  console.log('Deleting player-related captain selections...');
  await prisma.captainSelection.deleteMany({ where: { asset: { type: 'PLAYER' } } });
  
  console.log('Deleting player-related performances...');
  await prisma.playerPerformance.deleteMany({ where: { asset: { type: 'PLAYER' } } });

  console.log('Deleting all player assets...');
  const deletedPlayers = await prisma.asset.deleteMany({ where: { type: 'PLAYER' } });
  console.log(`✅ Successfully deleted ${deletedPlayers.count} players.`);

  // 2. Fetch all teams
  console.log('\nFetching teams from database...');
  const teams = await prisma.asset.findMany({
    where: { 
      type: 'TEAM',
      apiFootballId: { not: null }
    },
    select: { id: true, name: true, code: true, apiFootballId: true }
  });
  console.log(`Found ${teams.length} teams with a valid apiFootballId.`);

  let totalImported = 0;

  // 3. Re-seed players using ISPORTS API
  for (const team of teams) {
    if (!team.apiFootballId) continue;
    
    console.log(`\nFetching players for team: ${team.name} (API ID: ${team.apiFootballId})...`);
    
    try {
      const apiResponse = await apiFootballFetch('/players/squads', { team: team.apiFootballId });
      const apiPlayers = apiResponse?.response?.[0]?.players || [];
      
      if (apiPlayers.length === 0) {
        console.log(`⚠️ No players returned for ${team.name}`);
        continue;
      }
      
      const inputPlayers = apiPlayers.map((p: any) => ({
        name: p.name,
        position: p.position,
        age: p.age,
        image: p.photo,
        shirtNumber: p.number,
        externalId: p.id
      }));

      const result = await importOfficialSquad({
        teamId: team.id,
        teamCode: team.code || undefined,
        teamName: team.name,
        sourceName: 'ISPORTS API',
        sourceUrl: 'http://api.isportsapi.com',
        replaceExisting: false, 
        players: inputPlayers
      });

      if (result.ok) {
        console.log(`✅ Imported ${result.imported} players for ${team.name}. Skipped: ${result.skipped}`);
        totalImported += result.imported || 0;
      } else {
        console.error(`❌ Failed to import squad for ${team.name}`);
      }

      // Add a tiny delay to be polite to the API if needed
      await sleep(200);

    } catch (error: any) {
      console.error(`❌ Error fetching/importing players for ${team.name}:`, error.message);
    }
  }

  console.log(`\n--- RESEED COMPLETED ---`);
  console.log(`Total players imported: ${totalImported}`);
}

main()
  .catch(e => {
    console.error('Fatal error during wipe and reseed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
