import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'BREAK'];

type SyncOptions = {
  matchId?: string | null;
  limit?: number;
  lookbackHours?: number;
  allowFinished?: boolean;
  dryRun?: boolean;
};

type MatchEventRow = {
  id: string;
  minute: number | null;
  type: string;
  teamId: string | null;
  playerId: string | null;
  playerName: string | null;
  detail: string;
  sourceName: string | null;
  createdAt: Date;
};

function clampNumber(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeEventType(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  if (/goal|هدف/.test(text)) return 'goal';
  if (/yellow|صفراء|انذار|إنذار/.test(text)) return 'yellow_card';
  if (/red|حمراء|طرد/.test(text)) return 'red_card';
  if (/sub|تبديل/.test(text)) return 'substitution';
  if (/shot|تسديدة|save|blocked|on target/.test(text)) return 'shot';
  if (/corner|ركنية/.test(text)) return 'corner';
  if (/penalty|جزاء/.test(text)) return 'penalty';
  if (/var/.test(text)) return 'var';
  if (/foul|خطأ/.test(text)) return 'foul';
  if (/offside|تسلل/.test(text)) return 'offside';
  return type || 'note';
}

function eventLabel(eventType: string) {
  const key = eventType.toLowerCase();
  if (key.includes('goal')) return 'هدف';
  if (key.includes('yellow')) return 'بطاقة صفراء';
  if (key.includes('red')) return 'بطاقة حمراء';
  if (key.includes('sub')) return 'تبديل';
  if (key.includes('shot')) return 'تسديدة';
  if (key.includes('corner')) return 'ركنية';
  if (key.includes('penalty')) return 'ركلة جزاء';
  if (key.includes('var')) return 'VAR';
  if (key.includes('foul')) return 'خطأ';
  if (key.includes('offside')) return 'تسلل';
  return 'حدث';
}

function extractJerseyNumber(detail?: string | null, playerName?: string | null) {
  const text = `${playerName || ''} ${detail || ''}`;
  const hash = text.match(/#\s?(\d{1,2})\b/);
  if (hash) return hash[1];
  const shirt = text.match(/(?:shirt|no\.?|number|رقم)\s*[:#-]?\s*(\d{1,2})\b/i);
  if (shirt) return shirt[1];
  return null;
}

function teamSide(teamId: string | null | undefined, homeTeamId: string, awayTeamId: string): 'home' | 'away' | 'unknown' {
  if (teamId === homeTeamId) return 'home';
  if (teamId === awayTeamId) return 'away';
  return 'unknown';
}

function deterministicNoise(seed: string, max = 12) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return Math.abs(hash % max);
}

function inferCoordinates(event: MatchEventRow, homeTeamId: string, awayTeamId: string, index: number) {
  const type = normalizeEventType(event.type, event.detail);
  const side = teamSide(event.teamId, homeTeamId, awayTeamId);
  const homeAttacksRight = side === 'home';
  const awayAttacksLeft = side === 'away';
  const noise = deterministicNoise(`${event.id}-${event.minute}-${event.detail}`, 18) - 9;
  const lane = 22 + ((index * 17) % 56);

  if (type === 'goal' || type === 'shot' || type === 'penalty') {
    const x = homeAttacksRight ? 82 : awayAttacksLeft ? 18 : 50;
    const endX = homeAttacksRight ? 96 : awayAttacksLeft ? 4 : null;
    return { x: clampNumber(x + noise / 2), y: clampNumber(50 + noise), endX, endY: 50, zone: 'attacking_third' };
  }

  if (type === 'corner') {
    const x = homeAttacksRight ? 94 : awayAttacksLeft ? 6 : 50;
    const y = index % 2 === 0 ? 8 : 92;
    return { x, y, endX: homeAttacksRight ? 82 : awayAttacksLeft ? 18 : null, endY: 50, zone: 'corner' };
  }

  if (type === 'substitution') {
    return { x: 50, y: side === 'home' ? 94 : side === 'away' ? 6 : 50, endX: null, endY: null, zone: 'touchline' };
  }

  if (type === 'yellow_card' || type === 'red_card' || type === 'foul') {
    const baseX = side === 'home' ? 42 : side === 'away' ? 58 : 50;
    return { x: clampNumber(baseX + noise), y: lane, endX: null, endY: null, zone: 'middle_third' };
  }

  const baseX = side === 'home' ? 35 : side === 'away' ? 65 : 50;
  return { x: clampNumber(baseX + noise), y: lane, endX: null, endY: null, zone: 'general' };
}

function statusList(allowFinished: boolean) {
  return allowFinished ? [...LIVE_STATUSES, ...FINISHED_STATUSES] : LIVE_STATUSES;
}

function numberOption(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export async function ensureLiveAnimationTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveAnimationEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "matchId" TEXT NOT NULL,
      "sequenceNumber" INTEGER NOT NULL,
      "minute" INTEGER,
      "second" INTEGER,
      "teamId" TEXT,
      "playerId" TEXT,
      "playerName" TEXT,
      "jerseyNumber" TEXT,
      "eventType" TEXT NOT NULL DEFAULT 'note',
      "eventLabel" TEXT NOT NULL DEFAULT 'حدث',
      "x" DOUBLE PRECISION,
      "y" DOUBLE PRECISION,
      "endX" DOUBLE PRECISION,
      "endY" DOUBLE PRECISION,
      "zone" TEXT,
      "provider" TEXT NOT NULL DEFAULT 'NORMALIZED_ANIMATION',
      "rawProviderEventId" TEXT,
      "payload" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LiveAnimationEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_sequenceNumber_key" ON "LiveAnimationEvent"("matchId", "sequenceNumber");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_createdAt_idx" ON "LiveAnimationEvent"("matchId", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_matchId_eventType_idx" ON "LiveAnimationEvent"("matchId", "eventType");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LiveAnimationEvent_rawProviderEventId_idx" ON "LiveAnimationEvent"("rawProviderEventId");`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveAnimationState" (
      "matchId" TEXT NOT NULL PRIMARY KEY,
      "lastSequence" INTEGER NOT NULL DEFAULT 0,
      "currentMinute" INTEGER,
      "currentPhase" TEXT,
      "homeScore" INTEGER,
      "awayScore" INTEGER,
      "lastEventId" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LiveAnimationState_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

async function existingSequences(matchId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<{ sequenceNumber: number }[]>(
      `SELECT "sequenceNumber" FROM "LiveAnimationEvent" WHERE "matchId" = $1`,
      matchId,
    );
    return new Set(rows.map((row) => Number(row.sequenceNumber)));
  } catch {
    return new Set<number>();
  }
}

async function upsertAnimationEvent(input: {
  matchId: string;
  sequenceNumber: number;
  event: MatchEventRow;
  homeTeamId: string;
  awayTeamId: string;
  index: number;
}) {
  const { event, matchId, sequenceNumber, homeTeamId, awayTeamId, index } = input;
  const eventType = normalizeEventType(event.type, event.detail);
  const coords = inferCoordinates(event, homeTeamId, awayTeamId, index);
  const payload = JSON.stringify({
    source: 'match_event_normalizer',
    matchEventId: event.id,
    originalType: event.type,
    detail: event.detail,
  });

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "LiveAnimationEvent" (
        "id", "matchId", "sequenceNumber", "minute", "second", "teamId", "playerId", "playerName", "jerseyNumber",
        "eventType", "eventLabel", "x", "y", "endX", "endY", "zone", "provider", "rawProviderEventId", "payload", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, NULL, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("matchId", "sequenceNumber") DO UPDATE SET
        "minute" = EXCLUDED."minute",
        "teamId" = EXCLUDED."teamId",
        "playerId" = EXCLUDED."playerId",
        "playerName" = EXCLUDED."playerName",
        "jerseyNumber" = EXCLUDED."jerseyNumber",
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
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    randomUUID(),
    matchId,
    sequenceNumber,
    event.minute,
    event.teamId,
    event.playerId,
    event.playerName,
    extractJerseyNumber(event.detail, event.playerName),
    eventType,
    eventLabel(eventType),
    coords.x,
    coords.y,
    coords.endX,
    coords.endY,
    coords.zone,
    event.sourceName || 'MATCH_EVENT_NORMALIZER',
    event.id,
    payload,
    event.createdAt,
  );
}

async function updateAnimationState(match: any, lastSequence: number, lastEventId: string | null) {
  const latestSnapshot = match.statsSnapshots?.[0] || null;
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "LiveAnimationState" ("matchId", "lastSequence", "currentMinute", "currentPhase", "homeScore", "awayScore", "lastEventId", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT ("matchId") DO UPDATE SET
        "lastSequence" = EXCLUDED."lastSequence",
        "currentMinute" = EXCLUDED."currentMinute",
        "currentPhase" = EXCLUDED."currentPhase",
        "homeScore" = EXCLUDED."homeScore",
        "awayScore" = EXCLUDED."awayScore",
        "lastEventId" = EXCLUDED."lastEventId",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    match.id,
    lastSequence,
    latestSnapshot?.minute ?? null,
    match.status,
    latestSnapshot?.homeScore ?? match.homeScore ?? null,
    latestSnapshot?.awayScore ?? match.awayScore ?? null,
    lastEventId,
  );
}

async function syncOneMatch(match: any, dryRun: boolean) {
  const events = await prisma.matchEvent.findMany({
    where: { matchId: match.id },
    orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
    take: 250,
  }) as MatchEventRow[];

  const existing = await existingSequences(match.id);
  let inserted = 0;
  let updated = 0;
  let lastSequence = 0;
  let lastEventId: string | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const minutePart = Math.max(0, Number(event.minute || 0)) * 100;
    const sequenceNumber = minutePart + index + 1;
    lastSequence = Math.max(lastSequence, sequenceNumber);
    lastEventId = event.id;
    if (existing.has(sequenceNumber)) updated += 1;
    else inserted += 1;
    if (!dryRun) {
      await upsertAnimationEvent({
        matchId: match.id,
        sequenceNumber,
        event,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        index,
      });
    }
  }

  if (!dryRun) await updateAnimationState(match, lastSequence, lastEventId);

  return {
    matchId: match.id,
    title: `${match.homeTeam?.name || match.homeTeamId} ضد ${match.awayTeam?.name || match.awayTeamId}`,
    sourceEvents: events.length,
    inserted,
    updated,
    lastSequence,
    dryRun,
  };
}

export async function runLiveAnimationSync(options: SyncOptions = {}) {
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
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
    },
    orderBy: { matchDate: 'desc' },
    take: options.matchId ? 1 : limit,
  });

  const results = [];
  for (const match of matches) {
    results.push(await syncOneMatch(match, dryRun));
  }

  return {
    ok: true,
    mode: 'live_animation_sync_worker_v1',
    source: 'MatchEvent -> LiveAnimationEvent',
    limit,
    lookbackHours,
    allowFinished,
    dryRun,
    candidates: matches.length,
    results,
    note: 'This worker reads saved DB MatchEvent rows and writes normalized LiveAnimationEvent rows. It does not fetch external providers yet.',
  };
}
