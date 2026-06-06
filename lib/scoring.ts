import { Asset } from '@prisma/client';

// ============================================================
// THE 3-PILLAR GAME ECONOMY MODEL (Game Economy 2.0)
// 1. Fundamental Score (50%)
// 2. Popularity Score (20%)
// 3. Market Score (30%)
// ============================================================

export interface PillarScores {
  fundamental: number; // 0-100
  popularity: number;  // 0-100
  market: number;      // 0-100
}

export function calculateCompositeScore(pillars: PillarScores): number {
  const composite = (pillars.fundamental * 0.5) + (pillars.popularity * 0.2) + (pillars.market * 0.3);
  return Math.max(0, Math.min(100, Math.round(composite)));
}

// ============================================================
// PART 1: PLAYER PRICING
// ============================================================

export function calculatePlayerPrice(asset: Partial<Asset>): number {
  if (asset.type !== 'PLAYER') return 0;

  // 1. Fundamental Score (Simulated from tier and position)
  const tier = asset.playerTier || 0.5;
  let fundamental = 50 + (tier * 40); // 0.5 -> 70, 1.0 -> 90

  // 2. Popularity Score (World Cup Influence)
  // Legends like Messi/Ronaldo have popularity near 1.0 -> 100 score.
  let popularity = (asset.popularity || 0.5) * 100;

  // Age Adjustment purely on Fundamental (Legends keep their high popularity)
  const age = asset.age || 26;
  if (age >= 24 && age <= 29) {
    fundamental += 5; // Peak age bonus
  } else if (age > 33) {
    fundamental -= 5; // Age penalty on physical fundamentals
  }
  fundamental = Math.min(100, Math.max(0, fundamental));

  // 3. Market Score (Currently mocked to 50 until live trading volume is implemented)
  const market = 50; 

  const pillars: PillarScores = { fundamental, popularity, market };
  const finalScore = calculateCompositeScore(pillars);

  // Convert Score to Price (Exponential Curve)
  // A score of 100 yields ~5200 (Mbappe). Score of 90 yields ~3800. Score of 50 yields ~400.
  // Formula: 250 + (Score/100)^3 * 5000
  const normalizedFactor = finalScore / 100;
  const basePrice = 250 + (Math.pow(normalizedFactor, 3) * 5000);

  return Math.round(basePrice);
}

// ============================================================
// PART 2: TEAM PRICING (Market Cap & Shares System)
// ============================================================

export function calculateTeamPrice(team: Partial<Asset>, players: Partial<Asset>[]): number {
  if (team.type !== 'TEAM') return 0;

  // 1. Fundamental Score
  const rank = team.fifaRank || 48;
  const rankScore = Math.max(0, 100 - (rank * 1.5)); // Rank 1 -> 98.5, Rank 48 -> 28
  
  // Average top 11 players
  const top11 = [...players].sort((a, b) => (b.playerTier || 0) - (a.playerTier || 0)).slice(0, 11);
  const avgTier = top11.reduce((sum, p) => sum + (p.playerTier || 0.5), 0) / (top11.length || 1);
  const squadScore = avgTier * 100;

  // History (Participations)
  const historyScore = Math.min(100, (team.participations || 0) / 20 * 100);

  // Fundamental = 50% Rank, 30% Squad, 20% History
  const fundamental = (rankScore * 0.5) + (squadScore * 0.3) + (historyScore * 0.2);

  // 2. Popularity Score
  const popularity = (team.popularity || 0.5) * 100;

  // 3. Market Score
  const market = 50; // Mocked

  const pillars: PillarScores = { fundamental, popularity, market };
  const finalScore = calculateCompositeScore(pillars);

  // Convert Score to MARKET CAP then to Share Price
  // Max Market Cap = ~20,000,000. Divided by 10,000 shares = Max Price ~2000.
  // Formula: Market Cap = (Score/100)^3 * 20,000,000
  const normalizedFactor = finalScore / 100;
  const marketCap = Math.pow(normalizedFactor, 3) * 20000000;
  
  const SHARES_OUTSTANDING = 10000;
  const sharePrice = marketCap / SHARES_OUTSTANDING;

  // Minimum floor price for any team is 150
  return Math.max(150, Math.round(sharePrice));
}

// ============================================================
// PART 3: UTILITIES
// ============================================================

// Helper to calculate just the 0-100 composite score for display in UI
export function calculateAssetScore(asset: Partial<Asset>, players?: Partial<Asset>[]): number {
  if (asset.type === 'TEAM' && players) {
    const rank = asset.fifaRank || 48;
    const rankScore = Math.max(0, 100 - (rank * 1.5));
    const top11 = [...players].sort((a, b) => (b.playerTier || 0) - (a.playerTier || 0)).slice(0, 11);
    const avgTier = top11.reduce((sum, p) => sum + (p.playerTier || 0.5), 0) / (top11.length || 1);
    const squadScore = avgTier * 100;
    const historyScore = Math.min(100, (asset.participations || 0) / 20 * 100);
    const fundamental = (rankScore * 0.5) + (squadScore * 0.3) + (historyScore * 0.2);
    const popularity = (asset.popularity || 0.5) * 100;
    return calculateCompositeScore({ fundamental, popularity, market: 50 });
  } else if (asset.type === 'PLAYER') {
    const tier = asset.playerTier || 0.5;
    let fundamental = 50 + (tier * 40);
    const age = asset.age || 26;
    if (age >= 24 && age <= 29) fundamental += 5;
    else if (age > 33) fundamental -= 5;
    const popularity = (asset.popularity || 0.5) * 100;
    return calculateCompositeScore({ fundamental, popularity, market: 50 });
  }
  return 50;
}
