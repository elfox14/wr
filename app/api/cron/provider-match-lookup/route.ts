import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { defaultTheStatsQuery, resolveTheStatsProviderId } from '@/lib/theStatsMatchExtras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function buildQuery(url: URL, matchDate: Date) {
  const params = new URLSearchParams();
  for (const key of ['competition_id', 'season_id', 'providerMatchesPerPage', 'status', 'stage', 'group', 'utc_offset']) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }
  params.set('date_from', url.searchParams.get('date_from') || url.searchParams.get('dateFrom') || dateOnly(addDays(matchDate, -1)));
  params.set('date_to', url.searchParams.get('date_to') || url.searchParams.get('dateTo') || dateOnly(addDays(matchDate, 1)));
  return defaultTheStatsQuery(params);
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId');
  if (!matchId) {
    return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  if (!match) {
    return NextResponse.json({ ok: false, error: 'match not found', matchId }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const query = buildQuery(url, match.matchDate);
  const resolution = await resolveTheStatsProviderId(match, query);

  return NextResponse.json({
    ok: true,
    mode: 'provider_match_lookup_v1',
    match: {
      id: match.id,
      title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`,
      externalId: match.externalId,
      status: match.status,
      matchDate: match.matchDate,
      homeTeam: { id: match.homeTeamId, name: match.homeTeam?.name, code: match.homeTeam?.code },
      awayTeam: { id: match.awayTeamId, name: match.awayTeam?.name, code: match.awayTeam?.code },
    },
    query,
    resolution,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
