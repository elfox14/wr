const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const matches = await prisma.match.findMany({ where: { stage: 'round_of_32' } });
  console.log('Matches:', matches.length);
  console.log('Finished:', matches.filter(m => m.status === 'FINISHED').length);
}

run().finally(() => prisma.$disconnect());
