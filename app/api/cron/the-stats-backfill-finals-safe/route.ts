import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { revalidateStatsViews } from '@/lib/revalidateStatsViews';
import { defaultTheStatsQuery, resolveTheStatsProviderId } from '@/lib/theStatsMatchExtras';
import { theStatsApiFetch } from '@/lib/theStatsApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const n = Number(url.searchParams.get(name) ?? fallback);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

function dateParam(url: URL, name: string, fallback: string) {
  const raw = String(url.searchParams.get(name) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function numberId(value: unknown) { const n = Number(String(value || '').replace(/\D/g, '')); return Number.isFinite(n) ? n : 0; }
function num(value: unknown) { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : null; }
function n(value: unknown) { if (value === null || value === undefined || value === '') return null; const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value); return Number.isFinite(number) ? number : null; }
function str(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && text !== '[object Object]' && !/^null|undefined|-$/i.test(text)) return text;
      continue;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const text = str(record.name, record.fullName, record.full_name, record.title, record.label, record.display_name, record.displayName);
      if (text) return text;
    }
  }
  return null;
}
function bool(value: unknown) { if (typeof value === 'boolean') return value; if (value === null || value === undefined || value === '') return null; const s = String(value).trim().toLowerCase(); if (['1', 'true', 'yes', 'y'].includes(s)) return true; if (['0', 'false', 'no', 'n'].includes(s)) return false; return null; }
function dataOf(payload: any) { return payload?.data || payload?.response || payload?.result || payload || {}; }
function listFrom(payload: any, fields: string[]) { if (Array.isArray(payload)) return payload; const data = dataOf(payload); if (Array.isArray(data)) return data; for (const field of fields) if (Array.isArray(data?.[field])) return data[field]; for (const field of fields) if (Array.isArray(payload?.[field])) return payload[field]; return []; }
function pair(value: any) { const all = value?.all || value || {}; const home = n(all.home ?? all.home_team ?? all.homeTeam ?? all.home_team_value); const away = n(all.away ?? all.away_team ?? all.awayTeam ?? all.away_team_value); return home === null && away === null ? null : { home, away }; }

function safeError(error: any) {
  return {
    name: error?.name || 'TheStatsApiError',
    message: String(error?.message || error),
    status: Number(error?.status || error?.payload?.error?.status_code || 0) || null,
    code: error?.code || error?.payload?.error?.code || null,
    payload: error?.payload || null,
  };
}

function compactStats(payload: any) {
  const data = dataOf(payload);
  const overview = data.overview || data.stats || {};
  const shots = data.shots || {};
  const attack = data.attack || {};
  const defending = data.defending || {};
  const goalkeeping = data.goalkeeping || {};
  const passes = data.passes || {};
  const out: Record<string, any> = {};
  const entries: Record<string, any> = {
    possession: overview.ball_possession || overview.possession,
    xg: overview.expected_goals || data.expected_goals,
    npxg: data.np_expected_goals || data.non_penalty_expected_goals,
    bigChances: overview.big_chances,
    shots: overview.total_shots || shots.total_shots,
    shotsOnTarget: overview.shots_on_target || shots.shots_on_target,
    shotsOffTarget: overview.shots_off_target || shots.shots_off_target,
    blockedShots: shots.blocked_shots,
    shotsInsideBox: shots.shots_inside_box,
    shotsOutsideBox: shots.shots_outside_box,
    corners: overview.corner_kicks || overview.corners,
    fouls: overview.fouls,
    offsides: overview.offsides || attack.offsides,
    yellowCards: overview.yellow_cards,
    redCards: overview.red_cards,
    passes: overview.passes || passes.total_passes,
    accuratePasses: overview.accurate_passes || passes.accurate_passes,
    tackles: overview.tackles,
    saves: overview.goalkeeper_saves || goalkeeping.saves,
    interceptions: defending.interceptions,
    clearances: defending.clearances,
    ballRecoveries: defending.ball_recoveries,
  };
  for (const [keyName, value] of Object.entries(entries)) { const parsed = pair(value); if (parsed) out[keyName] = parsed; }
  return { meta: { source: 'match-stats' }, stats: out };
}

