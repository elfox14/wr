import { PrismaClient } from '@prisma/client';
import { calculateFairValue, calculateAssetScore } from '../lib/scoring';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data for Advanced Market...');

  const arPlayersData = [
    { name: 'Emi Martinez', code: 'EM23', pos: 'GK', tier: 0.9, age: 31, club: 'Aston Villa', gmv: 28, leg: 80 },
    { name: 'Cristian Romero', code: 'CR13', pos: 'DEF', tier: 0.8, age: 25, club: 'Tottenham', gmv: 65, leg: 60 },
    { name: 'Lisandro Martinez', code: 'LM25', pos: 'DEF', tier: 0.8, age: 26, club: 'Man Utd', gmv: 50, leg: 60 },
    { name: 'Enzo Fernandez', code: 'EF8', pos: 'MID', tier: 0.9, age: 23, club: 'Chelsea', gmv: 80, leg: 75 },
    { name: 'Alexis Mac Allister', code: 'AM10', pos: 'MID', tier: 0.9, age: 25, club: 'Liverpool', gmv: 70, leg: 75 },
    { name: 'Lionel Messi', code: 'LM10', pos: 'FWD', tier: 1.0, age: 36, club: 'Inter Miami', gmv: 30, pop: 1.0, leg: 100 },
    { name: 'Julian Alvarez', code: 'JA9', pos: 'FWD', tier: 0.9, age: 24, club: 'Man City', gmv: 90, leg: 72 }
  ];

  const arPlayers = arPlayersData.map(p => {
    const asset = {
      type: 'PLAYER' as const,
      fundamental: p.tier * 100,
      popularity: (p.pop || 0.5) * 100,
      worldCupLegacy: p.leg,
      marketDemand: 50,
      momentum: 50,
      age: p.age,
    };
    const score = calculateAssetScore(asset);
    const fairValue = calculateFairValue(score, 'PLAYER');
    return {
      ...p,
      score,
      fairValue,
      marketPrice: fairValue
    };
  });

  const arTeamPartial = { 
    type: 'TEAM' as const,
    fundamental: 90,
    popularity: 90,
    worldCupLegacy: 90,
    marketDemand: 60,
    momentum: 50,
    fifaRank: 1,
  };
  const arTeamScore = calculateAssetScore(arTeamPartial, arPlayers.map(p => ({ score: p.score })));
  const arTeamFairValue = calculateFairValue(arTeamScore, 'TEAM');

  const argentina = await prisma.asset.upsert({
    where: { id: 'team-ar' },
    update: {
      fifaRank: 1,
      score: arTeamScore,
      continent: 'South America',
      group: 'A',
      coach: 'Lionel Scaloni',
      participations: 18,
      ownersCount: 15400,
      current_price: arTeamFairValue,
      marketPrice: arTeamFairValue,
      fairValue: arTeamFairValue,
      fundamental: 90,
      popularity: 90,
      worldCupLegacy: 90,
      marketDemand: 60,
      momentum: 50,
      volatilityScore: 20
    },
    create: {
      id: 'team-ar',
      type: 'TEAM',
      name: 'الأرجنتين',
      code: 'AR',
      image: '🇦🇷',
      current_price: arTeamFairValue,
      marketPrice: arTeamFairValue,
      fairValue: arTeamFairValue,
      high_price: arTeamFairValue,
      low_price: arTeamFairValue,
      market_cap: '5.2B',
      volume: '150M',
      change: 2.5,
      fifaRank: 1,
      score: arTeamScore,
      continent: 'South America',
      group: 'A',
      coach: 'Lionel Scaloni',
      participations: 18,
      ownersCount: 15400,
      riskIndex: 0.2,
      fundamental: 90,
      popularity: 90,
      worldCupLegacy: 90,
      marketDemand: 60,
      momentum: 50,
      volatilityScore: 20,
      priceHistory: { create: { price: arTeamFairValue } }
    }
  });

  for (const p of arPlayers) {
    await prisma.asset.upsert({
      where: { id: `player-ar-${p.code.toLowerCase()}` },
      update: {
        position: p.pos,
        score: p.score,
        playerTier: p.tier,
        age: p.age,
        club: p.club,
        globalMarketValue: p.gmv,
        current_price: p.fairValue,
        marketPrice: p.fairValue,
        fairValue: p.fairValue,
        fundamental: p.tier * 100,
        popularity: (p.pop || 0.5) * 100,
        worldCupLegacy: p.leg,
        marketDemand: 50,
        momentum: 50,
        volatilityScore: 50
      },
      create: {
        id: `player-ar-${p.code.toLowerCase()}`,
        type: 'PLAYER',
        name: p.name,
        code: p.code,
        image: '👤',
        teamId: argentina.id,
        current_price: p.fairValue,
        marketPrice: p.fairValue,
        fairValue: p.fairValue,
        high_price: p.fairValue + 50,
        low_price: p.fairValue - 50,
        market_cap: '100M',
        volume: '1M',
        change: 1.2,
        position: p.pos,
        score: p.score,
        playerTier: p.tier,
        age: p.age,
        club: p.club,
        globalMarketValue: p.gmv,
        fundamental: p.tier * 100,
        popularity: (p.pop || 0.5) * 100,
        worldCupLegacy: p.leg,
        marketDemand: 50,
        momentum: 50,
        volatilityScore: 50,
        priceHistory: { create: { price: p.fairValue } }
      }
    });
  }

  // Same logic for France
  const frPlayersData = [
    { name: 'Mike Maignan', code: 'MM16', pos: 'GK', tier: 0.9, age: 28, club: 'AC Milan', gmv: 40, leg: 70 },
    { name: 'William Saliba', code: 'WS2', pos: 'DEF', tier: 0.9, age: 23, club: 'Arsenal', gmv: 80, leg: 50 },
    { name: 'Theo Hernandez', code: 'TH22', pos: 'DEF', tier: 0.8, age: 26, club: 'AC Milan', gmv: 60, leg: 65 },
    { name: 'Eduardo Camavinga', code: 'EC6', pos: 'MID', tier: 0.9, age: 21, club: 'Real Madrid', gmv: 90, leg: 60 },
    { name: 'Aurelien Tchouameni', code: 'AT8', pos: 'MID', tier: 0.9, age: 24, club: 'Real Madrid', gmv: 90, leg: 65 },
    { name: 'Kylian Mbappe', code: 'KM10', pos: 'FWD', tier: 1.0, age: 25, club: 'Real Madrid', gmv: 180, pop: 1.0, leg: 85 },
    { name: 'Antoine Griezmann', code: 'AG7', pos: 'FWD', tier: 0.9, age: 33, club: 'Atletico Madrid', gmv: 25, leg: 80 }
  ];

  const frPlayers = frPlayersData.map(p => {
    const asset = {
      type: 'PLAYER' as const,
      fundamental: p.tier * 100,
      popularity: (p.pop || 0.6) * 100,
      worldCupLegacy: p.leg,
      marketDemand: 50,
      momentum: 50,
      age: p.age,
    };
    const score = calculateAssetScore(asset);
    const fairValue = calculateFairValue(score, 'PLAYER');
    return {
      ...p,
      score,
      fairValue,
      marketPrice: fairValue
    };
  });

  const frTeamPartial = { 
    type: 'TEAM' as const,
    fundamental: 90,
    popularity: 85,
    worldCupLegacy: 85,
    marketDemand: 60,
    momentum: 50,
    fifaRank: 2,
  };
  const frTeamScore = calculateAssetScore(frTeamPartial, frPlayers.map(p => ({ score: p.score })));
  const frTeamFairValue = calculateFairValue(frTeamScore, 'TEAM');

  const france = await prisma.asset.upsert({
    where: { id: 'team-fr' },
    update: {
      fifaRank: 2,
      score: frTeamScore,
      continent: 'Europe',
      group: 'B',
      coach: 'Didier Deschamps',
      participations: 16,
      ownersCount: 14200,
      current_price: frTeamFairValue,
      marketPrice: frTeamFairValue,
      fairValue: frTeamFairValue,
      fundamental: 90,
      popularity: 85,
      worldCupLegacy: 85,
      marketDemand: 60,
      momentum: 50,
      volatilityScore: 30
    },
    create: {
      id: 'team-fr',
      type: 'TEAM',
      name: 'فرنسا',
      code: 'FR',
      image: '🇫🇷',
      current_price: frTeamFairValue,
      marketPrice: frTeamFairValue,
      fairValue: frTeamFairValue,
      high_price: frTeamFairValue,
      low_price: frTeamFairValue,
      market_cap: '4.8B',
      volume: '130M',
      change: -1.0,
      fifaRank: 2,
      score: frTeamScore,
      continent: 'Europe',
      group: 'B',
      coach: 'Didier Deschamps',
      participations: 16,
      ownersCount: 14200,
      riskIndex: 0.3,
      fundamental: 90,
      popularity: 85,
      worldCupLegacy: 85,
      marketDemand: 60,
      momentum: 50,
      volatilityScore: 30,
      priceHistory: { create: { price: frTeamFairValue } }
    }
  });

  for (const p of frPlayers) {
    await prisma.asset.upsert({
      where: { id: `player-fr-${p.code.toLowerCase()}` },
      update: {
        position: p.pos,
        score: p.score,
        playerTier: p.tier,
        age: p.age,
        club: p.club,
        globalMarketValue: p.gmv,
        current_price: p.fairValue,
        marketPrice: p.fairValue,
        fairValue: p.fairValue,
        fundamental: p.tier * 100,
        popularity: (p.pop || 0.6) * 100,
        worldCupLegacy: p.leg,
        marketDemand: 50,
        momentum: 50,
        volatilityScore: 50
      },
      create: {
        id: `player-fr-${p.code.toLowerCase()}`,
        type: 'PLAYER',
        name: p.name,
        code: p.code,
        image: '👤',
        teamId: france.id,
        current_price: p.fairValue,
        marketPrice: p.fairValue,
        fairValue: p.fairValue,
        high_price: p.fairValue + 50,
        low_price: p.fairValue - 50,
        market_cap: '100M',
        volume: '1M',
        change: 0.5,
        position: p.pos,
        score: p.score,
        playerTier: p.tier,
        age: p.age,
        club: p.club,
        globalMarketValue: p.gmv,
        fundamental: p.tier * 100,
        popularity: (p.pop || 0.6) * 100,
        worldCupLegacy: p.leg,
        marketDemand: 50,
        momentum: 50,
        volatilityScore: 50,
        priceHistory: { create: { price: p.fairValue } }
      }
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
