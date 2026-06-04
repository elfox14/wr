import { PrismaClient } from '@prisma/client';
import { calculatePlayerPrice, calculateTeamPrice, calculateTeamStrengthIndex } from '../lib/scoring';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data for Advanced Market...');

  const arPlayersData = [
    { name: 'Emi Martinez', code: 'EM23', pos: 'GK', tier: 0.9, age: 31, club: 'Aston Villa', gmv: 28 },
    { name: 'Cristian Romero', code: 'CR13', pos: 'DEF', tier: 0.8, age: 25, club: 'Tottenham', gmv: 65 },
    { name: 'Lisandro Martinez', code: 'LM25', pos: 'DEF', tier: 0.8, age: 26, club: 'Man Utd', gmv: 50 },
    { name: 'Enzo Fernandez', code: 'EF8', pos: 'MID', tier: 0.9, age: 23, club: 'Chelsea', gmv: 80 },
    { name: 'Alexis Mac Allister', code: 'AM10', pos: 'MID', tier: 0.9, age: 25, club: 'Liverpool', gmv: 70 },
    { name: 'Lionel Messi', code: 'LM10', pos: 'FWD', tier: 1.0, age: 36, club: 'Inter Miami', gmv: 30, pop: 1.0 },
    { name: 'Julian Alvarez', code: 'JA9', pos: 'FWD', tier: 0.9, age: 24, club: 'Man City', gmv: 90 }
  ];

  const arPlayers = arPlayersData.map(p => {
    const asset = {
      type: 'PLAYER',
      playerTier: p.tier,
      globalMarketValue: p.gmv,
      age: p.age,
      popularity: p.pop || 0.5,
    };
    return {
      ...p,
      price: calculatePlayerPrice(asset),
      score: 85 + (p.tier * 10)
    };
  });

  const arTeamPartial = { type: 'TEAM', fifaRank: 1, participations: 18, popularity: 0.9, harmony: 0.95, injuries: 0 };
  const arTeamPrice = calculateTeamPrice(arTeamPartial, arPlayers.map(p => ({ current_price: p.price })));
  const arTeamIndex = calculateTeamStrengthIndex(arTeamPartial, arPlayers.map(p => ({ score: p.score })));

  // 1. Argentina Team
  const argentina = await prisma.asset.upsert({
    where: { id: 'team-ar' },
    update: {
      fifaRank: 1,
      score: arTeamIndex,
      continent: 'South America',
      group: 'A',
      coach: 'Lionel Scaloni',
      participations: 18,
      ownersCount: 15400,
      current_price: arTeamPrice,
      riskIndex: 0.2
    },
    create: {
      id: 'team-ar',
      type: 'TEAM',
      name: 'الأرجنتين',
      code: 'AR',
      image: '🇦🇷',
      current_price: arTeamPrice,
      high_price: arTeamPrice,
      low_price: arTeamPrice,
      market_cap: '5.2B',
      volume: '150M',
      change: 2.5,
      fifaRank: 1,
      score: arTeamIndex,
      continent: 'South America',
      group: 'A',
      coach: 'Lionel Scaloni',
      participations: 18,
      ownersCount: 15400,
      riskIndex: 0.2,
      priceHistory: { create: { price: arTeamPrice } }
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
        current_price: p.price
      },
      create: {
        id: `player-ar-${p.code.toLowerCase()}`,
        type: 'PLAYER',
        name: p.name,
        code: p.code,
        image: '👤',
        teamId: argentina.id,
        current_price: p.price,
        high_price: p.price + 50,
        low_price: p.price - 50,
        market_cap: '100M',
        volume: '1M',
        change: 1.2,
        position: p.pos,
        score: p.score,
        playerTier: p.tier,
        age: p.age,
        club: p.club,
        globalMarketValue: p.gmv,
        priceHistory: { create: { price: p.price } }
      }
    });
  }

  // Same logic for France
  const frPlayersData = [
    { name: 'Mike Maignan', code: 'MM16', pos: 'GK', tier: 0.9, age: 28, club: 'AC Milan', gmv: 40 },
    { name: 'William Saliba', code: 'WS2', pos: 'DEF', tier: 0.9, age: 23, club: 'Arsenal', gmv: 80 },
    { name: 'Theo Hernandez', code: 'TH22', pos: 'DEF', tier: 0.8, age: 26, club: 'AC Milan', gmv: 60 },
    { name: 'Eduardo Camavinga', code: 'EC6', pos: 'MID', tier: 0.9, age: 21, club: 'Real Madrid', gmv: 90 },
    { name: 'Aurelien Tchouameni', code: 'AT8', pos: 'MID', tier: 0.9, age: 24, club: 'Real Madrid', gmv: 90 },
    { name: 'Kylian Mbappe', code: 'KM10', pos: 'FWD', tier: 1.0, age: 25, club: 'Real Madrid', gmv: 180, pop: 1.0 },
    { name: 'Antoine Griezmann', code: 'AG7', pos: 'FWD', tier: 0.9, age: 33, club: 'Atletico Madrid', gmv: 25 }
  ];

  const frPlayers = frPlayersData.map(p => {
    const asset = {
      type: 'PLAYER',
      playerTier: p.tier,
      globalMarketValue: p.gmv,
      age: p.age,
      popularity: p.pop || 0.6,
    };
    return {
      ...p,
      price: calculatePlayerPrice(asset),
      score: 85 + (p.tier * 10)
    };
  });

  const frTeamPartial = { type: 'TEAM', fifaRank: 2, participations: 16, popularity: 0.85, harmony: 0.8, injuries: 1 };
  const frTeamPrice = calculateTeamPrice(frTeamPartial, frPlayers.map(p => ({ current_price: p.price })));
  const frTeamIndex = calculateTeamStrengthIndex(frTeamPartial, frPlayers.map(p => ({ score: p.score })));

  const france = await prisma.asset.upsert({
    where: { id: 'team-fr' },
    update: {
      fifaRank: 2,
      score: frTeamIndex,
      continent: 'Europe',
      group: 'B',
      coach: 'Didier Deschamps',
      participations: 16,
      ownersCount: 14200,
      current_price: frTeamPrice,
      riskIndex: 0.3
    },
    create: {
      id: 'team-fr',
      type: 'TEAM',
      name: 'فرنسا',
      code: 'FR',
      image: '🇫🇷',
      current_price: frTeamPrice,
      high_price: frTeamPrice,
      low_price: frTeamPrice,
      market_cap: '4.8B',
      volume: '130M',
      change: -1.0,
      fifaRank: 2,
      score: frTeamIndex,
      continent: 'Europe',
      group: 'B',
      coach: 'Didier Deschamps',
      participations: 16,
      ownersCount: 14200,
      riskIndex: 0.3,
      priceHistory: { create: { price: frTeamPrice } }
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
        current_price: p.price
      },
      create: {
        id: `player-fr-${p.code.toLowerCase()}`,
        type: 'PLAYER',
        name: p.name,
        code: p.code,
        image: '👤',
        teamId: france.id,
        current_price: p.price,
        high_price: p.price + 50,
        low_price: p.price - 50,
        market_cap: '100M',
        volume: '1M',
        change: 0.5,
        position: p.pos,
        score: p.score,
        playerTier: p.tier,
        age: p.age,
        club: p.club,
        globalMarketValue: p.gmv,
        priceHistory: { create: { price: p.price } }
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
