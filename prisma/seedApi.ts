import { PrismaClient } from '@prisma/client';
import { calculatePlayerPrice, calculateTeamPrice, calculateTeamStrengthIndex } from '../lib/scoring';

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

  // 3. Process each team
  let teamCount = 0;
  let playerCount = 0;

  for (const apiTeam of apiTeams) {
    const tla = apiTeam.tla; // 3-letter code
    const teamName = apiTeam.name || apiTeam.shortName;
    const shortName = apiTeam.shortName || teamName;
    const crest = apiTeam.crest || ''; // SVG/PNG URL of team crest
    const coachName = apiTeam.coach?.name || 'N/A';
    const squad = apiTeam.squad || [];
    const flag = flagEmojis[tla] || '🏳️';
    const rank = fifaRanks[tla] || 50;
    const continent = continentMap[tla] || 'Unknown';
    const dbTeamId = `team-${tla.toLowerCase()}`;

    console.log(`⚽ ${flag} ${teamName} (${tla}) — Coach: ${coachName} — ${squad.length} players`);

    // Calculate team price based on rank
    const teamPartial = {
      type: 'TEAM' as const,
      fifaRank: rank,
      participations: 10,
      popularity: rank <= 10 ? 0.9 : rank <= 20 ? 0.7 : 0.5,
      harmony: 0.85,
      injuries: 0,
    };

    const playerPrices: { current_price: number }[] = [];
    const playerScores: { score: number }[] = [];

    // Process players
    const processedPlayers = squad.map((p: any) => {
      const age = calcAge(p.dateOfBirth);
      const pos = mapPosition(p.position);
      const isStar = (p.position === 'Offence' || p.position === 'Midfield') && age >= 22 && age <= 32;
      const tier = isStar ? 0.9 : 0.7;

      const assetObj = {
        type: 'PLAYER' as const,
        playerTier: tier,
        globalMarketValue: isStar ? 80 : 20,
        age,
        popularity: isStar ? 0.85 : 0.5,
      };

      const price = calculatePlayerPrice(assetObj);
      const score = Math.round(65 + (tier * 25) + (rank <= 10 ? 10 : 0));

      playerPrices.push({ current_price: price });
      playerScores.push({ score });

      return {
        apiId: p.id,
        name: p.name,
        pos,
        age,
        tier,
        price,
        score,
        nationality: p.nationality || '',
      };
    });

    const teamPrice = calculateTeamPrice(teamPartial, playerPrices);
    const teamScore = calculateTeamStrengthIndex(teamPartial, playerScores);

    // Save team
    await prisma.asset.upsert({
      where: { id: dbTeamId },
      update: {
        name: shortName,
        code: tla,
        image: flag,
        current_price: teamPrice,
        score: teamScore,
        fifaRank: rank,
        continent,
        coach: coachName,
        participations: 10,
        ownersCount: Math.floor(Math.random() * 5000 + 500),
        riskIndex: rank <= 10 ? 0.3 : rank <= 20 ? 0.5 : 0.7,
        harmony: 0.85,
        popularity: rank <= 10 ? 0.9 : 0.7,
      },
      create: {
        id: dbTeamId,
        type: 'TEAM',
        name: shortName,
        code: tla,
        image: flag,
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
        group: 'A',
        participations: 10,
        ownersCount: Math.floor(Math.random() * 5000 + 500),
        riskIndex: rank <= 10 ? 0.3 : rank <= 20 ? 0.5 : 0.7,
        harmony: 0.85,
        popularity: rank <= 10 ? 0.9 : 0.7,
        priceHistory: { create: { price: teamPrice } },
      },
    });
    teamCount++;

    // Save players
    for (const p of processedPlayers) {
      const dbPlayerId = `player-${tla.toLowerCase()}-${p.apiId}`;
      await prisma.asset.upsert({
        where: { id: dbPlayerId },
        update: {
          name: p.name,
          current_price: p.price,
          age: p.age,
          position: p.pos,
          score: p.score,
          playerTier: p.tier,
        },
        create: {
          id: dbPlayerId,
          type: 'PLAYER',
          name: p.name,
          code: `${tla}${p.apiId}`,
          image: flag,
          teamId: dbTeamId,
          current_price: p.price,
          high_price: p.price,
          low_price: p.price,
          market_cap: `${Math.floor(Math.random() * 800 + 100)}M`,
          volume: `${Math.floor(Math.random() * 10 + 2)}M`,
          change: 0,
          position: p.pos,
          score: p.score,
          playerTier: p.tier,
          age: p.age,
          globalMarketValue: p.tier > 0.8 ? 80 : 20,
          popularity: p.tier > 0.8 ? 0.85 : 0.5,
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
