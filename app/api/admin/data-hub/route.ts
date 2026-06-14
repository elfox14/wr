import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDataHubStatus, importDataHubTeams, importSingleDataHubTeam } from '@/lib/dataHubImport';
import { clearPlaceholderApiFootballIds } from '@/lib/dataHubMaintenance';
import { getDataHubConfig } from '@/lib/mcPrimeDataHub';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return '';
  return authorization.slice(7).trim();
}

function hasAdminSecret(request: Request) {
  const url = new URL(request.url);
  const supplied = getBearerToken(request) || request.headers.get('x-admin-secret') || url.searchParams.get('token') || '';
  const expected = process.env.ADMIN_API_SECRET || process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET || '';
  return Boolean(expected && supplied && supplied === expected);
}

async function requireAdmin(request: Request) {
  if (hasAdminSecret(request)) return { session: null };
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function parseLimit(value: string | null, fallback = 12) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

async function withPlaceholderIdCleanup<T extends Record<string, any>>(result: T) {
  const placeholderIdCleanup = await clearPlaceholderApiFootballIds();
  return { ...result, placeholderIdCleanup };
}

const officialSquadNotice = 'Official World Cup squads are managed separately. Data Hub general squad imports are disabled.';

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  try {
    if (action === 'status') {
      const status = await getDataHubStatus();
      return NextResponse.json({
        ...status,
        ok: status.ok !== false,
        squadImportDisabled: true,
        squadImportNotice: officialSquadNotice,
        config: {
          ...getDataHubConfig(),
          token: undefined,
        },
      });
    }

    if (action === 'cleanup-placeholder-api-ids') {
      return NextResponse.json(await clearPlaceholderApiFootballIds());
    }

    if (action === 'sync-teams') {
      const limit = parseLimit(url.searchParams.get('limit'));
      const requestedFull = url.searchParams.get('full') === '1' || url.searchParams.get('full') === 'true';
      const result = await importDataHubTeams({ limit, full: false });
      return NextResponse.json(await withPlaceholderIdCleanup({
        ...result,
        requestedFull,
        full: false,
        squadImportDisabled: true,
        squadImportNotice: officialSquadNotice,
      }));
    }

    if (action === 'sync-team') {
      return NextResponse.json({
        ok: false,
        error: 'sync-team is disabled because it may import general provider squads.',
        squadImportDisabled: true,
        squadImportNotice: officialSquadNotice,
      }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Data Hub admin action failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => ({}));
  const action = body.action || 'sync-teams';

  try {
    if (action === 'status') {
      const status = await getDataHubStatus();
      return NextResponse.json({ ...status, ok: status.ok !== false, squadImportDisabled: true, squadImportNotice: officialSquadNotice });
    }

    if (action === 'cleanup-placeholder-api-ids') {
      return NextResponse.json(await clearPlaceholderApiFootballIds());
    }

    if (action === 'sync-team') {
      return NextResponse.json({
        ok: false,
        error: 'sync-team is disabled because it may import general provider squads.',
        squadImportDisabled: true,
        squadImportNotice: officialSquadNotice,
      }, { status: 409 });
    }

    if (action === 'sync-teams') {
      const limit = parseLimit(String(body.limit || '12'));
      const requestedFull = Boolean(body.full);
      const result = await importDataHubTeams({ limit, full: false });
      return NextResponse.json(await withPlaceholderIdCleanup({
        ...result,
        requestedFull,
        full: false,
        squadImportDisabled: true,
        squadImportNotice: officialSquadNotice,
      }));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Data Hub admin action failed' }, { status: 500 });
  }
}
