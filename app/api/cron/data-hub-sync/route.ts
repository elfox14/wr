import { NextResponse } from 'next/server';
import { importDataHubTeams, importSingleDataHubTeam } from '@/lib/dataHubImport';

export const dynamic = 'force-dynamic';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return '';
  return authorization.slice(7).trim();
}

function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const supplied = getBearerToken(request) || url.searchParams.get('token') || url.searchParams.get('secret') || '';
  const expected = process.env.DATA_HUB_CRON_SECRET || process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';
  return Boolean(expected && supplied && supplied === expected);
}

function parseLimit(value: string | null, fallback = 8) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

async function run(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'teams';
  const limit = parseLimit(url.searchParams.get('limit'));
  const full = url.searchParams.get('full') === '1' || url.searchParams.get('full') === 'true';
  const teamId = url.searchParams.get('team_id') || url.searchParams.get('teamId');

  try {
    if (mode === 'team') {
      if (!teamId) return NextResponse.json({ error: 'team_id is required for mode=team' }, { status: 400 });
      return NextResponse.json({ ok: true, mode, team: await importSingleDataHubTeam(teamId) });
    }

    if (mode === 'teams') {
      return NextResponse.json({ ok: true, mode, ...(await importDataHubTeams({ limit, full })) });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, mode, error: error?.message || 'Data Hub cron sync failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
