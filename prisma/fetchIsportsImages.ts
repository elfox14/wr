import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_KEY = process.env.ISPORTS_API_KEY;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function normalizeName(name: string): string {
  // Remove accents, special chars, lower case
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchIsportsImages() {
  console.log('🔄 Starting Image Fetch from iSports API...');

  if (!API_KEY) {
    console.error('❌ ISPORTS_API_KEY is missing in .env');
    return;
  }

  // 1. Fetch all teams to create a mapping
  console.log('📡 Fetching teams list from iSports API...');
  const teamsRes = await fetch(`http://api.isportsapi.com/sport/football/team?api_key=${API_KEY}`);
  const teamsData = await teamsRes.json();
  
  if (teamsData.code !== 0 || !teamsData.data) {
    console.error('❌ Failed to fetch teams:', teamsData);
    return;
  }

  const isportsTeams = teamsData.data;
  console.log(`✅ Fetched ${isportsTeams.length} teams from iSports.`);

  // Create a map for quick lookup
  const teamMap = new Map<string, any>();
  for (const team of isportsTeams) {
    if (team.isNational || team.name) {
      teamMap.set(normalizeName(team.name), team);
    }
  }

  // 2. Process Players in our DB that don't have images
  const playersWithoutImages = await prisma.asset.findMany({
    where: { 
      type: 'PLAYER',
      NOT: { image: { startsWith: 'http' } }
    },
    include: {
      team: true
    }
  });

  console.log(`📡 Found ${playersWithoutImages.length} players needing images.`);

  if (playersWithoutImages.length === 0) {
    console.log('✅ All players already have images!');
    return;
  }

  // Group by DB Team
  const playersByTeam = new Map<string, any[]>();
  for (const p of playersWithoutImages) {
    const teamName = p.team?.name;
    if (!teamName) continue;
    if (!playersByTeam.has(teamName)) playersByTeam.set(teamName, []);
    playersByTeam.get(teamName)?.push(p);
  }

  let updatedPlayers = 0;

  for (const [dbTeamName, dbPlayers] of playersByTeam.entries()) {
    const normName = normalizeName(dbTeamName);
    
    // Attempt to find the iSports team ID
    let isportsTeam = teamMap.get(normName);
    
    // Some hardcoded fallbacks if names don't exactly match
    if (!isportsTeam) {
      if (normName === 'usa' || normName === 'unitedstates') isportsTeam = teamMap.get('usa');
      else if (normName === 'korea') isportsTeam = teamMap.get('southkorea');
    }

    if (!isportsTeam) {
      console.log(`⚠️ Team not found in iSports: ${dbTeamName}`);
      continue;
    }

    console.log(`⚽ Checking Team: ${dbTeamName} (iSports ID: ${isportsTeam.teamId})`);
    
    try {
      await sleep(1000); // polite delay
      const playersRes = await fetch(`http://api.isportsapi.com/sport/football/player?api_key=${API_KEY}&teamId=${isportsTeam.teamId}`);
      const playersData = await playersRes.json();

      if (playersData.code !== 0 || !playersData.data) {
        console.warn(`⚠️ Failed to fetch players for ${dbTeamName}:`, playersData.message);
        continue;
      }

      const isportsSquad = playersData.data;

      // Try to match each DB player to an iSports player
      for (const dbPlayer of dbPlayers) {
        const normDbPlayerName = normalizeName(dbPlayer.name);
        
        const match = isportsSquad.find((p: any) => normalizeName(p.name).includes(normDbPlayerName) || normDbPlayerName.includes(normalizeName(p.name)));
        
        if (match && match.photo) {
          await prisma.asset.update({
            where: { id: dbPlayer.id },
            data: { image: match.photo }
          });
          console.log(`  ✅ Updated Player: ${dbPlayer.name}`);
          updatedPlayers++;
        } else {
          console.log(`  ❌ No match or photo for Player: ${dbPlayer.name}`);
        }
      }
    } catch (e) {
      console.error(`Error processing team ${dbTeamName}:`, e);
    }
  }

  console.log(`\n🏆 iSports Image Sync Complete!`);
  console.log(`   Updated Players: ${updatedPlayers}`);
}

fetchIsportsImages()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
