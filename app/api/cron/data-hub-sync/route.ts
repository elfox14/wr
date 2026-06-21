import { NextResponse } from 'next/server';
import { importDataHubTeams } from '@/lib/dataHubImport';
import { clearPlaceholderApiFootballIds } from '@/lib/dataHubMaintenance';

export const dynamic = 'force-dynamic';

const squadImportNotice = 'Data Hub general squad imports are disabled. football-data.org remains available only through a separate approved fallback or verification workflow when needed.';

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
  const requestedFull = url.searchParams.get('full') === '1' || url.searchParams.get('full') === 'true';

  try {
    if (mode === 'team') {
      return NextResponse.json({
        ok: false,
        mode,
        error: 'mode=team is disabled because it may import general Data Hub provider squads.',
        squadImportDisabled: true,
        squadImportNotice,
      }, { status: 409 });
    }

    if (mode === 'teams') {
      const result = await importDataHubTeams({ limit, full: false });
      const maintenance = await clearPlaceholderApiFootballIds();
      return NextResponse.json({
        ...result,
        ok: result.ok !== false,
        mode,
        requestedFull,
        full: false,
        squadImportDisabled: true,
        squadImportNotice,
        maintenance,
      });
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
