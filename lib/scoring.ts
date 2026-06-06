import { Asset } from '@prisma/client';

// ============================================================
// THE 4-PILLAR GAME ECONOMY MODEL (Game Economy 2.1)
// 1. Fundamental Score
// 2. Popularity Score
// 3. World Cup Legacy
// 4. Market Demand
// ============================================================

export interface PillarScores {
  fundamental: number; // 0-100
  popularity: number;  // 0-100
  legacy?: number;     // 0-100 (For players)
  marketDemand: number;// 0-100
}

export function calculateCompositeScore(pillars: PillarScores, isTeam = false): number {
  if (isTeam) {
    // For Teams: Fundamental (which includes History) = 60%, Popularity = 20%, Market Demand = 20%
    const composite = (pillars.fundamental * 0.6) + (pillars.popularity * 0.2) + (pillars.marketDemand * 0.2);
    return Math.max(0, Math.min(100, Math.round(composite)));
  } else {
    // For Players: Fundamental 30%, Popularity 25%, Legacy 20%, Market Demand 25%
    const legacyScore = pillars.legacy || 0;
    const composite = (pillars.fundamental * 0.30) + (pillars.popularity * 0.25) + (legacyScore * 0.20) + (pillars.marketDemand * 0.25);
    return Math.max(0, Math.min(100, Math.round(composite)));
  }
}

// ============================================================
// PART 1: PLAYER PRICING
// ============================================================

export function getPlayerRatingLabel(rating: number): string {
  if (rating >= 90) return 'World-class';
  if (rating >= 85) return 'Top starter';
  if (rating >= 80) return 'Key player';
  if (rating >= 70) return 'Squad/rotation';
  return 'Reserve';
}

export function calculatePlayerPrice(asset: Partial<Asset> & { teamRank?: number }): number {
  if (asset.type !== 'PLAYER') return 0;

  // 1. Calculate the 4-Pillar Composite Score
  let score = asset.score;
  if (!score) {
    score = calculateAssetScore(asset);
  }

  // 2. Position Multiplier on Final Price
  let basePrice = (score as number) * 10;
  const position = (asset as any).position || 'MID';
  if (position === 'FWD') basePrice *= 1.15;
  else if (position === 'MID') basePrice *= 1.05;
  else if (position === 'DEF') basePrice *= 0.95;
  else if (position === 'GK') basePrice *= 0.85;

  return Math.round(basePrice);
}

// ============================================================
// PART 2: TEAM PRICING (Market Cap & Shares System)
// ============================================================

export function getTeamTierLabel(score: number): string {
  if (score >= 90) return 'الأسهم الذهبية (Tier A)';
  if (score >= 80) return 'أسهم قيادية (Tier B)';
  if (score >= 70) return 'أسهم النمو (Tier C)';
  if (score >= 60) return 'أسهم الفرص (Tier D)';
  return 'أسهم المخاطرة (Tier E)';
}

export function calculateTeamPrice(team: Partial<Asset>, players: Partial<Asset>[]): number {
  if (team.type !== 'TEAM') return 0;

  // Rank Score
  const rank = team.fifaRank || 48;
  const rankScore = Math.max(0, 100 - (rank * 1.5)); 
  
  // Squad Score (with Star Count)
  const sorted = [...players].sort((a, b) => (b.playerTier || 0) - (a.playerTier || 0));
  const top11 = sorted.slice(0, 11);
  const avgTier = top11.reduce((sum, p) => sum + (p.playerTier || 0.5), 0) / (top11.length || 1);
  const topStarTier = (sorted[0]?.playerTier || 0.5) * 100; // Best player's tier
  const depthCount = players.filter(p => (p.playerTier || 0) > 0.7).length;
  const depthScore = Math.min(100, depthCount * 8); // ~12 good players = 96

  // Squad = 60% Average + 30% Best Star + 10% Depth
  const squadScore = (avgTier * 100 * 0.60) + (topStarTier * 0.30) + (depthScore * 0.10);

  // History (Participations / Cups)
  const historyScore = Math.min(100, (team.participations || 0) / 20 * 100);

  // 1. Fundamental = 40% Rank, 30% Squad, 30% History (Brand/Legacy)
  const fundamental = (rankScore * 0.40) + (squadScore * 0.30) + (historyScore * 0.30);

  // 2. Popularity Score
  const popularity = (team.popularity || 0.5) * 100;

  // 3. Market Demand (Starts equal to popularity, grows dynamically)
  const marketDemand = getDynamicMarketDemand(team, popularity);

  const pillars: PillarScores = { fundamental, popularity, marketDemand };
  const finalScore = calculateCompositeScore(pillars, true);

  // Smooth curve: min 150 (score=0) -> max 2000 (score=100)
  const normalized = finalScore / 100;
  const sharePrice = 150 + Math.pow(normalized, 2.5) * 1850;
  
  return Math.max(150, Math.round(sharePrice));
}

