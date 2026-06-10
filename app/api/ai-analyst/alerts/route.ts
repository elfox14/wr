import { NextResponse } from 'next/server';
import { buildSmartTradeAlerts } from '@/features/analysis/lib/smart-alerts';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') || 8);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.round(limitParam), 1), 30) : 8;
  const type = searchParams.get('type');

  const where = type === 'TEAM' || type === 'PLAYER' ? { type } : undefined;

  const assets = await prisma.asset.findMany({
    where,
    orderBy: [
      { score: 'desc' },
      { marketPrice: 'desc' },
    ],
    take: 150,
  });

  return NextResponse.json({
    count: assets.length,
    filters: {
      type: type === 'TEAM' || type === 'PLAYER' ? type : 'ALL',
      limit,
    },
    alerts: buildSmartTradeAlerts(assets, limit),
  });
}
