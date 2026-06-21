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
  const n = Number(String(value ?? '').replace('%', '').trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

function emptyStats(): NormalizedStats {
  return { minute: null, homePossession: null, awayPossession: null, homeAttacks: null, awayAttacks: null, homeDangerousAttacks: null, awayDangerousAttacks: null, homeShots: null, awayShots: null, homeShotsOnTarget: null, awayShotsOnTarget: null, homeShotsOffTarget: null, awayShotsOffTarget: null, homeCorners: null, awayCorners: null, homeYellowCards: null, awayYellowCards: null, homeRedCards: null, awayRedCards: null, homeScore: null, awayScore: null };
}

function htmlish(text: string) {
  return /<!doctype|<html|<body|<head|404|This page could not be found/i.test(String(text || '').slice(0, 1500));
}

function parseFlashText(text: string) {
  const raw = String(text || '');
  if (!raw || htmlish(raw)) return null;
  const sections = raw.split('!');
  const schedule = (sections[0] || '').split('^');
  const stats = emptyStats();

  const stateA = schedule[3] || null;
  const stateB = schedule[8] || null;
  const minuteA = numeric(schedule[4]);
  const minuteB = numeric(schedule[9]);
  const homeScoreA = numeric(schedule[1]);
  const awayScoreA = numeric(schedule[2]);
  const homeScoreB = numeric(schedule[6]);
  const awayScoreB = numeric(schedule[7]);

  const matchState = stateB || stateA || null;
  stats.minute = minuteB ?? minuteA;
  stats.homeScore = homeScoreB ?? homeScoreA;
  stats.awayScore = awayScoreB ?? awayScoreA;

  const records: string[] = [];
  for (const section of sections.slice(1)) {
    for (const part of section.split('^')) {
      const record = part.trim();
      if (record) records.push(record);
    }
  }

  const useful = matchState || stats.minute !== null || stats.homeScore !== null || stats.awayScore !== null || records.length > 0;
  if (!useful) return null;
  return {
    stats,
    flash: {
      scheduleID: schedule[0] || null,
      recordsCount: records.length,
      meta: {
        scheduleID: schedule[0] || null,
        matchState,
        scheduleMinute: stats.minute,
        fields: schedule.slice(0, 12),
      },
    },
  };
}

function candidateUrls(providerMatchId: number) {
  const id = encodeURIComponent(String(providerMatchId));
  const t = Date.now();
  return [
    `https://www.isportslive8.com/flashdata/get?id=${id}&t=${t}`,
    `https://www.isportslive8.com/football/flashdata/get?id=${id}&t=${t}`,
    `https://zhibo.feijing88.com/flashdata/get?id=${id}&t=${t}`,
    `https://live.titan007.com/flashdata/get?id=${id}&t=${t}`,
    `https://www.isportslive8.com/flashdata/${id}.js?t=${t}`,
    `https://zhibo.feijing88.com/flashdata/${id}.js?t=${t}`,
  ];
}

async function readDirectFlash(providerMatchId: number) {
  const attempts: any[] = [];
  for (const sourceUrl of candidateUrls(providerMatchId)) {
    try {
      const response = await fetch(sourceUrl, { cache: 'no-store', headers: { accept: 'text/plain,*/*', referer: 'https://www.isportslive8.com/', 'user-agent': 'Mozilla/5.0 MCPrimeFlashState/1.0' } });
      const text = await response.text();
      const parsed = parseFlashText(text);
      attempts.push({ sourceUrl, ok: response.ok, status: response.status, length: text.length, htmlish: htmlish(text), parsed: Boolean(parsed), sample: text.slice(0, 160) });
      if (response.ok && parsed) return { ok: true, status: response.status, sourceUrl, parsed, attempts };
    } catch (error: any) {
      attempts.push({ sourceUrl, ok: false, error: String(error?.message || error).slice(0, 260) });
    }
  }
  return { ok: false, status: null, sourceUrl: null, parsed: null, attempts };
}

async function readRemoteFlash(req: Request) {
  const url = new URL(req.url);
  url.pathname = '/api/internal/live-ingest/isports/remote-flash-pull';
  url.searchParams.set('save', 'false');
  url.searchParams.set('includeMatch', 'true');
  const response = await remoteFlashPullGET(new Request(url.toString(), { method: 'GET', headers: req.headers }));
  if (!response) return { ok: false, status: 500, body: null };
  const text = await response.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, body };
}

async function findMatch(dbMatchId: string | null, providerMatchId: number) {
  if (dbMatchId) return prisma.match.findUnique({ where: { id: dbMatchId }, select: { id: true, animationMatchId: true } });
  if (Number.isFinite(providerMatchId) && providerMatchId > 0) return prisma.match.findFirst({ where: { animationMatchId: providerMatchId }, select: { id: true, animationMatchId: true } });
  return null;
}

