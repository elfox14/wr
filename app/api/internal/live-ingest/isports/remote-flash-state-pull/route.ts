import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { GET as remoteFlashPullGET } from '@/app/api/internal/live-ingest/isports/remote-flash-pull/route';
import { ensureStatsTable, hasUsefulStats, type NormalizedStats } from '@/lib/live-match-stats';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const PROVIDER = 'ISPORTS_FLASH';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function statusFromState(value: unknown) {
  const state = String(value ?? '').trim().toUpperCase();
  if (!state) return null;
  if (state === '-1' || state === '4' || state === 'FT' || state === 'FINISHED' || state === 'ENDED' || state === 'COMPLETED') return 'FINISHED';
  if (state === '2' || state === 'HT' || state.includes('HALF')) return 'HT';
  if (state === '3' || state === '2H' || state.includes('SECOND')) return '2H';
  if (state === '1' || state === '1H' || state.includes('FIRST')) return '1H';
  if (state === '5' || state === 'P' || state === 'PEN') return 'PEN';
  return null;
}

function numeric(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function readRemoteFlash(req: Request) {
  const url = new URL(req.url);
  url.pathname = '/api/internal/live-ingest/isports/remote-flash-pull';
  url.searchParams.set('save', 'false');
  url.searchParams.set('includeMatch', 'true');
  const response = await remoteFlashPullGET(new Request(url.toString(), { method: 'GET', headers: req.headers }));
  const text = await response.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, body };
}

async function findMatch(dbMatchId: string | null, providerMatchId: number) {
  if (dbMatchId) return prisma.match.findUnique({ where: { id: dbMatchId }, select: { id: true } });
  if (Number.isFinite(providerMatchId) && providerMatchId > 0) return prisma.match.findFirst({ where: { animationMatchId: providerMatchId }, select: { id: true } });
  return null;
}

async function saveSnapshot(matchId: string, providerMatchId: number, stats: NormalizedStats, rawData: any, replace: boolean) {
  if (!hasUsefulStats(stats)) return { deleted: 0, inserted: 0, snapshotId: null, reason: 'no_useful_flash_stats' };
  await ensureStatsTable();
  let deleted = 0;
  if (replace) {
    deleted = (await prisma.matchStatsSnapshot.deleteMany({ where: { matchId, provider: PROVIDER } })).count;
  }
  const snapshot = await prisma.matchStatsSnapshot.create({
    data: {
      id: randomUUID(),
      matchId,
      provider: PROVIDER,
      providerMatchId,
      minute: stats.minute,
      homePossession: stats.homePossession,
      awayPossession: stats.awayPossession,
      homeAttacks: stats.homeAttacks,
      awayAttacks: stats.awayAttacks,
      homeDangerousAttacks: stats.homeDangerousAttacks,
      awayDangerousAttacks: stats.awayDangerousAttacks,
      homeShots: stats.homeShots,
      awayShots: stats.awayShots,
      homeShotsOnTarget: stats.homeShotsOnTarget,
      awayShotsOnTarget: stats.awayShotsOnTarget,
      homeShotsOffTarget: stats.homeShotsOffTarget,
      awayShotsOffTarget: stats.awayShotsOffTarget,
      homeCorners: stats.homeCorners,
      awayCorners: stats.awayCorners,
      homeYellowCards: stats.homeYellowCards,
      awayYellowCards: stats.awayYellowCards,
      homeRedCards: stats.homeRedCards,
      awayRedCards: stats.awayRedCards,
      homeScore: stats.homeScore,
      awayScore: stats.awayScore,
      rawData,
    },
    select: { id: true },
  });
  return { deleted, inserted: 1, snapshotId: snapshot.id };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const url = new URL(req.url);
    const dbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
    const providerMatchId = Math.floor(Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || 0));
    const save = ['1', 'true', 'yes', 'on'].includes(String(url.searchParams.get('save') ?? 'true').toLowerCase());
    const replace = !['0', 'false', 'no', 'off'].includes(String(url.searchParams.get('replace') ?? 'true').toLowerCase());

    const remote = await readRemoteFlash(req);
    const stats = remote.body?.stats || {};
    const state = remote.body?.flash?.meta?.matchState ?? null;
    const nextStatus = statusFromState(state);
    const match = save ? await findMatch(dbMatchId, providerMatchId) : null;

    let matchUpdate: any = null;
    let snapshot: any = null;
    if (save && match?.id) {
      const data: any = {};
      const homeScore = numeric(stats.homeScore);
      const awayScore = numeric(stats.awayScore);
      if (homeScore !== null) data.homeScore = homeScore;
      if (awayScore !== null) data.awayScore = awayScore;
      if (nextStatus) data.status = nextStatus;
      if (Object.keys(data).length) {
        matchUpdate = await prisma.match.update({ where: { id: match.id }, data, select: { id: true, homeScore: true, awayScore: true, status: true } });
      }
      snapshot = await saveSnapshot(match.id, providerMatchId, stats, {
        source: PROVIDER,
        stateSource: 'isports_flash_schedule_state',
        statusFromMinute: false,
        flashMeta: remote.body?.flash?.meta || null,
        loader: remote.body?.loader || null,
        remoteFlashStatus: remote.status,
      }, replace);
    }

    return json({
      ok: true,
      mode: 'isports_remote_flash_state_pull',
      remote: { ok: remote.ok, status: remote.status, loader: remote.body?.loader || null },
      stateSource: 'isports_flash_schedule_state',
      statusFromMinute: false,
      matchState: state,
      providerStatus: nextStatus,
      stats,
      save: { matchUpdate, snapshot },
      flash: remote.body?.flash || null,
      note: 'Uses iSports flash schedule state as the only source for match phase/status. Minute-based status inference is disabled here.',
    });
  } catch (error: any) {
    return json({ ok: false, mode: 'isports_remote_flash_state_pull', error: error?.message || 'Internal Server Error' }, 500);
  }
}
