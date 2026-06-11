import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function allowed(req: Request) {
  const expected = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerKey = req.headers.get('x-admin-key') || '';
  const { searchParams } = new URL(req.url);
  const queryKey = searchParams.get('key') || '';
  return [bearer, headerKey, queryKey].some((value) => value && value === expected);
}

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function GET(req: Request) {
  if (!allowed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const { searchParams } = new URL(req.url);
  const fixtureId = searchParams.get('fixtureId') || '459709921';
  const dryRun = searchParams.get('dryRun') !== 'false';

  const badNews = await prisma.marketNews.findMany({
    where: { localeGroupKey: { startsWith: `${fixtureId}:` } },
    orderBy: { publishedAt: 'asc' },
    include: { asset: { select: { id: true, name: true, current_price: true, marketPrice: true, high_price: true, low_price: true } } },
  });

  const grouped = new Map<string, typeof badNews>();
  badNews.forEach((item) => {
    const group = grouped.get(item.assetId) || [];
    group.push(item);
    grouped.set(item.assetId, group);
  });

  const assetFixes = Array.from(grouped.entries()).map(([assetId, items]) => {
    const first = items[0];
    const restorePrice = toFiniteNumber(first?.priceBefore);
    return {
      assetId,
      assetName: first?.asset?.name || assetId,
      restorePrice,
      currentPrice: first?.asset?.current_price,
      marketPrice: first?.asset?.marketPrice,
      newsCount: items.length,
      firstNewsAt: first?.publishedAt,
      lastNewsAt: items[items.length - 1]?.publishedAt,
      localeGroupKeys: items.map((item) => item.localeGroupKey),
    };
  });

  const affectedAssetIds = assetFixes.map((item) => item.assetId);
  const firstEventAt = badNews[0]?.publishedAt;
  const lastEventAt = badNews[badNews.length - 1]?.publishedAt;
  const deleteFrom = firstEventAt ? new Date(firstEventAt.getTime() - 60_000) : null;
  const deleteTo = lastEventAt ? new Date(lastEventAt.getTime() + 60_000) : null;

  const badMatch = await prisma.match.findFirst({
    where: { OR: [{ externalId: fixtureId }, { animationMatchId: Number(fixtureId) }] },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });

  const preview = {
    ok: true,
    dryRun,
    fixtureId,
    badNewsCount: badNews.length,
    affectedAssets: assetFixes,
    badMatch: badMatch ? {
      id: badMatch.id,
      externalId: badMatch.externalId,
      animationMatchId: badMatch.animationMatchId,
      status: badMatch.status,
      score: `${badMatch.homeScore}-${badMatch.awayScore}`,
      homeTeam: badMatch.homeTeam?.name,
      awayTeam: badMatch.awayTeam?.name,
    } : null,
    plannedPriceHistoryWindow: deleteFrom && deleteTo ? { from: deleteFrom, to: deleteTo, assetIds: affectedAssetIds } : null,
  };

  if (dryRun) {
    return NextResponse.json({ ...preview, nextAction: 'Review affectedAssets, then rerun with dryRun=false to apply rollback.' }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  }

  if (badNews.length === 0) {
    return NextResponse.json({ ...preview, applied: false, reason: 'No MarketNews rows found for fixture.' }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  }

  const result: any = { restoredAssets: [], deletedPriceHistory: 0, deletedMarketNews: 0, deletedBadMatch: false };

  for (const fix of assetFixes) {
    if (!fix.restorePrice || fix.restorePrice <= 0) continue;
    const updated = await prisma.asset.update({
      where: { id: fix.assetId },
      data: {
        current_price: Math.round(fix.restorePrice),
        marketPrice: fix.restorePrice,
        change: 0,
      },
      select: { id: true, name: true, current_price: true, marketPrice: true },
    });
    result.restoredAssets.push(updated);
  }

  if (deleteFrom && deleteTo && affectedAssetIds.length > 0) {
    const deletedHistory = await prisma.priceHistory.deleteMany({
      where: { assetId: { in: affectedAssetIds }, timestamp: { gte: deleteFrom, lte: deleteTo } },
    });
    result.deletedPriceHistory = deletedHistory.count;
  }

  const deletedNews = await prisma.marketNews.deleteMany({ where: { localeGroupKey: { startsWith: `${fixtureId}:` } } });
  result.deletedMarketNews = deletedNews.count;

  if (badMatch) {
    await prisma.match.delete({ where: { id: badMatch.id } });
    result.deletedBadMatch = true;
  }

  return NextResponse.json({ ...preview, applied: true, result }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
}

export async function POST(req: Request) { return GET(req); }
