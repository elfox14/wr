import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizeName } from '@/lib/apiFootball';
import { ensureStatsTable } from '@/lib/live-match-stats';
import {
  blockProviderForHours,
  blockProviderUntil,
  getProviderQuotaBlock,
  isProviderQuotaError,
  recordProviderRequest,
} from '@/lib/provider-quota-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeamAsset = {
  id: string;
  name: string;
  code: string | null;
};

const TEAM_SELECT = {
  id: true,
  name: true,
  code: true,
};

const MATCH_SELECT = {
  id: true,
  externalId: true,
  homeTeamId: true,
  awayTeamId: true,
  matchDate: true,
  status: true,
  homeScore: true,
  awayScore: true,
  groupPhase: true,
  stage: true,
  homeTeam: { select: TEAM_SELECT },
  awayTeam: { select: TEAM_SELECT },
};

function validSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getAuth(req: Request) {
  const valid = validSecrets();
  if (valid.length === 0) return { valid: false, method: 'missing_server_secret' };
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: req.headers.get('x-cron-secret')?.trim() || '' },
    { method: 'x-admin-secret', value: req.headers.get('x-admin-secret')?.trim() || '' },
    { method: 'cronSecret_query', value: url.searchParams.get('cronSecret')?.trim() || '' },
    { method: 'adminSecret_query', value: url.searchParams.get('adminSecret')?.trim() || '' },
    { method: 'key_query', value: url.searchParams.get('key')?.trim() || '' },
  ];
  const match = candidates.find((item) => item.value && valid.includes(item.value));
  return match ? { valid: true, method: match.method } : { valid: false, method: null };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  return dateKey(new Date());
}

function defaultTournamentStartDate() {
  return String(process.env.FOOTBALL_DATA_TOURNAMENT_START_DATE || '2026-06-11').trim();
}

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function safeScore(...values: unknown[]) {
  for (const value of values) {
    const score = n(value);
    if (score !== null) return Math.max(0, Math.min(99, score));
  }
  return null;
}

function extractScore(match: any) {
  const fullTime = match?.score?.fullTime || {};
  const regular = match?.score?.regularTime || {};
  const halfTime = match?.score?.halfTime || {};
  return {
    homeScore: safeScore(fullTime.home, regular.home, halfTime.home),
    awayScore: safeScore(fullTime.away, regular.away, halfTime.away),
  };
}

function inferMinute(status?: string | null, minute?: unknown) {
  const providerMinute = n(minute);
  if (providerMinute !== null) return providerMinute;
  const value = String(status || '').toUpperCase();
  if (value === 'FINISHED' || value === 'FT') return 90;
  if (value === 'PAUSED' || value === 'HT') return 45;
  return null;
}

function normalizeFootballDataStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (['LIVE', 'IN_PLAY', 'PAUSED'].includes(value)) return 'IN_PLAY';
  if (value === 'FINISHED') return 'FINISHED';
  if (['TIMED', 'SCHEDULED'].includes(value)) return 'SCHEDULED';
  if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(value)) return value;
  return value || 'SCHEDULED';
}

function normalizeTeamName(name?: string | null) {
  const value = normalizeName(name || '')
    .replace(/&/g, ' and ')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bnational team\b/g, '')
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (value === 'south korea' || value === 'korea republic' || value === 'republic of korea') return 'korea republic';
  if (value === 'czech republic' || value === 'czechia') return 'czechia';
  if (value === 'united states' || value === 'united states of america') return 'usa';
  return value;
}

function providerTeamCandidates(team: any) {
  return [team?.tla, team?.shortName, team?.name].map(normalizeTeamName).filter(Boolean);
}

function localTeamCandidates(team: any) {
  return [team?.code, team?.name].map(normalizeTeamName).filter(Boolean);
}

function teamMatches(providerTeam: any, localTeam: any) {
  const provider = providerTeamCandidates(providerTeam);
  const local = localTeamCandidates(localTeam);
  return provider.some((name) => local.includes(name)) || local.some((name) => provider.includes(name));
}

function providerErrorText(error: any) {
  return [
    error?.payload?.message,
    error?.payload?.error,
    error?.message,
    typeof error?.payload === 'string' ? error.payload : '',
    JSON.stringify(error?.payload || {}),
  ].filter(Boolean).join(' ');
}

