import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function secrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function isAuthorized(req: Request) {
  const validSecrets = secrets();
  if (validSecrets.length === 0) return false;
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret')?.trim() || '',
    req.headers.get('x-cron-secret')?.trim() || '',
    url.searchParams.get('key')?.trim() || '',
    url.searchParams.get('adminSecret')?.trim() || '',
    url.searchParams.get('cronSecret')?.trim() || '',
  ];
  return candidates.some((value) => value && validSecrets.includes(value));
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const nearUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [
      totalMatches,
      linkedMatches,
      liveMatches,
      nearMatches,
      unlinkedNearMatches,
      marketNewsLastHour,
      marketNewsLast24h,
      priceHistoryLastHour,
      priceHistoryLast24h,
      latestNews,
      latestPrice,
      recentMatches,
      unlinkedImportant,
    ] = await Promise.all([
      prisma.match.count(),
      prisma.match.count({ where: { animationMatchId: { not: null } } }),
      prisma.match.count({ where: { status: { in: ['IN_PLAY', 'LIVE'] } } }),
      prisma.match.count({ where: { matchDate: { gte: now, lte: nearUntil } } }),
      prisma.match.count({ where: { animationMatchId: null, matchDate: { gte: dayStart, lte: nearUntil } } }),
      prisma.marketNews.count({ where: { publishedAt: { gte: hourAgo } } }),
      prisma.marketNews.count({ where: { publishedAt: { gte: dayAgo } } }),
      prisma.priceHistory.count({ where: { timestamp: { gte: hourAgo } } }),
      prisma.priceHistory.count({ where: { timestamp: { gte: dayAgo } } }),
      prisma.marketNews.findFirst({ orderBy: { publishedAt: 'desc' }, include: { asset: { select: { id: true, name: true, code: true } } } }),
      prisma.priceHistory.findFirst({ orderBy: { timestamp: 'desc' }, include: { asset: { select: { id: true, name: true, code: true } } } }),
      prisma.match.findMany({
        where: { matchDate: { gte: dayStart, lte: nearUntil } },
        orderBy: { matchDate: 'asc' },
        take: 20,
        include: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } },
      }),
      prisma.match.findMany({
        where: { animationMatchId: null, matchDate: { gte: dayStart, lte: nearUntil } },
        orderBy: { matchDate: 'asc' },
        take: 20,
        include: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } },
      }),
    ]);

    const blockers: string[] = [];
    if (unlinkedNearMatches > 0) blockers.push('There are near matches without animationMatchId. Review manual links.');
    if (liveMatches > 0 && priceHistoryLastHour === 0) blockers.push('Live matches exist but no price history was created in the last hour.');
    if (marketNewsLast24h === 0) blockers.push('No market news in the last 24 hours. This can be normal if no goals or trading events happened.');

    return NextResponse.json({
      ok: true,
      updatedAt: now.toISOString(),
      environment: {
        cronBaseUrl: process.env.CRON_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || null,
        apiFootballCronEnabled: process.env.ENABLE_API_FOOTBALL_CRON === 'true',
        apiFootballProtection: true,
        providerMode: 'iSports-first / API-Football protected',
      },
      counters: {
        totalMatches,
        linkedMatches,
        unlinkedMatches: Math.max(0, totalMatches - linkedMatches),
        liveMatches,
        nearMatches,
        unlinkedNearMatches,
        marketNewsLastHour,
        marketNewsLast24h,
        priceHistoryLastHour,
        priceHistoryLast24h,
      },
      latest: {
        marketNews: latestNews ? { id: latestNews.id, title: latestNews.titleAr, eventType: latestNews.eventType, asset: latestNews.asset, publishedAt: latestNews.publishedAt.toISOString() } : null,
        priceHistory: latestPrice ? { id: latestPrice.id, price: latestPrice.price, asset: latestPrice.asset, timestamp: latestPrice.timestamp.toISOString() } : null,
      },
      todayWindowMatches: recentMatches.map((match) => ({
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        score: `${toNumber(match.homeScore)}-${toNumber(match.awayScore)}`,
        matchDate: match.matchDate.toISOString(),
        homeTeam: match.homeTeam?.name,
        awayTeam: match.awayTeam?.name,
      })),
      unlinkedImportant: unlinkedImportant.map((match) => ({
        id: match.id,
        status: match.status,
        matchDate: match.matchDate.toISOString(),
        homeTeam: match.homeTeam?.name,
        awayTeam: match.awayTeam?.name,
      })),
      blockers,
      recommendations: [
        'Keep only one cron-job.org job calling /api/cron/master-sync every minute.',
        'Do not enable API-Football cron while the daily limit is 100 requests.',
        'Use /live for public monitoring and this page for admin health checks.',
      ],
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  } catch (error: any) {
    console.error('live-health error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
