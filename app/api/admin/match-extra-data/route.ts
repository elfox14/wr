import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { defaultTheStatsQuery, resolveTheStatsProviderId } from '@/lib/theStatsMatchExtras';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type EndpointKey = 'matchInfo' | 'stats' | 'timeline' | 'lineups' | 'shotmap' | 'playerStats';
type FetchResult = { key: EndpointKey; path: string; ok: boolean; payload?: any; error?: any };

const PHASES: Record<string, EndpointKey[]> = {
  summary: ['matchInfo', 'stats'],
  timeline: ['timeline'],
  lineups: ['lineups'],
  players: ['playerStats'],
  shotmap: ['shotmap'],
  visual: ['shotmap', 'lineups'],
  all: ['matchInfo', 'stats', 'timeline', 'lineups', 'shotmap', 'playerStats'],
};
const AUTO_PHASES = ['summary', 'lineups', 'players', 'shotmap', 'timeline'];

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
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (value && typeof value === 'object') {
      const nested = str(value.name, value.fullName, value.full_name, value.displayName, value.display_name, value.title, value.label);
      if (nested) return nested;
    }
  }
  return null;
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
  const home = n(all.home ?? all.home_team ?? all.homeTeam ?? all.home_team_value);
  const away = n(all.away ?? all.away_team ?? all.awayTeam ?? all.away_team_value);
  return home === null && away === null ? null : { home, away };
}
function pickStats(stats: Record<string, any>, entries: Array<[string, any]>) {
  for (const [key, value] of entries) {
    const p = pair(value);
    if (p) stats[key] = p;
  }
}
function compactMatchStats(payload: any) {
  const data = dataOf(payload);
  const overview = data.overview || data.stats || {};
  const shots = data.shots || {};
  const attack = data.attack || {};
  const passes = data.passes || {};
  const defending = data.defending || {};
  const goalkeeping = data.goalkeeping || {};
  const out: Record<string, any> = {};
  pickStats(out, [
    ['possession', overview.ball_possession || overview.possession],
    ['xg', overview.expected_goals || data.expected_goals],
    ['npxg', data.np_expected_goals || data.non_penalty_expected_goals],
    ['bigChances', overview.big_chances],
    ['shots', overview.total_shots || shots.total_shots],
    ['shotsOnTarget', overview.shots_on_target || shots.shots_on_target],
    ['shotsOffTarget', overview.shots_off_target || shots.shots_off_target],
    ['corners', overview.corner_kicks || overview.corners],
    ['fouls', overview.fouls],
    ['offsides', overview.offsides || attack.offsides],
    ['yellowCards', overview.yellow_cards],
    ['redCards', overview.red_cards],
    ['passes', overview.passes || passes.total_passes],
    ['accuratePasses', overview.accurate_passes || passes.accurate_passes],
    ['tackles', overview.tackles || defending.tackles],
    ['goalkeeperSaves', overview.goalkeeper_saves || goalkeeping.saves],
  ]);
  return { meta: { source: 'match-stats' }, stats: out };
}
function compactShot(row: any) {
  const player = row?.player || row?.athlete || row?.shooter || row?.scorer || {};
  const team = row?.team || row?.side || {};
  const outcome = str(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type);
  return {
    id: str(row?.id, row?.shot_id, row?.event_id),
    minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute),
    playerId: str(player?.id, row?.player_id, row?.playerId),
    playerName: str(player?.name, row?.player_name, row?.playerName, row?.shooter_name),
    teamId: str(team?.id, row?.team_id, row?.teamId),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    x: n(row?.x ?? row?.pitchX ?? row?.location?.x ?? row?.coordinates?.x ?? row?.position?.x ?? row?.shot?.x),
    y: n(row?.y ?? row?.pitchY ?? row?.location?.y ?? row?.coordinates?.y ?? row?.position?.y ?? row?.shot?.y),
    xg: n(row?.xg ?? row?.expected_goals ?? row?.expectedGoals ?? row?.shot?.xg),
    npxg: n(row?.npxg ?? row?.non_penalty_xg ?? row?.nonPenaltyXg ?? row?.shot?.npxg),
    outcome,
    situation: str(row?.situation, row?.play_pattern, row?.playPattern),
    bodyPart: str(row?.body_part, row?.bodyPart, row?.shot?.body_part, row?.shot?.bodyPart),
    isOnTarget: /on target|saved|goal/i.test(String(outcome || '')) || Boolean(row?.on_target ?? row?.is_on_target),
    isGoal: Boolean(row?.is_goal) || /goal|scored/i.test(String(outcome || row?.type || '')),
    isBlocked: Boolean(row?.is_blocked_shot ?? row?.blocked),
    isPenalty: /penalty/i.test(String(row?.type || row?.situation || row?.playPattern || '')) || Boolean(row?.is_penalty),
  };
}
function compactEvent(row: any) {
  const player = row?.player || row?.athlete || row?.scorer || {};
  const team = row?.team || {};
  const playerIn = row?.player_in || row?.playerIn || row?.sub_in || row?.subIn || row?.incoming || {};
  const playerOut = row?.player_out || row?.playerOut || row?.sub_out || row?.subOut || row?.outgoing || {};
  return {
    sequence: n(row?.sequence ?? row?.order ?? row?.index),
    period: str(row?.period, row?.half),
    type: str(row?.type, row?.event_type, row?.incident_type, row?.name) || 'event',
    minute: n(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute),
    extraTime: n(row?.extra_time ?? row?.time?.extra ?? row?.stoppage_time),
    teamId: str(team?.id, row?.team_id, row?.teamId),
    teamName: str(team?.name, row?.team_name, row?.teamName),
    playerId: str(player?.id, row?.player_id, row?.playerId),
    playerName: str(player?.name, row?.player_name, row?.playerName, row?.scorer?.name),
    playerIn: str(playerIn?.name, row?.player_in_name, row?.playerInName),
    playerOut: str(playerOut?.name, row?.player_out_name, row?.playerOutName),
    reason: str(row?.reason, row?.card_reason, row?.description, row?.comment, row?.text),
    outcome: str(row?.outcome, row?.result, row?.decision),
    detail: str(row?.detail, row?.description, row?.comment, row?.text, row?.message),
  };
}
function compactPlayerStat(row: any) {
  const passing = row?.passing || {};
  const shooting = row?.shooting || {};
  const defending = row?.defending || {};
  const duels = row?.duels || {};
  const general = row?.general || {};
  const goalkeeping = row?.goalkeeping || {};
  const scoring = row?.scoring || {};
  const team = row?.team || row?.team_info || {};
  return {
    playerId: str(row?.player_id, row?.playerId, row?.id, row?.player?.id),
    playerName: str(row?.player_name, row?.playerName, row?.name, row?.player?.name),
    teamId: str(row?.team_id, row?.teamId, team?.id),
    teamName: str(row?.team_name, row?.teamName, team?.name),
    position: str(row?.position),
    rating: n(row?.rating),
    started: row?.started ?? null,
    played: row?.played ?? null,
    minutes: n(row?.minutes_played ?? row?.minutes),
    goals: n(shooting.goals ?? scoring.goals ?? row?.goals),
    assists: n(passing.assists ?? scoring.assists ?? row?.assists),
    shots: n(shooting.total_shots ?? row?.total_shots),
    shotsOnTarget: n(shooting.shots_on_target ?? row?.shots_on_target),
    passes: n(passing.total_passes ?? row?.total_passes),
    accuratePasses: n(passing.accurate_passes ?? row?.accurate_passes),
    keyPasses: n(passing.key_passes ?? row?.key_passes),
    crosses: n(passing.total_crosses ?? row?.total_crosses),
    tackles: n(defending.tackles ?? row?.tackles),
    interceptions: n(defending.interceptions ?? row?.interceptions),
    clearances: n(defending.clearances ?? row?.clearances),
    foulsCommitted: n(general.fouls ?? row?.fouls),
    foulsWon: n(general.was_fouled ?? row?.was_fouled),
    saves: n(goalkeeping.saves ?? row?.saves),
    expectedGoals: n(shooting.expected_goals ?? shooting.xg),
    expectedAssists: n(shooting.expected_assists ?? passing.expected_assists),
  };
}
function compactMatchInfo(matchInfoPayload: any, statsPayload: any, shotmapPayload: any) {
  const data = dataOf(matchInfoPayload);
  const statsData = dataOf(statsPayload);
  const shotmap = shotmapPayload || {};
  const venue = data?.venue || data?.fixture?.venue || data?.match?.venue || {};
  const referee = data?.referee || data?.fixture?.referee || data?.match?.referee || {};
  return {
    status: str(data?.status, statsData?.status),
    venue: str(venue?.name, venue),
    city: str(venue?.city, data?.city),
    referee: str(referee?.name, referee),
    finalScore: data?.score?.final_score || data?.score || null,
    xgAvailable: Boolean(data?.xg_available),
    npxgSummary: shotmap?.np_xg_summary || null,
    shotmapFinal: shotmap?.meta?.is_final ?? null,
  };
}
function selectedPhase(raw: string | null) {
  const value = String(raw || 'auto').trim().toLowerCase();
  if (value === 'auto') return AUTO_PHASES[Math.floor(Date.now() / 60_000) % AUTO_PHASES.length];
  return PHASES[value] ? value : 'summary';
}
function endpointPath(key: EndpointKey, id: string) {
  const base = `/api/football/matches/${id}`;
  if (key === 'matchInfo') return base;
  if (key === 'stats') return `${base}/stats`;
  if (key === 'timeline') return `${base}/timeline`;
  if (key === 'lineups') return `${base}/lineups`;
  if (key === 'shotmap') return `${base}/shotmap`;
  return `${base}/player-stats`;
}
async function fetchSafe(key: EndpointKey, path: string, timeoutMs: number): Promise<FetchResult> {
  try { return { key, path, ok: true, payload: await theStatsApiFetch(path, {}, { timeoutMs }) }; }
  catch (error: any) { return { key, path, ok: false, error: safeTheStatsApiError(error) }; }
}
async function fetchStaged(keys: EndpointKey[], id: string, timeoutMs: number, delayMs: number) {
  const out: FetchResult[] = [];
  for (const key of keys) {
    out.push(await fetchSafe(key, endpointPath(key, id), timeoutMs));
    if (delayMs > 0 && key !== keys[keys.length - 1]) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return out;
}
function mergeNormalized(previous: any, patch: any) {
  return {
    ...previous,
    ...patch,
    matchInfo: { ...(previous?.matchInfo || {}), ...(patch.matchInfo || {}) },
    liveStats: patch.liveStats || previous?.liveStats || { meta: {}, stats: {} },
    lineups: patch.lineups !== undefined ? patch.lineups : previous?.lineups || null,
    eventsDetailed: patch.eventsDetailed || previous?.eventsDetailed || { all: [] },
    shotmap: patch.shotmap || previous?.shotmap || [],
    playerStats: patch.playerStats || previous?.playerStats || [],
  };
}
async function previousNormalized(matchId: string) {
  const row = await prisma.matchStatsSnapshot.findFirst({ where: { matchId, provider: 'THE_STATS_API_EXTRAS' }, orderBy: { capturedAt: 'desc' }, select: { rawData: true } }).catch(() => null);
  return (row?.rawData as any)?.normalized || {};
}
async function syncOne(match: any, dryRun: boolean, save: boolean, includeRaw: boolean, timeoutMs: number, query: Record<string, string | number>, phase: string, maxEndpoints: number, delayMs: number) {
  const resolved = await resolveTheStatsProviderId(match, query);
  if (!resolved.id) return { ok: false, matchId: match.id, error: 'Could not resolve provider match id', resolved };
  const id = encodeURIComponent(String(resolved.id));
  const endpointKeys = (PHASES[phase] || PHASES.summary).slice(0, maxEndpoints);
  const endpoints = await fetchStaged(endpointKeys, id, timeoutMs, delayMs);
  const byKey: Record<string, FetchResult> = Object.fromEntries(endpoints.map((item) => [item.key, item]));
  const prev = await previousNormalized(match.id);
  const stats = byKey.stats?.ok ? compactMatchStats(byKey.stats.payload) : null;
  const timelineRows = byKey.timeline?.ok ? listFrom(byKey.timeline.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']) : [];
  const shotRows = byKey.shotmap?.ok ? listFrom(byKey.shotmap.payload, ['data', 'shotmap', 'shots', 'events', 'items', 'results']) : [];
  const playerRows = byKey.playerStats?.ok ? listFrom(byKey.playerStats.payload, ['data', 'players', 'player_stats', 'items', 'results']) : [];
  const patch: Record<string, any> = {};
  if (byKey.matchInfo?.ok || byKey.stats?.ok || byKey.shotmap?.ok) patch.matchInfo = compactMatchInfo(byKey.matchInfo?.payload, byKey.stats?.payload, byKey.shotmap?.payload);
  if (stats) patch.liveStats = stats;
  if (byKey.lineups?.ok) patch.lineups = dataOf(byKey.lineups.payload);
  if (byKey.timeline?.ok) patch.eventsDetailed = { all: timelineRows.map(compactEvent) };
  if (byKey.shotmap?.ok) patch.shotmap = shotRows.map(compactShot);
  if (byKey.playerStats?.ok) patch.playerStats = playerRows.map(compactPlayerStat);
  const normalized = mergeNormalized(prev, patch);
  let snapshotId: string | null = null;
  if (!dryRun && save) {
    const rawData: Record<string, any> = { provider: 'THE_STATS_API', mode: 'match_extra_data_staged', phase, requestedEndpoints: endpointKeys, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, importedAt: new Date().toISOString(), endpoints: endpoints.map((item) => ({ key: item.key, path: item.path, ok: item.ok, error: item.ok ? null : item.error })), normalized };
    if (includeRaw) rawData.raw = Object.fromEntries(endpoints.filter((item) => item.ok).map((item) => [item.key, item.payload]));
    const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: 'THE_STATS_API_EXTRAS', providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0, rawData }, select: { id: true } });
    snapshotId = snapshot.id;
  }
  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, phase, requestedEndpoints: endpointKeys, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, endpointsOk: endpoints.filter((item) => item.ok).map((item) => item.key), endpointsFailed: endpoints.filter((item) => !item.ok).map((item) => ({ key: item.key, status: item.error?.status, code: item.error?.code, message: item.error?.message })), counts: { stats: Object.keys(normalized.liveStats?.stats || {}).length, shots: (normalized.shotmap || []).length, detailedEvents: (normalized.eventsDetailed?.all || []).length, playerStats: (normalized.playerStats || []).length, lineups: normalized.lineups ? 1 : 0 }, matchInfo: normalized.matchInfo, saved: Boolean(snapshotId), snapshotId, normalizedPreview: normalized };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || url.searchParams.get('dbMatchId') || url.searchParams.get('id') || '';
  const dryRun = bool(url.searchParams.get('dryRun'), false);
  const save = bool(url.searchParams.get('save'), true);
  const includeRaw = bool(url.searchParams.get('includeRaw'), false);
  const timeoutMs = int(url.searchParams.get('timeoutMs'), 12000, 3000, 60000);
  const limit = int(url.searchParams.get('limit'), 4, 1, 12);
  const minutesBack = int(url.searchParams.get('minutesBack'), 240, 15, 720);
  const minutesForward = int(url.searchParams.get('minutesForward'), 180, 0, 720);
  const maxEndpoints = int(url.searchParams.get('maxEndpoints'), 2, 1, 6);
  const endpointDelayMs = int(url.searchParams.get('endpointDelayMs'), 350, 0, 3000);
  const phase = selectedPhase(url.searchParams.get('phase'));
  const now = Date.now();
  const query = defaultTheStatsQuery(url.searchParams);

  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { matchDate: { gte: new Date(now - minutesBack * 60_000), lte: new Date(now + minutesForward * 60_000) } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' }, take: limit });
    const results = [];
    for (const match of matches) {
      try { results.push(await syncOne(match, dryRun, save, includeRaw, timeoutMs, query, phase, maxEndpoints, endpointDelayMs)); }
      catch (error: any) { results.push({ ok: false, matchId: match.id, error: safeTheStatsApiError(error) }); }
    }
    const successful = results.filter((item: any) => item.ok);
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'match_extra_data_staged', phase, maxEndpoints, endpointDelayMs, dryRun, saved: !dryRun && save, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, snapshotsSaved: successful.filter((item: any) => item.saved).length, results, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'match_extra_data_staged', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}

export async function POST(req: Request) { return GET(req); }
