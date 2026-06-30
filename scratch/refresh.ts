import { PrismaClient } from '@prisma/client';
import { collectTheStatsMatchExtras } from '../lib/theStatsMatchExtras';

const prisma = new PrismaClient();

async function run() {
  await prisma.match.update({ where: { id: 'cmq6vgqzz0104g7g428tv1hrj' }, data: { externalId: null } });
  const match = await prisma.match.findUnique({ where: { id: 'cmq6vgqzz0104g7g428tv1hrj' }, include: { homeTeam: true, awayTeam: true } });
  if (!match) {
    console.log('Match not found');
    return;
  }
  console.log('Fetching and saving stats for match:', match.id);
  const result = await collectTheStatsMatchExtras(match, { save: true, includeRaw: false, endpointMode: 'full' });
  console.log('Result:', result);
}

run().finally(() => prisma.$disconnect());
