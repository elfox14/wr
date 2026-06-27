import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.asset.findMany({
    take: 10,
    where: { image: { contains: 'ui-avatars.com' } }
  });
  console.log(assets.map(a => ({ id: a.id, name: a.name, image: a.image })));
}

main().finally(() => prisma.$disconnect());
