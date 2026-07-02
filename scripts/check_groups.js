const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.asset.findMany({
    where: { name: { in: ['باراغواي', 'السويد', 'الإكوادور', 'السنغال', 'البوسنة والهرسك', 'الكونغو الديمقراطية', 'الجزائر', 'غانا'] } },
    select: { name: true, group: true }
  });
  console.log(t);
}
run().finally(()=>prisma.$disconnect());
