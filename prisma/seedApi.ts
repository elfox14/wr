import { PrismaClient } from '@prisma/client';
import { calculatePlayerPrice, calculateTeamPrice, calculateTeamStrengthIndex } from '../lib/scoring';

const prisma = new PrismaClient();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = 'api-football-v1.p.rapidapi.com';

const TOP_TEAMS = [
  'Argentina', 'France', 'Brazil', 'England', 'Spain', 
  'Germany', 'Portugal', 'Italy', 'Netherlands', 'Belgium', 
  'Uruguay', 'Colombia', 'Croatia', 'Morocco', 'Senegal'
];

async function fetchFromApi(endpoint: string) {
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is missing in .env');
  }
  
  const response = await fetch(`https://${API_HOST}${endpoint}`, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': API_HOST
    }
  });
  
  const data = await response.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(JSON.stringify(data.errors));
  }
  return data.response;
}

// Map real positions to our app positions
function mapPosition(pos: string) {
  switch (pos) {
    case 'Goalkeeper': return 'GK';
    case 'Defender': return 'DEF';
    case 'Midfielder': return 'MID';
    case 'Attacker': return 'FWD';
    default: return 'MID';
  }
}

// Generate a random market value to simulate real-world pricing
function generateRandomMarketValue(age: number, tier: number, isStar: boolean) {
  let baseValue = isStar ? 80 : 20;
  if (age < 25) baseValue *= 1.2;
  if (age > 32) baseValue *= 0.6;
  baseValue *= tier;
  return Math.round(baseValue);
}

// Dummy FIFA ranks to avoid an extra API call just for ranks
const fifaRanks: Record<string, number> = {
  'Argentina': 1, 'France': 2, 'Brazil': 5, 'England': 3, 'Spain': 8,
  'Germany': 16, 'Portugal': 6, 'Italy': 9, 'Netherlands': 7, 'Belgium': 4,
  'Uruguay': 11, 'Colombia': 14, 'Croatia': 10, 'Morocco': 12, 'Senegal': 17
};

async function main() {
  console.log('⚽ Starting API Data Sync...');

  if (!RAPIDAPI_KEY) {
    console.error('❌ Error: RAPIDAPI_KEY is not set. Please add it to your .env file or Render environment variables.');
    process.exit(1);
  }

  for (let i = 0; i < TOP_TEAMS.length; i++) {
    const countryName = TOP_TEAMS[i];
    console.log(`\n--- Fetching Data for ${countryName} ---`);
    
    try {
      // 1. Fetch Team ID (We search by name)
      const teamsRes = await fetchFromApi(`/teams?search=${countryName}`);
      
      if (!teamsRes || !Array.isArray(teamsRes)) {
        console.log(`⚠️ Invalid response from API for ${countryName}. Check your RAPIDAPI_KEY and API subscription.`);
        continue;
      }

      // Filter to ensure it's a National Team
      const teamData = teamsRes.find((t: any) => t.team.national === true);
      
      if (!teamData) {
        console.log(`⚠️ National team for ${countryName} not found. Skipping.`);
        continue;
      }
      
      const apiTeamId = teamData.team.id;
      const teamLogo = teamData.team.logo;
      const teamCode = teamData.team.code || countryName.substring(0, 3).toUpperCase();
      
      console.log(`✅ Team found: ${countryName} (ID: ${apiTeamId})`);
      
      // 2. Fetch Squad for this team
      console.log(`Fetching squad for ${countryName}...`);
      const squadRes = await fetchFromApi(`/players/squads?team=${apiTeamId}`);
      
      if (!squadRes || squadRes.length === 0 || !squadRes[0].players) {
        console.log(`⚠️ No squad data for ${countryName}. Skipping.`);
        continue;
      }

      const rawPlayers = squadRes[0].players;
      console.log(`✅ Found ${rawPlayers.length} players for ${countryName}.`);

      // 3. Process Players
      const processedPlayers = rawPlayers.map((rp: any) => {
        const isStar = rp.number === 10 || rp.number === 9 || rp.number === 7 || rp.number === 1;
        const tier = isStar ? 0.9 : 0.7;
        const assetObj = {
          type: 'PLAYER' as const,
          playerTier: tier,
          globalMarketValue: generateRandomMarketValue(rp.age || 26, tier, isStar),
          age: rp.age || 26,
          popularity: isStar ? 0.9 : 0.5,
        };
        
        const price = calculatePlayerPrice(assetObj);
        
        return {
          apiId: rp.id,
          name: rp.name,
          number: rp.number,
          pos: mapPosition(rp.position),
          photo: rp.photo,
          tier,
          price,
          score: Math.round(75 + (tier * 15)),
          ...assetObj
        };
      });

      // 4. Calculate Team Price
      const teamPartial = { 
        type: 'TEAM' as const, 
        fifaRank: fifaRanks[countryName] || 20, 
        participations: 10, 
        popularity: 0.8, 
        harmony: 0.85, 
        injuries: 0 
      };
      
      const teamPrice = calculateTeamPrice(teamPartial, processedPlayers.map((p: any) => ({ current_price: p.price })));
      const teamScore = calculateTeamStrengthIndex(teamPartial, processedPlayers.map((p: any) => ({ score: p.score })));

      // 5. Save Team to Database
      const dbTeamId = `team-${teamCode.toLowerCase()}`;
      const savedTeam = await prisma.asset.upsert({
        where: { id: dbTeamId },
        update: {
          current_price: teamPrice,
          score: teamScore,
          fifaRank: fifaRanks[countryName] || 20,
        },
        create: {
          id: dbTeamId,
          type: 'TEAM',
          name: countryName,
          code: teamCode,
          image: teamLogo, // Now using real logo URL
          current_price: teamPrice,
          high_price: teamPrice,
          low_price: teamPrice,
          market_cap: '1B',
          volume: '10M',
          change: 0,
          fifaRank: fifaRanks[countryName] || 20,
          score: teamScore,
          continent: 'Global',
          group: 'A',
          participations: 10,
          ownersCount: Math.floor(Math.random() * 5000),
          riskIndex: 0.5,
          priceHistory: { create: { price: teamPrice } }
        }
      });

      // 6. Save Players to Database
      for (const p of processedPlayers) {
        const dbPlayerId = `player-${apiTeamId}-${p.apiId}`;
        await prisma.asset.upsert({
          where: { id: dbPlayerId },
          update: {
            current_price: p.price,
            age: p.age,
            position: p.pos,
          },
          create: {
            id: dbPlayerId,
            type: 'PLAYER',
            name: p.name,
            code: `${countryName.substring(0,2).toUpperCase()}${p.number || ''}`,
            image: p.photo, // Real player photo
            teamId: savedTeam.id,
            current_price: p.price,
            high_price: p.price,
            low_price: p.price,
            market_cap: '10M',
            volume: '100K',
            change: 0,
            position: p.pos,
            score: p.score,
            playerTier: p.tier,
            age: p.age,
            globalMarketValue: p.globalMarketValue,
            priceHistory: { create: { price: p.price } }
          }
        });
      }

      console.log(`✅ Saved ${countryName} and ${processedPlayers.length} players to database.`);

      // Sleep to respect API rate limits (avoid getting blocked)
      if (i < TOP_TEAMS.length - 1) {
        console.log('Sleeping for 2 seconds to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`❌ Failed to sync ${countryName}:`, error);
    }
  }

  console.log('\n🎉 API Sync Completed Successfully!');
}

main()
  .catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
