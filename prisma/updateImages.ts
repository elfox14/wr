import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function updateTeams() {
  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
  });

  console.log(`Found ${teams.length} teams. Updating images...`);

  for (const team of teams) {
    try {
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team.name)}`);
      const data = await res.json();

      if (data && data.teams && data.teams.length > 0) {
        const teamBadge = data.teams[0].strTeamBadge;
        if (teamBadge) {
          await prisma.asset.update({
            where: { id: team.id },
            data: { image: teamBadge },
          });
          console.log(`✅ Updated team ${team.name} with badge`);
        } else {
          console.log(`⚠️ No badge found for team ${team.name}`);
        }
      } else {
        console.log(`❌ Team not found in API: ${team.name}`);
      }
    } catch (e) {
      console.log(`🚨 Error updating team ${team.name}:`, e);
    }
    await delay(300); // Respect rate limits
  }
}

async function updatePlayers() {
  const players = await prisma.asset.findMany({
    where: { type: 'PLAYER' },
  });

  console.log(`Found ${players.length} players. Updating images...`);

  for (const player of players) {
    try {
      // Often player names have full names like "Kylian Mbappé", TheSportsDB might work better with last name or full name
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(player.name)}`);
      const data = await res.json();

      if (data && data.player && data.player.length > 0) {
        const playerThumb = data.player[0].strThumb || data.player[0].strCutout || data.player[0].strRender;
        if (playerThumb) {
          await prisma.asset.update({
            where: { id: player.id },
            data: { image: playerThumb },
          });
          console.log(`✅ Updated player ${player.name}`);
        } else {
          console.log(`⚠️ No photo found for player ${player.name}`);
        }
      } else {
        // Try searching by last name if full name fails
        const nameParts = player.name.split(' ');
        if (nameParts.length > 1) {
          const lastName = nameParts[nameParts.length - 1];
          const res2 = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(lastName)}`);
          const data2 = await res2.json();
          if (data2 && data2.player && data2.player.length > 0) {
            const playerThumb = data2.player[0].strThumb || data2.player[0].strCutout || data2.player[0].strRender;
            if (playerThumb) {
              await prisma.asset.update({
                where: { id: player.id },
                data: { image: playerThumb },
              });
              console.log(`✅ Updated player ${player.name} (by last name)`);
            } else {
              console.log(`⚠️ No photo found for player ${player.name} even by last name`);
            }
          } else {
            console.log(`❌ Player not found in API: ${player.name}`);
          }
        } else {
          console.log(`❌ Player not found in API: ${player.name}`);
        }
      }
    } catch (e) {
      console.log(`🚨 Error updating player ${player.name}:`, e);
    }
    await delay(300); // Respect rate limits
  }
}

async function main() {
  await updateTeams();
  await updatePlayers();
  console.log('Finished updating images!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
