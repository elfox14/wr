import { analyzeFootballAsset, type FootballAnalysisAssetInput } from './analysis-adapter';
import { buildAIAnalystGroups, type NormalizedAIAnalystAsset } from './ai-analyst-ranking';
import { analyzeValueFit, formatVirtualCoins } from './value-fit';

export type SmartTradeAlertType = 'OPPORTUNITY' | 'WARNING' | 'QUALITY' | 'MOMENTUM';
export type SmartTradeAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type SmartTradeAlertAsset = NormalizedAIAnalystAsset & {
  id: string;
  name: string;
  type: string;
};

export type SmartTradeAlert = {
  id: string;
  type: SmartTradeAlertType;
  severity: SmartTradeAlertSeverity;
  title: string;
  message: string;
  asset: {
    id: string;
    name: string;
    type: string;
    image?: string | null;
    position?: string | null;
  };
  metrics: {
    technicalScore: number;
    marketPrice: number;
    fairValue: number;
    gapPercent: number;
    momentum: number;
    marketDemand: number;
  };
};

function severityFromGap(gapPercent: number): SmartTradeAlertSeverity {
  const absGap = Math.abs(gapPercent);
  if (absGap >= 20) return 'HIGH';
  if (absGap >= 10) return 'MEDIUM';
  return 'LOW';
}

function toAlert(asset: SmartTradeAlertAsset, type: SmartTradeAlertType): SmartTradeAlert {
  const analysis = analyzeFootballAsset(asset);
  const valueFit = analyzeValueFit(asset, analysis.weightedScore);
  const severity = type === 'QUALITY' ? 'MEDIUM' : severityFromGap(valueFit.gapPercent);
  const assetLabel = asset.type === 'TEAM' ? 'المنتخب' : 'اللاعب';

  const title = type === 'OPPORTUNITY'
    ? 'فرصة فنية محتملة'
    : type === 'WARNING'
      ? 'تحذير سعري'
      : type === 'MOMENTUM'
        ? 'زخم يستحق المتابعة'
        : 'جودة فنية عالية';

  const message = type === 'OPPORTUNITY'
    ? `${assetLabel} ${asset.name} يظهر أقل من قيمته الفنية. السعر ${formatVirtualCoins(valueFit.marketPrice)} مقابل قيمة عادلة ${formatVirtualCoins(valueFit.fairValue)}.`
    : type === 'WARNING'
      ? `${assetLabel} ${asset.name} قد يكون أعلى من مبرره الفني بفارق ${valueFit.gapPercent.toFixed(1)}%.`
      : type === 'MOMENTUM'
        ? `${assetLabel} ${asset.name} لديه زخم مرتفع وقد يؤثر ذلك على الطلب داخل السوق.`
        : `${assetLabel} ${asset.name} لديه Technical Score قوي (${analysis.weightedScore}) ويستحق المتابعة الفنية.`;

  return {
    id: `${type}:${asset.id}`,
    type,
    severity,
    title,
    message,
    asset: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      image: asset.image ?? null,
      position: asset.position ?? null,
    },
    metrics: {
      technicalScore: analysis.weightedScore,
      marketPrice: valueFit.marketPrice,
      fairValue: valueFit.fairValue,
      gapPercent: Number(valueFit.gapPercent.toFixed(2)),
      momentum: Number(asset.momentum ?? 0),
      marketDemand: Number(asset.marketDemand ?? 0),
    },
  };
}

function hasRequiredAlertFields(asset: FootballAnalysisAssetInput): asset is FootballAnalysisAssetInput & { id: string; name: string; type: string } {
  return Boolean(asset.id && asset.name && asset.type);
}

function hasNormalizedAlertFields(asset: NormalizedAIAnalystAsset): asset is SmartTradeAlertAsset {
  return Boolean(asset.id && asset.name && asset.type);
}

export function buildSmartTradeAlerts(assets: FootballAnalysisAssetInput[], limit = 8): SmartTradeAlert[] {
  const typedAssets = assets.filter(hasRequiredAlertFields);
  const groups = buildAIAnalystGroups(typedAssets, Math.max(limit, 6));

  const opportunityAlerts = groups.opportunities.filter(hasNormalizedAlertFields).slice(0, 3).map((asset) => toAlert(asset, 'OPPORTUNITY'));
  const warningAlerts = groups.warnings.filter(hasNormalizedAlertFields).slice(0, 3).map((asset) => toAlert(asset, 'WARNING'));
  const qualityAlerts = groups.highTechnical.filter(hasNormalizedAlertFields).slice(0, 2).map((asset) => toAlert(asset, 'QUALITY'));

  const momentumAlerts = groups.assets
    .filter(hasNormalizedAlertFields)
    .filter((asset) => Number(asset.momentum ?? 0) >= 75)
    .sort((a, b) => Number(b.momentum ?? 0) - Number(a.momentum ?? 0))
    .slice(0, 2)
    .map((asset) => toAlert(asset, 'MOMENTUM'));

  const seen = new Set<string>();
  return [...opportunityAlerts, ...warningAlerts, ...qualityAlerts, ...momentumAlerts]
    .filter((alert) => {
      if (seen.has(alert.id)) return false;
      seen.add(alert.id);
      return true;
    })
    .slice(0, limit);
}
