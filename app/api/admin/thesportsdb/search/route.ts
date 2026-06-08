import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { lookupEventsByDate, searchPlayers, searchTeams } from '@/lib/theSportsDb';

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
} | null;

function hasValidAdminSecret(req: Request) {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-admin-secret') || '';
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('adminSecret') || '';

  return [bearer, headerSecret, querySecret].some((value) => value && value === expectedSecret);
}

async function requireAdmin(req: Request) {
  if (hasValidAdminSecret(req)) return { secret: true };

  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.user.role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'team';
  const query = searchParams.get('q') || '';
  const date = searchParams.get('date') || '';

  try {
    if (type === 'player') {
      if (!query) return NextResponse.json({ error: 'q is required for player search' }, { status: 400 });
      const players = await searchPlayers(query);
      return NextResponse.json({ success: true, type, query, count: players.length, players });
    }

    if (type === 'event') {
      if (!date) return NextResponse.json({ error: 'date=YYYY-MM-DD is required for event search' }, { status: 400 });
      const events = await lookupEventsByDate(date);
      return NextResponse.json({ success: true, type, date, count: events.length, events });
    }

    if (!query) return NextResponse.json({ error: 'q is required for team search' }, { status: 400 });
    const teams = await searchTeams(query);
    return NextResponse.json({ success: true, type: 'team', query, count: teams.length, teams });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'TheSportsDB search failed',
      details: error.payload || null,
    }, { status: error.status || 500 });
  }
}
