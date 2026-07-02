const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const matches = await prisma.match.findMany({
    where: { stage: { in: ['round_of_32', 'last_32'] } },
    include: { homeTeam: true, awayTeam: true },
  });
  
  if (matches.length > 0) {
    console.log(`Found ${matches.length} matches.`);
    for (let i = 0; i < 5; i++) {
       if (matches[i]) {
         console.log(`${matches[i].homeTeamId} (${matches[i].homeTeam.code}) vs ${matches[i].awayTeamId} (${matches[i].awayTeam.code}), status: ${matches[i].status}, score: ${matches[i].homeScore}-${matches[i].awayScore}`);
       }
    }
  } else {
    console.log("No round_of_32 matches found.");
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
