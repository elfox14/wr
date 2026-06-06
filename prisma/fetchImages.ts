import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchImages() {
  console.log('🔄 Starting Image Fetch from TheSportsDB...');

  // 1. Process Teams
  const teams = await prisma.asset.findMany({
    where: { 
      type: 'TEAM',
      NOT: { image: { startsWith: 'http' } }
    }
  });

  console.log(`📡 Found ${teams.length} teams needing images.`);

  let updatedTeams = 0;
  for (const team of teams) {
    try {
      await sleep(650); // Respect 100 req/min limit
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team.name)}`);
      
      if (!res.ok) {
        console.warn(`⚠️ Failed to fetch team: ${team.name} (HTTP ${res.status})`);
        continue;
      }

      const data = await res.json();
      const badgeUrl = data?.teams?.[0]?.strTeamBadge;

      if (badgeUrl) {
        await prisma.asset.update({
          where: { id: team.id },
          data: { image: badgeUrl }
        });
        console.log(`✅ Updated Team: ${team.name}`);
        updatedTeams++;
      } else {
        console.log(`❌ No badge found for Team: ${team.name}`);
      }
    } catch (e) {
      console.error(`Error processing team ${team.name}:`, e);
    }
  }

  // 2. Process Players
  const players = await prisma.asset.findMany({
    where: { 
      type: 'PLAYER',
      NOT: { image: { startsWith: 'http' } }
    }
  });

  console.log(`\n📡 Found ${players.length} players needing images.`);

  let updatedPlayers = 0;
  for (const player of players) {
    try {
      await sleep(650); // Respect rate limit
      
      // Clean up player name to improve search accuracy
      // TheSportsDB works best with last names or full names without special accents sometimes, but we'll try exact first.
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(player.name)}`);
      
      if (!res.ok) {
        console.warn(`⚠️ Failed to fetch player: ${player.name} (HTTP ${res.status})`);
        continue;
      }

      const data = await res.json();
      const apiPlayer = data?.player?.[0];

      if (apiPlayer) {
        // Prefer cutout (transparent bg), then thumb (standard portrait), then render
        const imageUrl = apiPlayer.strCutout || apiPlayer.strThumb || apiPlayer.strRender;
        
        if (imageUrl) {
          await prisma.asset.update({
            where: { id: player.id },
            data: { image: imageUrl }
          });
          console.log(`✅ Updated Player: ${player.name}`);
          updatedPlayers++;
        } else {
          console.log(`❌ No image URL found in valid format for Player: ${player.name}`);
        }
      } else {
        console.log(`❌ Player not found in DB: ${player.name}`);
      }
    } catch (e) {
      console.error(`Error processing player ${player.name}:`, e);
    }
  }

  console.log(`\n🏆 Image Sync Complete!`);
  console.log(`   Updated Teams: ${updatedTeams}`);
  console.log(`   Updated Players: ${updatedPlayers}`);
}

fetchImages()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
