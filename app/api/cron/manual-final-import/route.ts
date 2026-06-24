import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { theStatsApiFetch } from '@/lib/theStatsApi';
import { runLiveAnimationSync } from '@/lib/liveAnimationSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanProviderId(value: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('mt_')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `mt_${digits}` : null;
}

function idNumber(value: string) {
  const n = Number(value.replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function dataOf(payload: any) {
  return payload?.data || payload?.response || payload?.result || payload || {};
}

function listFrom(payload: any, fields: string[]) {
  if (Array.isArray(payload)) return payload;
  const data = dataOf(payload);
  if (Array.isArray(data)) return data;
  for (const field of fields) if (Array.isArray(data?.[field])) return data[field];
  for (const field of fields) if (Array.isArray(payload?.[field])) return payload[field];
  return [];
}

function text(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const out = String(value).trim();
      if (out && out !== '[object Object]') return out;
    }
    if (value && typeof value === 'object') {
      const out = text(value.name, value.fullName, value.full_name, value.title, value.label, value.display_name, value.displayName);
      if (out) return out;
    }
  }
  return null;
}

function pair(value: any) {
  const all = value?.all || value || {};
  const home = asNumber(all.home ?? all.home_team ?? all.homeTeam ?? all.home_team_value);
  const away = asNumber(all.away ?? all.away_team ?? all.awayTeam ?? all.away_team_value);
  return home === null && away === null ? null : { home, away };
}

function compactStats(payload: any) {
  const data = dataOf(payload);
  const overview = data.overview || data.stats || {};
  const shots = data.shots || {};
  const attack = data.attack || {};
  const defending = data.defending || {};
  const out: Record<string, any> = {};
  const entries: Record<string, any> = {
    possession: overview.ball_possession || overview.possession,
    xg: overview.expected_goals || data.expected_goals,
    shots: overview.total_shots || shots.total_shots,
    shotsOnTarget: overview.shots_on_target || shots.shots_on_target,
    shotsOffTarget: overview.shots_off_target || shots.shots_off_target,
    corners: overview.corner_kicks || overview.corners,
    fouls: overview.fouls,
    offsides: overview.offsides || attack.offsides,
    yellowCards: overview.yellow_cards,
    redCards: overview.red_cards,
    passes: overview.passes,
    accuratePasses: overview.accurate_passes,
    tackles: overview.tackles,
    saves: overview.goalkeeper_saves,
    interceptions: defending.interceptions,
    clearances: defending.clearances,
  };
  for (const [key, value] of Object.entries(entries)) {
    const parsed = pair(value);
    if (parsed) out[key] = parsed;
  }
  return out;
}

function normalizeEventType(value: unknown) {
  const s = String(value || '').toLowerCase();
  if (s.includes('goal')) return 'goal';
  if (s.includes('yellow')) return 'yellow_card';
  if (s.includes('red')) return 'red_card';
  if (s.includes('sub')) return 'substitution';
  if (s.includes('corner')) return 'corner';
  if (s.includes('shot')) return 'shot';
  if (s.includes('penalty')) return 'penalty';
  return text(value) || 'event';
}

function compactEvent(row: any) {
  const team = row?.team || {};
  const player = row?.player || row?.athlete || row?.scorer || {};
  return {
    type: normalizeEventType(text(row?.type, row?.event_type, row?.incident_type, row?.name)),
    minute: asNumber(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute),
    providerTeamId: text(team?.id, row?.team_id, row?.teamId),
    teamName: text(team?.name, row?.team_name, row?.teamName),
    playerId: text(player?.id, row?.player_id, row?.playerId),
    playerName: text(player?.name, row?.player_name, row?.playerName, row?.scorer?.name),
    detail: text(row?.detail, row?.description, row?.comment, row?.text, row?.message),
  };
}

function compactShot(row: any) {
  const player = row?.player || row?.athlete || row?.shooter || {};
  const team = row?.team || {};
  const outcome = text(row?.outcome, row?.result, row?.shot_outcome, row?.status, row?.type);
  return {
    minute: asNumber(row?.minute ?? row?.time?.minute ?? row?.elapsed),
    playerName: text(player?.name, row?.player_name, row?.playerName),
    teamName: text(team?.name, row?.team_name, row?.teamName),
    xg: asNumber(row?.xg ?? row?.expected_goals ?? row?.expectedGoals),
    outcome,
    isGoal: /goal|scored/i.test(String(outcome || row?.type || '')),
  };
}

