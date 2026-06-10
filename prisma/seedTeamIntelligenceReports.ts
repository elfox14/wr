import { PrismaClient } from '@prisma/client';
import { seedTeamIntelligenceReports } from '../lib/seedTeamIntelligenceReports';

const prisma = new PrismaClient();

async function main() {
  const result = await seedTeamIntelligenceReports(prisma);
  console.log(
    `Team intelligence reports seed completed. Created: ${result.created}. Skipped: ${result.skipped}. Total teams: ${result.totalTeams}. Curated templates: ${result.curatedReports}.`,
  );
  if (result.missingTeams.length > 0) {
    console.warn(`Missing teams for codes: ${result.missingTeams.join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