function compactMatchInfo(matchInfoPayload: any, statsPayload: any) {
  const data = dataOf(matchInfoPayload);
  const stats = dataOf(statsPayload);
  const venue = data?.venue || data?.fixture?.venue || data?.match?.venue || {};
  const referee = data?.referee || data?.fixture?.referee || data?.match?.referee || {};
  return {
    status: str(data?.status, stats?.status),
    venue: str(venue?.name, venue),
    city: str(venue?.city, data?.city),
    referee: str(referee?.name, referee),
    finalScore: data?.score?.final_score || data?.score || null,
    xgAvailable: Boolean(data?.xg_available || stats?.overview?.expected_goals),
  };
}

function compactEvent(row: any) {
  const team = row?.team || {};
  const player = row?.player || row?.athlete || row?.scorer || {};
  return {
    sequence: n(row?.sequence),
    period: str(row?.period),
    type: str(row?.type, row?.event_type, row?.incident_type, row?.name) || 'event',
    minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute),
    extraTime: n(row?.extra_time ?? row?.extraTime ?? row?.stoppage_time),
    teamId: str(team?.id, row?.team_id, row?.teamId),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    playerId: str(player?.id, row?.player_id, row?.playerId),
    playerName: str(player?.name, row?.player_name, row?.playerName, row?.scorer?.name),
    detail: str(row?.detail, row?.description, row?.comment, row?.text, row?.message),
  };
}

function compactShot(row: any) {
  const player = row?.player || row?.athlete || row?.shooter || {};
  const team = row?.team || {};
  const outcome = str(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type);
  return {
    id: str(row?.id),
    minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed),
    playerId: str(player?.id, row?.player_id, row?.playerId),
    playerName: str(player?.name, row?.player_name, row?.playerName),
    teamId: str(team?.id, row?.team_id, row?.teamId),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    x: n(row?.x ?? row?.pitchX ?? row?.location?.x),
    y: n(row?.y ?? row?.pitchY ?? row?.location?.y),
    xg: n(row?.xg ?? row?.expected_goals ?? row?.expectedGoals),
    npxg: n(row?.npxg ?? row?.non_penalty_xg ?? row?.nonPenaltyXg),
    outcome,
    situation: str(row?.situation),
    bodyPart: str(row?.body_part, row?.bodyPart),
    isOnTarget: bool(row?.is_on_target) ?? /on target|saved|goal/i.test(String(outcome || '')),
    isGoal: bool(row?.is_goal) ?? /goal|scored/i.test(String(outcome || row?.type || '')),
    isBlocked: bool(row?.is_blocked_shot),
    isPenalty: bool(row?.is_penalty),
  };
}

function compactPlayerStat(row: any) {
  const player = row?.player || row?.athlete || row;
  const team = row?.team || {};
  const stats = row?.stats || row?.statistics || row;
  const passing = row?.passing || stats?.passing || {};
  const shooting = row?.shooting || stats?.shooting || {};
  const defending = row?.defending || stats?.defending || {};
  const goalkeeping = row?.goalkeeping || stats?.goalkeeping || {};
  const general = row?.general || stats?.general || {};
  const minutes = n(stats?.minutes ?? stats?.minutes_played ?? row?.minutes_played ?? row?.minutes);
  const played = bool(stats?.played ?? row?.played) ?? (minutes !== null && minutes > 0) ?? null;
  return {
    playerId: str(player?.id, row?.player_id, row?.playerId, row?.id),
    playerName: str(player?.name, row?.player_name, row?.playerName, row?.name),
    teamId: str(team?.id, row?.team_id, row?.teamId),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    position: str(player?.position, row?.position),
    rating: n(stats?.rating ?? row?.rating),
    minutes,
    played,
    goals: n(shooting?.goals ?? stats?.goals ?? row?.goals),
    assists: n(passing?.assists ?? stats?.assists ?? row?.assists),
    shots: n(shooting?.total_shots ?? stats?.shots ?? row?.shots),
    shotsOnTarget: n(shooting?.shots_on_target ?? stats?.shots_on_target ?? row?.shots_on_target),
    keyPasses: n(passing?.key_passes ?? stats?.key_passes ?? row?.key_passes),
    tackles: n(defending?.tackles ?? stats?.tackles ?? row?.tackles),
    interceptions: n(defending?.interceptions ?? stats?.interceptions ?? row?.interceptions),
    saves: n(goalkeeping?.saves ?? stats?.saves ?? row?.saves),
    yellowCards: n(general?.yellow_cards ?? stats?.yellow_cards ?? row?.yellow_cards),
    redCards: n(general?.red_cards ?? stats?.red_cards ?? row?.red_cards),
  };
}

