import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function generateHistory(basePrice: number) {
  const history = [];
  let currentPrice = basePrice;
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const change = (Math.random() - 0.45) * 5;
    currentPrice += change;
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    history.push({ price: Math.round(currentPrice), timestamp });
  }
  return history;
}

const teamsData = [
  // Group A
  { id: 'team-mex', name: 'Mexico', code: 'MEX', image: '🇲🇽', group: 'A', rank: 14, players: [{ name: 'Santiago Giménez', code: 'SG9' }] },
  { id: 'team-cro', name: 'Croatia', code: 'CRO', image: '🇭🇷', group: 'A', rank: 10, players: [{ name: 'Luka Modric', code: 'LM10' }] },
  { id: 'team-ngr', name: 'Nigeria', code: 'NGA', image: '🇳🇬', group: 'A', rank: 28, players: [{ name: 'Victor Osimhen', code: 'VO9' }] },
  { id: 'team-qat', name: 'Qatar', code: 'QAT', image: '🇶🇦', group: 'A', rank: 40, players: [{ name: 'Akram Afif', code: 'AA11' }] },

  // Group B
  { id: 'team-can', name: 'Canada', code: 'CAN', image: '🇨🇦', group: 'B', rank: 45, players: [{ name: 'Alphonso Davies', code: 'AD19' }] },
  { id: 'team-eng', name: 'England', code: 'ENG', image: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'B', rank: 3, players: [{ name: 'Jude Bellingham', code: 'JB5' }, { name: 'Harry Kane', code: 'HK9' }] },
  { id: 'team-sen', name: 'Senegal', code: 'SEN', image: '🇸🇳', group: 'B', rank: 17, players: [{ name: 'Sadio Mane', code: 'SM10' }] },
  { id: 'team-kor', name: 'South Korea', code: 'KOR', image: '🇰🇷', group: 'B', rank: 23, players: [{ name: 'Heung-min Son', code: 'HMS7' }] },

  // Group C
  { id: 'team-usa', name: 'USA', code: 'USA', image: '🇺🇸', group: 'C', rank: 12, players: [{ name: 'Christian Pulisic', code: 'CP10' }] },
  { id: 'team-ned', name: 'Netherlands', code: 'NED', image: '🇳🇱', group: 'C', rank: 6, players: [{ name: 'Virgil van Dijk', code: 'VVD4' }] },
  { id: 'team-ecu', name: 'Ecuador', code: 'ECU', image: '🇪🇨', group: 'C', rank: 31, players: [{ name: 'Moises Caicedo', code: 'MC25' }] },
  { id: 'team-aus', name: 'Australia', code: 'AUS', image: '🇦🇺', group: 'C', rank: 24, players: [{ name: 'Maty Ryan', code: 'MR1' }] },

  // Group D
  { id: 'team-arg', name: 'Argentina', code: 'ARG', image: '🇦🇷', group: 'D', rank: 1, players: [{ name: 'Lionel Messi', code: 'LM10' }, { name: 'Julian Alvarez', code: 'JA9' }] },
  { id: 'team-den', name: 'Denmark', code: 'DEN', image: '🇩🇰', group: 'D', rank: 21, players: [{ name: 'Christian Eriksen', code: 'CE10' }] },
  { id: 'team-mar', name: 'Morocco', code: 'MAR', image: '🇲🇦', group: 'D', rank: 13, players: [{ name: 'Achraf Hakimi', code: 'AH2' }] },
  { id: 'team-nzl', name: 'New Zealand', code: 'NZL', image: '🇳🇿', group: 'D', rank: 94, players: [{ name: 'Chris Wood', code: 'CW9' }] },

  // Group E
  { id: 'team-fr', name: 'France', code: 'FRA', image: '🇫🇷', group: 'E', rank: 2, players: [{ name: 'Kylian Mbappé', code: 'KM10' }, { name: 'Antoine Griezmann', code: 'AG7' }] },
  { id: 'team-col', name: 'Colombia', code: 'COL', image: '🇨🇴', group: 'E', rank: 14, players: [{ name: 'Luis Diaz', code: 'LD7' }] },
  { id: 'team-jpn', name: 'Japan', code: 'JPN', image: '🇯🇵', group: 'E', rank: 18, players: [{ name: 'Kaoru Mitoma', code: 'KM22' }] },
  { id: 'team-civ', name: 'Ivory Coast', code: 'CIV', image: '🇨🇮', group: 'E', rank: 39, players: [{ name: 'Sebastien Haller', code: 'SH9' }] },

  // Group F
  { id: 'team-bel', name: 'Belgium', code: 'BEL', image: '🇧🇪', group: 'F', rank: 4, players: [{ name: 'Kevin De Bruyne', code: 'KDB17' }] },
  { id: 'team-uru', name: 'Uruguay', code: 'URU', image: '🇺🇾', group: 'F', rank: 11, players: [{ name: 'Fede Valverde', code: 'FV15' }] },
  { id: 'team-alg', name: 'Algeria', code: 'ALG', image: '🇩🇿', group: 'F', rank: 43, players: [{ name: 'Riyad Mahrez', code: 'RM26' }] },
  { id: 'team-ksa', name: 'Saudi Arabia', code: 'KSA', image: '🇸🇦', group: 'F', rank: 53, players: [{ name: 'Salem Al-Dawsari', code: 'SAD10' }] },

  // Group G
  { id: 'team-br', name: 'Brazil', code: 'BRA', image: '🇧🇷', group: 'G', rank: 5, players: [{ name: 'Vinicius Jr', code: 'VJ7' }, { name: 'Rodrygo', code: 'R11' }] },
  { id: 'team-sui', name: 'Switzerland', code: 'SUI', image: '🇨🇭', group: 'G', rank: 19, players: [{ name: 'Granit Xhaka', code: 'GX34' }] },
  { id: 'team-egy', name: 'Egypt', code: 'EGY', image: '🇪🇬', group: 'G', rank: 36, players: [{ name: 'Mohamed Salah', code: 'MS11' }] },
  { id: 'team-crc', name: 'Costa Rica', code: 'CRC', image: '🇨🇷', group: 'G', rank: 52, players: [{ name: 'Keylor Navas', code: 'KN1' }] },

  // Group H
  { id: 'team-por', name: 'Portugal', code: 'POR', image: '🇵🇹', group: 'H', rank: 7, players: [{ name: 'Cristiano Ronaldo', code: 'CR7' }, { name: 'Bruno Fernandes', code: 'BF8' }] },
  { id: 'team-ser', name: 'Serbia', code: 'SRB', image: '🇷🇸', group: 'H', rank: 32, players: [{ name: 'Dusan Vlahovic', code: 'DV9' }] },
  { id: 'team-cmr', name: 'Cameroon', code: 'CMR', image: '🇨🇲', group: 'H', rank: 51, players: [{ name: 'Andre Onana', code: 'AO24' }] },
  { id: 'team-irn', name: 'IR Iran', code: 'IRN', image: '🇮🇷', group: 'H', rank: 20, players: [{ name: 'Mehdi Taremi', code: 'MT9' }] },

  // Group I
  { id: 'team-es', name: 'Spain', code: 'ESP', image: '🇪🇸', group: 'I', rank: 8, players: [{ name: 'Pedri', code: 'P8' }, { name: 'Lamine Yamal', code: 'LY19' }] },
  { id: 'team-chi', name: 'Chile', code: 'CHI', image: '🇨🇱', group: 'I', rank: 42, players: [{ name: 'Alexis Sanchez', code: 'AS7' }] },
  { id: 'team-mli', name: 'Mali', code: 'MLI', image: '🇲🇱', group: 'I', rank: 47, players: [{ name: 'Yves Bissouma', code: 'YB8' }] },
  { id: 'team-uzb', name: 'Uzbekistan', code: 'UZB', image: '🇺🇿', group: 'I', rank: 66, players: [{ name: 'Eldor Shomurodov', code: 'ES14' }] },

  // Group J
  { id: 'team-ita', name: 'Italy', code: 'ITA', image: '🇮🇹', group: 'J', rank: 9, players: [{ name: 'Federico Chiesa', code: 'FC14' }] },
  { id: 'team-per', name: 'Peru', code: 'PER', image: '🇵🇪', group: 'J', rank: 33, players: [{ name: 'Paolo Guerrero', code: 'PG9' }] },
  { id: 'team-bfa', name: 'Burkina Faso', code: 'BFA', image: '🇧🇫', group: 'J', rank: 62, players: [{ name: 'Edmond Tapsoba', code: 'ET12' }] },
  { id: 'team-uae', name: 'UAE', code: 'UAE', image: '🇦🇪', group: 'J', rank: 69, players: [{ name: 'Ali Mabkhout', code: 'AM7' }] },

  // Group K
  { id: 'team-de', name: 'Germany', code: 'GER', image: '🇩🇪', group: 'K', rank: 16, players: [{ name: 'Jamal Musiala', code: 'JM10' }, { name: 'Florian Wirtz', code: 'FW10' }] },
  { id: 'team-wal', name: 'Wales', code: 'WAL', image: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', group: 'K', rank: 29, players: [{ name: 'Brennan Johnson', code: 'BJ9' }] },
  { id: 'team-tun', name: 'Tunisia', code: 'TUN', image: '🇹🇳', group: 'K', rank: 41, players: [{ name: 'Ellyes Skhiri', code: 'ES17' }] },
  { id: 'team-omn', name: 'Oman', code: 'OMA', image: '🇴🇲', group: 'K', rank: 80, players: [{ name: 'Salaah Al-Yahyaei', code: 'SA10' }] },

  // Group L
  { id: 'team-pol', name: 'Poland', code: 'POL', image: '🇵🇱', group: 'L', rank: 30, players: [{ name: 'Robert Lewandowski', code: 'RL9' }] },
  { id: 'team-ven', name: 'Venezuela', code: 'VEN', image: '🇻🇪', group: 'L', rank: 54, players: [{ name: 'Yeferson Soteldo', code: 'YS10' }] },
  { id: 'team-gha', name: 'Ghana', code: 'GHA', image: '🇬🇭', group: 'L', rank: 61, players: [{ name: 'Mohammed Kudus', code: 'MK20' }] },
  { id: 'team-jam', name: 'Jamaica', code: 'JAM', image: '🇯🇲', group: 'L', rank: 57, players: [{ name: 'Leon Bailey', code: 'LB9' }] },
];

function calculatePrice(rank: number, isPlayer: boolean = false) {
  // Rank 1 gets ~5000, Rank 100 gets ~500
  let price = 5500 - (rank * 50);
  if (price < 300) price = 300;
  if (isPlayer) {
    // Players are a bit more volatile
    price = price * (0.8 + Math.random() * 0.4);
  }
  return Math.round(price);
}

async function main() {
  console.log('Seeding database with World Cup 2026 data (48 Teams)...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 1. Create Demo User
  const user = await prisma.user.upsert({
    where: { email: 'admin@worldcup.com' },
    update: {},
    create: {
      name: 'Admin Investor',
      username: 'investor_pro',
      email: 'admin@worldcup.com',
      password: hashedPassword,
      balance: 150000,
      total_profit: 25000,
      role: 'ADMIN',
    },
  });

  // 2. Clear existing data
  await prisma.match.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.marketNews.deleteMany({});
  await prisma.holding.deleteMany({});
  await prisma.priceHistory.deleteMany({});
  await prisma.asset.deleteMany({});

  // 3. Create Teams & Players
  const allTeamIds: string[] = [];

  for (const t of teamsData) {
    const basePrice = calculatePrice(t.rank);
    const historyData = generateHistory(basePrice);
    const finalPrice = historyData[historyData.length - 1].price;
    const highPrice = Math.max(...historyData.map(h => h.price));
    const lowPrice = Math.min(...historyData.map(h => h.price));

    // Create Team
    const teamRecord = await prisma.asset.create({
      data: {
        id: t.id,
        type: 'TEAM',
        name: t.name,
        code: t.code,
        image: t.image,
        group: t.group,
        current_price: finalPrice,
        high_price: highPrice,
        low_price: lowPrice,
        market_cap: `${(100 - t.rank + 10)}B`,
        volume: `${Math.floor(Math.random() * 5 + 1)}M`,
        change: parseFloat((Math.random() * 5 - 2.5).toFixed(2)),
        priceHistory: {
          create: historyData.map(h => ({
            price: h.price,
            timestamp: h.timestamp
          }))
        }
      }
    });

    allTeamIds.push(teamRecord.id);

    // Create Players for this team
    for (const p of t.players) {
      const pBasePrice = calculatePrice(t.rank, true);
      const pHistoryData = generateHistory(pBasePrice);
      const pFinalPrice = pHistoryData[pHistoryData.length - 1].price;
      const pHighPrice = Math.max(...pHistoryData.map(h => h.price));
      const pLowPrice = Math.min(...pHistoryData.map(h => h.price));

      await prisma.asset.create({
        data: {
          id: `player-${t.code.toLowerCase()}-${p.code.toLowerCase()}`,
          type: 'PLAYER',
          name: p.name,
          code: p.code,
          image: t.image, // Use team flag as player image
          teamId: teamRecord.id, // Link to team
          current_price: pFinalPrice,
          high_price: pHighPrice,
          low_price: pLowPrice,
          market_cap: `${Math.floor(Math.random() * 800 + 100)}M`,
          volume: `${Math.floor(Math.random() * 10 + 2)}M`,
          change: parseFloat((Math.random() * 8 - 4).toFixed(2)),
          priceHistory: {
            create: pHistoryData.map(h => ({
              price: h.price,
              timestamp: h.timestamp
            }))
          }
        }
      });
    }
  }

  // 4. Create Matches
  // We'll create some mock matches for Group A and B to start
  const now = new Date();
  await prisma.match.createMany({
    data: [
      { homeTeamId: 'team-mex', awayTeamId: 'team-qat', matchDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 1), status: 'SCHEDULED', groupPhase: 'Group A' },
      { homeTeamId: 'team-cro', awayTeamId: 'team-ngr', matchDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 2), status: 'SCHEDULED', groupPhase: 'Group A' },
      { homeTeamId: 'team-eng', awayTeamId: 'team-sen', matchDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3), status: 'SCHEDULED', groupPhase: 'Group B' },
      { homeTeamId: 'team-can', awayTeamId: 'team-kor', matchDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 1), status: 'FINISHED', groupPhase: 'Group B', homeScore: 2, awayScore: 1 },
      { homeTeamId: 'team-arg', awayTeamId: 'team-mar', matchDate: new Date(now.getTime() + 1000 * 60 * 60 * 5), status: 'LIVE', groupPhase: 'Group D', homeScore: 1, awayScore: 0 },
    ]
  });

  // 5. Create some Holdings for User
  await prisma.holding.create({
    data: {
      userId: user.id,
      assetId: 'team-arg',
      quantity: 120,
      avg_buy_price: 4900,
    }
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
