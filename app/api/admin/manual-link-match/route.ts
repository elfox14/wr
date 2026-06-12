import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function validSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getAuth(req: Request) {
  const expected = validSecrets();
  if (expected.length === 0) return { valid: false, method: 'missing_server_secret' };

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const { searchParams } = new URL(req.url);

  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-admin-key', value: req.headers.get('x-admin-key')?.trim() || '' },
    { method: 'x-admin-secret', value: req.headers.get('x-admin-secret')?.trim() || '' },
    { method: 'x-cron-secret', value: req.headers.get('x-cron-secret')?.trim() || '' },
    { method: 'key_query', value: searchParams.get('key')?.trim() || '' },
    { method: 'adminSecret_query', value: searchParams.get('adminSecret')?.trim() || '' },
    { method: 'cronSecret_query', value: searchParams.get('cronSecret')?.trim() || '' },
  ];

  const matched = candidates.find((item) => item.value && expected.includes(item.value));
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

function normalizedStatus(value?: string | null) {
  const status = String(value || '').toUpperCase();
  if (['FINISHED', 'FT', 'AET', 'PEN', '-1'].includes(status)) return 'FINISHED';
  if (['LIVE', 'IN_PLAY', '1H', '2H', 'HT'].includes(status)) return 'IN_PLAY';
  return 'SCHEDULED';
}

function safeScore(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99) return null;
  return Math.floor(parsed);
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized', authMethod: auth.method }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';
  const animationMatchId = Number(searchParams.get('animationMatchId') || 0);
  const status = normalizedStatus(searchParams.get('status'));
  const homeScore = safeScore(searchParams.get('homeScore'));
  const awayScore = safeScore(searchParams.get('awayScore'));

  if (!id || !Number.isFinite(animationMatchId) || animationMatchId <= 0) {
    return NextResponse.json({ ok: false, error: 'id and animationMatchId are required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const current = await prisma.match.findUnique({
    where: { id },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
  if (!current) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const duplicate = await prisma.match.findUnique({
    where: { animationMatchId },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });

  if (duplicate && duplicate.id !== id) {
    return NextResponse.json({
      ok: false,
      error: 'animationMatchId is already linked to another match',
      animationMatchId,
      linkedMatch: {
        id: duplicate.id,
        status: duplicate.status,
        score: `${duplicate.homeScore}-${duplicate.awayScore}`,
        homeTeam: duplicate.homeTeam?.name,
        awayTeam: duplicate.awayTeam?.name,
      },
    }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const data: any = { animationMatchId, status };
  if (homeScore !== null) data.homeScore = homeScore;
  if (awayScore !== null) data.awayScore = awayScore;

  const updated = await prisma.match.update({
    where: { id },
    data,
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });

  return NextResponse.json({
    ok: true,
    authMethod: auth.method,
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