async function fetchEndpoint(keyName: string, path: string, timeoutMs: number) {
  try {
    return { key: keyName, path, ok: true, payload: await theStatsApiFetch(path, {}, { timeoutMs }) };
  } catch (error: any) {
    return { key: keyName, path, ok: false, error: safeError(error) };
  }
}

async function collectSafeTheStatsMatchExtras(match: any, options: { includeRaw: boolean; timeoutMs: number; delayMs: number; query: Record<string, string | number> }) {
  const resolved = await resolveTheStatsProviderId(match, options.query);
  if (!resolved.id) return { ok: false, matchId: match.id, error: 'Could not resolve provider match id', resolved };

  const id = encodeURIComponent(String(resolved.id));
  const endpoints = [
    ['matchInfo', `/api/football/matches/${id}`],
    ['stats', `/api/football/matches/${id}/stats`],
    ['lineups', `/api/football/matches/${id}/lineups`],
    ['timeline', `/api/football/matches/${id}/timeline`],
    ['shotmap', `/api/football/matches/${id}/shotmap`],
    ['playerStats', `/api/football/matches/${id}/player-stats`],
  ];

  const results: any[] = [];
  for (const [keyName, path] of endpoints) {
    results.push(await fetchEndpoint(String(keyName), String(path), options.timeoutMs));
    if (options.delayMs > 0) await sleep(options.delayMs);
  }

  const byKey: Record<string, any> = Object.fromEntries(results.map((item) => [item.key, item]));
  const stats = byKey.stats?.ok ? compactStats(byKey.stats.payload) : { meta: {}, stats: {} };
  const events = byKey.timeline?.ok ? listFrom(byKey.timeline.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']).map(compactEvent) : [];
  const shotmap = byKey.shotmap?.ok ? listFrom(byKey.shotmap.payload, ['data', 'shotmap', 'shots', 'events', 'items', 'results']).map(compactShot) : [];
  const playerStats = byKey.playerStats?.ok ? listFrom(byKey.playerStats.payload, ['data', 'players', 'player_stats', 'items', 'results']).map(compactPlayerStat) : [];

  const normalized = {
    matchInfo: compactMatchInfo(byKey.matchInfo?.payload, byKey.stats?.payload),
    liveStats: stats,
    lineups: byKey.lineups?.ok ? dataOf(byKey.lineups.payload) : null,
    eventsDetailed: { all: events },
    shotmap,
    playerStats,
    playerHeatmaps: [],
    teamHeatmaps: { home: { points: [] }, away: { points: [] } },
  };
  const endpointSummaries = results.map((item) => ({ key: item.key, path: item.path, ok: item.ok, error: item.ok ? null : item.error, keySummary: item.ok ? null : item.error?.message || null }));
  const useful = Object.keys(stats.stats || {}).length > 0 || events.length > 0 || shotmap.length > 0 || playerStats.length > 0 || Boolean(normalized.lineups) || Boolean(normalized.matchInfo?.venue || normalized.matchInfo?.referee);
  const rateLimited = results.some((item) => Number(item.error?.status) === 429);

  return {
    ok: useful,
    matchId: match.id,
    endpointMode: 'safe-no-heatmaps',
    resolvedProviderMatchId: resolved.id,
    resolvedBy: resolved.by,
    rateLimited,
    endpointsOk: results.filter((item) => item.ok).map((item) => item.key),
    endpointsFailed: results.filter((item) => !item.ok).map((item) => ({ key: item.key, status: item.error?.status, code: item.error?.code, message: item.error?.message })),
    counts: { stats: Object.keys(stats.stats || {}).length, detailedEvents: events.length, shots: shotmap.length, playerStats: playerStats.length, lineups: normalized.lineups ? 1 : 0 },
    matchInfo: normalized.matchInfo,
    debug: { endpointSummaries, normalizedPreview: normalized, endpoints: options.includeRaw ? Object.fromEntries(results.map((item) => [item.key, item])) : undefined },
  };
}

function countsFrom(normalized: any) {
  const stats = normalized?.liveStats?.stats || normalized?.stats || {};
  const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
  const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
  const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  const playerRatings = players.filter((p: any) => p?.rating !== null && p?.rating !== undefined && p?.rating !== '').length;
  return { stats: Object.keys(stats).length, events: events.length, shots: shots.length, players: players.length, playerRatings, lineups: normalized?.lineups ? 1 : 0 };
}

function existingCounts(snapshot: any) { return countsFrom(snapshot?.rawData?.normalized || {}); }
function completeEnough(snapshot: any, requireEvents: boolean) {
  if (!snapshot) return false;
  const c = existingCounts(snapshot);
  const hasColumnStats = [snapshot.homePossession, snapshot.homeShots, snapshot.homeShotsOnTarget].some((v) => v !== null && v !== undefined);
  return Boolean((c.stats > 0 || hasColumnStats) && c.players > 0 && (!requireEvents || c.events > 0));
}

function statPair(stats: any, key: string) {
  const value = stats?.[key] || {};
  return { home: num(value.home), away: num(value.away) };
}

function columns(normalized: any) {
  const stats = normalized?.liveStats?.stats || normalized?.stats || {};
  const possession = statPair(stats, 'possession');
  const shots = statPair(stats, 'shots');
  const onTarget = statPair(stats, 'shotsOnTarget');
  const offTarget = statPair(stats, 'shotsOffTarget');
  const corners = statPair(stats, 'corners');
  const yellow = statPair(stats, 'yellowCards');
  const red = statPair(stats, 'redCards');
  return {
    homePossession: possession.home, awayPossession: possession.away,
    homeShots: shots.home, awayShots: shots.away,
    homeShotsOnTarget: onTarget.home, awayShotsOnTarget: onTarget.away,
    homeShotsOffTarget: offTarget.home, awayShotsOffTarget: offTarget.away,
    homeCorners: corners.home, awayCorners: corners.away,
    homeYellowCards: yellow.home, awayYellowCards: yellow.away,
    homeRedCards: red.home, awayRedCards: red.away,
  };
}

function endpointsFailed(collected: any) { return Array.isArray(collected?.endpointsFailed) ? collected.endpointsFailed : []; }
function endpointStatus(item: any) { return Number(item?.status ?? item?.error?.status ?? 0) || 0; }
function all404(collected: any) {
  const failed = endpointsFailed(collected);
  return failed.length > 0 && failed.every((item: any) => endpointStatus(item) === 404);
}
function any429(collected: any) {
  return endpointsFailed(collected).some((item: any) => endpointStatus(item) === 429 || /\b429\b|rate.?limit|too many|quota/i.test(String(item?.message || item?.error?.message || '')));
}

async function ensureSkipTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TheStatsBackfillSkip" (
      "matchId" TEXT PRIMARY KEY,
      "reason" TEXT NOT NULL,
      "providerMatchId" TEXT NULL,
      "retryAfter" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => undefined);
}

