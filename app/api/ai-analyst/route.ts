import { NextResponse } from 'next/server';
import { buildAIAnalystGroups } from '@/features/analysis/lib/ai-analyst-ranking';
import { analyzeFootballAsset } from '@/features/analysis/lib/analysis-adapter';
import { buildSmartTradeAlerts } from '@/features/analysis/lib/smart-alerts';
import { analyzeValueFit } from '@/features/analysis/lib/value-fit';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function toAssetSummary(asset: any) {
  const analysis = analyzeFootballAsset(asset);
  const valueFit = analyzeValueFit(asset, analysis.weightedScore);

  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    image: asset.image ?? null,
    position: asset.position ?? null,
    marketPrice: valueFit.marketPrice,
    fairValue: valueFit.fairValue,
    gapPercent: Number(valueFit.gapPercent.toFixed(2)),
    technicalScore: analysis.weightedScore,
    roleLabel: analysis.roleLabel,
    valueSignal: valueFit.signal,
    valueLabel: valueFit.label,
    valueReason: valueFit.reason,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') || 6);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.round(limitParam), 1), 20) : 6;
  const type = searchParams.get('type');

  const where = type === 'TEAM' || type === 'PLAYER' ? { type } : undefined;

  const rawAssets = await prisma.asset.findMany({
    where,
    orderBy: [
      { score: 'desc' },
      { marketPrice: 'desc' },
    ],
    take: 150,
  });

  const groups = buildAIAnalystGroups(rawAssets, limit);
  const alerts = buildSmartTradeAlerts(rawAssets, Math.min(limit + 2, 20));

  return NextResponse.json({
    count: groups.assets.length,
    filters: {
      type: type === 'TEAM' || type === 'PLAYER' ? type : 'ALL',
      limit,
    },
    alerts,
    opportunities: groups.opportunities.map(toAssetSummary),
    warnings: groups.warnings.map(toAssetSummary),
    highTechnical: groups.highTechnical.map(toAssetSummary),
  });
}
