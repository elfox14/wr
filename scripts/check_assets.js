const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.asset.findMany({
    select: { name: true, group: true, code: true }
  });
  require('fs').writeFileSync('assets.json', JSON.stringify(t, null, 2));
}
run().finally(() => prisma.$disconnect());
