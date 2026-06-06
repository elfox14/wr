import { Asset } from '@prisma/client';

export function calculatePlayerPrice(asset: Partial<Asset>): number {
  if (asset.type !== 'PLAYER') return 0;
  
  // Base pricing based on tier and global market value
  // User examples: 1200 for world class, 700 for starter, 250 for sub
  
  let basePrice = 250; // default for sub
  if (asset.playerTier) {
    if (asset.playerTier >= 0.9) basePrice = 1200;
    else if (asset.playerTier >= 0.8) basePrice = 700;
  }
  
  // Global market value modifier (if available, e.g., 180M -> +180)
  if (asset.globalMarketValue) {
    basePrice += asset.globalMarketValue * 2; 
  }

  // Age modifier (younger is generally higher potential, but peak is 26-29)
  if (asset.age) {
    if (asset.age < 23) basePrice *= 1.1; // Youth premium
    else if (asset.age > 33) basePrice *= 0.8; // Age penalty
  }

  // Momentum / Popularity
  if (asset.popularity) {
    basePrice *= (1 + (asset.popularity * 0.2));
  }

  // Risk Index penalty (higher risk = lower price)
  if (asset.riskIndex && asset.riskIndex > 0.7) {
    basePrice *= 0.9;
  }

  return Math.round(basePrice);
}

export function calculateTeamPrice(team: Partial<Asset>, players: Partial<Asset>[]): number {
  if (team.type !== 'TEAM') return 0;

  // Option: Index based on average player price
  // A team has ~26 players. If average is 700, sum is 18200.
  // We can use the top 11 players for the starting XI value.
  
  const sortedPlayers = [...players].sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
  const top11 = sortedPlayers.slice(0, 11);
  
  let startingXIValue = 0;
  top11.forEach(p => startingXIValue += (p.current_price || 0));

  // The base Team Price formula:
  // 40% FIFA Rank, 30% Squad Value, 20% History (Participations), 10% Popularity

  // 1. FIFA Rank Score (Rank 1 = 1000, Rank 48 = 100)
  let rankScore = 500;
  if (team.fifaRank) {
    rankScore = Math.max(100, 1000 - (team.fifaRank * 18));
  }

  // 2. Squad Value Score (normalize against a max expected starting XI value of ~12000)
  let squadScore = (startingXIValue / 12000) * 1000;
  if (squadScore > 1000) squadScore = 1000;

  // 3. History/Participations (Max ~22 participations = 1000)
  let historyScore = 500;
  if (team.participations) {
    historyScore = Math.min(1000, (team.participations / 22) * 1000);
  }

  // 4. Popularity (0.0 to 1.0)
  const popScore = (team.popularity || 0.5) * 1000;

  const finalPrice = (0.40 * rankScore) + (0.30 * squadScore) + (0.20 * historyScore) + (0.10 * popScore);
  
  // Scale it up so a strong team is around 3000 (3x scale) to ensure the team ceiling is higher than star players.
  return Math.max(100, Math.round(finalPrice * 3));
}

export function calculateTeamStrengthIndex(team: Partial<Asset>, players: Partial<Asset>[]): number {
  if (team.type !== 'TEAM') return 0;
  
  // Team Strength Index out of 100
  // Quality, Market Value, Ranking, Injuries, Harmony
  
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const top11 = sortedPlayers.slice(0, 11);
  
  let totalPlayerQuality = 0;
  top11.forEach(p => totalPlayerQuality += (p.score || 70));
  const avgQuality = top11.length > 0 ? totalPlayerQuality / top11.length : 70;

  let rankScore = 50;
  if (team.fifaRank) {
    rankScore = Math.max(10, 100 - (team.fifaRank * 1.5));
  }

  let harmonyScore = (team.harmony || 1.0) * 100;
  
  let injuryPenalty = (team.injuries || 0) * 2; // e.g. 5 injuries = -10 pts

  let index = (avgQuality * 0.5) + (rankScore * 0.3) + (harmonyScore * 0.2) - injuryPenalty;
  
  if (index > 100) index = 100;
  if (index < 0) index = 0;

  return Number(index.toFixed(1));
}
