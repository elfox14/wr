import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { importOfficialSquads } from '@/lib/officialSquadImport';

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

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    route: '/api/admin/official-squads',
    method: 'POST',
    policy: 'APPROVED_SQUAD_SOURCES_ONLY',
    note: 'Use this route for official or approved squad lists only. Data Hub generic squads remain disabled.',
    acceptedPayload: {
      teamCode: 'EGY',
      sourceName: 'Official federation / FIFA / approved source',
      sourceUrl: 'https://example.com/source',
      replaceExisting: false,
      players: [
        {
          name: 'Player Name',
          position: 'Forward',
          age: 26,
          club: 'Club Name',
          shirtNumber: 10,
          image: 'https://example.com/player.jpg',
        },
      ],
    },
    batchPayload: {
      teams: [
        {
          teamCode: 'EGY',
          sourceName: 'Official source',
          sourceUrl: 'https://example.com/source',
          replaceExisting: false,
          players: [],
        },
      ],
    },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });

  try {
    const result = await importOfficialSquads(payload);
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Official squad import failed',
    }, { status: 500 });
  }
}
