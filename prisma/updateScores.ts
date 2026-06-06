import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { calculateTeamPrice, calculatePlayerPrice } from '../lib/scoring';

const prisma = new PrismaClient();

function getTeamScoreByFifaRank(rank: number | null): number {
  if (!rank || rank <= 0) return 65;
  if (rank === 1) return 99;
  if (rank === 2) return 98;
  if (rank === 3) return 97;
  
  let score = 100 - (rank * 0.9);
  if (rank > 10) score = 91 - ((rank - 10) * 0.6);
  if (rank > 30) score = 79 - ((rank - 30) * 0.4);
  if (rank > 50) score = 71 - ((rank - 50) * 0.2);
  
  return Math.max(60, Math.min(99, Math.round(score)));
}

async function main() {
  console.log('🔄 Starting Score Update based on FIFA Rankings...');

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    include: { players: true }
  });

  let updatedTeams = 0;
  let updatedPlayers = 0;

  for (const team of teams) {
    const fifaRank = team.fifaRank || 50;
    const newTeamScore = getTeamScoreByFifaRank(fifaRank);
    
    // Calculate accurate price based on comprehensive formula
    const newTeamPrice = calculateTeamPrice(team, team.players);

    await prisma.asset.update({
      where: { id: team.id },
      data: {
        score: newTeamScore,
        current_price: newTeamPrice,
        high_price: Math.max(team.high_price, newTeamPrice),
      }
    });
    updatedTeams++;

    for (const player of team.players) {
      // Calculate player score based on Team Score + tier bonus (deterministic)
      const tier = player.playerTier || 0.5;
      
      let playerOffset = 0;
      if (tier >= 0.9) {
        playerOffset = 2; // Fixed instead of random
      } else if (tier >= 0.7) {
        playerOffset = 0; // Fixed instead of random
      } else {
        playerOffset = -3; // Fixed instead of random
      }

      const newPlayerScore = Math.max(50, Math.min(99, newTeamScore + playerOffset));
      
      // Calculate price based on robust formula
      const tempPlayerObj = { ...player, score: newPlayerScore }; // simulate updated score if needed
      const newPlayerPrice = calculatePlayerPrice(tempPlayerObj);

      await prisma.asset.update({
        where: { id: player.id },
        data: {
          score: newPlayerScore,
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
