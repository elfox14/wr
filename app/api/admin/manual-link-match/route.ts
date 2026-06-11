import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isAllowed(req: Request) {
  const expected = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerKey = req.headers.get('x-admin-key') || '';
  const { searchParams } = new URL(req.url);
  const queryKey = searchParams.get('key') || '';
  return [bearer, headerKey, queryKey].some((value) => value && value === expected);
}

function normalizedStatus(value?: string | null) {
  const status = String(value || '').toUpperCase();
  if (['FINISHED', 'FT', 'AET', 'PEN', '-1'].includes(status)) return 'FINISHED';
  if (['LIVE', 'IN_PLAY', '1H', '2H', 'HT'].includes(status)) return 'IN_PLAY';
  return 'SCHEDULED';
}

export async function GET(req: Request) {
  if (!isAllowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';
  const animationMatchId = Number(searchParams.get('animationMatchId') || 0);
  const status = normalizedStatus(searchParams.get('status'));
  const homeScoreRaw = searchParams.get('homeScore');
  const awayScoreRaw = searchParams.get('awayScore');

  if (!id || !Number.isFinite(animationMatchId) || animationMatchId <= 0) {
    return NextResponse.json({ ok: false, error: 'id and animationMatchId are required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const current = await prisma.match.findUnique({ where: { id }, include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } });
  if (!current) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const data: any = { animationMatchId, status };
  if (homeScoreRaw !== null) data.homeScore = Number(homeScoreRaw);
  if (awayScoreRaw !== null) data.awayScore = Number(awayScoreRaw);

  const updated = await prisma.match.update({ where: { id }, data, include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } });

  return NextResponse.json({
    ok: true,
    match: {
      id: updated.id,
      animationMatchId: updated.animationMatchId,
      status: updated.status,
      score: `${updated.homeScore}-${updated.awayScore}`,
      homeTeam: updated.homeTeam?.name,
      awayTeam: updated.awayTeam?.name,
    },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
}

export async function POST(req: Request) { return GET(req); }
