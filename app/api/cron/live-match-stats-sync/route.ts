import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { footballFetchFromProvider } from '@/lib/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type NormalizedStats = {
  minute: number | null;
  homePossession: number | null;
  awayPossession: number | null;
  homeAttacks: number | null;
  awayAttacks: number | null;
  homeDangerousAttacks: number | null;
  awayDangerousAttacks: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homeShotsOffTarget: number | null;
  awayShotsOffTarget: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

const EMPTY_STATS: NormalizedStats = {
  minute: null,
  homePossession: null,
  awayPossession: null,
  homeAttacks: null,
  awayAttacks: null,
  homeDangerousAttacks: null,
  awayDangerousAttacks: null,
  homeShots: null,
  awayShots: null,
  homeShotsOnTarget: null,
  awayShotsOnTarget: null,
  homeShotsOffTarget: null,
  awayShotsOffTarget: null,
  homeScore: null,
  awayScore: null,
};

function validSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function getCronAuth(req: Request) {
  const expected = validSecrets();
  if (expected.length === 0) return { valid: true, method: 'no_secret_configured' };
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cronHeader = req.headers.get('x-cron-secret')?.trim() || '';
  const adminHeader = req.headers.get('x-admin-secret')?.trim() || '';
  const { searchParams } = new URL(req.url);
  const cronQuery = searchParams.get('cronSecret')?.trim() || '';
  const adminQuery = searchParams.get('adminSecret')?.trim() || '';
  const keyQuery = searchParams.get('key')?.trim() || '';
  const matched = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: cronHeader },
    { method: 'x-admin-secret', value: adminHeader },
    { method: 'cronSecret_query', value: cronQuery },
    { method: 'adminSecret_query', value: adminQuery },
    { method: 'key_query', value: keyQuery },
  ].find((item) => item.value && expected.includes(item.value));
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

