import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getFootballLineups } from '@/lib/isportsApi';
import { flattenLineupPlayers } from '@/lib/isportsMapping';

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.authorized) return admin.error;

  const { searchParams } = new URL(req.url);
  const matchId = Number(searchParams.get('matchId'));

  if (!matchId || Number.isNaN(matchId)) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
  }

  try {
    const payload: any = await getFootballLineups({ matchId });
    const players = flattenLineupPlayers(payload);

    return NextResponse.json({
      success: payload?.code === 0,
      code: payload?.code,
      message: payload?.message,
      matchId,
      totalPlayers: players.length,
      data: payload?.data || [],
      players,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to load iSports lineups',
      primary: error.primary || null,
      fallback: error.fallback || null,
    }, { status: 500 });
  }
}
