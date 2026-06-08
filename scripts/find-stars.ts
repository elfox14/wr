process.env.DATABASE_URL = "postgresql://worldcup_db_wle8_user:An6i9mjJFz300GJdMNZdGmADBVGOyA3V@dpg-d8guunnlk1mc73dqddjg.oregon-postgres.render.com/worldcup_db_wle8";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stars = await prisma.asset.findMany({
    where: {
      name: {
        in: ['Kylian Mbappé', 'Kylian Mbappe', 'Jude Bellingham', 'Vinícius Júnior', 'Vinicius Junior', 'Vinicius Jr']
      }
    },
    select: { id: true, name: true }
  });
  console.log('Found assets:', stars);
  
  const arTeams = await prisma.asset.findMany({
    where: {
      code: { in: ['ARG', 'FRA', 'BRA'] }
    },
    select: { id: true, name: true, code: true }
  });
  console.log('Found teams:', arTeams);
}

main().finally(() => prisma.$disconnect());
