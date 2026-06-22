import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PriceHistoryRow = {
  assetId: string;
  price: number;
  timestamp: Date;
  asset: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    type: string;
    current_price: number;
    change: number;
    momentum: number | null;
    riskIndex: number | null;
    volatilityScore: number | null;
  };
};

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function compactText(value: unknown, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function classifyEvent(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  if (text.includes('goal') || text.includes('هدف')) return 'goal';
  if (text.includes('red') || text.includes('طرد') || text.includes('حمراء')) return 'red_card';
  if (text.includes('penalty') || text.includes('جزاء')) return 'penalty';
  if (text.includes('var')) return 'var';
  if (text.includes('yellow') || text.includes('صفراء')) return 'yellow_card';
  if (text.includes('sub') || text.includes('تبديل')) return 'substitution';
  return 'note';
}

function buildMovers(rows: PriceHistoryRow[]) {
  const byAsset = new Map<string, PriceHistoryRow[]>();
  for (const row of rows) {
    const list = byAsset.get(row.assetId) || [];
    if (list.length < 3) list.push(row);
    byAsset.set(row.assetId, list);
  }

  return Array.from(byAsset.values())
    .map((list) => {
      const latest = list[0];
      const previous = list[1];
      if (!latest) return null;
      const currentPrice = finiteNumber(latest.price, latest.asset.current_price);
      const previousPrice = previous ? finiteNumber(previous.price, latest.asset.current_price) : latest.asset.current_price;
      const changePercent = percentChange(currentPrice, previousPrice);
      return {
        id: latest.asset.id,
        name: latest.asset.name,
        code: latest.asset.code,
        image: latest.asset.image,
        type: latest.asset.type,
        currentPrice,
        previousPrice,
        changePercent,
        direction: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat',
        momentum: latest.asset.momentum,
        riskIndex: latest.asset.riskIndex,
        volatilityScore: latest.asset.volatilityScore,
        updatedAt: latest.timestamp,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 8);
}

export async function GET() {
  const now = new Date();
  const recentSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const matchWindowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const matchWindowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  try {
    const [recentEvents, tacticalReports, marketNews, priceRows, matches, snapshotCount, eventCount, reportCount] = await Promise.all([
      prisma.matchEvent.findMany({
        where: {
          OR: [
            { createdAt: { gte: recentSince } },
            { updatedAt: { gte: recentSince } },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 18,
        include: {
          match: {
            select: {
              id: true,
              status: true,
              homeScore: true,
              awayScore: true,
              matchDate: true,
              homeTeam: { select: { id: true, name: true, code: true, image: true } },
              awayTeam: { select: { id: true, name: true, code: true, image: true } },
            },
          },
        },
      }).catch(() => []),
      prisma.teamIntelligenceReport.findMany({
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 8,
        include: {
          team: { select: { id: true, name: true, code: true, image: true, group: true, fifaRank: true, coach: true } },
        },
      }).catch(() => []),
      prisma.marketNews.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 10,
        include: {
          asset: { select: { id: true, name: true, code: true, image: true, type: true, current_price: true, change: true, momentum: true } },
        },
      }).catch(() => []),
      prisma.priceHistory.findMany({
        orderBy: { timestamp: 'desc' },
        take: 240,
        include: {
          asset: { select: { id: true, name: true, code: true, image: true, type: true, current_price: true, change: true, momentum: true, riskIndex: true, volatilityScore: true } },
        },
      }).catch(() => []),
      prisma.match.findMany({
        where: { matchDate: { gte: matchWindowStart, lte: matchWindowEnd } },
        orderBy: { matchDate: 'asc' },
        take: 8,
        select: {
          id: true,
          externalId: true,
          animationMatchId: true,
          status: true,
          matchDate: true,
          homeScore: true,
          awayScore: true,
          groupPhase: true,
          stage: true,
          homeTeam: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true, change: true } },
          awayTeam: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true, change: true } },
          events: {
            orderBy: [{ minute: 'desc' }, { updatedAt: 'desc' }],
            take: 6,
            select: { id: true, minute: true, type: true, detail: true, playerName: true, sourceName: true, sourceUrl: true, updatedAt: true },
          },
          statsSnapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
            select: {
              provider: true,
              minute: true,
              homePossession: true,
              awayPossession: true,
              homeAttacks: true,
              awayAttacks: true,
              homeDangerousAttacks: true,
              awayDangerousAttacks: true,
              homeShots: true,
              awayShots: true,
              homeShotsOnTarget: true,
              awayShotsOnTarget: true,
              homeCorners: true,
              awayCorners: true,
              homeYellowCards: true,
              awayYellowCards: true,
              homeRedCards: true,
              awayRedCards: true,
              homeScore: true,
              awayScore: true,
              capturedAt: true,
            },
          },
        },
      }).catch(() => []),
      prisma.matchStatsSnapshot.count().catch(() => 0),
      prisma.matchEvent.count().catch(() => 0),
      prisma.teamIntelligenceReport.count().catch(() => 0),
    ]);

    const turningPoints = recentEvents.map((event: any) => ({
      id: event.id,
      minute: event.minute,
      type: event.type,
      impactType: classifyEvent(event.type, event.detail),
      playerName: event.playerName,
      detail: compactText(event.detail, 180),
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl,
      updatedAt: event.updatedAt,
      match: event.match ? {
        id: event.match.id,
        status: event.match.status,
        score: `${event.match.homeScore ?? 0}-${event.match.awayScore ?? 0}`,
        homeTeam: event.match.homeTeam,
        awayTeam: event.match.awayTeam,
        matchDate: event.match.matchDate,
      } : null,
    }));

    const tacticalSnapshots = tacticalReports.map((report: any) => ({
      id: report.id,
      team: report.team,
      title: report.title,
      summary: compactText(report.summary, 220),
      reportType: report.reportType,
      sourceName: report.sourceName,
      sourceUrl: report.sourceUrl,
      sourceCategory: report.sourceCategory,
      confidence: report.confidence,
      tacticalTags: report.tacticalTags || [],
      strengths: (report.strengths || []).slice(0, 3),
      weaknesses: (report.weaknesses || []).slice(0, 3),
      publishedAt: report.publishedAt,
      metrics: report.metrics || null,
    }));

    const latestNews = marketNews.map((item: any) => ({
      id: item.id,
      eventType: item.eventType,
      severity: item.severity,
      titleAr: item.titleAr,
      bodyAr: compactText(item.bodyAr, 180),
      changePercent: item.changePercent,
      publishedAt: item.publishedAt,
      asset: item.asset,
      context: item.context || null,
    }));

    return NextResponse.json({
      ok: true,
      source: 'home_demo_command_center_database_read_only',
      generatedAt: now.toISOString(),
      health: {
        snapshotCount,
        eventCount,
        reportCount,
        recentEvents: recentEvents.length,
        tacticalReports: tacticalReports.length,
        marketNews: marketNews.length,
        priceRows: priceRows.length,
      },
      matches,
      turningPoints,
      tacticalSnapshots,
      marketNews: latestNews,
      movers: buildMovers(priceRows as PriceHistoryRow[]),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('home demo command center error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
