import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LIVE_STATUSES = new Set(['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALF_TIME', 'HALFTIME', 'PAUSED']);
const FINISHED_STATUSES = new Set(['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED']);
const SCHEDULED_STATUSES = new Set(['TIMED', 'SCHEDULED', 'NOT_STARTED', 'NS']);

function envBool(name, fallback = false) {
  const value = String(process.env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function envNumber(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bnational team\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeamName(name) {
  const value = normalizeName(name);
  if (!value) return '';
  if (['south korea', 'korea republic', 'republic of korea', 'kor'].includes(value)) return 'korea republic';
  if (['czech republic', 'czechia', 'cze'].includes(value)) return 'czechia';
  if (['bosnia and herzegovina', 'bosnia herzegovina', 'bosnia h', 'bih'].includes(value)) return 'bosnia h';
  if (['united states', 'united states of america', 'usa', 'usmnt'].includes(value)) return 'usa';
  if (['curacao', 'curacao ', 'cuw'].includes(value)) return 'curacao';
  if (['ivory coast', 'cote d ivoire', 'cote divoire', 'civ'].includes(value)) return 'ivory coast';
  if (['dr congo', 'd r congo', 'democratic republic of the congo', 'congo dr', 'cod'].includes(value)) return 'dr congo';
  if (['cape verde islands', 'cape verde', 'cpv'].includes(value)) return 'cape verde';
  if (['saudi arabia', 'ksa'].includes(value)) return 'saudi arabia';
  return value;
}

function providerTeamCandidates(team) {
  return [team?.tla, team?.shortName, team?.name].map(normalizeTeamName).filter(Boolean);
}

function localTeamCandidates(team) {
  return [team?.code, team?.name].map(normalizeTeamName).filter(Boolean);
}

function teamMatches(providerTeam, localTeam) {
  const provider = providerTeamCandidates(providerTeam);
  const local = localTeamCandidates(localTeam);
  return provider.some((name) => local.includes(name)) || local.some((name) => provider.includes(name));
}

function dateDistanceHours(a, b) {
  const at = new Date(a).getTime();
  const bt = new Date(b).getTime();
  if (!Number.isFinite(at) || !Number.isFinite(bt)) return Number.POSITIVE_INFINITY;
  return Math.abs(at - bt) / 36e5;
}

function findProviderMatch(localMatch, providerMatches) {
  const candidates = providerMatches
    .map((item) => {
      const normal = teamMatches(item?.homeTeam, localMatch.homeTeam) && teamMatches(item?.awayTeam, localMatch.awayTeam);
      const reversed = teamMatches(item?.homeTeam, localMatch.awayTeam) && teamMatches(item?.awayTeam, localMatch.homeTeam);
      if (!normal && !reversed) return null;
      return { item, reversed, distanceHours: dateDistanceHours(localMatch.matchDate, item?.utcDate) };
    })
    .filter(Boolean)
    .filter((entry) => entry.distanceHours <= envNumber('FOOTBALL_DATA_MATCH_DATE_TOLERANCE_HOURS', 36, 1, 96))
    .sort((a, b) => a.distanceHours - b.distanceHours);
  return candidates[0] || null;
}

function safeScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(99, Math.floor(n)));
}

function extractScore(providerMatch, reversed = false) {
  const score = providerMatch?.score || {};
  const fullTime = score.fullTime || {};
  const regularTime = score.regularTime || {};
  const halfTime = score.halfTime || {};
  const home = safeScore(fullTime.home ?? regularTime.home ?? score.home ?? score.homeTeam ?? halfTime.home);
  const away = safeScore(fullTime.away ?? regularTime.away ?? score.away ?? score.awayTeam ?? halfTime.away);
  if (home === null || away === null) return { homeScore: null, awayScore: null };
  return reversed ? { homeScore: away, awayScore: home } : { homeScore: home, awayScore: away };
}

function normalizeFootballDataStatus(status) {
  const value = String(status || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (value === 'FINISHED') return 'FINISHED';
  if (['IN_PLAY', 'LIVE'].includes(value)) return 'IN_PLAY';
  if (value === 'PAUSED') return 'HT';
  if (['TIMED', 'SCHEDULED'].includes(value)) return 'SCHEDULED';
  if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(value)) return value;
  return value || 'SCHEDULED';
}

function shouldPersist(providerStatus, homeScore, awayScore) {
  const status = normalizeFootballDataStatus(providerStatus);
  if (homeScore !== null && awayScore !== null) return true;
  return LIVE_STATUSES.has(status) || FINISHED_STATUSES.has(status);
}

function appBaseUrl() {
  return String(
    process.env.FOOTBALL_DATA_SYNC_TARGET_ORIGIN ||
    process.env.POST_MATCH_STATS_SYNC_TARGET_ORIGIN ||
    process.env.LIVE_INGEST_TARGET_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    'https://worldcup.mcprim.com',
  ).replace(/\/$/, '');
}

function syncSecret() {
  return String(process.env.FOOTBALL_DATA_SYNC_SECRET || process.env.LIVE_INGEST_SECRET || process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '').trim();
}

async function footballDataFetch(path, params) {
  const token = String(process.env.FOOTBALL_DATA_API_TOKEN || '').trim();
  if (!token) throw new Error('FOOTBALL_DATA_API_TOKEN is missing');
  const baseUrl = String(process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4').replace(/\/$/, '');
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) url.searchParams.set(key, String(value));
  });
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'X-Auth-Token': token, accept: 'application/json' },
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 500) }; }
  if (!response.ok) {
    throw new Error(`football-data HTTP ${response.status}: ${payload?.message || text.slice(0, 300)}`);
  }
  return { payload, url: url.toString().replace(token, '***') };
}

