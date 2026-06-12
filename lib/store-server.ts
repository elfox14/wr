import prisma from '@/lib/prisma';

const ASSET_SELECT = {
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
  popularity: true,
  momentum: true,
  volatilityScore: true,
  apiFootballId: true,
  isportsId: true,
  teamId: true,
};

export async function getAssets() {
  const assets = await prisma.asset.findMany({
    select: ASSET_SELECT,
    orderBy: [
      { score: 'desc' },
      { marketPrice: 'desc' },
    ],
    take: 240,
  });

  return JSON.parse(JSON.stringify(assets));
}