function retryDelayMsFromFootballDataError(error: any) {
  const text = providerErrorText(error).toLowerCase();
  const waitMatch = text.match(/wait\s+(\d+)\s*(second|seconds|sec|s|minute|minutes|min|m|hour|hours|h)\b/);
  if (!waitMatch) return null;

  const amount = Number(waitMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = waitMatch[2];
  if (['second', 'seconds', 'sec', 's'].includes(unit)) return amount * 1000;
  if (['minute', 'minutes', 'min', 'm'].includes(unit)) return amount * 60 * 1000;
  if (['hour', 'hours', 'h'].includes(unit)) return amount * 60 * 60 * 1000;
  return null;
}

async function blockFootballDataAfterError(error: any) {
  const text = providerErrorText(error) || 'football-data quota or rate limit reached';
  const retryDelayMs = retryDelayMsFromFootballDataError(error);

  if (retryDelayMs !== null) {
    const safetyBufferMs = 10 * 1000;
    const blockedUntil = new Date(Date.now() + retryDelayMs + safetyBufferMs);
    return blockProviderUntil('FOOTBALL_DATA', blockedUntil, text.slice(0, 500));
  }

  return blockProviderForHours('FOOTBALL_DATA', 24, text.slice(0, 500));
}

async function footballDataFetch(path: string, params: Record<string, string> = {}) {
  const token = String(process.env.FOOTBALL_DATA_API_TOKEN || process.env.FOOTBALL_DATA_API_KEY || '').trim();
  if (!token) throw Object.assign(new Error('FOOTBALL_DATA_API_TOKEN is missing'), { status: 400, provider: 'FOOTBALL_DATA' });

  const baseUrl = String(process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4').replace(/\/$/, '');
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { 'X-Auth-Token': token, accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null);

  await recordProviderRequest({
    provider: 'FOOTBALL_DATA',
    route: path,
    providerMatchId: Number(path.match(/\/matches\/(\d+)/)?.[1] || 0) || null,
    status: response.status,
    ok: response.ok,
    reason: response.ok ? null : JSON.stringify(payload || {}).slice(0, 500),
  }).catch(() => undefined);

  if (!response.ok) {
    throw Object.assign(new Error(payload?.message || `football-data returned HTTP ${response.status}`), {
      status: response.status,
      payload,
      provider: 'FOOTBALL_DATA',
    });
  }
  return payload;
}

async function findTeamAsset(team: any): Promise<TeamAsset | null> {
  const candidates = providerTeamCandidates(team);
  if (candidates.length === 0) return null;
  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, select: TEAM_SELECT, take: 500 });
  return (
    teams.find((asset) => candidates.includes(normalizeTeamName(asset.code)))
    || teams.find((asset) => candidates.includes(normalizeTeamName(asset.name)))
    || null
  ) as TeamAsset | null;
}

async function findExistingLocalMatch(providerMatchId: number, homeTeamId: string, awayTeamId: string, matchDate: Date) {
  const externalIds = [`football-data:${providerMatchId}`, String(providerMatchId)];
  const byExternal = await prisma.match.findFirst({
    where: { externalId: { in: externalIds } },
    select: MATCH_SELECT,
  });
  if (byExternal) return byExternal;

  const from = new Date(matchDate.getTime() - 18 * 60 * 60 * 1000);
  const to = new Date(matchDate.getTime() + 18 * 60 * 60 * 1000);
  return prisma.match.findFirst({
    where: {
      homeTeamId,
      awayTeamId,
      matchDate: { gte: from, lte: to },
      status: { in: ['SCHEDULED', 'LIVE', 'IN_PLAY', 'FINISHED', 'TIMED', 'PAUSED'] },
    },
    orderBy: { matchDate: 'asc' },
    select: MATCH_SELECT,
  });
}

function extractTeamStats(team: any) {
  const stats = team?.statistics || {};
  return {
    possession: n(stats.ball_possession),
    shots: n(stats.shots),
    shotsOnGoal: n(stats.shots_on_goal),
    shotsOffGoal: n(stats.shots_off_goal),
    corners: n(stats.corner_kicks),
    yellowCards: n(stats.yellow_cards),
    yellowRedCards: n(stats.yellow_red_cards),
    redCards: n(stats.red_cards),
    fouls: n(stats.fouls),
    offsides: n(stats.offsides),
    saves: n(stats.saves),
    throwIns: n(stats.throw_ins),
    freeKicks: n(stats.free_kicks),
    goalKicks: n(stats.goal_kicks),
  };
}