async function markSkip(matchId: string, reason: string, providerMatchId: string | null, retryAfter: Date) {
  await ensureSkipTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TheStatsBackfillSkip" ("matchId", "reason", "providerMatchId", "retryAfter", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT ("matchId") DO UPDATE SET "reason" = EXCLUDED."reason", "providerMatchId" = EXCLUDED."providerMatchId", "retryAfter" = EXCLUDED."retryAfter", "updatedAt" = NOW()`,
    matchId,
    reason.slice(0, 500),
    providerMatchId,
    retryAfter,
  ).catch(() => undefined);
}

async function activeSkips() {
  await ensureSkipTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT "matchId", "reason", "providerMatchId", "retryAfter" FROM "TheStatsBackfillSkip" WHERE "retryAfter" > NOW()`).catch(() => []);
  return new Map(rows.map((row) => [row.matchId, row]));
}

async function deleteOldTheStats(matchId: string) {
  const snapshots = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId, provider: { startsWith: 'THE_STATS_API' } } });
  const events = await prisma.matchEvent.deleteMany({ where: { matchId, OR: [{ sourceName: { startsWith: 'THE_STATS_API' } }, { sourceName: { contains: 'TheStats' } }, { sourceName: { contains: 'THE_STATS' } }] } });
  return { snapshots: snapshots.count, events: events.count };
}

async function saveSnapshot(match: any, collected: any, includeRaw: boolean) {
  const normalized = collected?.debug?.normalizedPreview || {};
  const deleted = await deleteOldTheStats(match.id);
  const snapshot = await prisma.matchStatsSnapshot.create({
    data: {
      id: randomUUID(),
      matchId: match.id,
      provider: 'THE_STATS_API_EXTRAS',
      providerMatchId: numberId(collected?.resolvedProviderMatchId),
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      ...columns(normalized),
      rawData: {
        provider: 'THE_STATS_API',
        mode: 'safe_backfill_snapshot_only_no_heatmaps_v4',
        importedAt: new Date().toISOString(),
        resolvedProviderMatchId: collected?.resolvedProviderMatchId,
        resolvedBy: collected?.resolvedBy,
        noDuplicatePolicy: { storage: 'snapshot-only', matchEventsWritten: false, deletedOldTheStatsMatchEvents: true },
        safetyPolicy: { heatmaps: 'disabled', reason: 'avoid long web requests and Render 502' },
        counts: countsFrom(normalized),
        normalized,
        ...(includeRaw && collected?.debug?.endpoints ? { raw: collected.debug.endpoints } : {}),
      },
    },
    select: { id: true },
  });
  return { snapshotId: snapshot.id, counts: countsFrom(normalized), deleted };
}

async function loadCandidates(options: { from: string; to: string; limit: number; requireEvents: boolean; skip404: boolean }) {
  const skipMap = options.skip404 ? await activeSkips() : new Map();
  const matches = await prisma.match.findMany({
    where: { status: { in: FINISHED }, matchDate: { gte: new Date(`${options.from}T00:00:00.000Z`), lte: new Date(`${options.to}T23:59:59.999Z`) } },
    orderBy: { matchDate: 'asc' },
    take: 160,
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: { where: { provider: { startsWith: 'THE_STATS_API' } }, orderBy: { capturedAt: 'desc' }, take: 1, select: { id: true, homePossession: true, homeShots: true, homeShotsOnTarget: true, rawData: true } },
    },
  });

  const skippedActive: any[] = [];
  const candidates = [];
  for (const match of matches) {
    if (completeEnough(match.statsSnapshots[0], options.requireEvents)) continue;
    const skipped = skipMap.get(match.id);
    if (skipped) {
      skippedActive.push({ matchId: match.id, teams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, reason: skipped.reason, retryAfter: skipped.retryAfter });
      continue;
    }
    candidates.push(match);
    if (candidates.length >= options.limit) break;
  }
  return { candidates, skippedActive };
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);
  const url = new URL(req.url);
  const startedAt = Date.now();
  const from = dateParam(url, 'from', process.env.WORLD_CUP_TOURNAMENT_START_DATE || '2026-06-14');
  const to = dateParam(url, 'to', todayIso());
  const limit = intParam(url, 'limit', 1, 1, 1);
  const requestsPerMinute = intParam(url, 'requestsPerMinute', 60, 20, 60);
  const delayMs = Math.max(intParam(url, 'delayMs', 1000, 0, 5000), Math.ceil(60000 / requestsPerMinute));
  const betweenMatchesDelayMs = intParam(url, 'betweenMatchesDelayMs', 0, 0, 5000);
  const timeoutMs = intParam(url, 'timeoutMs', 8000, 3000, 15000);
  const includeRaw = boolParam(url, 'includeRaw', false);
  const requireEvents = boolParam(url, 'requireEvents', false);
  const dryRun = boolParam(url, 'dryRun', false);
  const skip404 = boolParam(url, 'skip404', true);
  const skipHours = intParam(url, 'skipHours', 12, 1, 72);
  const stopOn429 = boolParam(url, 'stopOn429', true);

  const providerParams = new URLSearchParams(url.searchParams);
  providerParams.set('date_from', from);
  providerParams.set('date_to', to);
  const providerQuery = defaultTheStatsQuery(providerParams);
  const { candidates, skippedActive } = await loadCandidates({ from, to, limit, requireEvents, skip404 });
  const processed: any[] = [];
  let stoppedEarly: any = null;
  let estimatedProviderRequests = 0;

  for (const match of candidates) {
    const teams = `${match.homeTeam?.name || match.homeTeamId} vs ${match.awayTeam?.name || match.awayTeamId}`;
    if (dryRun) { processed.push({ matchId: match.id, teams, status: 'dry_run_candidate' }); continue; }
    const collected = await collectSafeTheStatsMatchExtras(match, { includeRaw, timeoutMs, delayMs, query: providerQuery });
    estimatedProviderRequests += 6;

    if (!collected.ok) {
      if (skip404 && all404(collected)) {
        const retryAfter = new Date(Date.now() + skipHours * 36e5);
        await markSkip(match.id, 'all details endpoints returned 404', (collected as any)?.resolvedProviderMatchId || null, retryAfter);
        processed.push({ matchId: match.id, teams, status: 'skipped_404_temporarily', retryAfter, endpointsFailed: endpointsFailed(collected) });
        if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
        continue;
      }

      if (stopOn429 && any429(collected)) {
        processed.push({ matchId: match.id, teams, status: 'rate_limited_stop', error: collected.error, endpointsFailed: endpointsFailed(collected) });
        stoppedEarly = { reason: '429 from TheStats', matchId: match.id, teams };
        break;
      }

      processed.push({ matchId: match.id, teams, status: 'failed_collect', error: collected.error || 'no useful data', resolved: collected.resolved || null, endpointsFailed: endpointsFailed(collected) });
      if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
      continue;
    }

    const normalized = (collected as any)?.debug?.normalizedPreview || {};
    const counts = countsFrom(normalized);
    if (requireEvents && counts.events <= 0) {
      processed.push({ matchId: match.id, teams, status: 'skipped_no_events_from_source', providerMatchId: (collected as any).resolvedProviderMatchId, counts });
      if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
      continue;
    }
    const saved = await saveSnapshot(match, collected, includeRaw);
    processed.push({ matchId: match.id, teams, status: 'saved_snapshot_only_no_duplicate_events', providerMatchId: (collected as any).resolvedProviderMatchId, resolvedBy: (collected as any).resolvedBy, snapshotId: saved.snapshotId, counts: saved.counts, deleted: saved.deleted });
    if (betweenMatchesDelayMs) await sleep(betweenMatchesDelayMs);
  }

  const savedCount = processed.filter((item) => item.status === 'saved_snapshot_only_no_duplicate_events').length;
  const revalidation = savedCount > 0 ? revalidateStatsViews('the-stats-safe-backfill') : null;

  return json({
    ok: true,
    mode: 'the_stats_backfill_finals_safe_v4_single_match_no_heatmaps_cached_stats',
    durationMs: Date.now() - startedAt,
    dryRun,
    stoppedEarly,
    scope: { from, to, limit, selected: candidates.length, requireEvents, skip404, skipHours },
    rateLimit: { requestsPerMinute, delayMs, betweenMatchesDelayMs, estimatedProviderRequests, stopOn429, heatmaps: 'disabled' },
    noDuplicatePolicy: { writeMatchEvents: false, storage: 'THE_STATS_API_EXTRAS snapshot only', deletesOldTheStatsMatchEventRows: true },
    cache: { revalidated: Boolean(revalidation), revalidation },
    skippedActive,
    processed,
    nextRunHint: stoppedEarly ? 'Wait 10-20 minutes, then run again with limit=1.' : 'Run again to process the next match. Heatmaps are intentionally disabled on this safe web route to avoid Render 502.',
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
