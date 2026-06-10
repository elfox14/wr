import { Asset, Match } from '@prisma/client';

type Stage = 'group' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final' | string;

export interface TeamMatchContext {
  team: Asset;
  opponent?: Asset | null;
  match?: Pick<Match, 'stage' | 'homeTeamId' | 'awayTeamId' | 'homeScore' | 'awayScore'> | null;
  won: boolean;
  drawn: boolean;
  lost: boolean;
  goalsFor: number;
  goalsAgainst: number;
  isEliminated?: boolean;
  qualifiedFromGroup?: boolean;
  wonTournament?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getStageMultiplier(stage?: Stage): number {
  const s = (stage || 'group').toLowerCase();
  if (s.includes('final') && !s.includes('semi') && !s.includes('quarter')) return 2.0;
  if (s.includes('semi')) return 1.75;
  if (s.includes('quarter')) return 1.5;
  if (s.includes('round_of_16') || s.includes('last_16')) return 1.3;
  if (s.includes('third')) return 1.15;
  return 1.0;
}

function getRankStrength(rank?: number | null): number {
  // Higher means stronger. Rank 1 = 100, rank 100 = 1.
  const safeRank = Math.max(1, rank || 80);
  return clamp(101 - safeRank, 1, 100);
}

function getOpponentMultiplier(team: Asset, opponent?: Asset | null): number {
  if (!opponent) return 1.0;

  const teamStrength = getRankStrength(team.fifaRank);
  const opponentStrength = getRankStrength(opponent.fifaRank);
  const strengthGap = opponentStrength - teamStrength;

  // Beating a stronger opponent is rewarded. Expected results move less.
  return clamp(1 + (strengthGap / 100), 0.70, 1.45);
}

function getGoalDiffBonus(goalsFor: number, goalsAgainst: number): number {
  const diff = goalsFor - goalsAgainst;
  if (diff > 0) return clamp(diff * 0.75, 0, 3.0);
  if (diff < 0) return clamp(diff * 0.75, -3.5, 0);
  return 0;
}

export function calculateMatchPriceDelta(context: TeamMatchContext): number {
  const stageMultiplier = getStageMultiplier(context.match?.stage);
  const opponentMultiplier = getOpponentMultiplier(context.team, context.opponent);

  let baseDelta = 0;
  if (context.won) baseDelta = 3.0 * opponentMultiplier;
  else if (context.drawn) baseDelta = context.opponent
    ? 0.8 * getOpponentMultiplier(context.team, context.opponent)
    : 1.0;
  else if (context.lost) {
    // Loss to a weaker opponent hurts more; loss to stronger opponent hurts less.
    const lossPain = clamp(2.0 / opponentMultiplier, 1.0, 4.5);
    baseDelta = -lossPain;
  }

  let deltaPercent = (baseDelta + getGoalDiffBonus(context.goalsFor, context.goalsAgainst)) * stageMultiplier;

  if (context.qualifiedFromGroup) deltaPercent += 8.0;
  if (context.isEliminated) deltaPercent -= stageMultiplier >= 1.3 ? 18.0 : 12.0;
  if (context.wonTournament) deltaPercent += 30.0;

  return clamp(deltaPercent, -35.0, 35.0);
}

export function applyMarketMove(currentPrice: number, deltaPercent: number): number {
  const safePrice = Math.max(1, currentPrice);
  const newPrice = safePrice * (1 + deltaPercent / 100);
  return Math.max(1, Math.round(newPrice));
}

/**
 * Legacy aggregate API kept for compatibility.
 * Prefer calculateMatchPriceDelta per match so opponent strength and stage can be applied accurately.
 */
export function calculateNewPrice(
  asset: Asset,
  stats: { won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number },
  isEliminated: boolean = false,
): number {
  let deltaPercent = 0.0;
  deltaPercent += stats.won * 3.0;
  deltaPercent += stats.drawn * 1.0;
  deltaPercent -= stats.lost * 2.0;
  deltaPercent += getGoalDiffBonus(stats.goalsFor, stats.goalsAgainst);

  if (isEliminated) {
    deltaPercent -= 15.0;
  }

  deltaPercent = clamp(deltaPercent, -35.0, 35.0);
  return applyMarketMove(asset.current_price, deltaPercent);
}
