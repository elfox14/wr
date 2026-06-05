import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Assigning 48 teams into 12 groups of 4 using World Cup Pot System...');

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    orderBy: { fifaRank: 'asc' }
  });

  if (teams.length !== 48) {
    console.warn(`Warning: Expected 48 teams, found ${teams.length}`);
  }

  // Create Pots based on FIFA rank (12 teams per pot)
  const pot1 = teams.slice(0, 12);
  const pot2 = teams.slice(12, 24);
  const pot3 = teams.slice(24, 36);
  const pot4 = teams.slice(36, 48);

  const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  
  // Assign exactly one team from each pot to each group
  for (let i = 0; i < groupNames.length; i++) {
    const groupName = groupNames[i];
    
    const groupTeams = [
      pot1[i],
      pot2[i],
      pot3[i],
      pot4[i]
    ].filter(Boolean); // Filter undefined just in case

    for (const team of groupTeams) {
      await prisma.asset.update({
        where: { id: team.id },
        data: { group: groupName }
      });
      console.log(`Assigned ${team.name} to Group ${groupName} (Pot ${groupTeams.indexOf(team) + 1})`);
    }
  }

  console.log('Done assigning groups with proper Pot distribution!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