async function ensureStatsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MatchStatsSnapshot" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
      "provider" TEXT NOT NULL DEFAULT 'ISPORTS',
      "providerMatchId" INTEGER NOT NULL,
      "minute" INTEGER,
      "homePossession" INTEGER,
      "awayPossession" INTEGER,
      "homeAttacks" INTEGER,
      "awayAttacks" INTEGER,
      "homeDangerousAttacks" INTEGER,
      "awayDangerousAttacks" INTEGER,
      "homeShots" INTEGER,
      "awayShots" INTEGER,
      "homeShotsOnTarget" INTEGER,
      "awayShotsOnTarget" INTEGER,
      "homeShotsOffTarget" INTEGER,
      "awayShotsOffTarget" INTEGER,
      "homeScore" INTEGER,
      "awayScore" INTEGER,
      "rawData" JSONB,
      "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchStatsSnapshot_matchId_capturedAt_idx" ON "MatchStatsSnapshot" ("matchId", "capturedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchStatsSnapshot_providerMatchId_idx" ON "MatchStatsSnapshot" ("providerMatchId")');
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const n = toNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function getPath(obj: any, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function getSideObject(item: any, side: 'home' | 'away') {
  const keys = side === 'home'
    ? ['home', 'homeTeam', 'homeStats', 'homeStatistics', 'teamA', 'localteam', 'host']
    : ['away', 'awayTeam', 'awayStats', 'awayStatistics', 'teamB', 'visitorteam', 'guest'];
  for (const key of keys) {
    if (item?.[key] && typeof item[key] === 'object') return item[key];
  }
  return item || {};
}

function collectArrays(value: any, output: any[] = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    output.push(value);
    value.forEach((item) => collectArrays(item, output));
    return output;
  }
  Object.values(value).forEach((item) => collectArrays(item, output));
  return output;
}

function applyStatLabel(stats: NormalizedStats, rawLabel: unknown, homeValue: unknown, awayValue: unknown) {
  const label = String(rawLabel || '').toLowerCase().replace(/[_-]/g, ' ');
  const home = toNumber(homeValue);
  const away = toNumber(awayValue);
  if (home === null && away === null) return;

  if (label.includes('possession') || label === 'poss' || label.includes('ball possession')) {
    stats.homePossession = home;
    stats.awayPossession = away;
  } else if (label.includes('dangerous') || label.includes('d att') || label.includes('d-att')) {
    stats.homeDangerousAttacks = home;
    stats.awayDangerousAttacks = away;
  } else if (label.includes('attack') || label === 'att') {
    stats.homeAttacks = home;
    stats.awayAttacks = away;
  } else if (label.includes('on target') || label.includes('shot on') || label.includes('sot')) {
    stats.homeShotsOnTarget = home;
    stats.awayShotsOnTarget = away;
  } else if (label.includes('off target') || label.includes('shot off')) {
    stats.homeShotsOffTarget = home;
    stats.awayShotsOffTarget = away;
  } else if (label.includes('shot')) {
    stats.homeShots = home;
    stats.awayShots = away;
  }
}

function normalizeStats(payload: any): NormalizedStats {
  const stats: NormalizedStats = { ...EMPTY_STATS };
  const rootItems = [payload, ...(Array.isArray(payload?.response) ? payload.response : []), ...(Array.isArray(payload?.data) ? payload.data : []), ...(Array.isArray(payload?.result) ? payload.result : [])].filter(Boolean);

  for (const item of rootItems) {
    const home = getSideObject(item, 'home');
    const away = getSideObject(item, 'away');
    stats.minute ??= firstNumber(item?.minute, item?.matchMinute, item?.time, item?.elapsed, item?.liveTime, item?.status?.elapsed, payload?.minute, payload?.elapsed);
    stats.homeScore ??= firstNumber(item?.homeScore, item?.home_score, item?.score?.home, item?.goals?.home, home?.score, home?.goals);
    stats.awayScore ??= firstNumber(item?.awayScore, item?.away_score, item?.score?.away, item?.goals?.away, away?.score, away?.goals);
    stats.homePossession ??= firstNumber(home?.possession, home?.poss, home?.ballPossession, home?.ball_possession, item?.homePossession, item?.home_possession);
    stats.awayPossession ??= firstNumber(away?.possession, away?.poss, away?.ballPossession, away?.ball_possession, item?.awayPossession, item?.away_possession);
    stats.homeAttacks ??= firstNumber(home?.attacks, home?.attack, home?.att, item?.homeAttacks, item?.home_attacks, item?.homeATT);
    stats.awayAttacks ??= firstNumber(away?.attacks, away?.attack, away?.att, item?.awayAttacks, item?.away_attacks, item?.awayATT);
    stats.homeDangerousAttacks ??= firstNumber(home?.dangerousAttacks, home?.dangerous_attacks, home?.dAtt, home?.d_att, item?.homeDangerousAttacks, item?.home_dangerous_attacks);
    stats.awayDangerousAttacks ??= firstNumber(away?.dangerousAttacks, away?.dangerous_attacks, away?.dAtt, away?.d_att, item?.awayDangerousAttacks, item?.away_dangerous_attacks);
    stats.homeShots ??= firstNumber(home?.shots, home?.shotsTotal, home?.shots_total, item?.homeShots, item?.home_shots);
    stats.awayShots ??= firstNumber(away?.shots, away?.shotsTotal, away?.shots_total, item?.awayShots, item?.away_shots);
    stats.homeShotsOnTarget ??= firstNumber(home?.shotsOnTarget, home?.shots_on_target, home?.onTarget, item?.homeShotsOnTarget, item?.home_shots_on_target);
    stats.awayShotsOnTarget ??= firstNumber(away?.shotsOnTarget, away?.shots_on_target, away?.onTarget, item?.awayShotsOnTarget, item?.away_shots_on_target);
    stats.homeShotsOffTarget ??= firstNumber(home?.shotsOffTarget, home?.shots_off_target, home?.offTarget, item?.homeShotsOffTarget, item?.home_shots_off_target);
    stats.awayShotsOffTarget ??= firstNumber(away?.shotsOffTarget, away?.shots_off_target, away?.offTarget, item?.awayShotsOffTarget, item?.away_shots_off_target);
  }

  for (const array of collectArrays(payload)) {
    for (const row of array) {
      if (!row || typeof row !== 'object') continue;
      const label = row.type ?? row.name ?? row.key ?? row.stat ?? row.statName ?? row.statisticsType;
      const homeValue = row.home ?? row.homeValue ?? row.home_value ?? row.homeTeam ?? getPath(row, ['values.home', 'value.home']);
      const awayValue = row.away ?? row.awayValue ?? row.away_value ?? row.awayTeam ?? getPath(row, ['values.away', 'value.away']);
      applyStatLabel(stats, label, homeValue, awayValue);
    }
  }

  return stats;
}

function hasUsefulStats(stats: NormalizedStats) {
  return Object.entries(stats).some(([key, value]) => key !== 'minute' && value !== null && value !== undefined);
}

async function saveSnapshot(match: any, providerMatchId: number, stats: NormalizedStats, rawData: any) {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MatchStatsSnapshot" (
      "id", "matchId", "provider", "providerMatchId", "minute",
      "homePossession", "awayPossession", "homeAttacks", "awayAttacks",
      "homeDangerousAttacks", "awayDangerousAttacks", "homeShots", "awayShots",
      "homeShotsOnTarget", "awayShotsOnTarget", "homeShotsOffTarget", "awayShotsOffTarget",
      "homeScore", "awayScore", "rawData"
    ) VALUES ($1,$2,'ISPORTS',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)`,
    id,
    match.id,
    providerMatchId,
    stats.minute,
    stats.homePossession,
    stats.awayPossession,
    stats.homeAttacks,
    stats.awayAttacks,
    stats.homeDangerousAttacks,
    stats.awayDangerousAttacks,
    stats.homeShots,
    stats.awayShots,
    stats.homeShotsOnTarget,
    stats.awayShotsOnTarget,
    stats.homeShotsOffTarget,
    stats.awayShotsOffTarget,
    stats.homeScore,
    stats.awayScore,
    JSON.stringify(rawData || null)
  );
  return id;
}

export async function GET(req: Request) {
  const auth = getCronAuth(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    await ensureStatsTable();
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === 'true';
    const singleMatchId = Number(url.searchParams.get('matchId') || 0);
    const hasSingleMatchId = Boolean(singleMatchId && Number.isFinite(singleMatchId));

    const matches = await prisma.match.findMany({
      where: hasSingleMatchId
        ? { animationMatchId: singleMatchId }
        : { animationMatchId: { not: null }, status: { in: ['IN_PLAY', 'LIVE'] } },
      orderBy: { matchDate: 'asc' },
      take: hasSingleMatchId ? 1 : 12,
      select: { id: true, animationMatchId: true, status: true, homeScore: true, awayScore: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    });

    if (hasSingleMatchId && matches.length === 0) {
      try {
        const raw = await footballFetchFromProvider('ISPORTS', '/analysis', { fixture: singleMatchId });
        const stats = normalizeStats(raw);
        return NextResponse.json({
          ok: true,
          authMethod: auth.method,
          count: 1,
          linkedInDatabase: false,
          message: 'iSports analysis fetched directly, but this matchId is not linked to a Match row yet.',
          processed: [{ providerMatchId: singleMatchId, status: hasUsefulStats(stats) ? 'direct_debug_mapped' : 'direct_debug_unmapped', stats, ...(debug ? { raw } : {}) }],
        }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error: any) {
        return NextResponse.json({
          ok: true,
          authMethod: auth.method,
          count: 1,
          linkedInDatabase: false,
          processed: [{ providerMatchId: singleMatchId, status: 'direct_fetch_failed', error: error?.message || 'Unknown error' }],
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const processed = [];
    for (const match of matches) {
      if (!match.animationMatchId) continue;
      try {
        const raw = await footballFetchFromProvider('ISPORTS', '/analysis', { fixture: match.animationMatchId });
        const stats = normalizeStats(raw);
        if (stats.homeScore === null) stats.homeScore = match.homeScore;
        if (stats.awayScore === null) stats.awayScore = match.awayScore;
        if (!hasUsefulStats(stats) && !debug) {
          processed.push({ matchId: match.id, providerMatchId: match.animationMatchId, status: 'no_mapped_stats', matchStatus: match.status });
          continue;
        }
        const snapshotId = await saveSnapshot(match, match.animationMatchId, stats, raw);
        processed.push({ matchId: match.id, providerMatchId: match.animationMatchId, status: 'saved', matchStatus: match.status, snapshotId, stats, ...(debug ? { raw } : {}) });
      } catch (error: any) {
        processed.push({ matchId: match.id, providerMatchId: match.animationMatchId, status: 'failed', matchStatus: match.status, error: error?.message || 'Unknown error' });
      }
    }

    return NextResponse.json({ ok: true, authMethod: auth.method, count: processed.length, linkedInDatabase: matches.length > 0, processed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('live-match-stats-sync error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
