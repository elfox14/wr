import { mapPositionToAnalysisRole, scorePlayerProfile, type FootballPosition, type MetricScores } from './player-scoring-engine';
import type { ValueFitAssetInput } from './value-fit';

export type FootballAnalysisAssetInput = ValueFitAssetInput & {
  id?: string;
  name?: string | null;
  type?: string | null;
  image?: string | null;
  position?: string | null;
  score?: number | string | null;
  lastPerformanceRating?: number | string | null;
  fundamental?: number | string | null;
  momentum?: number | string | null;
  change?: number | string | null;
  marketDemand?: number | string | null;
  demandScore?: number | string | null;
  popularity?: number | string | null;
  popularityScore?: number | string | null;
  consistency?: number | string | null;
  volatilityScore?: number | string | null;
  availability?: number | string | null;
  squadQuality?: number | string | null;
  qualityScore?: number | string | null;
  teamScore?: number | string | null;
  worldCupLegacy?: number | string | null;
  legacyScore?: number | string | null;
};

function n(value: unknown, fallback = 50) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizePercent(value: unknown, fallback = 50) {
  const num = n(value, fallback);
  if (num <= 1) return Math.round(num * 100);
  return Math.max(0, Math.min(100, Math.round(num)));
}

function priceSignal(asset: FootballAnalysisAssetInput) {
  const current = n(asset?.marketPrice ?? asset?.current_price, 0);
  const fair = n(asset?.fairValue, current || 1);
  if (!current || !fair) return 50;
  const discount = ((fair - current) / fair) * 100;
  return Math.max(0, Math.min(100, Math.round(55 + discount * 2)));
}

export function buildPlayerMetrics(asset: FootballAnalysisAssetInput): MetricScores {
  const baseScore = normalizePercent(asset?.score ?? asset?.lastPerformanceRating ?? asset?.fundamental ?? 55);
  const momentum = normalizePercent(asset?.momentum ?? asset?.change ?? 50);
  const demand = normalizePercent(asset?.marketDemand ?? asset?.demandScore ?? 50);
  const popularity = normalizePercent(asset?.popularity ?? asset?.popularityScore ?? 50);
  const fairSignal = priceSignal(asset);
  const consistency = normalizePercent(asset?.consistency ?? asset?.lastPerformanceRating ?? baseScore);
  const volatility = normalizePercent(asset?.volatilityScore ?? Math.abs(n(asset?.change, 0)) * 3, 35);

  return {
    pass_quality: baseScore,
    first_touch: baseScore,
    progressive_passing: Math.round((baseScore + momentum) / 2),
    ball_carrying: Math.round((baseScore + popularity) / 2),
    decision_quality: Math.round((baseScore + consistency) / 2),
    positioning: Math.round((baseScore + consistency) / 2),
    off_ball_movement: Math.round((momentum + baseScore) / 2),
    space_occupation: baseScore,
    press_resistance: Math.round((baseScore + fairSignal) / 2),
    role_discipline: consistency,
    intensity: momentum,
    sprint_output: Math.round((momentum + demand) / 2),
    workload: Math.round((momentum + consistency) / 2),
    duel_power: baseScore,
    stamina: consistency,
    interceptions: Math.round((baseScore + consistency) / 2),
    tackling: baseScore,
    duel_success: baseScore,
    pressures: Math.round((momentum + demand) / 2),
    recoveries: consistency,
    errors_leading_to_shot: Math.max(0, Math.min(100, 100 - consistency)),
    shot_quality: Math.round((baseScore + momentum) / 2),
    xg_contribution: Math.round((baseScore + demand) / 2),
    xa_contribution: Math.round((baseScore + popularity) / 2),
    key_passes: Math.round((baseScore + momentum) / 2),
    final_third_actions: Math.round((momentum + demand) / 2),
    box_presence: Math.round((baseScore + popularity) / 2),
    volatility,
    error_risk: Math.max(0, Math.min(100, volatility)),
    availability: normalizePercent(asset?.availability ?? 85),
    consistency,
  };
}

export function buildTeamMetrics(team: FootballAnalysisAssetInput): MetricScores {
  const baseScore = normalizePercent(team?.score ?? team?.fundamental ?? team?.teamScore ?? 60);
  const squadQuality = normalizePercent(team?.squadQuality ?? team?.qualityScore ?? baseScore);
  const momentum = normalizePercent(team?.momentum ?? team?.change ?? 50);
  const demand = normalizePercent(team?.marketDemand ?? team?.demandScore ?? 50);
  const legacy = normalizePercent(team?.worldCupLegacy ?? team?.legacyScore ?? 55);
  const risk = normalizePercent(team?.volatilityScore ?? Math.abs(n(team?.change, 0)) * 3, 35);
  const consistency = Math.round((baseScore + squadQuality + legacy) / 3);

  return {
    pass_quality: Math.round((baseScore + squadQuality) / 2),
    first_touch: squadQuality,
    progressive_passing: Math.round((baseScore + momentum) / 2),
    ball_carrying: squadQuality,
    decision_quality: consistency,
    positioning: consistency,
    off_ball_movement: Math.round((momentum + squadQuality) / 2),
    space_occupation: consistency,
    press_resistance: Math.round((squadQuality + legacy) / 2),
    role_discipline: consistency,
    intensity: momentum,
    sprint_output: Math.round((momentum + demand) / 2),
    workload: Math.round((momentum + consistency) / 2),
    duel_power: squadQuality,
    stamina: consistency,
    interceptions: consistency,
    tackling: squadQuality,
    duel_success: squadQuality,
    pressures: Math.round((momentum + demand) / 2),
    recoveries: consistency,
    errors_leading_to_shot: Math.max(0, Math.min(100, risk)),
    shot_quality: Math.round((squadQuality + momentum) / 2),
    xg_contribution: Math.round((baseScore + demand) / 2),
    xa_contribution: Math.round((squadQuality + demand) / 2),
    key_passes: Math.round((squadQuality + momentum) / 2),
    final_third_actions: Math.round((momentum + demand) / 2),
    box_presence: Math.round((squadQuality + legacy) / 2),
    volatility: risk,
    error_risk: risk,
    availability: normalizePercent(team?.availability ?? 88),
    consistency,
  };
}

export function analyzeFootballAsset(asset: FootballAnalysisAssetInput) {
  const role: FootballPosition = mapPositionToAnalysisRole(asset?.position, asset?.type);
  const metrics = asset?.type === 'TEAM' ? buildTeamMetrics(asset) : buildPlayerMetrics(asset);
  return scorePlayerProfile(role, metrics);
}
