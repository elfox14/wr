import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDataHubStatus, importDataHubTeams, importSingleDataHubTeam } from '@/lib/dataHubImport';
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
        config: {
          ...getDataHubConfig(),
          token: undefined,
        },
      });
    }

    if (action === 'sync-teams') {
      const limit = parseLimit(url.searchParams.get('limit'));
      const full = url.searchParams.get('full') === '1' || url.searchParams.get('full') === 'true';
      return NextResponse.json(await importDataHubTeams({ limit, full }));
    }

    if (action === 'sync-team') {
      const teamId = url.searchParams.get('team_id') || url.searchParams.get('teamId');
      if (!teamId) return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
      return NextResponse.json({ ok: true, team: await importSingleDataHubTeam(teamId) });
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
      return NextResponse.json({ ...status, ok: status.ok !== false });
    }

    if (action === 'sync-team') {
      const teamId = body.team_id || body.teamId;
      if (!teamId) return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
      return NextResponse.json({ ok: true, team: await importSingleDataHubTeam(teamId) });
    }

    if (action === 'sync-teams') {
      const limit = parseLimit(String(body.limit || '12'));
      const full = Boolean(body.full);
      return NextResponse.json(await importDataHubTeams({ limit, full }));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Data Hub admin action failed' }, { status: 500 });
  }
}
