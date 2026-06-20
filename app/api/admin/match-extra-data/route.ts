import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { defaultTheStatsQuery, resolveTheStatsProviderId } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function n(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}
function str(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return String(value).trim();
  return null;
}
async function fetchSafe(key: string, path: string, timeoutMs: number) {
  try { return { key, path, ok: true, payload: await theStatsApiFetch(path, {}, { timeoutMs }) }; }
  catch (error: any) { return { key, path, ok: false, error: safeTheStatsApiError(error) }; }
}
function dataOf(payload: any) { return payload?.data || payload?.response || payload?.result || payload || {}; }
function listFrom(payload: any, fields: string[]) {
  if (Array.isArray(payload)) return payload;
  const data = dataOf(payload);
  for (const field of fields) if (Array.isArray(data?.[field])) return data[field];
  for (const field of fields) if (Array.isArray(payload?.[field])) return payload[field];
  return [];
}
function pair(value: any) {
  const all = value?.all || value || {};
  const home = n(all.home ?? all.home_team ?? all.homeTeam);
  const away = n(all.away ?? all.away_team ?? all.awayTeam);
  return home === null && away === null ? null : { home, away };
}
function compactLiveStats(payload: any) {
  const data = dataOf(payload);
  const stats = data?.stats || {};
  const out: Record<string, any> = {};
  const map: Record<string, any> = {
    possession: stats.ball_possession,
    shots: stats.total_shots,
    shotsOnTarget: stats.shots_on_target,
    shotsOffTarget: stats.shots_off_target,
    corners: stats.corner_kicks,
    xg: stats.expected_goals,
    fouls: stats.fouls,
    offsides: stats.offsides,
    yellowCards: stats.yellow_cards,
    redCards: stats.red_cards,
    bigChances: stats.big_chances,
    goalkeeperSaves: stats.goalkeeper_saves,
  };
  for (const [key, value] of Object.entries(map)) {
    const p = pair(value);
    if (p) out[key] = p;
  }
  return { meta: data?.meta || {}, stats: out };
}
function compactShot(row: any) {
  const player = row?.player || row?.athlete || row?.shooter || row?.scorer || {};
  const team = row?.team || row?.side || {};
  const outcome = str(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type);
  return {
    minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute),
    playerName: str(player?.name, row?.player_name, row?.playerName, row?.shooter_name),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    x: n(row?.x ?? row?.pitchX ?? row?.location?.x ?? row?.coordinates?.x ?? row?.position?.x ?? row?.shot?.x),
    y: n(row?.y ?? row?.pitchY ?? row?.location?.y ?? row?.coordinates?.y ?? row?.position?.y ?? row?.shot?.y),
    xg: n(row?.xg ?? row?.expected_goals ?? row?.expectedGoals ?? row?.shot?.xg),
    npxg: n(row?.npxg ?? row?.non_penalty_xg ?? row?.nonPenaltyXg ?? row?.shot?.npxg),
    outcome,
    bodyPart: str(row?.body_part, row?.bodyPart, row?.shot?.body_part, row?.shot?.bodyPart),
    isOnTarget: /on target|saved|goal/i.test(String(outcome || '')) || Boolean(row?.on_target ?? row?.is_on_target),
    isGoal: /goal|scored/i.test(String(outcome || row?.type || '')),
    isPenalty: /penalty/i.test(String(row?.type || row?.situation || row?.playPattern || '')) || Boolean(row?.is_penalty),
  };
}
function compactEvent(row: any) {
  const player = row?.player || row?.athlete || row?.scorer || {};
  const team = row?.team || {};
  const playerIn = row?.player_in || row?.playerIn || row?.sub_in || row?.subIn || row?.incoming || {};
  const playerOut = row?.player_out || row?.playerOut || row?.sub_out || row?.subOut || row?.outgoing || {};
  return {
    type: str(row?.type, row?.event_type, row?.incident_type, row?.name) || 'event',
    minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    playerName: str(player?.name, row?.player_name, row?.playerName, row?.scorer?.name),
    playerIn: str(playerIn?.name, row?.player_in_name, row?.playerInName),
    playerOut: str(playerOut?.name, row?.player_out_name, row?.playerOutName),
    reason: str(row?.reason, row?.card_reason, row?.description, row?.comment, row?.text),
    outcome: str(row?.outcome, row?.result, row?.decision),
    detail: str(row?.detail, row?.description, row?.comment, row?.text, row?.message),
  };
}
function compactMatchInfo(matchInfoPayload: any, liveStatsPayload: any, shotmapPayload: any) {
  const data = dataOf(matchInfoPayload);
  const live = dataOf(liveStatsPayload);
  const shotmap = shotmapPayload || {};
  const venue = data?.venue || data?.fixture?.venue || data?.match?.venue || {};
  const referee = data?.referee || data?.fixture?.referee || data?.match?.referee || {};
  return {
    status: str(data?.status, live?.meta?.match_status),
    venue: str(venue?.name, venue),
    city: str(venue?.city, data?.city),
    referee: str(referee?.name, referee),
    score: data?.score || null,
    xgAvailable: Boolean(data?.xg_available),
    npxgSummary: shotmap?.np_xg_summary || null,
    shotmapFinal: shotmap?.meta?.is_final ?? null,
  };
}
async function syncOne(match: any, dryRun: boolean, save: boolean, includeRaw: boolean, timeoutMs: number, query: Record<string, string | number>) {
  const resolved = await resolveTheStatsProviderId(match, query);
  if (!resolved.id) return { ok: false, matchId: match.id, error: 'Could not resolve provider match id', resolved };
  const id = encodeURIComponent(String(resolved.id));
  const endpoints = await Promise.all([
    fetchSafe('matchInfo', `/api/football/matches/${id}`, timeoutMs),
    fetchSafe('timeline', `/api/football/matches/${id}/timeline`, timeoutMs),
    fetchSafe('liveStats', `/api/football/matches/${id}/live-stats`, timeoutMs),
    fetchSafe('lineups', `/api/football/matches/${id}/lineups`, timeoutMs),
    fetchSafe('shotmap', `/api/football/matches/${id}/shotmap`, timeoutMs),
  ]);
  const byKey: Record<string, any> = Object.fromEntries(endpoints.map((item) => [item.key, item]));
  const liveStats = byKey.liveStats?.ok ? compactLiveStats(byKey.liveStats.payload) : { meta: {}, stats: {} };
  const timelineRows = byKey.timeline?.ok ? listFrom(byKey.timeline.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']) : [];
  const shotRows = byKey.shotmap?.ok ? listFrom(byKey.shotmap.payload, ['data', 'shotmap', 'shots', 'events', 'items', 'results']) : [];
  const normalized = {
    matchInfo: compactMatchInfo(byKey.matchInfo?.payload, byKey.liveStats?.payload, byKey.shotmap?.payload),
    liveStats,
    lineups: byKey.lineups?.ok ? dataOf(byKey.lineups.payload) : null,
    eventsDetailed: { all: timelineRows.map(compactEvent) },
    shotmap: shotRows.map(compactShot),
  };
  let snapshotId: string | null = null;
  if (!dryRun && save) {
    const rawData: Record<string, any> = { provider: 'THE_STATS_API', mode: 'match_extra_data_safe', resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, importedAt: new Date().toISOString(), endpoints: endpoints.map((item) => ({ key: item.key, path: item.path, ok: item.ok, error: item.ok ? null : item.error })), normalized };
    if (includeRaw) rawData.raw = Object.fromEntries(endpoints.filter((item) => item.ok).map((item) => [item.key, item.payload]));
    const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: 'THE_STATS_API_EXTRAS', providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0, rawData }, select: { id: true } });
    snapshotId = snapshot.id;
  }
  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, endpointsOk: endpoints.filter((item) => item.ok).map((item) => item.key), endpointsFailed: endpoints.filter((item) => !item.ok).map((item) => ({ key: item.key, status: item.error?.status, code: item.error?.code, message: item.error?.message })), counts: { liveStats: Object.keys(liveStats.stats || {}).length, shots: normalized.shotmap.length, detailedEvents: normalized.eventsDetailed.all.length }, matchInfo: normalized.matchInfo, saved: Boolean(snapshotId), snapshotId, normalizedPreview: normalized };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const save = bool(url.searchParams.get('save'), true);
  const includeRaw = bool(url.searchParams.get('includeRaw'), false);
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 15000, 3000, 60000);
  const limit = int(url.searchParams.get('limit'), 4, 1, 12);
  const minutesBack = int(url.searchParams.get('minutesBack'), 240, 15, 720);
  const minutesForward = int(url.searchParams.get('minutesForward'), 180, 0, 720);
  const now = Date.now();
  const query = defaultTheStatsQuery(url.searchParams);

  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' }, take: limit });

    const results = [];
    for (const match of matches) {
      try { results.push(await syncOne(match, dryRun, save, includeRaw, timeoutMs, query)); }
      catch (error: any) { results.push({ ok: false, matchId: match.id, error: safeTheStatsApiError(error) }); }
    }

    const successful = results.filter((item: any) => item.ok);
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'match_extra_data_safe', dryRun, saved: !dryRun && save, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, snapshotsSaved: successful.filter((item: any) => item.saved).length, results, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_extra_data_safe', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
