import { analyzeFootballAsset, type FootballAnalysisAssetInput } from './analysis-adapter';
import { analyzeValueFit, getFairValue, getMarketPrice } from './value-fit';

export type AIAnalystAsset = FootballAnalysisAssetInput;

export type NormalizedAIAnalystAsset = AIAnalystAsset & {
  marketPrice: number;
  fairValue: number;
  momentum: number;
  marketDemand: number;
  volatilityScore: number;
};

export function normalizeAnalysisAsset(asset: AIAnalystAsset): NormalizedAIAnalystAsset {
  return {
    ...asset,
    marketPrice: getMarketPrice(asset),
    fairValue: getFairValue(asset),
    momentum: Number(asset?.momentum ?? 50),
    marketDemand: Number(asset?.marketDemand ?? 50),
    volatilityScore: Number(asset?.volatilityScore ?? 50),
  };
}

export function getTechnicalScore(asset: AIAnalystAsset) {
  return analyzeFootballAsset(asset).weightedScore;
}

export function getOpportunityScore(asset: AIAnalystAsset) {
  const technicalScore = getTechnicalScore(asset);
  const valueFit = analyzeValueFit(asset, technicalScore);
  const gap = valueFit.gapPercent;
  const demandBoost = Number(asset?.marketDemand ?? 50) * 0.08;
  const momentumBoost = Number(asset?.momentum ?? 50) * 0.08;

  return technicalScore + Math.max(0, -gap) * 1.4 - Math.max(0, gap) * 0.6 + demandBoost + momentumBoost;
}

export function getWarningScore(asset: AIAnalystAsset) {
  const technicalScore = getTechnicalScore(asset);
  const valueFit = analyzeValueFit(asset, technicalScore);
  const gap = valueFit.gapPercent;
  const volatilityPenalty = Number(asset?.volatilityScore ?? 50) * 0.25;
  const weakTechnicalPenalty = Math.max(0, 70 - technicalScore);

  return Math.max(0, gap) * 1.8 + weakTechnicalPenalty + volatilityPenalty;
}

export function isTechnicalOpportunity(asset: AIAnalystAsset) {
  const technicalScore = getTechnicalScore(asset);
  const valueFit = analyzeValueFit(asset, technicalScore);
  return valueFit.signal === 'UNDERVALUED' || technicalScore >= 75 || valueFit.gapPercent <= -5;
}

export function isTechnicalWarning(asset: AIAnalystAsset) {
  const technicalScore = getTechnicalScore(asset);
  const valueFit = analyzeValueFit(asset, technicalScore);
  return valueFit.signal === 'OVERVALUED' || valueFit.gapPercent >= 8;
}

export function sortByTechnicalOpportunity(a: AIAnalystAsset, b: AIAnalystAsset) {
  return getOpportunityScore(b) - getOpportunityScore(a);
}

export function sortByTechnicalWarning(a: AIAnalystAsset, b: AIAnalystAsset) {
  return getWarningScore(b) - getWarningScore(a);
}

export function sortByTechnicalQuality(a: AIAnalystAsset, b: AIAnalystAsset) {
  return getTechnicalScore(b) - getTechnicalScore(a);
}

export function buildAIAnalystGroups(assets: AIAnalystAsset[], limit = 6) {
  const normalized = assets.map(normalizeAnalysisAsset);

  return {
    assets: normalized,
    opportunities: [...normalized].filter(isTechnicalOpportunity).sort(sortByTechnicalOpportunity).slice(0, limit),
    warnings: [...normalized].filter(isTechnicalWarning).sort(sortByTechnicalWarning).slice(0, limit),
    highTechnical: [...normalized].sort(sortByTechnicalQuality).slice(0, limit),
  };
}
