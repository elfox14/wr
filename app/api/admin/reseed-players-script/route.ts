import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateFairValue, calculateAssetScore } from '@/lib/scoring';
import { getFlagUrl } from '@/lib/images';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 mins on vercel

// Map position from API to our format
function mapPosition(pos: string | null): string {
  switch (pos) {
    case 'Goalkeeper': return 'GK';
    case 'Defence': return 'DEF';
    case 'Midfield': return 'MID';
    case 'Offence': return 'FWD';
    default: return 'MID';
  }
}

// Calculate player age from DOB
function calcAge(dob: string | null): number {
  if (!dob) return 26;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// Rough FIFA ranking (June 2026 estimates)
const fifaRanks: Record<string, number> = {
  'ARG': 1, 'FRA': 2, 'ENG': 3, 'BRA': 5, 'BEL': 4, 'NED': 6, 'POR': 7,
  'ESP': 8, 'ITA': 9, 'CRO': 10, 'URY': 11, 'COL': 12, 'MEX': 14, 'USA': 13,
  'MAR': 15, 'GER': 16, 'SEN': 17, 'JPN': 18, 'SUI': 19, 'IRN': 20,
  'DEN': 21, 'AUS': 24, 'KOR': 23, 'ECU': 31, 'CAN': 45,
  'SRB': 32, 'POL': 30, 'TUN': 41, 'CMR': 51, 'GHA': 61,
  'WAL': 29, 'QAT': 40, 'NGA': 28, 'KSA': 53, 'CRC': 52, 'PAR': 50,
  'NZL': 94, 'CIV': 39, 'ALG': 43, 'EGY': 36, 'VEN': 54, 'CHI': 42,
  'PER': 33, 'MLI': 47, 'BFA': 62, 'UZB': 66, 'JAM': 57, 'SCO': 35,
  'UKR': 26, 'TUR': 27, 'BOL': 70, 'PAN': 55, 'IDN': 85, 'TRI': 80,
  'IRQ': 65, 'BHR': 78, 'OMA': 80, 'UAE': 69,
};

// ── GRADUATED TEAM POPULARITY (0.0 - 1.0) ──
function calcTeamPopularity(rank: number, tla: string): number {
  const brandBonus: Record<string, number> = {
    'BRA': 0.15, 'ARG': 0.12, 'GER': 0.10, 'FRA': 0.10,
    'ENG': 0.10, 'ESP': 0.08, 'ITA': 0.10, 'NED': 0.05,
    'POR': 0.05, 'MEX': 0.05, 'USA': 0.05, 'JPN': 0.03,
  };
  const base = Math.max(0.15, 1.0 - (rank / 50));
  return Math.min(1.0, base + (brandBonus[tla] || 0));
}

// ── SMART PLAYER TIER SYSTEM ──
function calcPlayerTier(rank: number, pos: string, age: number, squadIndex: number, squadSize: number): number {
  const maxRank = 100;
  const rankFactor = Math.max(0, (maxRank - rank) / maxRank);
  let tier = 0.40 + (rankFactor * 0.40);

  if (pos === 'FWD') tier += 0.06;
  else if (pos === 'MID') tier += 0.03;
  else if (pos === 'DEF') tier -= 0.02;
  else if (pos === 'GK') tier -= 0.05;

  if (age >= 24 && age <= 29) tier += 0.05;
  else if (age >= 21 && age <= 23) tier += 0.02;
  else if (age < 21) tier -= 0.03;
  else if (age > 33) tier -= 0.08;
  else if (age > 30) tier -= 0.03;

  const relativePos = squadIndex / Math.max(1, squadSize);
  if (relativePos <= 0.42) {
    tier += 0.05;
  } else if (relativePos > 0.75) {
    tier -= 0.05;
  }

  return Math.min(1.0, Math.max(0.25, parseFloat(tier.toFixed(2))));
}

// ── PLAYER POPULARITY ──
function calcPlayerPopularity(teamPop: number, tier: number): number {
  const pop = (teamPop * 0.6) + (tier * 0.4);
  return Math.min(1.0, Math.max(0.1, parseFloat(pop.toFixed(2))));
}

export async function GET() {
  try {
    console.log('--- STARTING PLAYER WIPE AND RESEED (FOOTBALL-DATA.ORG) ---');

    const API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';
    if (!API_KEY) {
      return NextResponse.json({ ok: false, error: 'FOOTBALL_DATA_API_KEY is missing in env' }, { status: 500 });
    }

    // 1. Fetch World Cup squads from football-data.org
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/teams', {
      headers: { 'X-Auth-Token': API_KEY }
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `football-data.org API returned status ${res.status}` }, { status: 500 });
    }

    const data = await res.json() as any;
    const apiTeams = data.teams || [];

    if (apiTeams.length === 0) {
      return NextResponse.json({ ok: false, error: 'No teams returned from football-data.org API' }, { status: 500 });
    }

    // 2. Wipe existing player data
    console.log('Deleting player-related holdings...');
    await prisma.holding.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related transactions...');
    await prisma.transaction.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related market news...');
    await prisma.marketNews.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related price history...');
    await prisma.priceHistory.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related captain selections...');
    await prisma.captainSelection.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related performances...');
    await prisma.playerPerformance.deleteMany({ where: { asset: { type: 'PLAYER' } } });

    console.log('Deleting all player assets...');
    const deletedPlayers = await prisma.asset.deleteMany({ where: { type: 'PLAYER' } });
    console.log(`✅ Successfully deleted ${deletedPlayers.count} players.`);

    let totalImported = 0;
    const results = [];

    // 3. Process each team and insert players
    for (const apiTeam of apiTeams) {
      const tla = apiTeam.tla;
      const teamName = apiTeam.name || apiTeam.shortName;
      const squad = apiTeam.squad || [];
      const rank = fifaRanks[tla] || 50;
      const dbTeamId = `team-${tla.toLowerCase()}`;
      const teamPopularity = calcTeamPopularity(rank, tla);

      // Verify the team exists in the database
      const teamExists = await prisma.asset.findUnique({ where: { id: dbTeamId } });
      if (!teamExists) {
        results.push({ team: teamName, tla, status: 'skipped_team_not_in_db' });
        continue;
      }

      const processedPlayers = squad.map((p: any, idx: number) => {
        const age = calcAge(p.dateOfBirth);
        const pos = mapPosition(p.position);
        const tier = calcPlayerTier(rank, pos, age, idx, squad.length);
        const pop = calcPlayerPopularity(teamPopularity, tier);

        const tempPlayerObj = {
          type: 'PLAYER' as const,
          playerTier: tier,
          age,
          popularity: pop,
          riskIndex: age > 33 ? 0.8 : age < 22 ? 0.6 : 0.3,
          teamRank: rank,
          position: pos,
          ownersCount: 0,
          volume: '0'
        };
        
        const score = calculateAssetScore(tempPlayerObj);
        const fairValue = calculateFairValue(score, 'PLAYER');

        return {
          apiId: p.id,
          name: p.name,
          pos,
          age,
          tier,
          price: fairValue,
          score,
          pop,
          nationality: p.nationality || ''
        };
      });

      // Star Boost: top 5 players per team get +0.10 tier
      const sortedByTier = [...processedPlayers].sort((a, b) => b.tier - a.tier);
      const starIds = new Set(sortedByTier.slice(0, 5).map(p => p.apiId));
      for (const p of processedPlayers) {
        if (starIds.has(p.apiId)) {
          p.tier = Math.min(1.0, p.tier + 0.10);
          p.pop = Math.min(1.0, p.pop + 0.08);
          
          const tempObj = { 
            type: 'PLAYER' as const, 
            playerTier: p.tier, 
            age: p.age, 
            popularity: p.pop, 
            teamRank: rank, 
            position: p.pos,
            ownersCount: 0,
            volume: '0'
          };
          p.score = calculateAssetScore(tempObj);
          p.price = calculateFairValue(p.score, 'PLAYER');
        }
      }

      // Save players to database
      let teamImportedCount = 0;
      for (const p of processedPlayers) {
        const dbPlayerId = `player-${tla.toLowerCase()}-${p.apiId}`;
        const flagUrl = getFlagUrl(tla) || '';

        await prisma.asset.upsert({
          where: { id: dbPlayerId },
          update: {
            name: p.name,
            image: flagUrl, // Default flag fallback
            current_price: p.price,
            age: p.age,
            position: p.pos,
            score: p.score,
            playerTier: p.tier,
            popularity: p.pop * 100,
            fundamental: p.tier * 100,
            worldCupLegacy: p.age > 30 ? 60 : 30,
            marketDemand: 50,
            momentum: 50,
            marketPrice: p.price,
            fairValue: p.price,
            volatilityScore: 50,
            riskIndex: 0.5,
            isAvailable: true,
            apiFootballId: p.apiId, // Map football-data id to apiFootballId for subsequent updates
          },
          create: {
            id: dbPlayerId,
            type: 'PLAYER',
            name: p.name,
            code: `${tla}${p.apiId}`.slice(0, 10).toUpperCase(),
            image: flagUrl,
            teamId: dbTeamId,
            current_price: p.price,
            high_price: p.price,
            low_price: p.price,
            market_cap: `${Math.floor(p.price * 10)}M`,
            volume: '0',
            change: 0,
            position: p.pos,
            score: p.score,
            playerTier: p.tier,
            age: p.age,
            popularity: p.pop * 100,
            fundamental: p.tier * 100,
            worldCupLegacy: p.age > 30 ? 60 : 30,
            marketDemand: 50,
            momentum: 50,
            marketPrice: p.price,
            fairValue: p.price,
            volatilityScore: 50,
            riskIndex: 0.5,
            isAvailable: true,
            apiFootballId: p.apiId,
            priceHistory: { create: { price: p.price } },
          },
        });
        teamImportedCount++;
        totalImported++;
      }

      results.push({ team: teamName, tla, status: 'success', imported: teamImportedCount });
    }

    return NextResponse.json({
      ok: true,
      deleted: deletedPlayers.count,
      totalImported,
      results
    });

  } catch (error: any) {
    console.error('Error in reseed players:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
