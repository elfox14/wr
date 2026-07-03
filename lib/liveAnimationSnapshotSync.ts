import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { ensureLiveAnimationTables } from '@/lib/liveAnimationSync';
import {
  animationEventLabel,
  inferLiveAnimationSpatial,
  normalizeAnimationEventType,
  type AnimationTeamSide,
} from '@/lib/liveAnimationSpatial';

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'BREAK', 'PAUSED'];

type SnapshotSyncOptions = {
  matchId?: string | null;
  limit?: number;
  lookbackHours?: number;
  allowFinished?: boolean;
  dryRun?: boolean;
};

function numberOption(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableMinute(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace("'", '').trim() : value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(130, Math.round(number)));
}

function statusList(allowFinished: boolean) {
  return allowFinished ? [...LIVE_STATUSES, ...FINISHED_STATUSES] : LIVE_STATUSES;
}

function normalizeName(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamIdFromName(teamName: unknown, homeTeam: any, awayTeam: any) {
  const name = normalizeName(teamName);
  if (!name) return null;
  const home = normalizeName(homeTeam?.name || homeTeam?.code);
  const away = normalizeName(awayTeam?.name || awayTeam?.code);
  if (home && (name.includes(home) || home.includes(name))) return homeTeam.id;
  if (away && (name.includes(away) || away.includes(name))) return awayTeam.id;
  return null;
}

function sideFromTeam(teamId: string | null | undefined, homeTeamId: string, awayTeamId: string): AnimationTeamSide {
  if (teamId === homeTeamId) return 'home';
  if (teamId === awayTeamId) return 'away';
  return 'unknown';
}

function coord(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number >= 0 && number <= 1) return number * 100;
  if (number >= 0 && number <= 100) return number;
  return null;
}

function snapshotEvents(snapshot: any) {
  const raw = asRecord(snapshot?.rawData);
  const normalized = asRecord(raw.normalized);
  const events = asRecord(normalized.eventsDetailed).all;
  return Array.isArray(events) ? events : [];
}

function buildSequence(row: any, index: number) {
  const explicit = toNumber(row.sequence ?? row.sequenceNumber, 0);
  if (explicit > 0) return Math.min(999999, Math.floor(explicit));
  const minute = nullableMinute(row.minute);
  return Math.max(1, (minute ?? 0) * 100 + index + 1);
}

async function existingSnapshotSequences(matchId: string) {
  const rows = await prisma.$queryRawUnsafe<{ sequenceNumber: number }[]>(
    `SELECT "sequenceNumber" FROM "LiveAnimationEvent" WHERE "matchId" = $1 AND "provider" = 'THE_STATS_SNAPSHOT_EVENTS'`,
    matchId,
  ).catch(() => []);
  return new Set(rows.map((row) => Number(row.sequenceNumber)));
}

async function upsertSnapshotEvent(input: {
  match: any;
  snapshot: any;
  row: any;
  index: number;
}) {
  const { match, snapshot, row, index } = input;
  const minute = nullableMinute(row.minute);
  const eventType = normalizeAnimationEventType(row.type || row.eventType || row.detail, row.detail);
  const teamId = row.teamId && [match.homeTeam.id, match.awayTeam.id].includes(String(row.teamId))
    ? String(row.teamId)
    : teamIdFromName(row.teamName, match.homeTeam, match.awayTeam);
  const side = sideFromTeam(teamId, match.homeTeam.id, match.awayTeam.id);
  const explicitX = coord(row.x ?? row.startX ?? row.location?.x ?? row.coordinates?.x);
  const explicitY = coord(row.y ?? row.startY ?? row.location?.y ?? row.coordinates?.y);
  const explicitEndX = coord(row.endX ?? row.end_x ?? row.end?.x);
  const explicitEndY = coord(row.endY ?? row.end_y ?? row.end?.y);
  const spatial = inferLiveAnimationSpatial({
    id: String(row.id || row.sequence || `snapshot-${index}`),
    type: eventType,
    detail: row.detail || row.type || row.eventType,
    minute,
    teamSide: side,
    index,
    explicitX,
    explicitY,
    explicitEndX,
    explicitEndY,
  });
  const hasExact = explicitX !== null && explicitY !== null;
  const sequenceNumber = buildSequence(row, index);
  const payload = JSON.stringify({
    source: 'thestats_snapshot_event_normalizer',
    snapshotId: snapshot.id,
    providerMatchId: snapshot.providerMatchId,
    row,
  });

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "LiveAnimationEvent" (
        "id", "matchId", "sequenceNumber", "minute", "second", "teamId", "playerId", "playerName", "jerseyNumber",
        "eventType", "eventLabel", "x", "y", "endX", "endY", "zone", "provider", "rawProviderEventId", "payload",
        "coordinateSource", "coordinateConfidence", "eventSide", "isInferred", "anchorZone", "displayPriority", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, NULL, $5, $6, $7, NULL,
        $8, $9, $10, $11, $12, $13, $14, 'THE_STATS_SNAPSHOT_EVENTS', $15, $16::jsonb,
        $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("matchId", "sequenceNumber") DO UPDATE SET
        "minute" = EXCLUDED."minute",
        "teamId" = EXCLUDED."teamId",
        "playerId" = EXCLUDED."playerId",
        "playerName" = EXCLUDED."playerName",
        "eventType" = EXCLUDED."eventType",
        "eventLabel" = EXCLUDED."eventLabel",
        "x" = EXCLUDED."x",
        "y" = EXCLUDED."y",
        "endX" = EXCLUDED."endX",
        "endY" = EXCLUDED."endY",
        "zone" = EXCLUDED."zone",
        "provider" = EXCLUDED."provider",
        "rawProviderEventId" = EXCLUDED."rawProviderEventId",
        "payload" = EXCLUDED."payload",
        "coordinateSource" = EXCLUDED."coordinateSource",
        "coordinateConfidence" = EXCLUDED."coordinateConfidence",
        "eventSide" = EXCLUDED."eventSide",
        "isInferred" = EXCLUDED."isInferred",
        "anchorZone" = EXCLUDED."anchorZone",
        "displayPriority" = EXCLUDED."displayPriority",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    randomUUID(),
    match.id,
    sequenceNumber,
    minute,
    teamId,
    row.playerId || null,
    row.playerName || null,
    eventType,
    animationEventLabel(eventType),
    explicitX ?? spatial.x,
    explicitY ?? spatial.y,
    explicitEndX ?? spatial.endX,
    explicitEndY ?? spatial.endY,
    spatial.zone,
    String(row.id || row.sequence || `${snapshot.id}:${index}`).slice(0, 160),
    payload,
    hasExact ? 'THE_STATS_COORDINATES' : spatial.coordinateSource,
    hasExact ? 'HIGH' : spatial.coordinateConfidence,
    spatial.eventSide,
    !hasExact,
    spatial.anchorZone,
    spatial.displayPriority,
    snapshot.capturedAt || new Date(),
  );

  return sequenceNumber;
}