// ============================================================
// PART 3: UTILITIES
// ============================================================

// Helper to calculate dynamic market demand based on volume and owners
function getDynamicMarketDemand(asset: Partial<Asset>, basePopularity: number): number {
  let volumeValue = 0;
  if (asset.volume) {
    if (asset.volume.includes('M')) volumeValue = parseFloat(asset.volume) * 1000000;
    else if (asset.volume.includes('K')) volumeValue = parseFloat(asset.volume) * 1000;
    else volumeValue = parseFloat(asset.volume) || 0;
  }
  
  const ownersBonus = (asset.ownersCount || 0) * 0.1;
  const volumeBonus = volumeValue / 1000; // e.g. 10k volume = +10 to demand
  
  return Math.min(100, basePopularity + ownersBonus + volumeBonus);
}

// Helper to calculate just the 0-100 composite score for display in UI
export function calculateAssetScore(asset: Partial<Asset>, players?: Partial<Asset>[]): number {
  if (asset.type === 'TEAM' && players) {
    const rank = asset.fifaRank || 48;
    const rankScore = Math.max(0, 100 - (rank * 1.5));
    const sorted = [...players].sort((a, b) => (b.playerTier || 0) - (a.playerTier || 0));
    const top11 = sorted.slice(0, 11);
    const avgTier = top11.reduce((sum, p) => sum + (p.playerTier || 0.5), 0) / (top11.length || 1);
    const topStarTier = (sorted[0]?.playerTier || 0.5) * 100;
    const depthCount = players.filter(p => (p.playerTier || 0) > 0.7).length;
    const depthScore = Math.min(100, depthCount * 8);
    const squadScore = (avgTier * 100 * 0.60) + (topStarTier * 0.30) + (depthScore * 0.10);
    const historyScore = Math.min(100, (asset.participations || 0) / 20 * 100);
    const fundamental = (rankScore * 0.40) + (squadScore * 0.30) + (historyScore * 0.30);
    const popularity = (asset.popularity || 0.5) * 100;
    const marketDemand = getDynamicMarketDemand(asset, popularity);
    
    return calculateCompositeScore({ fundamental, popularity, marketDemand }, true);
  } else if (asset.type === 'PLAYER') {
    const tier = asset.playerTier || 0.5;
    const age = asset.age || 26;
    let fundamental = 50 + (tier * 40);
    if (age >= 24 && age <= 29) fundamental += 5;
    else if (age > 33) fundamental -= 5;
    
    const popularity = (asset.popularity || 0.5) * 100;
    const marketDemand = getDynamicMarketDemand(asset, popularity);
    
    let legacy = 20; 
    if (age > 32 && tier >= 0.9) legacy = 95;
    else if (age > 28 && tier >= 0.8) legacy = 75;
    else if (age > 25 && tier >= 0.8) legacy = 60;
    else if (tier >= 0.6) legacy = 40; 
    
    if (age <= 23 && tier >= 0.8) {
      legacy = Math.max(legacy, 40);
    }

    return calculateCompositeScore({ fundamental, popularity, legacy, marketDemand }, false);
  }
  return 50;
}
