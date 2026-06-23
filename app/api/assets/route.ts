import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type AssetView = 'full' | 'groups' | 'market';

function normalizeView(value: string | null): AssetView {
  if (value === 'groups' || value === 'market') return value;
  return 'full';
}

const baseOrderBy = [
  { type: 'desc' as const }, // TEAM before PLAYER so national teams are visible first in public screens.
  { score: 'desc' as const },
  { marketPrice: 'desc' as const },
];

async function getGroupAssets() {
  return prisma.asset.findMany({
    where: { type: 'TEAM' },
    orderBy: [{ group: 'asc' }, { fifaRank: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      image: true,
      group: true,
      continent: true,
      fifaRank: true,
      score: true,
      fundamental: true,
      worldCupLegacy: true,
      harmony: true,
    },
  });
}

async function getMarketAssets() {
  return prisma.asset.findMany({
    orderBy: baseOrderBy,
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      image: true,
      current_price: true,
      high_price: true,
      low_price: true,
      market_cap: true,
      volume: true,
      change: true,
      group: true,
      continent: true,
      fifaRank: true,
      position: true,
      score: true,
      isAvailable: true,
      marketPrice: true,
      fairValue: true,
      momentum: true,
      marketDemand: true,
      volatilityScore: true,
      ownersCount: true,
    },
  });
}

async function getFullAssets() {
  return prisma.asset.findMany({
    orderBy: baseOrderBy,
    include: {
      priceHistory: {
        orderBy: { timestamp: 'asc' },
        take: 30,
      },
      players: {
        select: {
          id: true,
          type: true,
          name: true,
          code: true,
          image: true,
          position: true,
          teamId: true,
          score: true,
          playerTier: true,
          roleImportance: true,
        },
      },
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const view = normalizeView(request.nextUrl.searchParams.get('view'));
    const assets = view === 'groups'
      ? await getGroupAssets()
      : view === 'market'
        ? await getMarketAssets()
        : await getFullAssets();

    return NextResponse.json(assets, {
      headers: {
        'Cache-Control': view === 'full'
          ? 'public, s-maxage=60, stale-while-revalidate=120'
          : 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
