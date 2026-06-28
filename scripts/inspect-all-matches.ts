import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying matches in DB...');
  const totalMatchesCount = await prisma.match.count();
  console.log(`Total matches in DB: ${totalMatchesCount}`);

  const stages = await prisma.match.groupBy({
    by: ['stage'],
    _count: {
      id: true,
    },
  });
  console.log('Stages present in DB:', JSON.stringify(stages, null, 2));

  // Let's get all matches
  const allMatches = await prisma.match.findMany({
    orderBy: { matchDate: 'asc' },
    include: {
      homeTeam: true,
      awayTeam: true,
    }
  });

  console.log(`\nAll matches in DB (${allMatches.length}):`);
  allMatches.forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.id}] ${m.homeTeam.name} (${m.homeTeam.code}) vs ${m.awayTeam.name} (${m.awayTeam.code}) | Stage: ${m.stage} | GroupPhase: ${m.groupPhase} | Date: ${m.matchDate.toISOString()} | Status: ${m.status}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
