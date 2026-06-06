import { PrismaClient } from '@prisma/client';
import { calculatePlayerPrice, calculateTeamPrice } from '../lib/scoring';
import { getFlagUrl } from '../lib/images';

const prisma = new PrismaClient();

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';
const BASE_URL = 'https://api.football-data.org/v4';

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

// Continents for each country (rough mapping)
const continentMap: Record<string, string> = {
  'URY': 'South America', 'ARG': 'South America', 'BRA': 'South America', 'COL': 'South America',
  'ECU': 'South America', 'PAR': 'South America', 'VEN': 'South America', 'CHI': 'South America',
  'PER': 'South America', 'BOL': 'South America',
  'GER': 'Europe', 'ESP': 'Europe', 'FRA': 'Europe', 'ENG': 'Europe', 'POR': 'Europe',
  'ITA': 'Europe', 'NED': 'Europe', 'BEL': 'Europe', 'CRO': 'Europe', 'DEN': 'Europe',
  'SUI': 'Europe', 'SRB': 'Europe', 'POL': 'Europe', 'WAL': 'Europe', 'SCO': 'Europe',
  'UKR': 'Europe', 'AUT': 'Europe', 'CZE': 'Europe', 'HUN': 'Europe', 'SVK': 'Europe',
  'SVN': 'Europe', 'ALB': 'Europe', 'GEO': 'Europe', 'TUR': 'Europe', 'GRE': 'Europe',
  'USA': 'North America', 'MEX': 'North America', 'CAN': 'North America', 'CRC': 'North America',
  'HON': 'North America', 'JAM': 'North America', 'PAN': 'North America', 'TRI': 'North America',
  'JPN': 'Asia', 'KOR': 'Asia', 'KSA': 'Asia', 'IRN': 'Asia', 'AUS': 'Asia',
  'QAT': 'Asia', 'IRQ': 'Asia', 'UZB': 'Asia', 'BHR': 'Asia', 'IDN': 'Asia',
  'CHN': 'Asia', 'OMA': 'Asia', 'UAE': 'Asia', 'IND': 'Asia',
  'MAR': 'Africa', 'SEN': 'Africa', 'NGA': 'Africa', 'EGY': 'Africa', 'CMR': 'Africa',
  'GHA': 'Africa', 'CIV': 'Africa', 'ALG': 'Africa', 'TUN': 'Africa', 'MLI': 'Africa',
  'BFA': 'Africa', 'COD': 'Africa', 'ZAF': 'Africa', 'TAN': 'Africa',
  'NZL': 'Oceania',
};

// Emoji flags for countries
const flagEmojis: Record<string, string> = {
  'URY': '🇺🇾', 'GER': '🇩🇪', 'ESP': '🇪🇸', 'PAR': '🇵🇾', 'ARG': '🇦🇷',
  'FRA': '🇫🇷', 'BRA': '🇧🇷', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'POR': '🇵🇹', 'ITA': '🇮🇹',
  'NED': '🇳🇱', 'BEL': '🇧🇪', 'CRO': '🇭🇷', 'DEN': '🇩🇰', 'SUI': '🇨🇭',
  'SRB': '🇷🇸', 'POL': '🇵🇱', 'WAL': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'UKR': '🇺🇦',
  'AUT': '🇦🇹', 'CZE': '🇨🇿', 'HUN': '🇭🇺', 'SVK': '🇸🇰', 'SVN': '🇸🇮',
  'ALB': '🇦🇱', 'GEO': '🇬🇪', 'TUR': '🇹🇷', 'GRE': '🇬🇷',
  'USA': '🇺🇸', 'MEX': '🇲🇽', 'CAN': '🇨🇦', 'CRC': '🇨🇷', 'HON': '🇭🇳',
  'JAM': '🇯🇲', 'PAN': '🇵🇦', 'TRI': '🇹🇹',
  'COL': '🇨🇴', 'ECU': '🇪🇨', 'VEN': '🇻🇪', 'CHI': '🇨🇱', 'PER': '🇵🇪',
  'BOL': '🇧🇴',
  'JPN': '🇯🇵', 'KOR': '🇰🇷', 'KSA': '🇸🇦', 'IRN': '🇮🇷', 'AUS': '🇦🇺',
  'QAT': '🇶🇦', 'IRQ': '🇮🇶', 'UZB': '🇺🇿', 'IDN': '🇮🇩', 'BHR': '🇧🇭',
  'CHN': '🇨🇳', 'OMA': '🇴🇲', 'UAE': '🇦🇪',
  'MAR': '🇲🇦', 'SEN': '🇸🇳', 'NGA': '🇳🇬', 'EGY': '🇪🇬', 'CMR': '🇨🇲',
  'GHA': '🇬🇭', 'CIV': '🇨🇮', 'ALG': '🇩🇿', 'TUN': '🇹🇳', 'MLI': '🇲🇱',
  'BFA': '🇧🇫', 'COD': '🇨🇩', 'ZAF': '🇿🇦', 'TAN': '🇹🇿',
  'NZL': '🇳🇿',
};

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