async function postIngest(payload) {
  const secret = syncSecret();
  if (!secret) throw new Error('FOOTBALL_DATA_SYNC_SECRET/LIVE_INGEST_SECRET/ADMIN_API_SECRET/CRON_SECRET is missing');
  const url = `${appBaseUrl()}/api/internal/live-ingest/match-snapshot`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${secret}`,
      'x-live-ingest-secret': secret,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`internal ingest failed ${response.status}: ${text.slice(0, 500)}`);
  return data;
}

function buildGoalEvents(localMatch, homeScore, awayScore, minute) {
  const events = [];
  const prevHome = safeScore(localMatch.homeScore) ?? 0;
  const prevAway = safeScore(localMatch.awayScore) ?? 0;
  if (homeScore !== null && homeScore > prevHome) {
    events.push({
      minute,
      type: 'goal_confirmed',
      teamSide: 'home',
      detail: `هدف مؤكد من Football-Data لـ ${localMatch.homeTeam?.name || 'الفريق الأول'} — النتيجة ${homeScore}-${awayScore ?? prevAway}`,
      sourceName: 'Football-Data Results Sync',
    });
  }
  if (awayScore !== null && awayScore > prevAway) {
    events.push({
      minute,
      type: 'goal_confirmed',
      teamSide: 'away',
      detail: `هدف مؤكد من Football-Data لـ ${localMatch.awayTeam?.name || 'الفريق الثاني'} — النتيجة ${homeScore ?? prevHome}-${awayScore}`,
      sourceName: 'Football-Data Results Sync',
    });
  }
  return events;
}

async function localMatchesForWindow(dateFrom, dateTo) {
  const take = envNumber('FOOTBALL_DATA_RESULTS_LOCAL_LIMIT', 120, 1, 300);
  return prisma.match.findMany({
    where: { matchDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lte: new Date(`${dateTo}T23:59:59.999Z`) } },
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    orderBy: { matchDate: 'asc' },
    take,
  });
}

async function runOnce() {
  const now = new Date();
  const lookbackDays = envNumber('FOOTBALL_DATA_RESULTS_LOOKBACK_DAYS', 21, 0, 90);
  const lookaheadDays = envNumber('FOOTBALL_DATA_RESULTS_LOOKAHEAD_DAYS', 3, 0, 30);
  const dateFrom = process.env.FOOTBALL_DATA_RESULTS_DATE_FROM || isoDate(new Date(now.getTime() - lookbackDays * 864e5));
  const dateTo = process.env.FOOTBALL_DATA_RESULTS_DATE_TO || isoDate(new Date(now.getTime() + lookaheadDays * 864e5));
  const competition = String(process.env.FOOTBALL_DATA_COMPETITION || process.env.FOOTBALL_DATA_COMPETITION_CODE || 'WC').trim();
  const season = String(process.env.FOOTBALL_DATA_SEASON || '2026').trim();
  const dryRun = envBool('FOOTBALL_DATA_RESULTS_DRY_RUN', false);
  const debug = envBool('FOOTBALL_DATA_RESULTS_DEBUG', false);

  const { payload } = await footballDataFetch(`/competitions/${encodeURIComponent(competition)}/matches`, { dateFrom, dateTo, season });
  const providerMatches = Array.isArray(payload?.matches) ? payload.matches : [];
  const localMatches = await localMatchesForWindow(dateFrom, dateTo);
  const processed = [];

  console.log(`[football-data-results-sync] local=${localMatches.length} provider=${providerMatches.length} window=${dateFrom}..${dateTo} competition=${competition} season=${season}`);

  for (const localMatch of localMatches) {
    const found = findProviderMatch(localMatch, providerMatches);
    if (!found) {
      processed.push({ matchId: localMatch.id, status: 'provider_match_not_found', local: `${localMatch.homeTeam?.code || localMatch.homeTeam?.name}-${localMatch.awayTeam?.code || localMatch.awayTeam?.name}` });
      continue;
    }

    const providerMatch = found.item;
    const mappedStatus = normalizeFootballDataStatus(providerMatch.status);
    const { homeScore, awayScore } = extractScore(providerMatch, found.reversed);
    if (!shouldPersist(mappedStatus, homeScore, awayScore)) {
      processed.push({ matchId: localMatch.id, providerMatchId: providerMatch.id, status: 'skipped_no_score_status', providerStatus: providerMatch.status, mappedStatus });
      continue;
    }

    const changed = String(localMatch.status || '').toUpperCase() !== mappedStatus
      || safeScore(localMatch.homeScore) !== homeScore
      || safeScore(localMatch.awayScore) !== awayScore;

    if (!changed && !envBool('FOOTBALL_DATA_RESULTS_SAVE_UNCHANGED_SNAPSHOT', false)) {
      processed.push({ matchId: localMatch.id, providerMatchId: providerMatch.id, status: 'skipped_unchanged', mappedStatus, score: `${homeScore}-${awayScore}` });
      continue;
    }

    const minute = providerMatch.minute === '90' ? 90 : safeScore(providerMatch.minute);
    const ingestPayload = {
      matchId: localMatch.id,
      provider: 'FOOTBALL_DATA_RESULTS',
      providerMatchId: Number(providerMatch.id),
      status: mappedStatus,
      minute,
      stats: { homeScore, awayScore, minute },
      events: buildGoalEvents(localMatch, homeScore, awayScore, minute),
      rawData: {
        provider: 'FOOTBALL_DATA',
        providerStatus: providerMatch.status,
        utcDate: providerMatch.utcDate,
        group: providerMatch.group,
        stage: providerMatch.stage,
        score: providerMatch.score,
        reversed: found.reversed,
      },
    };

    if (dryRun) {
      processed.push({ matchId: localMatch.id, providerMatchId: providerMatch.id, status: 'dry_run_would_save', mappedStatus, score: `${homeScore}-${awayScore}`, ...(debug ? { providerMatch } : {}) });
      continue;
    }

    try {
      const saved = await postIngest(ingestPayload);
      processed.push({ matchId: localMatch.id, providerMatchId: providerMatch.id, status: 'saved', mappedStatus, score: `${homeScore}-${awayScore}`, savedEventsCount: saved.savedEventsCount ?? 0, snapshotId: saved.snapshot?.id });
    } catch (error) {
      processed.push({ matchId: localMatch.id, providerMatchId: providerMatch.id, status: 'failed', error: error?.message || String(error) });
    }
  }

  const summary = { ok: true, at: new Date().toISOString(), source: 'FOOTBALL_DATA', competition, season, dateFrom, dateTo, localCount: localMatches.length, providerCount: providerMatches.length, processed };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  await runOnce();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('[football-data-results-sync] fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
