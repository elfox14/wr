import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function toScore(value: string | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(99, Math.floor(parsed))) : fallback;
}
function normalizeStatus(value: string | null) {
  const status = String(value || 'FINISHED').trim().toUpperCase();
  if (['FINISHED', 'FT', 'COMPLETED', 'ENDED', 'AET', 'PEN'].includes(status)) return status;
  if (['IN_PLAY', 'LIVE', 'SCHEDULED'].includes(status)) return status === 'LIVE' ? 'IN_PLAY' : status;
  return 'FINISHED';
}
function cleanText(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}
function matchWhere(url: URL) {
  const id = cleanText(url.searchParams.get('id') || url.searchParams.get('matchId') || url.searchParams.get('dbMatchId'));
  const externalId = cleanText(url.searchParams.get('externalId'));
  const animationMatchId = Number(url.searchParams.get('animationMatchId') || url.searchParams.get('fixtureId') || 0);
  if (id) return { id };
  if (externalId) return { externalId };
  if (Number.isFinite(animationMatchId) && animationMatchId > 0) return { animationMatchId };
  return null;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const url = new URL(req.url);
  const where = matchWhere(url);
  if (!where) return json({ ok: false, error: 'Pass id, matchId, dbMatchId, externalId, or animationMatchId.' }, 400);

  const confirm = url.searchParams.get('confirmScoreRepair') || url.searchParams.get('confirm') || '';
  if (confirm !== 'CONFIRM_FINAL_SCORE_REPAIR') {
    return json({ ok: false, error: 'Missing confirmation.', required: 'confirmScoreRepair=CONFIRM_FINAL_SCORE_REPAIR' }, 409);
  }

  const reason = cleanText(url.searchParams.get('reason'), 'Manual final-score correction');
  const sourceName = cleanText(url.searchParams.get('sourceName'), 'Manual review');
  const sourceUrl = cleanText(url.searchParams.get('sourceUrl')) || null;
  const status = normalizeStatus(url.searchParams.get('status'));

  try {
    const match = await prisma.match.findFirst({
      where,
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });
    if (!match) return json({ ok: false, error: 'Match not found.', where }, 404);

    const oldHomeScore = Number(match.homeScore || 0);
    const oldAwayScore = Number(match.awayScore || 0);
    const homeScore = toScore(url.searchParams.get('homeScore'), oldHomeScore);
    const awayScore = toScore(url.searchParams.get('awayScore'), oldAwayScore);

    const updated = await prisma.match.update({
      where: { id: match.id },
      data: { homeScore, awayScore, status },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });

    const note = await prisma.matchEvent.create({
      data: {
        id: randomUUID(),
        matchId: match.id,
        minute: null,
        type: 'score_correction',
        detail: `${reason}. Corrected final score from ${oldHomeScore}-${oldAwayScore} to ${homeScore}-${awayScore}.`,
        sourceName,
        sourceUrl,
      },
      select: { id: true, type: true, detail: true },
    });

    const snapshot = await prisma.matchStatsSnapshot.create({
      data: {
        id: randomUUID(),
        matchId: match.id,
        provider: 'MANUAL_SCORE_REPAIR',
        providerMatchId: Number(updated.animationMatchId || String(updated.externalId || '').replace(/\D/g, '')) || 0,
        homeScore,
        awayScore,
        rawData: {
          mode: 'manual_final_score_repair',
          reason,
          sourceName,
          sourceUrl,
          oldScore: { home: oldHomeScore, away: oldAwayScore },
          correctedScore: { home: homeScore, away: awayScore },
          status,
          repairedAt: new Date().toISOString(),
        },
      },
      select: { id: true, provider: true, capturedAt: true },
    });

    return json({
      ok: true,
      mode: 'manual_final_score_repair',
      authMode: auth.mode,
      match: {
        id: updated.id,
        externalId: updated.externalId,
        animationMatchId: updated.animationMatchId,
        status: updated.status,
        homeTeam: updated.homeTeam?.name,
        awayTeam: updated.awayTeam?.name,
        oldScore: `${oldHomeScore}-${oldAwayScore}`,
        correctedScore: `${updated.homeScore}-${updated.awayScore}`,
      },
      note,
      snapshot,
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function POST(req: Request) {
  return GET(req);
}