function fullStatsPayload(matchDetail: any, homeTeam: TeamAsset, awayTeam: TeamAsset) {
  const home = extractTeamStats(matchDetail?.homeTeam);
  const away = extractTeamStats(matchDetail?.awayTeam);
  return {
    provider: 'FOOTBALL_DATA_FULL',
    providerStatus: matchDetail?.status || null,
    providerLastUpdated: matchDetail?.lastUpdated || null,
    utcDate: matchDetail?.utcDate || null,
    competition: matchDetail?.competition || null,
    season: matchDetail?.season || null,
    stage: matchDetail?.stage || null,
    group: matchDetail?.group || null,
    minute: matchDetail?.minute ?? null,
    injuryTime: matchDetail?.injuryTime ?? null,
    attendance: matchDetail?.attendance ?? null,
    venue: matchDetail?.venue || null,
    score: matchDetail?.score || null,
    teams: {
      home: { localId: homeTeam.id, localName: homeTeam.name, provider: matchDetail?.homeTeam || null, stats: home },
      away: { localId: awayTeam.id, localName: awayTeam.name, provider: matchDetail?.awayTeam || null, stats: away },
    },
    goals: Array.isArray(matchDetail?.goals) ? matchDetail.goals : [],
    penalties: Array.isArray(matchDetail?.penalties) ? matchDetail.penalties : [],
    bookings: Array.isArray(matchDetail?.bookings) ? matchDetail.bookings : [],
    substitutions: Array.isArray(matchDetail?.substitutions) ? matchDetail.substitutions : [],
  };
}

async function getLatestFullSnapshot(matchId: string) {
  await ensureStatsTable();
  return prisma.matchStatsSnapshot.findFirst({
    where: { matchId, provider: 'FOOTBALL_DATA_FULL' },
    orderBy: { capturedAt: 'desc' },
  });
}

async function saveFullStatsSnapshot(params: {
  localMatch: any;
  providerMatchId: number;
  matchDetail: any;
  homeTeam: TeamAsset;
  awayTeam: TeamAsset;
  forceSnapshot: boolean;
}) {
  await ensureStatsTable();
  const latest = await getLatestFullSnapshot(params.localMatch.id);
  const latestRaw = (latest?.rawData || {}) as any;
  const providerLastUpdated = params.matchDetail?.lastUpdated || null;

  if (!params.forceSnapshot && latest && providerLastUpdated && latestRaw?.providerLastUpdated === providerLastUpdated) {
    return { status: 'skipped_same_provider_last_updated', snapshotId: latest.id, providerLastUpdated };
  }

  const home = extractTeamStats(params.matchDetail?.homeTeam);
  const away = extractTeamStats(params.matchDetail?.awayTeam);
  const { homeScore, awayScore } = extractScore(params.matchDetail);

  const row = await prisma.matchStatsSnapshot.create({
    data: {
      id: randomUUID(),
      matchId: params.localMatch.id,
      provider: 'FOOTBALL_DATA_FULL',
      providerMatchId: params.providerMatchId,
      minute: inferMinute(params.matchDetail?.status, params.matchDetail?.minute),
      homePossession: home.possession,
      awayPossession: away.possession,
      homeShots: home.shots,
      awayShots: away.shots,
      homeShotsOnTarget: home.shotsOnGoal,
      awayShotsOnTarget: away.shotsOnGoal,
      homeShotsOffTarget: home.shotsOffGoal,
      awayShotsOffTarget: away.shotsOffGoal,
      homeCorners: home.corners,
      awayCorners: away.corners,
      homeYellowCards: home.yellowCards,
      awayYellowCards: away.yellowCards,
      homeRedCards: home.redCards,
      awayRedCards: away.redCards,
      homeScore: homeScore ?? params.localMatch.homeScore,
      awayScore: awayScore ?? params.localMatch.awayScore,
      rawData: fullStatsPayload(params.matchDetail, params.homeTeam, params.awayTeam) as any,
    },
  });

  return { status: 'saved_full_stats_snapshot', snapshotId: row.id, providerLastUpdated };
}

function providerTeamId(value: any) {
  const id = Number(value?.id);
  return Number.isFinite(id) ? id : null;
}

