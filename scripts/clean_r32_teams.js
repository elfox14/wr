const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const matches = await prisma.match.findMany({
    where: { stage: { in: ['round_of_32', 'last_32'] } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'desc' } // Keep the newest ones
  });
  
  const seenTeams = new Set();
  const toDelete = [];
  
  for (const match of matches) {
    const home = match.homeTeamId;
    const away = match.awayTeamId;
    
    if (seenTeams.has(home) || seenTeams.has(away)) {
      toDelete.push(match);
    } else {
      if (home) seenTeams.add(home);
      if (away) seenTeams.add(away);
    }
  }
  
  console.log(`Keeping matches for ${seenTeams.size} teams.`);
  console.log(`Found ${toDelete.length} matches where a team is duplicated.`);
  
  for (const match of toDelete) {
    await prisma.match.delete({ where: { id: match.id } });
    console.log(`Deleted match ${match.id} (${match.homeTeam?.name} vs ${match.awayTeam?.name})`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