function compactPlayerStat(row: any) {
  const player = row?.player || row?.athlete || row;
  const team = row?.team || {};
  const stats = row?.stats || row?.statistics || row;
  const shooting = row?.shooting || stats?.shooting || {};
  const passing = row?.passing || stats?.passing || {};
  return {
    playerId: text(player?.id, row?.player_id, row?.playerId, row?.id),
    playerName: text(player?.name, row?.player_name, row?.playerName, row?.name),
    teamName: text(team?.name, row?.team_name, row?.teamName),
    position: text(player?.position, row?.position),
    rating: asNumber(stats?.rating ?? row?.rating),
    minutes: asNumber(stats?.minutes ?? stats?.minutes_played ?? row?.minutes),
    goals: asNumber(shooting?.goals ?? stats?.goals ?? row?.goals),
    assists: asNumber(passing?.assists ?? stats?.assists ?? row?.assists),
    shots: asNumber(shooting?.total_shots ?? stats?.shots ?? row?.shots),
    shotsOnTarget: asNumber(shooting?.shots_on_target ?? stats?.shots_on_target ?? row?.shots_on_target),
    passes: asNumber(passing?.total_passes ?? stats?.passes ?? row?.passes),
    keyPasses: asNumber(passing?.key_passes ?? stats?.key_passes ?? row?.key_passes),
  };
}

async function fetchEndpoint(key: string, path: string, timeoutMs: number) {
  try {
    const payload = await theStatsApiFetch(path, {}, { timeoutMs });
    return { key, path, ok: true, payload };
  } catch (error: any) {
    return { key, path, ok: false, error: { message: String(error?.message || error), status: error?.status || null, code: error?.code || null } };
  }
}

