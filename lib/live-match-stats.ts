import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { footballFetchFromProvider } from '@/lib/apiFootball';

export type NormalizedStats = {
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
  homeCorners: number | null;
  awayCorners: number | null;
  homeYellowCards: number | null;
  awayYellowCards: number | null;
  homeRedCards: number | null;
  awayRedCards: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

type NormalizedEvent = {
  minute: number | null;
  type: string;
  teamName?: string | null;
  playerName?: string | null;
  detail: string;
  sourceName: string;
  sourceUrl?: string | null;
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
  homeCorners: null,
  awayCorners: null,
  homeYellowCards: null,
  awayYellowCards: null,
  homeRedCards: null,
  awayRedCards: null,
  homeScore: null,
  awayScore: null,
};

export function providerErrorDetails(error: any, debug = false) {
  const details: any = { error: error?.message || 'Unknown error' };
  if (error?.provider) details.provider = error.provider;
  if (error?.status) details.providerStatus = error.status;
  if (error?.keyIndex !== undefined) details.keyIndex = error.keyIndex;
  if (debug && error?.payload !== undefined) details.providerPayload = error.payload;
  return details;
}

export async function ensureStatsTable() {
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

  const columns = [
    ['homeCorners', 'INTEGER'],
    ['awayCorners', 'INTEGER'],
    ['homeYellowCards', 'INTEGER'],
    ['awayYellowCards', 'INTEGER'],
    ['homeRedCards', 'INTEGER'],
    ['awayRedCards', 'INTEGER'],
  ];

  for (const [name, type] of columns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "MatchStatsSnapshot" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
  }

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

function collectArrays(value: any, output: any[] = [], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return output;
  if (Array.isArray(value)) {
    output.push(value);
    value.forEach((item) => collectArrays(item, output, depth + 1));
    return output;
  }
  Object.values(value).forEach((item) => collectArrays(item, output, depth + 1));
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

export function normalizeStats(payload: any): NormalizedStats {
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

const LIVE_STAT_FIELDS: (keyof NormalizedStats)[] = [
  'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
];

export function hasUsefulStats(stats: NormalizedStats) {
  return LIVE_STAT_FIELDS.some((key) => stats[key] !== null && stats[key] !== undefined);
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function getLatestSnapshot(matchId: string) {
  await ensureStatsTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "MatchStatsSnapshot"
    WHERE "matchId" = ${quoteSql(matchId)}
    ORDER BY "capturedAt" DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

export async function getSnapshotHistory(matchId: string, limit = 80) {
  await ensureStatsTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "MatchStatsSnapshot"
    WHERE "matchId" = ${quoteSql(matchId)}
    ORDER BY "capturedAt" DESC
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `);
  return rows;
}

async function saveSnapshot(match: any, providerMatchId: number, stats: NormalizedStats, rawData: any) {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MatchStatsSnapshot" (
      "id", "matchId", "provider", "providerMatchId", "minute",
      "homePossession", "awayPossession", "homeAttacks", "awayAttacks",
      "homeDangerousAttacks", "awayDangerousAttacks", "homeShots", "awayShots",
      "homeShotsOnTarget", "awayShotsOnTarget", "homeShotsOffTarget", "awayShotsOffTarget",
      "homeCorners", "awayCorners", "homeYellowCards", "awayYellowCards", "homeRedCards", "awayRedCards",
      "homeScore", "awayScore", "rawData"
    ) VALUES ($1,$2,'ISPORTS',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb)`,
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
    stats.homeCorners,
    stats.awayCorners,
    stats.homeYellowCards,
    stats.awayYellowCards,
    stats.homeRedCards,
    stats.awayRedCards,
    stats.homeScore,
    stats.awayScore,
    JSON.stringify(rawData || null)
  );
  return id;
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function eventTypeFromLabel(value: string) {
  const text = value.toLowerCase();
  if (text.includes('goal') || text.includes('هدف')) return 'goal';
  if (text.includes('yellow')) return 'yellow_card';
  if (text.includes('red')) return 'red_card';
  if (text.includes('corner')) return 'corner';
  if (text.includes('sub')) return 'substitution';
  if (text.includes('var')) return 'var';
  if (text.includes('penalty')) return 'penalty';
  if (text.includes('danger')) return 'dangerous_attack';
  return 'match_event';
}

function isEventLike(row: any) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const label = textValue(row.type, row.eventType, row.kind, row.name, row.detail, row.text, row.event, row.incidentType);
  if (!label) return false;
  const lower = label.toLowerCase();
  return ['goal', 'card', 'corner', 'sub', 'var', 'penalty', 'danger', 'yellow', 'red'].some((token) => lower.includes(token)) || row.minute || row.time;
}

export function normalizeEvents(payload: any): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  for (const array of collectArrays(payload)) {
    for (const row of array) {
      if (!isEventLike(row)) continue;
      const detail = textValue(row.detail, row.text, row.name, row.type, row.event, row.incidentType);
      const type = eventTypeFromLabel(textValue(row.type, row.eventType, row.kind, row.name, row.detail, row.event, row.incidentType));
      if (!detail) continue;
      events.push({
        minute: firstNumber(row.minute, row.time, row.elapsed, row.matchMinute),
        type,
        teamName: textValue(row.teamName, row.team?.name, row.team, row.side),
        playerName: textValue(row.playerName, row.player?.name, row.player, row.player_name),
        detail,
        sourceName: 'ISPORTS',
        sourceUrl: null,
      });
    }
  }
  return events.slice(0, 30);
}

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function statDeltaEvent(prev: any, stats: NormalizedStats, key: keyof NormalizedStats, teamName: string, type: string, detail: string, minDelta = 1): NormalizedEvent | null {
  const before = n(prev?.[key]);
  const after = n(stats[key]);
  if (before === null || after === null || after - before < minDelta) return null;
  return { minute: stats.minute, type, teamName, detail, sourceName: 'MC PRIME Live Monitor' };
}

function generatedImportantEvents(match: any, previous: any, stats: NormalizedStats): NormalizedEvent[] {
  const homeName = match.homeTeam?.name || 'الفريق الأول';
  const awayName = match.awayTeam?.name || 'الفريق الثاني';
  const events: NormalizedEvent[] = [];

  const prevHomeScore = n(previous?.homeScore);
  const prevAwayScore = n(previous?.awayScore);
  if (prevHomeScore !== null && stats.homeScore !== null && stats.homeScore > prevHomeScore) {
    events.push({ minute: stats.minute, type: 'goal', teamName: homeName, detail: `هدف لـ ${homeName} — النتيجة ${stats.homeScore} - ${stats.awayScore ?? prevAwayScore ?? 0}`, sourceName: 'MC PRIME Live Monitor' });
  }
  if (prevAwayScore !== null && stats.awayScore !== null && stats.awayScore > prevAwayScore) {
    events.push({ minute: stats.minute, type: 'goal', teamName: awayName, detail: `هدف لـ ${awayName} — النتيجة ${stats.homeScore ?? prevHomeScore ?? 0} - ${stats.awayScore}`, sourceName: 'MC PRIME Live Monitor' });
  }

  const candidates = [
    statDeltaEvent(previous, stats, 'homeDangerousAttacks', homeName, 'dangerous_attack', `هجمة خطيرة لـ ${homeName}`, 3),
    statDeltaEvent(previous, stats, 'awayDangerousAttacks', awayName, 'dangerous_attack', `هجمة خطيرة لـ ${awayName}`, 3),
    statDeltaEvent(previous, stats, 'homeShotsOnTarget', homeName, 'shot_on_target', `تسديدة على المرمى لـ ${homeName}`, 1),
    statDeltaEvent(previous, stats, 'awayShotsOnTarget', awayName, 'shot_on_target', `تسديدة على المرمى لـ ${awayName}`, 1),
    statDeltaEvent(previous, stats, 'homeCorners', homeName, 'corner', `ركنية لـ ${homeName}`, 1),
    statDeltaEvent(previous, stats, 'awayCorners', awayName, 'corner', `ركنية لـ ${awayName}`, 1),
    statDeltaEvent(previous, stats, 'homeYellowCards', homeName, 'yellow_card', `بطاقة صفراء على ${homeName}`, 1),
    statDeltaEvent(previous, stats, 'awayYellowCards', awayName, 'yellow_card', `بطاقة صفراء على ${awayName}`, 1),
    statDeltaEvent(previous, stats, 'homeRedCards', homeName, 'red_card', `بطاقة حمراء على ${homeName}`, 1),
    statDeltaEvent(previous, stats, 'awayRedCards', awayName, 'red_card', `بطاقة حمراء على ${awayName}`, 1),
  ];

  for (const event of candidates) if (event) events.push(event);
  return events;
}

async function saveEventIfNew(match: any, event: NormalizedEvent) {
  const detail = event.detail.slice(0, 240);
  const existing = await prisma.matchEvent.findFirst({
    where: {
      matchId: match.id,
      minute: event.minute,
      type: event.type,
      detail,
    },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.matchEvent.create({
    data: {
      matchId: match.id,
      minute: event.minute,
      type: event.type,
      teamId: match.homeTeam?.name === event.teamName ? match.homeTeamId : match.awayTeam?.name === event.teamName ? match.awayTeamId : null,
      playerName: event.playerName || null,
      detail,
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl || null,
    },
  });
}

export async function syncMatchStats(match: any, options: { debug?: boolean; force?: boolean } = {}) {
  await ensureStatsTable();
  const providerMatchId = Number(match.animationMatchId);
  if (!providerMatchId || !Number.isFinite(providerMatchId)) {
    return { status: 'missing_provider_match_id', snapshotId: null, stats: null, savedEvents: [] };
  }

  const previous = await getLatestSnapshot(match.id);
  const raw = await footballFetchFromProvider('ISPORTS', '/analysis', { fixture: providerMatchId });
  const stats = normalizeStats(raw);
  if (stats.homeScore === null) stats.homeScore = match.homeScore;
  if (stats.awayScore === null) stats.awayScore = match.awayScore;

  if (!hasUsefulStats(stats) && !options.debug) {
    return { status: 'no_mapped_stats', snapshotId: null, stats, savedEvents: [], ...(options.debug ? { raw } : {}) };
  }

  const snapshotId = await saveSnapshot(match, providerMatchId, stats, raw);
  const rawEvents = normalizeEvents(raw);
  const generated = previous ? generatedImportantEvents(match, previous, stats) : [];
  const savedEvents = [];
  for (const event of [...generated, ...rawEvents]) {
    const saved = await saveEventIfNew(match, event);
    if (saved) savedEvents.push(saved);
  }

  return { status: 'saved', snapshotId, stats, savedEvents, ...(options.debug ? { raw } : {}) };
}

export function publicSnapshot(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    matchId: row.matchId,
    provider: row.provider,
    providerMatchId: row.providerMatchId,
    minute: row.minute,
    homePossession: row.homePossession,
    awayPossession: row.awayPossession,
    homeAttacks: row.homeAttacks,
    awayAttacks: row.awayAttacks,
    homeDangerousAttacks: row.homeDangerousAttacks,
    awayDangerousAttacks: row.awayDangerousAttacks,
    homeShots: row.homeShots,
    awayShots: row.awayShots,
    homeShotsOnTarget: row.homeShotsOnTarget,
    awayShotsOnTarget: row.awayShotsOnTarget,
    homeShotsOffTarget: row.homeShotsOffTarget,
    awayShotsOffTarget: row.awayShotsOffTarget,
    homeCorners: row.homeCorners,
    awayCorners: row.awayCorners,
    homeYellowCards: row.homeYellowCards,
    awayYellowCards: row.awayYellowCards,
    homeRedCards: row.homeRedCards,
    awayRedCards: row.awayRedCards,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    capturedAt: row.capturedAt instanceof Date ? row.capturedAt.toISOString() : row.capturedAt,
  };
}