function localTeamIdForProviderTeam(matchDetail: any, localMatch: any, providerTeam: any) {
  const id = providerTeamId(providerTeam);
  if (id && id === providerTeamId(matchDetail?.homeTeam)) return localMatch.homeTeamId;
  if (id && id === providerTeamId(matchDetail?.awayTeam)) return localMatch.awayTeamId;
  if (teamMatches(providerTeam, matchDetail?.homeTeam)) return localMatch.homeTeamId;
  if (teamMatches(providerTeam, matchDetail?.awayTeam)) return localMatch.awayTeamId;
  return null;
}

async function saveMatchEventIfNew(params: {
  localMatch: any;
  matchDetail: any;
  minute: number | null;
  type: string;
  team?: any;
  playerName?: string | null;
  detail: string;
}) {
  const detail = params.detail.slice(0, 240);
  const existing = await prisma.matchEvent.findFirst({
    where: {
      matchId: params.localMatch.id,
      minute: params.minute,
      type: params.type,
      detail,
    },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.matchEvent.create({
    data: {
      matchId: params.localMatch.id,
      minute: params.minute,
      type: params.type,
      teamId: params.team ? localTeamIdForProviderTeam(params.matchDetail, params.localMatch, params.team) : null,
      playerName: params.playerName || null,
      detail,
      sourceName: 'FOOTBALL_DATA_FULL',
      sourceUrl: 'https://www.football-data.org/',
    },
  });
}

function cardType(card?: string | null) {
  const value = String(card || '').toUpperCase();
  if (value.includes('RED') && value.includes('YELLOW')) return 'second_yellow_card';
  if (value.includes('RED')) return 'red_card';
  if (value.includes('YELLOW')) return 'yellow_card';
  return 'card';
}

function arCardLabel(card?: string | null) {
  const type = cardType(card);
  if (type === 'yellow_card') return 'بطاقة صفراء';
  if (type === 'red_card') return 'بطاقة حمراء';
  if (type === 'second_yellow_card') return 'بطاقة صفراء ثانية';
  return 'بطاقة';
}

async function saveFootballDataEvents(localMatch: any, matchDetail: any) {
  const savedEvents = [];
  const goals = Array.isArray(matchDetail?.goals) ? matchDetail.goals : [];
  const bookings = Array.isArray(matchDetail?.bookings) ? matchDetail.bookings : [];
  const penalties = Array.isArray(matchDetail?.penalties) ? matchDetail.penalties : [];

  for (const goal of goals) {
    const isPenalty = String(goal?.type || '').toUpperCase() === 'PENALTY';
    const playerName = goal?.scorer?.name || null;
    const teamName = goal?.team?.name || 'الفريق';
    const minute = n(goal?.minute);
    const score = goal?.score ? ` — النتيجة ${goal.score.home ?? '?'}-${goal.score.away ?? '?'}` : '';
    const saved = await saveMatchEventIfNew({
      localMatch,
      matchDetail,
      minute,
      type: isPenalty ? 'penalty_goal' : 'goal',
      team: goal?.team,
      playerName,
      detail: `${isPenalty ? 'هدف من ضربة جزاء' : 'هدف'} لـ ${teamName}${playerName ? ` بواسطة ${playerName}` : ''}${score}`,
    });
    if (saved) savedEvents.push(saved.id);
  }

  for (const booking of bookings) {
    const playerName = booking?.player?.name || null;
    const teamName = booking?.team?.name || 'الفريق';
    const saved = await saveMatchEventIfNew({
      localMatch,
      matchDetail,
      minute: n(booking?.minute),
      type: cardType(booking?.card),
      team: booking?.team,
      playerName,
      detail: `${arCardLabel(booking?.card)} على ${teamName}${playerName ? ` — ${playerName}` : ''}`,
    });
    if (saved) savedEvents.push(saved.id);
  }

  for (const penalty of penalties) {
    const playerName = penalty?.player?.name || null;
    const teamName = penalty?.team?.name || 'غير محدد من المصدر';
    const scored = penalty?.scored === true;
    const missed = penalty?.scored === false;
    const saved = await saveMatchEventIfNew({
      localMatch,
      matchDetail,
      minute: null,
      type: scored ? 'penalty_scored' : missed ? 'penalty_missed' : 'penalty',
      team: penalty?.team,
      playerName,
      detail: `${scored ? 'ضربة جزاء مسجلة' : missed ? 'ضربة جزاء مهدرة' : 'ضربة جزاء'}${playerName ? ` — ${playerName}` : ''} (${teamName})`,
    });
    if (saved) savedEvents.push(saved.id);
  }

  return savedEvents;
}

function shouldFetchDetail(providerMatch: any, includeScheduled: boolean) {
  if (includeScheduled) return true;
  const status = String(providerMatch?.status || '').toUpperCase();
  if (['FINISHED', 'IN_PLAY', 'LIVE', 'PAUSED'].includes(status)) return true;
  const date = new Date(providerMatch?.utcDate || 0).getTime();
  return Number.isFinite(date) && date <= Date.now();
}

async function processProviderMatch(providerMatch: any, options: { createMissing: boolean; dryRun: boolean; forceSnapshot: boolean }) {
  const providerMatchId = Number(providerMatch?.id);
  const matchDate = new Date(providerMatch?.utcDate || Date.now());
  const providerStatus = normalizeFootballDataStatus(providerMatch?.status);
  const [homeTeam, awayTeam] = await Promise.all([findTeamAsset(providerMatch?.homeTeam), findTeamAsset(providerMatch?.awayTeam)]);

  if (!providerMatchId || !homeTeam || !awayTeam || !Number.isFinite(matchDate.getTime())) {
    return {
      status: 'skipped_unmatched',
      providerMatchId,
      providerHome: providerMatch?.homeTeam?.name,
      providerAway: providerMatch?.awayTeam?.name,
      homeMatched: Boolean(homeTeam),
      awayMatched: Boolean(awayTeam),
    };
  }

  const existing = await findExistingLocalMatch(providerMatchId, homeTeam.id, awayTeam.id, matchDate);
  const { homeScore, awayScore } = extractScore(providerMatch);
  const nextHomeScore = homeScore ?? existing?.homeScore ?? 0;
  const nextAwayScore = awayScore ?? existing?.awayScore ?? 0;

  if (!existing && !options.createMissing) {
    return {
      status: 'skipped_no_local_match',
      providerMatchId,
      providerStatus,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      score: `${nextHomeScore}-${nextAwayScore}`,
      hint: 'Pass createMissing=true to create the match before saving football-data full stats.',
    };
  }

  const data = {
    externalId: existing?.externalId || `football-data:${providerMatchId}`,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    matchDate,
    status: providerStatus,
    homeScore: nextHomeScore,
    awayScore: nextAwayScore,
    groupPhase: providerMatch?.group || providerMatch?.stage || providerMatch?.competition?.name || null,
    stage: String(providerMatch?.stage || existing?.stage || 'group').toLowerCase(),
  };

  if (options.dryRun) {
    return {
      status: existing ? 'dry_run_would_update_and_fetch_details' : 'dry_run_would_create_and_fetch_details',
      providerMatchId,
      localMatchId: existing?.id || null,
      providerStatus,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      score: `${nextHomeScore}-${nextAwayScore}`,
    };
  }

  const localMatch = existing
    ? await prisma.match.update({ where: { id: existing.id }, data, select: MATCH_SELECT })
    : await prisma.match.create({ data, select: MATCH_SELECT });

  const matchDetail = await footballDataFetch(`/matches/${providerMatchId}`);
  const snapshot = await saveFullStatsSnapshot({
    localMatch,
    providerMatchId,
    matchDetail,
    homeTeam,
    awayTeam,
    forceSnapshot: options.forceSnapshot,
  });
  const savedEvents = await saveFootballDataEvents(localMatch, matchDetail);
  const latestScore = extractScore(matchDetail);

  return {
    status: existing ? 'updated_existing_match_full_stats' : 'created_match_full_stats',
    providerMatchId,
    localMatchId: localMatch.id,
    providerStatus: matchDetail?.status || providerMatch?.status,
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    score: `${latestScore.homeScore ?? localMatch.homeScore}-${latestScore.awayScore ?? localMatch.awayScore}`,
    snapshot,
    savedEventsCount: savedEvents.length,
    detailLastUpdated: matchDetail?.lastUpdated || null,
  };
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: 'Unauthorized', authMethod: auth.method }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const startedAt = new Date();
  const url = new URL(req.url);
  const now = new Date();
  const date = url.searchParams.get('date') || '';
  const dateFrom = url.searchParams.get('dateFrom') || date || defaultTournamentStartDate();
  const dateTo = url.searchParams.get('dateTo') || date || todayKey();
  const competition = (url.searchParams.get('competition') || process.env.FOOTBALL_DATA_COMPETITION || 'WC').trim();
  const createMissing = url.searchParams.get('createMissing') !== 'false';
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const includeScheduled = url.searchParams.get('includeScheduled') === 'true';
  const forceSnapshot = url.searchParams.get('forceSnapshot') === 'true' || url.searchParams.get('force') === 'true';
  const bypassCooldown = url.searchParams.get('bypassCooldown') === 'true' || url.searchParams.get('ignoreCooldown') === 'true' || url.searchParams.get('force') === 'true';
  const minIntervalMinutes = Math.max(0, Number(url.searchParams.get('minIntervalMinutes') || process.env.FOOTBALL_DATA_FULL_STATS_MIN_INTERVAL_MINUTES || 15));
  const maxMatches = Math.max(1, Math.min(150, Number(url.searchParams.get('maxMatches') || process.env.FOOTBALL_DATA_FULL_STATS_MAX_MATCHES || 104)));
  const processed: any[] = [];
  const skipped: any[] = [];
  const errors: any[] = [];
  let externalRequestsUsed = 0;

  try {
    const guard = bypassCooldown ? null : await getProviderQuotaBlock('FOOTBALL_DATA');
    if (guard) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        mode: 'football_data_full_stats_sync',
        provider: 'FOOTBALL_DATA',
        reason: 'provider_guard_or_cooldown_active',
        guard: { blockedUntil: guard.blockedUntil, reason: guard.reason },
        dateFrom,
        dateTo,
        externalRequestsUsed,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const payload = await footballDataFetch(`/competitions/${encodeURIComponent(competition)}/matches`, { dateFrom, dateTo });
    externalRequestsUsed += 1;
    const providerMatches = Array.isArray(payload?.matches) ? payload.matches : [];
    const matchesToProcess = providerMatches.filter((match: any) => shouldFetchDetail(match, includeScheduled)).slice(0, maxMatches);

    for (const match of providerMatches) {
      if (!matchesToProcess.includes(match)) {
        skipped.push({ providerMatchId: match?.id, status: match?.status, utcDate: match?.utcDate, reason: 'scheduled_future_or_over_max_matches' });
      }
    }

    for (const match of matchesToProcess) {
      try {
        const result = await processProviderMatch(match, { createMissing, dryRun, forceSnapshot });
        if (!dryRun && !String(result.status || '').startsWith('skipped_')) externalRequestsUsed += 1;
        processed.push(result);
      } catch (error: any) {
        errors.push({ providerMatchId: match?.id, message: error?.message || 'football-data detail sync failed', status: error?.status, payload: error?.payload });
        if (isProviderQuotaError(error)) throw error;
      }
    }

    if (!dryRun && minIntervalMinutes > 0) {
      await blockProviderUntil('FOOTBALL_DATA', new Date(Date.now() + minIntervalMinutes * 60 * 1000), `cooldown after full stats sync (${dateFrom}..${dateTo})`);
    }

    return NextResponse.json({
      ok: errors.length === 0,
      mode: 'football_data_full_stats_sync',
      authMethod: auth.method,
      provider: 'FOOTBALL_DATA',
      competition,
      dateFrom,
      dateTo,
      now: now.toISOString(),
      dryRun,
      createMissing,
      includeScheduled,
      bypassCooldown,
      forceSnapshot,
      minIntervalMinutes,
      maxMatches,
      listMatchesFetched: providerMatches.length,
      detailMatchesProcessed: matchesToProcess.length,
      externalRequestsUsed,
      processed,
      skipped,
      errors,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } });
  } catch (error: any) {
    if (isProviderQuotaError(error)) {
      await blockFootballDataAfterError(error);
    }
    errors.push({ message: error?.message || 'football-data full stats sync failed', status: error?.status, provider: error?.provider || 'FOOTBALL_DATA', payload: error?.payload });
    return NextResponse.json({
      ok: false,
      mode: 'football_data_full_stats_sync',
      provider: 'FOOTBALL_DATA',
      competition,
      dateFrom,
      dateTo,
      externalRequestsUsed,
      processed,
      skipped,
      errors,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    }, { status: error?.status || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
