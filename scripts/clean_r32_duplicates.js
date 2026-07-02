const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const matches = await prisma.match.findMany({
    where: { stage: { in: ['round_of_32', 'last_32'] } },
    include: { homeTeam: true, awayTeam: true }
  });
  
  console.log(`Found ${matches.length} round of 32 matches`);
  
  const toDelete = [];
  
  // A round of 32 match should have proper team names or specific placeholder names.
  // We should only keep the latest 16? Or maybe just delete everything that looks like a duplicate.
  // Wait, let's group by MatchDate or check if they are identical.
  for (const m of matches) {
    console.log(`- ${m.id}: ${m.homeTeam?.name} vs ${m.awayTeam?.name} (${m.matchDate})`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
