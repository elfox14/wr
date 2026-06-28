import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const API_KEY = 'c3c5bd3299344bf0bb15ff8210e798e6';
const BASE_URL = 'https://api.football-data.org/v4';

function mapStage(stage: string): string {
  const s = (stage || '').toUpperCase();
  if (s.includes('GROUP')) return 'group_stage';
  if (s.includes('LAST_32') || s.includes('ROUND_OF_32')) return 'round_of_32';
  if (s.includes('LAST_16') || s.includes('ROUND_OF_16')) return 'round_of_16';
  if (s.includes('QUARTER') || s.includes('QF')) return 'quarter_finals';
  if (s.includes('SEMI') || s.includes('SF')) return 'semi_finals';
  if (s.includes('THIRD') || s.includes('PLACE')) return 'third_place';
  if (s.includes('FINAL')) return 'final';
  return 'group_stage';
}

function mapStatus(status: string): string {
  switch (status) {
    case 'FINISHED': return 'FINISHED';
    case 'IN_PLAY': case 'PAUSED': case 'LIVE': return 'IN_PLAY';
    default: return 'SCHEDULED';
  }
}

async function main() {
  console.log('🔄 Starting fast match-only sync from football-data.org...');

  // Connect to DB with retries
  for (let i = 0; i < 3; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Connected to database successfully.');
      break;
    } catch (e) {
      console.log(`Connection retry ${i+1} failed...`);
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('📡 Fetching matches from API...');
  const res = await fetch(`${BASE_URL}/competitions/WC/matches`, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${await res.text()}`);
  }

  const data: any = await res.json();
  const apiMatches = data.matches || [];
  console.log(`✅ Found ${apiMatches.length} matches in API.`);

  let matchCount = 0;
  for (const m of apiMatches) {
    const homeTla = m.homeTeam?.tla;
    const awayTla = m.awayTeam?.tla;
    if (!homeTla || !awayTla) continue;

    const homeId = `team-${homeTla.toLowerCase()}`;
    const awayId = `team-${awayTla.toLowerCase()}`;

    // Check both teams exist in DB
    const homeExists = await prisma.asset.findUnique({ where: { id: homeId } });
    const awayExists = await prisma.asset.findUnique({ where: { id: awayId } });

    if (!homeExists || !awayExists) {
      console.log(`⚠️ Missing team in DB: ${homeTla} (${!!homeExists}) or ${awayTla} (${!!awayExists}). Skipping match ${m.id}.`);
      continue;
    }

    const externalId = String(m.id);
    const status = mapStatus(m.status);
    const stage = mapStage(m.stage);
    const groupPhase = m.group || stage;
    const matchDate = m.utcDate ? new Date(m.utcDate) : new Date();

    const homeScore = m.score?.fullTime?.home ?? 0;
    const awayScore = m.score?.fullTime?.away ?? 0;

    await prisma.match.upsert({
      where: { externalId },
      update: {
        homeScore,
        awayScore,
        status,
        stage,
        groupPhase,
        matchDate,
      },
      create: {
        externalId,
        homeTeamId: homeId,
        awayTeamId: awayId,
        matchDate,
        homeScore,
        awayScore,
        status,
        stage,
        groupPhase,
      },
    });

    matchCount++;
  }

  console.log(`✅ Upserted ${matchCount} matches in total.`);
}

main()
  .catch(e => console.error('❌ Error during sync:', e))
  .finally(() => prisma.$disconnect());
