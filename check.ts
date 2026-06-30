import { PrismaClient } from '@prisma/client';
import { collectTheStatsMatchExtras } from './lib/theStatsMatchExtras';

const prisma = new PrismaClient();

async function run() {
  const matchId = 'cmq6vgqzz0104g7g428tv1hrj';
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    console.log("Match not found");
    return;
  }
  
  console.log("Syncing match:", match.homeTeamName, "vs", match.awayTeamName);
  
  const result = await collectTheStatsMatchExtras(matchId, match.providerId, match.providerMatchId, {
    mode: 'full',
    force: true,
    allowLive: true,
    timeoutMs: 30000
  });
  
  console.log("Sync OK:", result.ok);
  
  const snapshot = await prisma.matchStatsSnapshot.findFirst({
    where: { matchId },
    orderBy: { capturedAt: 'desc' }
  });
  
  const data = (snapshot?.normalized as any)?.teamHeatmaps;
  console.log("Team Heatmaps:", data ? "Exists" : "Missing");
  if (data) {
     console.log("Home Points:", data.home?.points?.length || 0);
     console.log("Away Points:", data.away?.points?.length || 0);
  }
}

run().finally(() => prisma.$disconnect());