async function saveSnapshot(matchId: string, providerMatchId: number, stats: NormalizedStats, rawData: any, replace: boolean) {
  if (!hasUsefulStats(stats)) return { deleted: 0, inserted: 0, snapshotId: null, reason: 'no_useful_flash_stats' };
  await ensureStatsTable();
  let deleted = 0;
  if (replace) deleted = (await prisma.matchStatsSnapshot.deleteMany({ where: { matchId, provider: PROVIDER } })).count;
  const snapshot = await prisma.matchStatsSnapshot.create({
    data: { id: randomUUID(), matchId, provider: PROVIDER, providerMatchId, minute: stats.minute, homePossession: stats.homePossession, awayPossession: stats.awayPossession, homeAttacks: stats.homeAttacks, awayAttacks: stats.awayAttacks, homeDangerousAttacks: stats.homeDangerousAttacks, awayDangerousAttacks: stats.awayDangerousAttacks, homeShots: stats.homeShots, awayShots: stats.awayShots, homeShotsOnTarget: stats.homeShotsOnTarget, awayShotsOnTarget: stats.awayShotsOnTarget, homeShotsOffTarget: stats.homeShotsOffTarget, awayShotsOffTarget: stats.awayShotsOffTarget, homeCorners: stats.homeCorners, awayCorners: stats.awayCorners, homeYellowCards: stats.homeYellowCards, awayYellowCards: stats.awayYellowCards, homeRedCards: stats.homeRedCards, awayRedCards: stats.awayRedCards, homeScore: stats.homeScore, awayScore: stats.awayScore, rawData },
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
    let providerMatchId = Math.floor(Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || 0));
    const save = ['1', 'true', 'yes', 'on'].includes(String(url.searchParams.get('save') ?? 'true').toLowerCase());
    const replace = !['0', 'false', 'no', 'off'].includes(String(url.searchParams.get('replace') ?? 'true').toLowerCase());
    const match = await findMatch(dbMatchId, providerMatchId);
    providerMatchId = providerMatchId || Number(match?.animationMatchId || 0);

    const remote = await readRemoteFlash(req);
    const remoteState = remote.body?.flash?.meta?.matchState ?? null;
    const remoteStats = remote.body?.stats || {};
    const remoteValid = Boolean(remoteState || remote.body?.flash?.recordsCount > 0 || remote.body?.flash?.scheduleID !== 'scheduleID');
    const direct = providerMatchId ? await readDirectFlash(providerMatchId) : null;
    const directParsed = direct?.parsed || null;

    const stats = directParsed?.stats || remoteStats;
    const flash = directParsed?.flash || remote.body?.flash || null;
    const state = directParsed?.flash?.meta?.matchState ?? remoteState ?? null;
    const nextStatus = statusFromState(state);

    let matchUpdate: any = null;
    let snapshot: any = null;
    if (save && match?.id) {
      const data: any = {};
      const homeScore = numeric(stats.homeScore);
      const awayScore = numeric(stats.awayScore);
      if (homeScore !== null) data.homeScore = homeScore;
      if (awayScore !== null) data.awayScore = awayScore;
      if (nextStatus) data.status = nextStatus;
      if (Object.keys(data).length) matchUpdate = await prisma.match.update({ where: { id: match.id }, data, select: { id: true, homeScore: true, awayScore: true, status: true } });
      snapshot = await saveSnapshot(match.id, providerMatchId, stats, { source: PROVIDER, stateSource: 'isports_flash_schedule_state', statusFromMinute: false, flashMeta: flash?.meta || null, loader: directParsed ? 'direct_flashdata_by_provider_match_id' : remote.body?.loader || null, remoteFlashStatus: remote.status, directFlash: direct ? { ok: direct.ok, status: direct.status, sourceUrl: direct.sourceUrl, attempts: direct.attempts } : null }, replace);
    }

    return json({ ok: true, mode: 'cron_isports_flash_state', remote: { ok: remote.ok, status: remote.status, loader: remote.body?.loader || null, valid: remoteValid }, direct: direct ? { ok: direct.ok, status: direct.status, sourceUrl: direct.sourceUrl, attempts: direct.attempts } : null, stateSource: 'isports_flash_schedule_state', statusFromMinute: false, matchState: state, providerStatus: nextStatus, stats, save: { matchUpdate, snapshot }, flash, note: 'Uses direct /flashdata/get by provider match id when Browserless returns a placeholder scheduleID. Match status is never inferred from minute.' });
  } catch (error: any) {
    return json({ ok: false, mode: 'cron_isports_flash_state', error: error?.message || 'Internal Server Error' }, 500);
  }
}
