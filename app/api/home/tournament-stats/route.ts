import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

async function readInternalJson(origin: string, path: string) {
  try {
    const response = await fetch(`${origin}${path}`, { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    return response.ok && data?.ok ? data : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const [providerSummary, databaseSummary, playerLeaders, penaltiesSummary] = await Promise.all([
    readInternalJson(origin, '/api/matches/cached-the-stats-summary'),
    readInternalJson(origin, '/api/matches/summary-stats'),
    readInternalJson(origin, '/api/players/leaders'),
    readInternalJson(origin, '/api/matches/penalties-summary'),
  ]);

  return NextResponse.json({
    ok: true,
    providerSummary,
    databaseSummary,
    playerLeaders,
    penaltiesSummary,
  }, { headers: HEADERS });
}
