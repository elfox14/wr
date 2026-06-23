import { PrismaClient } from '@prisma/client';
import { fetchISportsAnimationBrowserlessText } from './isports-animation-browserless-fallback.mjs';

const prisma = new PrismaClient();

const LIVE_STAT_FIELDS = [
  'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
  'homeScore', 'awayScore',
];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'ET', 'BT', 'P', 'PAUSED'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];

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

function splitCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function appBaseUrl() {
  return String(
    process.env.LIVE_INGEST_TARGET_ORIGIN ||
    process.env.LIVE_SYNC_PUBLIC_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    'https://worldcup.mcprim.com',
  ).replace(/\/$/, '');
}

function ingestSecret() {
  return String(process.env.LIVE_INGEST_SECRET || process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '').trim();
}

function emptyStats() {
  const stats = Object.fromEntries(LIVE_STAT_FIELDS.map((field) => [field, null]));
  stats.minute = null;
  return stats;
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(typeof value === 'string' ? value.replace('%', '').replace(/[^0-9.-]/g, '').trim() : value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = num(value);
    if (n !== null) return n;
  }
  return null;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getPath(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function collectArrays(value, output = [], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return output;
  if (Array.isArray(value)) {
    output.push(value);
    value.forEach((item) => collectArrays(item, output, depth + 1));
    return output;
  }
  Object.values(value).forEach((item) => collectArrays(item, output, depth + 1));
  return output;
}

function sideObject(item, side) {
  const keys = side === 'home'
    ? ['home', 'homeTeam', 'homeStats', 'homeStatistics', 'teamA', 'localteam', 'host']
    : ['away', 'awayTeam', 'awayStats', 'awayStatistics', 'teamB', 'visitorteam', 'guest'];
  for (const key of keys) if (item?.[key] && typeof item[key] === 'object') return item[key];
  return item || {};
}

function applyStatLabel(stats, rawLabel, homeValue, awayValue) {
  const label = String(rawLabel || '').toLowerCase().replace(/[_-]/g, ' ');
  const home = num(homeValue);
  const away = num(awayValue);
  if (home === null && away === null) return;
  if (label.includes('possession') || label === 'poss' || label.includes('ball possession')) {
    stats.homePossession = home;
    stats.awayPossession = away;
  } else if (label.includes('dangerous') || label.includes('d att') || label.includes('danger')) {
    stats.homeDangerousAttacks = home;
    stats.awayDangerousAttacks = away;
  } else if (label.includes('attack') || label === 'att') {
    stats.homeAttacks = home;
    stats.awayAttacks = away;
  } else if (label.includes('on target') || label.includes('shot on') || label.includes('sot') || label.includes('on-tgt')) {
    stats.homeShotsOnTarget = home;
    stats.awayShotsOnTarget = away;
  } else if (label.includes('off target') || label.includes('shot off') || label.includes('off-tgt')) {
    stats.homeShotsOffTarget = home;
    stats.awayShotsOffTarget = away;
  } else if (label.includes('corner') || label === 'ck') {
    stats.homeCorners = home;
    stats.awayCorners = away;
  } else if (label.includes('yellow')) {
    stats.homeYellowCards = home;
    stats.awayYellowCards = away;
  } else if (label.includes('red')) {
    stats.homeRedCards = home;
    stats.awayRedCards = away;
  } else if (label.includes('shot')) {
    stats.homeShots = home;
    stats.awayShots = away;
  }
}

function normalizeStats(payload, match) {
  const stats = emptyStats();
  const roots = [
    payload,
    ...(Array.isArray(payload?.response) ? payload.response : []),
    ...(Array.isArray(payload?.data) ? payload.data : []),
    ...(Array.isArray(payload?.result) ? payload.result : []),
    ...(Array.isArray(payload?.results) ? payload.results : []),
  ].filter(Boolean);

  for (const item of roots) {
    const home = sideObject(item, 'home');
    const away = sideObject(item, 'away');
    stats.minute ??= firstNumber(item?.minute, item?.matchMinute, item?.time, item?.elapsed, item?.liveTime, item?.status?.elapsed, payload?.minute, payload?.elapsed);
    stats.homeScore ??= firstNumber(item?.homeScore, item?.home_score, item?.score?.home, item?.goals?.home, home?.score, home?.goals, match?.homeScore);
    stats.awayScore ??= firstNumber(item?.awayScore, item?.away_score, item?.score?.away, item?.goals?.away, away?.score, away?.goals, match?.awayScore);
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
    stats.homeCorners ??= firstNumber(home?.corners, home?.corner, home?.cornerKicks, item?.homeCorners, item?.home_corners);
    stats.awayCorners ??= firstNumber(away?.corners, away?.corner, away?.cornerKicks, item?.awayCorners, item?.away_corners);
    stats.homeYellowCards ??= firstNumber(home?.yellowCards, home?.yellow_cards, home?.yellow, item?.homeYellowCards, item?.home_yellow_cards);
    stats.awayYellowCards ??= firstNumber(away?.yellowCards, away?.yellow_cards, away?.yellow, item?.awayYellowCards, item?.away_yellow_cards);
    stats.homeRedCards ??= firstNumber(home?.redCards, home?.red_cards, home?.red, item?.homeRedCards, item?.home_red_cards);
    stats.awayRedCards ??= firstNumber(away?.redCards, away?.red_cards, away?.red, item?.awayRedCards, item?.away_red_cards);
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

function hasUsefulStats(stats) {
  return LIVE_STAT_FIELDS.some((field) => field !== 'homeScore' && field !== 'awayScore' && stats[field] !== null && stats[field] !== undefined);
}

function textLines(text) {
  return String(text || '').split(/\n|\r|\t/).map((line) => line.trim()).filter(Boolean);
}

function normalizeAnimationTextStats(text, match) {
  const stats = emptyStats();
  const lines = textLines(text);
  const compact = String(text || '').replace(/[\t\r\n]+/g, ' ');
  const score = compact.match(/(?:^|\s)(\d{1,2})\s*[:]\s*(\d{1,2})(?:\s|$)/);
  stats.homeScore = firstNumber(score?.[1], match?.homeScore);
  stats.awayScore = firstNumber(score?.[2], match?.awayScore);
  stats.minute = firstNumber(compact.match(/(?:minute|min|time)\D{0,8}(\d{1,3})/i)?.[1]);

  const labels = [
    ['homePossession', 'awayPossession', ['Poss', 'Possession', 'Ball Possession']],
    ['homeAttacks', 'awayAttacks', ['ATT', 'Attack', 'Attacks']],
    ['homeDangerousAttacks', 'awayDangerousAttacks', ['D-ATT', 'D ATT', 'Dangerous Attack', 'Dangerous Attacks']],
    ['homeShots', 'awayShots', ['Shots', 'Shot']],
    ['homeShotsOnTarget', 'awayShotsOnTarget', ['On-TGT', 'On TGT', 'On Target', 'Shots on Target']],
    ['homeShotsOffTarget', 'awayShotsOffTarget', ['Off-TGT', 'Off TGT', 'Off Target']],
    ['homeCorners', 'awayCorners', ['Corner', 'Corners', 'CK']],
    ['homeYellowCards', 'awayYellowCards', ['Yellow', 'Yellow Cards']],
    ['homeRedCards', 'awayRedCards', ['Red', 'Red Cards']],
  ];

  for (const [homeField, awayField, names] of labels) {
    for (const label of names) {
      const inline = compact.match(new RegExp(`(?:^|\\s)(-?\\d{1,4}%?)\\s+${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(-?\\d{1,4}%?)(?:\\s|$)`, 'i'));
      if (inline) {
        stats[homeField] = num(inline[1]);
        stats[awayField] = num(inline[2]);
        break;
      }
      const idx = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
      if (idx >= 0) {
        stats[homeField] = num(lines[idx - 1]);
        stats[awayField] = num(lines[idx + 1]);
        break;
      }
    }
  }
  return stats;
}

function providerStatus(raw, stats, match) {
  const root = asObject(raw);
  const values = [root.status, root.providerStatus, root.matchState, root.match_status, root.data?.status, root.response?.[0]?.fixture?.status?.short].filter(Boolean);
  for (const value of values) {
    const status = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (['FINISHED', 'FT', 'COMPLETED', 'ENDED', '-1'].includes(status)) return 'FINISHED';
    if (['HT', 'HALFTIME', 'HALF_TIME', 'PAUSED'].includes(status)) return 'HT';
    if (['2H', 'SECOND_HALF'].includes(status)) return '2H';
    if (['1H', 'FIRST_HALF', 'LIVE', 'IN_PLAY'].includes(status)) return Number(stats.minute || 0) >= 46 ? '2H' : '1H';
    if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', '0'].includes(status)) return 'SCHEDULED';
  }
  if (Number(stats.minute || 0) > 0) return Number(stats.minute || 0) >= 46 ? '2H' : '1H';
  return match.status;
}

async function candidateMatches() {
  const limit = envNumber('LIVE_INGEST_MATCH_LIMIT', 3, 1, 10);
  const lookbackHours = envNumber('LIVE_INGEST_LOOKBACK_HOURS', 3, 1, 24);
  const lookaheadMinutes = envNumber('LIVE_INGEST_LOOKAHEAD_MINUTES', 15, 0, 180);
  const finishedHours = envNumber('LIVE_INGEST_FINISHED_HOURS', 3, 0, 24);
  const now = Date.now();
  const liveStart = new Date(now - lookbackHours * 60 * 60 * 1000);
  const liveEnd = new Date(now + lookaheadMinutes * 60 * 1000);
  const finishedSince = new Date(now - finishedHours * 60 * 60 * 1000);
  return prisma.match.findMany({
    where: {
      animationMatchId: { not: null },
      OR: [
        { status: { in: LIVE_STATUSES } },
        { status: 'SCHEDULED', matchDate: { gte: liveStart, lte: liveEnd } },
        ...(finishedHours > 0 ? [{ status: { in: FINISHED_STATUSES }, matchDate: { gte: finishedSince } }] : []),
      ],
    },
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    orderBy: { matchDate: 'asc' },
    take: limit,
  });
}

async function latestSnapshot(matchId) {
  return prisma.matchStatsSnapshot.findFirst({
    where: { matchId, provider: { in: ['THESTATS', 'HSPORT_ANIMATION', 'ISPORTS_ANIMATION_BROWSERLESS'] } },
    orderBy: { capturedAt: 'desc' },
  });
}

function latestSnapshotAgeSeconds(snapshot) {
  if (!snapshot?.capturedAt) return Number.POSITIVE_INFINITY;
  const capturedAt = new Date(snapshot.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return Number.POSITIVE_INFINITY;
  return (Date.now() - capturedAt) / 1000;
}

function recentSnapshotSkip(match, latest) {
  const minIntervalSeconds = envNumber('LIVE_INGEST_MIN_INTERVAL_SECONDS', 180, 30, 3600);
  const ageSeconds = latestSnapshotAgeSeconds(latest);
  if (ageSeconds >= minIntervalSeconds) return null;
  return { matchId: match.id, providerMatchId: match.animationMatchId, status: 'skipped_recent_snapshot', ageSeconds: Math.round(ageSeconds), minIntervalSeconds };
}

function thestatsUrl(match) {
  const template = String(process.env.THESTATS_LIVE_URL_TEMPLATE || '').trim();
  if (!template) return '';
  const apiKey = String(process.env.THESTATS_API_KEY || '').trim();
  return template
    .replaceAll('{matchId}', String(match.id))
    .replaceAll('{providerMatchId}', String(match.animationMatchId || ''))
    .replaceAll('{animationMatchId}', String(match.animationMatchId || ''))
    .replaceAll('{externalId}', String(match.externalId || ''))
    .replaceAll('{apiKey}', encodeURIComponent(apiKey));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`request_timeout_${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTheStats(match) {
  if (!envBool('LIVE_INGEST_USE_THESTATS', true)) return { enabled: false, reason: 'LIVE_INGEST_USE_THESTATS is false' };
  const url = thestatsUrl(match);
  if (!url) return { enabled: false, reason: 'THESTATS_LIVE_URL_TEMPLATE is missing' };
  const apiKey = String(process.env.THESTATS_API_KEY || '').trim();
  const apiKeyHeader = String(process.env.THESTATS_API_KEY_HEADER || '').trim();
  const authHeader = String(process.env.THESTATS_AUTH_HEADER || '').trim();
  const headers = { accept: 'application/json,text/plain,*/*' };
  if (apiKey && apiKeyHeader) headers[apiKeyHeader] = apiKey;
  if (authHeader) headers.authorization = authHeader;
  const timeoutMs = envNumber('THESTATS_TIMEOUT_MS', 8000, 2000, 20000);
  const response = await fetchWithTimeout(url, { method: 'GET', headers }, timeoutMs);
  const text = await response.text();
  if (!response.ok) throw new Error(`TheStats failed ${response.status}: ${text.slice(0, 500)}`);
  const payload = (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })();
  const stats = normalizeStats(payload, match);
  return { enabled: true, provider: 'THESTATS', stats, rawData: payload, hasStats: hasUsefulStats(stats) };
}

async function fetchHSportAnimation(match) {
  if (!envBool('LIVE_INGEST_USE_HSPORT_ANIMATION', false)) return { enabled: false, reason: 'LIVE_INGEST_USE_HSPORT_ANIMATION is false' };
  const fallback = await fetchISportsAnimationBrowserlessText(match.animationMatchId);
  if (!fallback?.enabled) return { enabled: false, reason: fallback?.reason || 'animation disabled' };
  const stats = normalizeAnimationTextStats(fallback.text || '', match);
  return {
    enabled: true,
    provider: 'HSPORT_ANIMATION',
    stats,
    rawData: fallback.rawData || { sourceUrl: fallback.sourceUrl, textSample: String(fallback.text || '').slice(0, 1000) },
    hasStats: hasUsefulStats(stats),
    status: { hasText: fallback.hasText, error: fallback.error || null, sourceUrl: fallback.sourceUrl },
  };
}

async function postIngest(payload) {
  const secret = ingestSecret();
  if (!secret) throw new Error('LIVE_INGEST_SECRET/ADMIN_API_SECRET/CRON_SECRET is missing');
  const url = `${appBaseUrl()}/api/internal/live-ingest/match-snapshot`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-live-ingest-secret': secret }, body: JSON.stringify(payload) });
  const text = await response.text();
  const data = (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })();
  if (!response.ok) throw new Error(`ingest POST failed ${response.status}: ${text.slice(0, 500)}`);
  return data;
}

async function processMatch(match) {
  const providers = splitCsv(process.env.LIVE_INGEST_PROVIDER_ORDER || 'THESTATS,HSPORT_ANIMATION');
  const attempts = [];
  for (const provider of providers) {
    const name = provider.toUpperCase();
    try {
      const result = name === 'THESTATS' ? await fetchTheStats(match) : name === 'HSPORT_ANIMATION' ? await fetchHSportAnimation(match) : { enabled: false, reason: `unknown provider ${provider}` };
      attempts.push({ provider: name, enabled: result.enabled, hasStats: result.hasStats || false, reason: result.reason || null, status: result.status || null });
      if (!result.enabled || !result.hasStats) continue;
      const ingestPayload = {
        matchId: match.id,
        animationMatchId: match.animationMatchId,
        provider: result.provider,
        providerMatchId: Number(match.animationMatchId),
        status: providerStatus(result.rawData, result.stats, match),
        minute: result.stats.minute,
        stats: result.stats,
        events: [],
        ...(envBool('LIVE_INGEST_INCLUDE_RAW', false) ? { rawData: result.rawData } : {}),
      };
      const saved = await postIngest(ingestPayload);
      return { matchId: match.id, providerMatchId: match.animationMatchId, status: 'saved', sourceProvider: result.provider, hasUsefulStats: true, snapshotId: saved.snapshot?.id, attempts };
    } catch (error) {
      attempts.push({ provider: name, enabled: true, hasStats: false, error: error?.message || String(error) });
    }
  }
  return { matchId: match.id, providerMatchId: match.animationMatchId, status: 'skipped_no_useful_stats', attempts };
}

async function runOnce() {
  const matches = await candidateMatches();
  const processed = [];
  console.log(`[thestats-hsport-live-ingest] candidates=${matches.length}`);
  for (const match of matches) {
    const latest = await latestSnapshot(match.id);
    const skip = recentSnapshotSkip(match, latest);
    if (skip) { processed.push(skip); continue; }
    processed.push(await processMatch(match));
  }
  const summary = { ok: true, at: new Date().toISOString(), worker: 'thestats-hsport-live-ingest', candidates: matches.length, externalRequests: matches.length, processed };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  try {
    await runOnce();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[thestats-hsport-live-ingest] fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