async function main() {
  console.log('🌍 Starting Full Data Sync from football-data.org...\n');

  if (!API_KEY) {
    console.error('❌ FOOTBALL_DATA_API_KEY not set!');
    process.exit(1);
  }

  // 1. Fetch all teams from WC competition
  console.log('📡 Fetching teams from API...');
  const teamsRes = await fetch(`${BASE_URL}/competitions/WC/teams`, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!teamsRes.ok) {
    console.error(`❌ API returned ${teamsRes.status}: ${await teamsRes.text()}`);
    process.exit(1);
  }

  const teamsData = await teamsRes.json();
  const apiTeams = teamsData.teams || [];
  console.log(`✅ Found ${apiTeams.length} teams\n`);

  // 2. CLEANUP: Build list of valid new IDs, then remove everything else
  const validTeamIds = apiTeams.map((t: any) => `team-${t.tla.toLowerCase()}`);
  console.log('🧹 Cleaning up old/duplicate data...');

  // Find ALL teams in DB that are NOT in the new valid list
  const orphanTeams = await prisma.asset.findMany({
    where: {
      type: 'TEAM',
      id: { notIn: validTeamIds },
    },
  });

  for (const dup of orphanTeams) {
    console.log(`  🗑️ Removing orphan team: ${dup.name} (ID: ${dup.id})`);
    // Delete players of this team first
    const oldPlayers = await prisma.asset.findMany({ where: { teamId: dup.id } });
    for (const oldPlayer of oldPlayers) {
      await prisma.marketNews.deleteMany({ where: { assetId: oldPlayer.id } });
      await prisma.priceHistory.deleteMany({ where: { assetId: oldPlayer.id } });
      await prisma.transaction.deleteMany({ where: { assetId: oldPlayer.id } });
      await prisma.holding.deleteMany({ where: { assetId: oldPlayer.id } });
      await prisma.asset.delete({ where: { id: oldPlayer.id } });
    }
    // Delete team's related data
    await prisma.marketNews.deleteMany({ where: { assetId: dup.id } });
    await prisma.priceHistory.deleteMany({ where: { assetId: dup.id } });
    await prisma.transaction.deleteMany({ where: { assetId: dup.id } });
    await prisma.holding.deleteMany({ where: { assetId: dup.id } });
    await prisma.match.deleteMany({ where: { OR: [{ homeTeamId: dup.id }, { awayTeamId: dup.id }] } });
    await prisma.asset.delete({ where: { id: dup.id } });
  }

  if (orphanTeams.length > 0) {
    console.log(`  ✅ Removed ${orphanTeams.length} orphan teams`);
  } else {
    console.log('  ✅ No orphan data found');
  }
  console.log('');

  // ── REAL WORLD CUP PARTICIPATION DATA ──
  const worldCupHistory: Record<string, number> = {
    'BRA': 22, 'GER': 20, 'ITA': 18, 'ARG': 18, 'MEX': 17,
    'FRA': 16, 'ENG': 16, 'ESP': 16, 'URY': 14, 'BEL': 14,
    'SRB': 13, 'SUI': 12, 'KOR': 11, 'USA': 11, 'NED': 11,
    'POL': 9, 'POR': 8, 'CMR': 8, 'CRO': 7, 'JPN': 7,
    'NGA': 7, 'KSA': 7, 'MAR': 7, 'COL': 7, 'AUS': 6,
    'DEN': 6, 'CRC': 6, 'IRN': 6, 'TUN': 6, 'PAR': 5,
    'GHA': 4, 'ECU': 4, 'SEN': 3, 'NZL': 3, 'CIV': 3,
    'ALG': 4, 'EGY': 3, 'TUR': 2, 'WAL': 2, 'QAT': 2,
    'CAN': 2, 'CHI': 9, 'PER': 5, 'VEN': 1, 'BOL': 3,
    'MLI': 0, 'BFA': 0, 'UZB': 0, 'JAM': 1, 'SCO': 8,
    'UKR': 1, 'PAN': 2, 'IDN': 0, 'TRI': 2, 'IRQ': 1,
    'BHR': 0, 'OMA': 0, 'UAE': 1, 'GEO': 0, 'ALB': 0,
    'HON': 3, 'GRE': 3, 'HUN': 9, 'AUT': 7, 'CZE': 2,
    'SVK': 1, 'SVN': 2, 'COD': 1, 'ZAF': 3, 'TAN': 0,
    'CHN': 1, 'IND': 0,
  };

  // ── GRADUATED TEAM POPULARITY (0.0 - 1.0) ──
  function calcTeamPopularity(rank: number, tla: string): number {
    // Big brands get a floor regardless of current rank
    const brandBonus: Record<string, number> = {
      'BRA': 0.15, 'ARG': 0.12, 'GER': 0.10, 'FRA': 0.10,
      'ENG': 0.10, 'ESP': 0.08, 'ITA': 0.10, 'NED': 0.05,
      'POR': 0.05, 'MEX': 0.05, 'USA': 0.05, 'JPN': 0.03,
    };
    const base = Math.max(0.15, 1.0 - (rank / 50)); // rank 1 → 0.98, rank 50 → 0.0
    return Math.min(1.0, base + (brandBonus[tla] || 0));
  }

  // ── SMART PLAYER TIER SYSTEM ──
  function calcPlayerTier(rank: number, pos: string, age: number, squadIndex: number, squadSize: number): number {
    // rankFactor: how strong is the national team (0.0 to 1.0)
    const maxRank = 100;
    const rankFactor = Math.max(0, (maxRank - rank) / maxRank);

    // Base tier from team strength
    let tier = 0.40 + (rankFactor * 0.40); // rank 1 → 0.80, rank 50 → 0.60, rank 100 → 0.40

    // Position bonus (attackers are more tradeable)
    if (pos === 'FWD') tier += 0.06;
    else if (pos === 'MID') tier += 0.03;
    else if (pos === 'DEF') tier -= 0.02;
    else if (pos === 'GK') tier -= 0.05;

    // Age curve
    if (age >= 24 && age <= 29) tier += 0.05;      // Peak
    else if (age >= 21 && age <= 23) tier += 0.02;  // Rising
    else if (age < 21) tier -= 0.03;                // Very young
    else if (age > 33) tier -= 0.08;                // Declining
    else if (age > 30) tier -= 0.03;                // Late prime

    // Squad depth: first ~11 players get a starter bonus, rest get bench penalty
    // API usually returns squad ordered by importance (starters first)
    const relativePos = squadIndex / Math.max(1, squadSize);
    if (relativePos <= 0.42) {
      tier += 0.05; // Likely starter (top ~11 of 26)
    } else if (relativePos > 0.75) {
      tier -= 0.05; // Deep bench
    }

    return Math.min(1.0, Math.max(0.25, parseFloat(tier.toFixed(2))));
  }

  // ── PLAYER POPULARITY from team + tier ──
  function calcPlayerPopularity(teamPop: number, tier: number): number {
    // Player inherits 60% of team's fame, plus 40% from personal tier
    const pop = (teamPop * 0.6) + (tier * 0.4);
    return Math.min(1.0, Math.max(0.1, parseFloat(pop.toFixed(2))));
  }

  // 3. Process each team
  let teamCount = 0;
  let playerCount = 0;

  for (const apiTeam of apiTeams) {
    const tla = apiTeam.tla; // 3-letter code
    const teamName = apiTeam.name || apiTeam.shortName;
    const shortName = apiTeam.shortName || teamName;
    const crest = apiTeam.crest || '';
    const coachName = apiTeam.coach?.name || 'N/A';
    const squad = apiTeam.squad || [];
    const flag = flagEmojis[tla] || '🏳️';
    const dbImage = getFlagUrl(tla) || '';
    const rank = fifaRanks[tla] || 50;
    const continent = continentMap[tla] || 'Unknown';
    const dbTeamId = `team-${tla.toLowerCase()}`;
    const participations = worldCupHistory[tla] ?? 1;
    const teamPopularity = calcTeamPopularity(rank, tla);

    console.log(`⚽ ${flag} ${teamName} (${tla}) — Rank: ${rank} | Pop: ${teamPopularity.toFixed(2)} | WC: ${participations} | Squad: ${squad.length}`);

    // Calculate team score based on FIFA rank (display-only)
    let teamScoreRaw = 100 - (rank * 0.9);
    if (rank > 10) teamScoreRaw = 91 - ((rank - 10) * 0.6);
    if (rank > 30) teamScoreRaw = 79 - ((rank - 30) * 0.4);
    if (rank > 50) teamScoreRaw = 71 - ((rank - 50) * 0.2);
    if (rank === 1) teamScoreRaw = 99;
    if (rank === 2) teamScoreRaw = 98;
    if (rank === 3) teamScoreRaw = 97;
    const teamScore = Math.max(55, Math.min(99, Math.round(teamScoreRaw)));

    // Process players with SMART TIER
    const processedPlayers = squad.map((p: any, idx: number) => {
      const age = calcAge(p.dateOfBirth);
      const pos = mapPosition(p.position);
      const tier = calcPlayerTier(rank, pos, age, idx, squad.length);
      const pop = calcPlayerPopularity(teamPopularity, tier);

      // EA-Style Rating (60-95) acts as the player's core Score
      let eaRating = Math.round(55 + (tier * 40));
      if (rank <= 3) eaRating -= 3;
      else if (rank <= 10) eaRating -= 2;
      const score = Math.max(60, Math.min(95, eaRating));

      const tempPlayerObj = {
        type: 'PLAYER' as const,
        playerTier: tier,
        age,
        score,
        popularity: pop,
        riskIndex: age > 33 ? 0.8 : age < 22 ? 0.6 : 0.3,
        teamRank: rank,
        position: pos,
      };
      const price = calculatePlayerPrice(tempPlayerObj);

      return { apiId: p.id, name: p.name, pos, age, tier, price, score, pop, nationality: p.nationality || '' };
    });

    // ── STAR BOOST: top 5 players per team get +0.10 tier ──
    const sortedByTier = [...processedPlayers].sort((a, b) => b.tier - a.tier);
    const starIds = new Set(sortedByTier.slice(0, 5).map(p => p.apiId));
    for (const p of processedPlayers) {
      if (starIds.has(p.apiId)) {
        p.tier = Math.min(1.0, p.tier + 0.10);
        p.pop = Math.min(1.0, p.pop + 0.08);
        
        let eaRating = Math.round(55 + (p.tier * 40));
        if (rank <= 3) eaRating -= 3;
        else if (rank <= 10) eaRating -= 2;
        p.score = Math.max(60, Math.min(95, eaRating));

        // Recalculate price with boosted tier
        const tempObj = { 
          type: 'PLAYER' as const, 
          playerTier: p.tier, 
          age: p.age, 
          score: p.score, 
          popularity: p.pop, 
          riskIndex: p.age > 33 ? 0.8 : 0.3,
          teamRank: rank,
          position: p.pos
        };
        p.price = calculatePlayerPrice(tempObj);
      }
    }

    // Team pricing partial
    const teamPartial = {
      type: 'TEAM' as const,
      fifaRank: rank,
      participations,
      popularity: teamPopularity,
      harmony: 0.85,
      injuries: 0,
    };

    const squadForPricing = processedPlayers.map((p: any) => ({
      current_price: p.price,
      score: p.score,
      playerTier: p.tier,
    }));

    const teamPrice = calculateTeamPrice(teamPartial, squadForPricing);

    // ── RISK INDEX (graduated) ──
    const teamRisk = rank <= 5 ? 0.2 : rank <= 10 ? 0.3 : rank <= 20 ? 0.45 : rank <= 35 ? 0.6 : 0.75;

    // Save team
    await prisma.asset.upsert({
      where: { id: dbTeamId },
      update: {
        name: shortName,
        code: tla,
        image: dbImage,
        current_price: teamPrice,
        score: teamScore,
        fifaRank: rank,
        continent,
        coach: coachName,
        participations,
        ownersCount: Math.floor(Math.random() * 5000 + 500),
        riskIndex: teamRisk,
        harmony: 0.85,
        popularity: teamPopularity,
      },
      create: {
        id: dbTeamId,
        type: 'TEAM',
        name: shortName,
        code: tla,
        image: dbImage,
        current_price: teamPrice,
        high_price: teamPrice,
        low_price: teamPrice,
        market_cap: `${Math.max(10, 110 - rank)}B`,
        volume: `${Math.floor(Math.random() * 5 + 1)}M`,
        change: 0,
        fifaRank: rank,
        score: teamScore,
        continent,
        coach: coachName,
        group: 'TBD',
        participations,
        ownersCount: Math.floor(Math.random() * 5000 + 500),
        riskIndex: teamRisk,
        harmony: 0.85,
        popularity: teamPopularity,
        priceHistory: { create: { price: teamPrice } },
      },
    });
    teamCount++;

    // Clean up orphan players for this team
    const validPlayerIds = processedPlayers.map((p: any) => `player-${tla.toLowerCase()}-${p.apiId}`);
    const orphanPlayers = await prisma.asset.findMany({
      where: {
        teamId: dbTeamId,
        type: 'PLAYER',
        id: { notIn: validPlayerIds },
      },
    });

    for (const op of orphanPlayers) {
      console.log(`  🗑️ Removing orphan player: ${op.name} (ID: ${op.id})`);
      await prisma.marketNews.deleteMany({ where: { assetId: op.id } });
      await prisma.priceHistory.deleteMany({ where: { assetId: op.id } });
      await prisma.transaction.deleteMany({ where: { assetId: op.id } });
      await prisma.holding.deleteMany({ where: { assetId: op.id } });
      await prisma.asset.delete({ where: { id: op.id } });
    }

    // Save players
    for (const p of processedPlayers) {
      const dbPlayerId = `player-${tla.toLowerCase()}-${p.apiId}`;
      await prisma.asset.upsert({
        where: { id: dbPlayerId },
        update: {
          name: p.name,
          image: dbImage,
          current_price: p.price,
          age: p.age,
          position: p.pos,
          score: p.score,
          playerTier: p.tier,
          popularity: p.pop,
        },
        create: {
          id: dbPlayerId,
          type: 'PLAYER',
          name: p.name,
          code: `${tla}${p.apiId}`,
          image: dbImage,
          teamId: dbTeamId,
          current_price: p.price,
          high_price: p.price,
          low_price: p.price,
          market_cap: `${Math.floor(p.price * 10)}M`,
          volume: `${Math.floor(Math.random() * 10 + 2)}M`,
          change: 0,
          position: p.pos,
          score: p.score,
          playerTier: p.tier,
          age: p.age,
          globalMarketValue: p.tier > 0.8 ? 80 : p.tier > 0.6 ? 40 : 15,
          popularity: p.pop,
          priceHistory: { create: { price: p.price } },
        },
      });
      playerCount++;
    }
  }

  // 3. Fetch matches and sync
  console.log('\n📡 Fetching matches from API...');
  const matchesRes = await fetch(`${BASE_URL}/competitions/WC/matches`, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (matchesRes.ok) {
    const matchesData = await matchesRes.json();
    const apiMatches = matchesData.matches || [];
    let matchCount = 0;

    for (const m of apiMatches) {
      const homeTla = m.homeTeam?.tla;
      const awayTla = m.awayTeam?.tla;
      if (!homeTla || !awayTla) continue;

      const homeId = `team-${homeTla.toLowerCase()}`;
      const awayId = `team-${awayTla.toLowerCase()}`;

      // Check both teams exist
      const homeExists = await prisma.asset.findUnique({ where: { id: homeId } });
      const awayExists = await prisma.asset.findUnique({ where: { id: awayId } });
      if (!homeExists || !awayExists) continue;

      const externalId = String(m.id);
      const status = m.status === 'FINISHED' ? 'FINISHED' : m.status === 'IN_PLAY' ? 'IN_PLAY' : 'SCHEDULED';
      const stage = (m.stage || 'GROUP_STAGE').toLowerCase().replace(/_/g, '_');
      const groupPhase = m.group || stage;

      await prisma.match.upsert({
        where: { externalId },
        update: {
          homeScore: m.score?.fullTime?.home ?? 0,
          awayScore: m.score?.fullTime?.away ?? 0,
          status,
          stage,
          groupPhase,
        },
        create: {
          externalId,
          homeTeamId: homeId,
          awayTeamId: awayId,
          matchDate: m.utcDate ? new Date(m.utcDate) : new Date(),
          homeScore: m.score?.fullTime?.home ?? 0,
          awayScore: m.score?.fullTime?.away ?? 0,
          status,
          stage,
          groupPhase,
        },
      });
      matchCount++;
    }
    console.log(`✅ Synced ${matchCount} matches`);
  }

  // 4. Fetch actual Groups from Standings API
  console.log('\n🎲 Fetching official World Cup Groups from API...');
  const standingsRes = await fetch(`${BASE_URL}/competitions/WC/standings`, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (standingsRes.ok) {
    const standingsData = await standingsRes.json();
    const standings = standingsData.standings || [];
    
    for (const groupData of standings) {
      if (!groupData.group) continue;
      // Extract group name e.g., "Group A" -> "A"
      const groupName = groupData.group.replace('Group ', '').trim();
      const table = groupData.table || [];
      
      for (const row of table) {
        const tla = row.team?.tla;
        if (!tla) continue;
        
        const dbTeamId = `team-${tla.toLowerCase()}`;
        
        try {
          await prisma.asset.update({
            where: { id: dbTeamId },
            data: { group: groupName }
          });
          // console.log(`Assigned ${tla} to Group ${groupName}`);
        } catch (e) {
          // Team might not exist if API has mismatch, ignore
        }
      }
    }
    console.log('✅ Official Groups assigned successfully');
  } else {
    console.warn('⚠️ Could not fetch standings. Groups will remain TBD.');
  }

  console.log(`\n🏆 Sync Complete!`);
  console.log(`   Teams: ${teamCount}`);
  console.log(`   Players: ${playerCount}`);
}

main()
  .catch((e) => {
    console.error('Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
