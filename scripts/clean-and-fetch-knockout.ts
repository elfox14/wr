import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Load .env manually
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    for (const line of envFile.split('\n')) {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env file:', e);
}

const prisma = new PrismaClient();

const API_KEY = 'c3c5bd3299344bf0bb15ff8210e798e6';
const BASE_URL = 'https://api.football-data.org/v4';

function mapStage(stage: string): string {
  const s = (stage || '').toUpperCase();
  if (s.includes('GROUP')) return 'group_stage';
  if (s.includes('LAST_32') || s.includes('ROUND_OF_32')) return 'round_of_32';
  if (s.includes('LAST_16') || s.includes('ROUND_OF_16')) return 'round_of_16';
  if (s.includes('QUARTER')) return 'quarter_finals';
  if (s.includes('SEMI')) return 'semi_finals';
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
  console.log('🔄 Cleaning up existing Round of 32 matches in database...');

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

  // Delete all existing round of 32 matches
  const deletedMatches = await prisma.match.deleteMany({
    where: {
      stage: { in: ['round_of_32', 'last_32'] }
    }
  });
  console.log(`🗑️ Deleted ${deletedMatches.count} old Round of 32 matches.`);

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

  // Load all team IDs to avoid queries in loop
  console.log('📡 Loading team IDs from DB...');
  const allTeams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true }
  });
  const teamIds = new Set(allTeams.map(t => t.id));
  console.log(`✅ Loaded ${teamIds.size} team IDs.`);

  let matchCount = 0;
  for (const m of apiMatches) {
    const homeTla = m.homeTeam?.tla;
    const awayTla = m.awayTeam?.tla;
    if (!homeTla || !awayTla) continue;

    const homeId = `team-${homeTla.toLowerCase()}`;
    const awayId = `team-${awayTla.toLowerCase()}`;

    // Check both teams exist in DB
    if (!teamIds.has(homeId) || !teamIds.has(awayId)) {
      console.log(`⚠️ Missing team in DB: ${homeTla} (${teamIds.has(homeId)}) or ${awayTla} (${teamIds.has(awayId)}). Skipping match ${m.id}.`);
      continue;
    }

    const externalId = String(m.id);
    const status = mapStatus(m.status);
    const stage = mapStage(m.stage);
    
    const groupPhase = m.stage === 'LAST_32' ? 'دور الـ 32' : m.group || stage;
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

  console.log(`✅ Synced and upserted ${matchCount} matches from API.`);
}

main()
  .catch(e => console.error('❌ Error during clean & sync:', e))
  .finally(() => prisma.$disconnect());
