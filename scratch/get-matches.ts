import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    take: 5,
    include: {
      homeTeam: true,
      awayTeam: true,
    }
  });
  console.log(JSON.stringify(matches, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
