import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { collectTheStatsMatchExtras, defaultTheStatsQuery } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function matchCard(match: any) {
  return {
    id: match.id,
    title: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
    status: match.status,
    matchDate: match.matchDate?.toISOString?.() || match.matchDate,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    externalId: match.externalId,
    animationMatchId: match.animationMatchId,
  };
}
async function nearbyMatches(limit = 12) {
  const now = Date.now();
  return prisma.match.findMany({
    where: { matchDate: { gte: new Date(now - 12 * 60 * 60_000), lte: new Date(now + 24 * 60 * 60_000) } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
    take: limit,
  });
}
async function latestMatch() {
  const now = Date.now();
  const matches = await prisma.match.findMany({
    where: { matchDate: { gte: new Date(now - 12 * 60 * 60_000), lte: new Date(now + 24 * 60 * 60_000) } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
    take: 30,
  });
  return matches.sort((a, b) => Math.abs(new Date(a.matchDate).getTime() - now) - Math.abs(new Date(b.matchDate).getTime() - now))[0] || null;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const rawMatchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const matchId = rawMatchId.trim();
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000);
  const includeRaw = ['1', 'true', 'yes', 'on'].includes(String(url.searchParams.get('includeRaw') || '').toLowerCase());
  const query = defaultTheStatsQuery(url.searchParams);

  try {
    if (!matchId || matchId.toUpperCase() === 'ID' || matchId.toLowerCase() === 'list') {
      const matches = await nearbyMatches(int(url.searchParams.get('limit'), 12, 1, 30));
      return json({ ok: false, error: 'ضع matchId الحقيقي بدل ID، أو استخدم matchId=latest لاختبار أقرب مباراة.', example: '/api/admin/match-extra-debug?matchId=latest', matches: matches.map(matchCard), config: getTheStatsApiConfigStatus() }, 400);
    }

    const match = matchId.toLowerCase() === 'latest'
      ? await latestMatch()
      : await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });

    if (!match) {
      const matches = await nearbyMatches(12);
      return json({ ok: false, error: 'match not found', matchId, hint: 'استخدم واحدًا من ids التالية أو افتح debug بـ matchId=latest.', matches: matches.map(matchCard), config: getTheStatsApiConfigStatus() }, 404);
    }

    const result = await collectTheStatsMatchExtras(match, { dryRun: true, save: false, includeRaw, timeoutMs, query });
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'match_extra_debug', selectedMatch: matchCard(match), result, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_extra_debug', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}
