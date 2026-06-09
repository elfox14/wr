import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'admin@worldcup.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function getOrigin(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(req.url).origin;
}

async function callInternal(req: Request, path: string, init: RequestInit = {}) {
  const origin = getOrigin(req);
  const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';

  const response = await fetch(`${origin}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function healthCheck() {
  const [assets, teams, players, matches, performances, news] = await Promise.all([
    prisma.asset.count(),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.match.count(),
    prisma.playerPerformance.count(),
    prisma.marketNews.count(),
  ]);

  return {
    ok: true,
    time: new Date().toISOString(),
    env: {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      nextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
      nextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
      adminApiSecret: Boolean(process.env.ADMIN_API_SECRET),
      cronSecret: Boolean(process.env.CRON_SECRET),
      apiFootballKey: Boolean(process.env.API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEYS),
      isportsKey: Boolean(process.env.ISPORTS_API_KEY || process.env.ISPORTS_API_KEYS),
      marketState: process.env.NEXT_PUBLIC_MARKET_STATE || null,
    },
    database: {
      assets,
      teams,
      players,
      matches,
      performances,
      news,
    },
  };
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'health';
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const fixtureId = searchParams.get('fixtureId');
  const force = searchParams.get('force') === 'true';

  try {
    if (action === 'health') {
      return NextResponse.json(await healthCheck());
    }

    if (action === 'fixtures') {
      const result = await callInternal(req, `/api/admin/api-football-fixtures?date=${encodeURIComponent(date)}`);
      return NextResponse.json(result, { status: result.ok ? 200 : result.status });
    }

    if (action === 'auto-sync') {
      const params = new URLSearchParams({ date });
      if (force) params.set('force', 'true');
      const result = await callInternal(req, `/api/cron/football-auto-sync?${params.toString()}`);
      return NextResponse.json(result, { status: result.ok ? 200 : result.status });
    }

    if (action === 'sync-performance') {
      if (!fixtureId) return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
      const result = await callInternal(req, '/api/admin/sync-player-performance', {
        method: 'POST',
        body: JSON.stringify({ fixtureId: Number(fixtureId), force, limit: 100 }),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Admin control action failed',
      details: error.payload || null,
    }, { status: error.status || 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  return GET(new Request(url.toString(), { headers: req.headers }));
}
