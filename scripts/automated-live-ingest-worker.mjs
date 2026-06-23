import { PrismaClient } from '@prisma/client';
import { fetchISportsAnimationBrowserlessText } from './isports-animation-browserless-fallback.mjs';

let prisma = new PrismaClient();

export function setPrisma(customPrisma) {
  prisma = customPrisma;
}

const LIVE_STAT_FIELDS = [
  'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
  'homeScore', 'awayScore',
];

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'ET', 'BT', 'P', 'PAUSED'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];

function envNumber(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function envBool(name, fallback = false) {
  const value = String(process.env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitKeys(value) {
  return String(value || '').split(',').map((key) => key.trim()).filter(Boolean);
}

function iSportsKeys() {
  const pool = splitKeys(process.env.ISPORTS_API_KEYS);
  if (pool.length) return pool;
  return [process.env.ISPORTS_API_KEY].map((key) => String(key || '').trim()).filter(Boolean);
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

function iSportsBaseUrl() {
  return String(process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com').replace(/\/$/, '');
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

function emptyStats() {
  return Object.fromEntries(LIVE_STAT_FIELDS.map((field) => [field, null]));
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

function getSideObject(item, side) {
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
  } else if (label.includes('dangerous') || label.includes('d att') || label.includes('d-att')) {
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
  } else if (label.includes('corner') || label.includes('corners') || label === 'ck') {
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

function normalizeStats(payload) {
  const stats = emptyStats();
  stats.minute = null;
  const roots = [
    payload,
    ...(Array.isArray(payload?.response) ? payload.response : []),
    ...(Array.isArray(payload?.data) ? payload.data : []),
    ...(Array.isArray(payload?.result) ? payload.result : []),
    ...(Array.isArray(payload?.results) ? payload.results : []),
  ].filter(Boolean);

  for (const item of roots) {
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

function isNumberToken(value) {
  return /^-?\d{1,4}%?$/.test(String(value || '').trim());
}

function isStatBlocker(value) {
  const line = String(value || '').trim().toLowerCase();
  return !line || ['undefined', 'no data', 'vs', 'ended', 'kick-off', 'statistics', 'days', 'hrs', 'hours', 'mins', 'secs', 'possession'].includes(line) || line.includes('upgrade your plan');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function numberBefore(lines, index) {
  for (let i = index - 1; i >= Math.max(0, index - 4); i -= 1) {
    if (isStatBlocker(lines[i])) break;
    if (isNumberToken(lines[i])) return num(lines[i]);
  }
  return null;
}

function numberAfter(lines, index) {
  for (let i = index + 1; i <= Math.min(lines.length - 1, index + 4); i += 1) {
    if (isStatBlocker(lines[i])) break;
    if (isNumberToken(lines[i])) return num(lines[i]);
  }
  return null;
}

function findTextStatPair(text, labels) {
  const compact = String(text || '').replace(/[\t\r\n]+/g, ' ');
  for (const label of labels) {
    const inline = compact.match(new RegExp(`(?:^|\\s)(-?\\d{1,4}%?)\\s+${escapeRegExp(label)}\\s+(-?\\d{1,4}%?)(?:\\s|$)`, 'i'));
    if (inline) return { home: num(inline[1]), away: num(inline[2]) };
  }
  const lines = textLines(text);
  for (const label of labels) {
    const idx = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
    if (idx >= 0) {
      if (isStatBlocker(lines[idx - 1]) || isStatBlocker(lines[idx + 1])) return null;
      const home = numberBefore(lines, idx);
      const away = numberAfter(lines, idx);
      if (home !== null || away !== null) return { home, away };
    }
  }
  return null;
}

function normalizeAnimationTextStats(text, match) {
  const stats = emptyStats();
  stats.minute = firstNumber(String(text || '').match(/(?:^|\s)(\d{1,3})\s*[`'′]\s*(?:\n|\s|$)/)?.[1], String(text || '').match(/(?:minute|min|time)\D{0,8}(\d{1,3})/i)?.[1]);
  const score = String(text || '').match(/(?:^|\s)(\d{1,2})\s*[:]\s*(\d{1,2})(?:\s|$)/);
  stats.homeScore = firstNumber(score?.[1], match?.homeScore);
  stats.awayScore = firstNumber(score?.[2], match?.awayScore);

  const mapping = [
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
  for (const [homeField, awayField, labels] of mapping) {
    const pair = findTextStatPair(text, labels);
    if (pair) {
      stats[homeField] = pair.home;
      stats[awayField] = pair.away;
    }
  }
  return stats;
}

function providerError(payload) {
  const code = payload?.code ?? payload?.status_code ?? payload?.status;
  if (code === undefined || code === null) return Boolean(payload?.error || payload?.errors);
  return Number(code) !== 0 && Number(code) !== 200 && String(code).toLowerCase() !== 'success';
}

function providerErrorMessage(payload) {
  const value = payload?.message || payload?.msg || payload?.error || payload?.errors || payload;
  return typeof value === 'string' ? value : JSON.stringify(value || {}).slice(0, 500);
}

async function fetchIsportsAnalysis(providerMatchId) {
  const keys = iSportsKeys();
  if (!keys.length) throw new Error('ISPORTS_API_KEY/ISPORTS_API_KEYS is missing');
  const errors = [];
  for (const apiKey of keys) {
    const url = new URL(`${iSportsBaseUrl()}/sport/football/analysis`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('matchId', String(providerMatchId));
    const response = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || providerError(payload)) {
      const reason = !response.ok ? `HTTP ${response.status}` : providerErrorMessage(payload);
      errors.push(reason);
      if (response.status === 429 || /rate|limit|quota|request/i.test(reason)) continue;
      throw new Error(`iSports analysis failed for ${providerMatchId}: ${reason}`);
    }
    return payload;
  }
  throw new Error(`iSports analysis failed for ${providerMatchId}: ${errors.join(' | ') || 'all keys failed'}`);
}

function statusFromRaw(payload, stats, match) {
  const root = asObject(payload);
  const candidates = [root.status, root.providerStatus, root.matchState, root.match_status, root.fixture?.status?.short, root.fixture?.status?.long, root.data?.status, root.response?.[0]?.fixture?.status?.short, root.response?.[0]?.fixture?.status?.long].filter((value) => value !== undefined && value !== null && value !== '');
  for (const candidate of candidates) {
    const value = String(candidate).trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (['FINISHED', 'FT', 'COMPLETED', 'ENDED', '-1'].includes(value)) return 'FINISHED';
    if (['HT', 'HALFTIME', 'HALF_TIME', 'PAUSED'].includes(value)) return 'HT';
    if (['2H', 'SECOND_HALF'].includes(value)) return '2H';
    if (['1H', 'FIRST_HALF', 'LIVE', 'IN_PLAY'].includes(value)) return Number(stats.minute || 0) >= 46 ? '2H' : '1H';
    if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', '0'].includes(value)) return 'SCHEDULED';
  }
  if (Number(stats.minute || 0) > 0) return Number(stats.minute || 0) >= 46 ? '2H' : '1H';
  return match.status;
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function teamName(match, side) {
  const team = side === 'home' ? match.homeTeam : match.awayTeam;
  return team?.name || team?.code || (side === 'home' ? 'الفريق الأول' : 'الفريق الثاني');
}

function deltaEvent(previous, stats, field, side, type, label, minDelta = 1) {
  if (!previous) return null;
  const before = n(previous[field]);
  const after = n(stats[field]);
  if (after === null || before === null || after - before < minDelta) return null;
  const diff = after - before;
  return { minute: stats.minute, type, teamSide: side, detail: `${label}${diff > 1 ? ` +${diff}` : ''} (الإجمالي ${after})`, sourceName: 'Automated Live Ingest Worker' };
}

function generateEvents(match, previous, stats) {
  const events = [];
  const prevHomeScore = previous ? n(previous.homeScore) : n(match.homeScore);
  const prevAwayScore = previous ? n(previous.awayScore) : n(match.awayScore);
  if (prevHomeScore !== null && stats.homeScore !== null && stats.homeScore > prevHomeScore) events.push({ minute: stats.minute, type: 'goal', teamSide: 'home', detail: `هدف لـ ${teamName(match, 'home')} — النتيجة ${stats.homeScore}-${stats.awayScore ?? prevAwayScore ?? 0}`, sourceName: 'Automated Live Ingest Worker' });
  if (prevAwayScore !== null && stats.awayScore !== null && stats.awayScore > prevAwayScore) events.push({ minute: stats.minute, type: 'goal', teamSide: 'away', detail: `هدف لـ ${teamName(match, 'away')} — النتيجة ${stats.homeScore ?? prevHomeScore ?? 0}-${stats.awayScore}`, sourceName: 'Automated Live Ingest Worker' });
  const candidates = [
    deltaEvent(previous, stats, 'homeShotsOnTarget', 'home', 'shot_on_target', `تسديدة على المرمى لـ ${teamName(match, 'home')}`),
    deltaEvent(previous, stats, 'awayShotsOnTarget', 'away', 'shot_on_target', `تسديدة على المرمى لـ ${teamName(match, 'away')}`),
    deltaEvent(previous, stats, 'homeCorners', 'home', 'corner', `ركنية لـ ${teamName(match, 'home')}`),
    deltaEvent(previous, stats, 'awayCorners', 'away', 'corner', `ركنية لـ ${teamName(match, 'away')}`),
    deltaEvent(previous, stats, 'homeDangerousAttacks', 'home', 'dangerous_attack', `هجمة خطيرة لـ ${teamName(match, 'home')}`, 3),
    deltaEvent(previous, stats, 'awayDangerousAttacks', 'away', 'dangerous_attack', `هجمة خطيرة لـ ${teamName(match, 'away')}`, 3),
    deltaEvent(previous, stats, 'homeYellowCards', 'home', 'yellow_card', `بطاقة صفراء على ${teamName(match, 'home')}`),
    deltaEvent(previous, stats, 'awayYellowCards', 'away', 'yellow_card', `بطاقة صفراء على ${teamName(match, 'away')}`),
    deltaEvent(previous, stats, 'homeRedCards', 'home', 'red_card', `بطاقة حمراء على ${teamName(match, 'home')}`),
    deltaEvent(previous, stats, 'awayRedCards', 'away', 'red_card', `بطاقة حمراء على ${teamName(match, 'away')}`),
  ];
  for (const event of candidates) if (event) events.push(event);
  return events.slice(0, 20);
}

function latestSnapshotAgeSeconds(snapshot) {
  if (!snapshot?.capturedAt) return Number.POSITIVE_INFINITY;
  const capturedAt = new Date(snapshot.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return Number.POSITIVE_INFINITY;
  return (Date.now() - capturedAt) / 1000;
}

async function candidateMatches() {
  const limit = envNumber('LIVE_INGEST_MATCH_LIMIT', 4, 1, 25);
  const lookbackHours = envNumber('LIVE_INGEST_LOOKBACK_HOURS', 3, 1, 24);
  const lookaheadMinutes = envNumber('LIVE_INGEST_LOOKAHEAD_MINUTES', 15, 0, 180);
  const finishedHours = envNumber('LIVE_INGEST_FINISHED_HOURS', 3, 0, 24);
  const now = Date.now();
  const liveStart = new Date(now - lookbackHours * 60 * 60 * 1000);
  const liveEnd = new Date(now + lookaheadMinutes * 60 * 1000);
  const finishedSince = new Date(now - finishedHours * 60 * 60 * 1000);

  return prisma.match.findMany({
    where: { animationMatchId: { not: null }, OR: [{ status: { in: LIVE_STATUSES } }, { status: 'SCHEDULED', matchDate: { gte: liveStart, lte: liveEnd } }, ...(finishedHours > 0 ? [{ status: { in: FINISHED_STATUSES }, matchDate: { gte: finishedSince } }] : [])] },
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    orderBy: { matchDate: 'asc' },
    take: limit,
  });
}

async function latestWorkerSnapshot(matchId) {
  return prisma.matchStatsSnapshot.findFirst({ where: { matchId, provider: { in: ['WORKER_ISPORTS', 'ISPORTS_ANIMATION_BROWSERLESS', 'AUTOMATED_LIVE_INGEST'] } }, orderBy: { capturedAt: 'desc' } });
}

async function postIngest(payload) {
  const secret = ingestSecret();
  if (!secret) throw new Error('LIVE_INGEST_SECRET/ADMIN_API_SECRET/CRON_SECRET is missing');
  const url = `${appBaseUrl()}/api/internal/live-ingest/match-snapshot`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-live-ingest-secret': secret }, body: JSON.stringify(payload) });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`ingest POST failed ${response.status}: ${text.slice(0, 500)}`);
  return data;
}

function recentSnapshotSkip(match, latest) {
  const minIntervalSeconds = envNumber('LIVE_INGEST_MIN_INTERVAL_SECONDS', 180, 30, 3600);
  const ageSeconds = latestSnapshotAgeSeconds(latest);
  if (ageSeconds >= minIntervalSeconds) return null;
  return { matchId: match.id, providerMatchId: match.animationMatchId, status: 'skipped_recent_snapshot', ageSeconds: Math.round(ageSeconds), minIntervalSeconds };
}

async function maybeAnimationBrowserlessFallback(match, currentStats) {
  if (hasUsefulStats(currentStats)) return null;
  const fallback = await fetchISportsAnimationBrowserlessText(match.animationMatchId);
  if (!fallback?.enabled) return fallback;
  const fallbackStats = normalizeAnimationTextStats(fallback.text || '', match);
  return { ...fallback, stats: fallbackStats, hasStats: hasUsefulStats(fallbackStats) };
}

async function processMatch(match, latest) {
  const raw = await fetchIsportsAnalysis(match.animationMatchId);
  let stats = normalizeStats(raw);
  if (stats.homeScore === null) stats.homeScore = match.homeScore;
  if (stats.awayScore === null) stats.awayScore = match.awayScore;

  let sourceProvider = 'WORKER_ISPORTS';
  let rawData = raw;
  let fallbackStatus = null;

  if (!hasUsefulStats(stats) && envBool('LIVE_INGEST_USE_BROWSERLESS_FALLBACK', false)) {
    try {
      const fallback = await maybeAnimationBrowserlessFallback(match, stats);
      fallbackStatus = fallback ? { enabled: fallback.enabled, source: fallback.source, hasStats: fallback.hasStats, hasText: fallback.hasText, sourceUrl: fallback.sourceUrl, error: fallback.error || null } : null;
      if (fallback?.hasStats) {
        stats = fallback.stats;
        if (stats.homeScore === null) stats.homeScore = match.homeScore;
        if (stats.awayScore === null) stats.awayScore = match.awayScore;
        sourceProvider = 'ISPORTS_ANIMATION_BROWSERLESS';
        rawData = fallback.rawData;
      }
    } catch (error) {
      fallbackStatus = { enabled: true, source: 'ISPORTS_ANIMATION_BROWSERLESS', hasStats: false, error: error?.message || String(error) };
    }
  }

  const saveEmpty = envBool('LIVE_INGEST_SAVE_EMPTY', false);
  if (!hasUsefulStats(stats) && !saveEmpty) {
    return { matchId: match.id, providerMatchId: match.animationMatchId, status: 'skipped_no_useful_stats', stats, fallbackStatus };
  }

  const providerStatus = statusFromRaw(rawData, stats, match);
  const events = generateEvents(match, latest, stats);
  const includeRaw = envBool('LIVE_INGEST_INCLUDE_RAW', false);
  const ingestPayload = { matchId: match.id, animationMatchId: match.animationMatchId, provider: sourceProvider, providerMatchId: match.animationMatchId, status: providerStatus, minute: stats.minute, stats, events, ...(includeRaw ? { rawData } : {}) };

  const saved = await postIngest(ingestPayload);
  return { matchId: match.id, providerMatchId: match.animationMatchId, status: 'saved', sourceProvider, providerStatus, minute: stats.minute, hasUsefulStats: hasUsefulStats(stats), savedEventsCount: saved.savedEventsCount ?? 0, snapshotId: saved.snapshot?.id, fallbackStatus };
}

export async function runOnce() {
  const maxRequests = envNumber('LIVE_INGEST_MAX_EXTERNAL_REQUESTS', 4, 1, 25);
  const matches = await candidateMatches();
  const processed = [];
  let externalRequests = 0;

  console.log(`[live-ingest-worker] candidates=${matches.length} maxExternalRequests=${maxRequests}`);
  for (const match of matches) {
    const latest = await latestWorkerSnapshot(match.id);
    const skip = recentSnapshotSkip(match, latest);
    if (skip) { processed.push(skip); continue; }
    if (externalRequests >= maxRequests) { processed.push({ matchId: match.id, providerMatchId: match.animationMatchId, status: 'skipped_run_request_limit' }); continue; }
    try {
      externalRequests += 1;
      processed.push(await processMatch(match, latest));
    } catch (error) {
      processed.push({ matchId: match.id, providerMatchId: match.animationMatchId, status: 'failed', error: error?.message || String(error) });
    }
  }

  const summary = { ok: true, at: new Date().toISOString(), candidates: matches.length, externalRequests, processed };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  const loop = envBool('LIVE_INGEST_LOOP', false);
  const intervalSeconds = envNumber('LIVE_INGEST_POLL_SECONDS', 180, 60, 3600);

  if (!loop) {
    await runOnce();
    await prisma.$disconnect();
    return;
  }

  console.log(`[live-ingest-worker] loop mode enabled. intervalSeconds=${intervalSeconds}`);
  while (true) {
    await runOnce().catch((error) => console.error('[live-ingest-worker] run failed:', error));
    await sleep(intervalSeconds * 1000);
  }
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('automated-live-ingest-worker.mjs') || 
  process.argv[1].endsWith('automated-live-ingest-worker')
);

if (isMain) {
  main().catch(async (error) => {
    console.error('[live-ingest-worker] fatal:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
}
