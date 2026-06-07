import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { calculateAssetScore, calculateFairValue } from '../lib/scoring';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting Score Update using new Valuation Engine...');

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    include: { players: true }
  });

  let updatedTeams = 0;
  let updatedPlayers = 0;

  for (const team of teams) {
    const newTeamScore = calculateAssetScore(team, team.players);
    const newTeamPrice = calculateFairValue(newTeamScore, 'TEAM');

    await prisma.asset.update({
      where: { id: team.id },
      data: {
        score: newTeamScore,
        fairValue: newTeamPrice,
        // Optional: you can sync current_price if desired, but in the new system
        // current_price is market-driven. For this script, we'll sync it to keep things aligned if needed.
        current_price: newTeamPrice, 
        high_price: Math.max(team.high_price, newTeamPrice),
      }
    });
    updatedTeams++;

    for (const player of team.players) {
      const newPlayerScore = calculateAssetScore(player);
      const newPlayerPrice = calculateFairValue(newPlayerScore, 'PLAYER');

      await prisma.asset.update({
        where: { id: player.id },
        data: {
          score: newPlayerScore,
          fairValue: newPlayerPrice,
          current_price: newPlayerPrice,
          high_price: Math.max(player.high_price, newPlayerPrice),
        }
      });
      updatedPlayers++;
    }
  }

  console.log(`✅ Successfully updated scores for ${updatedTeams} teams and ${updatedPlayers} players.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
