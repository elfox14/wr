import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureStatsTable } from '@/lib/live-match-stats';
import { getProviderQuotaBlock, getProviderUsageSummary } from '@/lib/provider-quota-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isAuthorized(req: Request, url: URL) {
  const valid = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((v) => String(v || '').trim()).filter(Boolean);
  if (valid.length === 0) return true;
  const candidates = [
    url.searchParams.get('key')?.trim() || '',
    url.searchParams.get('adminSecret')?.trim() || '',
    url.searchParams.get('cronSecret')?.trim() || '',
    req.headers.get('x-admin-secret')?.trim() || '',
    req.headers.get('x-cron-secret')?.trim() || '',
  ];
  return candidates.some((value) => value && valid.includes(value));
}

function toIso(value: any) {
  return value instanceof Date ? value.toISOString() : value || null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  try {
    await ensureStatsTable();
    const usageSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [isportsGuard, isportsUsage] = await Promise.all([
      getProviderQuotaBlock('ISPORTS'),
      getProviderUsageSummary('ISPORTS', usageSince),
    ]);
    const latestSnapshots = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ON ("matchId") *
      FROM "MatchStatsSnapshot"
      ORDER BY "matchId", "capturedAt" DESC
      LIMIT 20
    `);
    const latestEvents = await prisma.matchEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        match: {
          select: {
            id: true,
            animationMatchId: true,
            status: true,
            homeScore: true,
            awayScore: true,
            homeTeam: { select: { name: true, code: true } },
            awayTeam: { select: { name: true, code: true } },
          },
        },
      },
    });

    const liveMatches = await prisma.match.findMany({
      where: { OR: [{ status: { in: ['IN_PLAY', 'LIVE', 'HT'] } }, { status: 'FINISHED', matchDate: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } }] },
      orderBy: { matchDate: 'asc' },
      take: 12,
      select: {
        id: true,
        animationMatchId: true,
        status: true,
        matchDate: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true, code: true } },
        awayTeam: { select: { name: true, code: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      primaryProvider: isportsGuard ? 'FOOTBALL_DATA' : 'ISPORTS',
      fallbackProvider: 'FOOTBALL_DATA',
      providerUsage: {
        windowHours: 24,
        isports: isportsUsage,
        softLimit: Number(process.env.ISPORTS_DAILY_SOFT_LIMIT || 120),
      },
      isports: {
        status: isportsGuard ? 'blocked' : 'active',
        blockedUntil: toIso(isportsGuard?.blockedUntil),
        reason: isportsGuard?.reason || null,
      },
      footballData: {
        status: process.env.FOOTBALL_DATA_API_TOKEN ? 'configured' : 'missing_token',
        competition: process.env.FOOTBALL_DATA_COMPETITION || 'WC',
      },
      liveMatches: liveMatches.map((match) => ({
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        matchDate: toIso(match.matchDate),
        score: `${match.homeScore ?? 0}-${match.awayScore ?? 0}`,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      })),
      latestSnapshots: latestSnapshots.map((row) => ({
        id: row.id,
        matchId: row.matchId,
        provider: row.provider,
        providerMatchId: row.providerMatchId,
        minute: row.minute,
        score: `${row.homeScore ?? 0}-${row.awayScore ?? 0}`,
        hasStats: ['homePossession','awayPossession','homeDangerousAttacks','awayDangerousAttacks','homeShots','awayShots','homeCorners','awayCorners'].some((key) => row[key] !== null && row[key] !== undefined),
        capturedAt: toIso(row.capturedAt),
      })),
      latestEvents: latestEvents.map((event) => ({
        id: event.id,
        type: event.type,
        minute: event.minute,
        detail: event.detail,
        sourceName: event.sourceName,
        createdAt: toIso(event.createdAt),
        match: event.match ? {
          animationMatchId: event.match.animationMatchId,
          status: event.match.status,
          score: `${event.match.homeScore ?? 0}-${event.match.awayScore ?? 0}`,
          homeTeam: event.match.homeTeam,
          awayTeam: event.match.awayTeam,
        } : null,
      })),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