async function updateSnapshotAnimationState(match: any, lastSequence: number) {
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "LiveAnimationState" ("matchId", "lastSequence", "currentMinute", "currentPhase", "homeScore", "awayScore", "lastEventId", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT ("matchId") DO UPDATE SET
        "lastSequence" = GREATEST("LiveAnimationState"."lastSequence", EXCLUDED."lastSequence"),
        "currentMinute" = COALESCE(EXCLUDED."currentMinute", "LiveAnimationState"."currentMinute"),
        "currentPhase" = COALESCE(EXCLUDED."currentPhase", "LiveAnimationState"."currentPhase"),
        "homeScore" = COALESCE(EXCLUDED."homeScore", "LiveAnimationState"."homeScore"),
        "awayScore" = COALESCE(EXCLUDED."awayScore", "LiveAnimationState"."awayScore"),
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    match.id,
    lastSequence,
    match.minute ?? null,
    match.status ?? null,
    match.homeScore ?? null,
    match.awayScore ?? null,
  );
}

async function syncOneMatchFromSnapshots(match: any, dryRun: boolean) {
  const snapshot = (match.statsSnapshots || []).find((item: any) => snapshotEvents(item).length > 0) || null;
  if (!snapshot) {
    return { matchId: match.id, title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`, snapshotEvents: 0, inserted: 0, updated: 0, lastSequence: 0, dryRun };
  }

  const rows = snapshotEvents(snapshot).slice(0, 180);
  const existing = await existingSnapshotSequences(match.id);
  let inserted = 0;
  let updated = 0;
  let lastSequence = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const sequenceNumber = buildSequence(rows[index], index);
    lastSequence = Math.max(lastSequence, sequenceNumber);
    if (existing.has(sequenceNumber)) updated += 1;
    else inserted += 1;
    if (!dryRun) await upsertSnapshotEvent({ match, snapshot, row: rows[index], index });
  }

  if (!dryRun && lastSequence > 0) await updateSnapshotAnimationState(match, lastSequence);

  return {
    matchId: match.id,
    title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`,
    snapshotId: snapshot.id,
    snapshotEvents: rows.length,
    inserted,
    updated,
    lastSequence,
    dryRun,
  };
}

export async function runLiveAnimationSnapshotSync(options: SnapshotSyncOptions = {}) {
  const limit = numberOption(options.limit, 8, 1, 50);
  const lookbackHours = numberOption(options.lookbackHours, 12, 1, 24 * 30);
  const allowFinished = Boolean(options.allowFinished);
  const dryRun = Boolean(options.dryRun);

  await ensureLiveAnimationTables();

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: options.matchId
      ? { id: String(options.matchId) }
      : {
          matchDate: { gte: since, lte: new Date(Date.now() + 6 * 60 * 60 * 1000) },
          status: { in: statusList(allowFinished) },
        },
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: {
        where: { provider: { startsWith: 'THE_STATS_API' } },
        orderBy: { capturedAt: 'desc' },
        take: 4,
      },
    },
    orderBy: { matchDate: 'desc' },
    take: options.matchId ? 1 : limit,
  });

  const results = [];
  for (const match of matches) results.push(await syncOneMatchFromSnapshots(match, dryRun));

  return {
    ok: true,
    mode: 'live_animation_snapshot_sync_v1',
    source: 'MatchStatsSnapshot.rawData.normalized.eventsDetailed.all -> LiveAnimationEvent',
    limit,
    lookbackHours,
    allowFinished,
    dryRun,
    candidates: matches.length,
    results,
    note: 'This fallback makes the interactive pitch work when MatchEvent/LiveAnimationEvent is empty but TheStats snapshots contain events.',
  };
}