function teamIdFromName(match: any, teamName: string | null) {
  if (!teamName) return null;
  const lower = teamName.toLowerCase();
  if (lower.includes(String(match.homeTeam?.name || '').toLowerCase()) || lower.includes(String(match.homeTeam?.code || '').toLowerCase())) return match.homeTeamId;
  if (lower.includes(String(match.awayTeam?.name || '').toLowerCase()) || lower.includes(String(match.awayTeam?.code || '').toLowerCase())) return match.awayTeamId;
  return null;
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId');
  const providerMatchId = cleanProviderId(url.searchParams.get('providerMatchId'));
  const dryRun = ['1', 'true', 'yes'].includes(String(url.searchParams.get('dryRun') || '').toLowerCase());
  const includeRaw = ['1', 'true', 'yes'].includes(String(url.searchParams.get('includeRaw') || '').toLowerCase());
  const syncAnimation = !['0', 'false', 'no'].includes(String(url.searchParams.get('syncAnimation') || '').toLowerCase());
  const stopOnRateLimit = !['0', 'false', 'no'].includes(String(url.searchParams.get('stopOnRateLimit') || 'true').toLowerCase());
  const timeoutMs = Math.max(3000, Math.min(60000, Number(url.searchParams.get('timeoutMs') || 30000)));
  const delayMs = Math.max(0, Math.min(10000, Number(url.searchParams.get('delayMs') || 1500)));
  const scope = String(url.searchParams.get('scope') || 'full').toLowerCase();

  if (!matchId || !providerMatchId) {
    return NextResponse.json({ ok: false, error: 'matchId and providerMatchId are required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  if (!match) return NextResponse.json({ ok: false, error: 'match not found', matchId }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const id = encodeURIComponent(providerMatchId);
  const basicEndpoints = [
    ['matchInfo', `/api/football/matches/${id}`],
    ['stats', `/api/football/matches/${id}/stats`],
    ['lineups', `/api/football/matches/${id}/lineups`],
  ];
  const fullEndpoints = [
    ...basicEndpoints,
    ['timeline', `/api/football/matches/${id}/timeline`],
    ['shotmap', `/api/football/matches/${id}/shotmap`],
    ['playerStats', `/api/football/matches/${id}/player-stats`],
  ];
  const selectedEndpoints = scope === 'basic' ? basicEndpoints : fullEndpoints;

  const endpoints: any[] = [];
  let stoppedEarly: string | null = null;
  for (const [key, path] of selectedEndpoints) {
    const result = await fetchEndpoint(String(key), String(path), timeoutMs);
    endpoints.push(result);
    if (!result.ok && Number(result.error?.status) === 429 && stopOnRateLimit) {
      stoppedEarly = 'rate_limited';
      break;
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const byKey: Record<string, any> = Object.fromEntries(endpoints.map((item) => [item.key, item]));
  const stats = byKey.stats?.ok ? compactStats(byKey.stats.payload) : {};
  const events = byKey.timeline?.ok ? listFrom(byKey.timeline.payload, ['timeline', 'events', 'incidents', 'commentary', 'items', 'results']).map(compactEvent) : [];
  const shots = byKey.shotmap?.ok ? listFrom(byKey.shotmap.payload, ['data', 'shotmap', 'shots', 'events', 'items', 'results']).map(compactShot) : [];
  const players = byKey.playerStats?.ok ? listFrom(byKey.playerStats.payload, ['data', 'players', 'player_stats', 'items', 'results']).map(compactPlayerStat) : [];
  const lineups = byKey.lineups?.ok ? dataOf(byKey.lineups.payload) : null;
  const hasUsefulData = Object.keys(stats).length > 0 || Boolean(lineups) || events.length > 0 || shots.length > 0 || players.length > 0;

  let snapshotId: string | null = null;
  let insertedEvents = 0;

  if (!dryRun && hasUsefulData) {
    const snapshot = await prisma.matchStatsSnapshot.create({
      data: {
        id: randomUUID(),
        matchId,
        provider: scope === 'basic' ? 'THE_STATS_API_MANUAL_BASIC' : 'THE_STATS_API_MANUAL_FINAL',
        providerMatchId: idNumber(providerMatchId),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        rawData: {
          providerMatchId,
          scope,
          importedAt: new Date().toISOString(),
          endpoints: endpoints.map((item) => ({ key: item.key, ok: item.ok, error: item.ok ? null : item.error })),
          normalized: { stats, lineups, eventsDetailed: { all: events }, shotmap: shots, playerStats: players },
          raw: includeRaw ? Object.fromEntries(endpoints.filter((item) => item.ok).map((item) => [item.key, item.payload])) : undefined,
        },
      },
      select: { id: true },
    });
    snapshotId = snapshot.id;

    for (const event of events) {
      const exists = await prisma.matchEvent.findFirst({
        where: { matchId, minute: event.minute, type: event.type, playerName: event.playerName, sourceName: 'THE_STATS_API_MANUAL_FINAL' },
        select: { id: true },
      }).catch(() => null);
      if (exists) continue;
      await prisma.matchEvent.create({
        data: {
          id: randomUUID(),
          matchId,
          minute: event.minute,
          type: event.type,
          teamId: teamIdFromName(match, event.teamName),
          playerId: event.playerId,
          playerName: event.playerName,
          detail: event.detail || event.type,
          sourceName: 'THE_STATS_API_MANUAL_FINAL',
        },
      });
      insertedEvents += 1;
    }
  }

  let animationSync: any = null;
  if (!dryRun && hasUsefulData && syncAnimation && events.length > 0) {
    animationSync = await runLiveAnimationSync({ matchId, allowFinished: true, dryRun: false, limit: 1 });
  }

  return NextResponse.json({
    ok: true,
    mode: 'manual_final_import_v2_throttled',
    matchId,
    providerMatchId,
    scope,
    dryRun,
    delayMs,
    stoppedEarly,
    endpointsOk: endpoints.filter((item) => item.ok).map((item) => item.key),
    endpointsFailed: endpoints.filter((item) => !item.ok).map((item) => ({ key: item.key, error: item.error })),
    counts: { stats: Object.keys(stats).length, events: events.length, shots: shots.length, players: players.length, lineups: lineups ? 1 : 0 },
    hasUsefulData,
    snapshotId,
    insertedEvents,
    animationSync: animationSync ? { ok: animationSync.ok, results: animationSync.results } : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
