import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STAT_FIELDS = [
  'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks',
  'homeDangerousAttacks', 'awayDangerousAttacks', 'homeShots', 'awayShots',
  'homeShotsOnTarget', 'awayShotsOnTarget', 'homeShotsOffTarget', 'awayShotsOffTarget',
  'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards',
  'homeScore', 'awayScore',
] as const;

const STATUS_MAP: Record<string, string> = {
  LIVE: 'LIVE', IN_PLAY: 'IN_PLAY', '1H': '1H', FIRST_HALF: '1H', '2H': '2H', SECOND_HALF: '2H',
  HT: 'HT', HALF_TIME: 'HT', HALFTIME: 'HT', ET: 'ET', AET: 'AET', PEN: 'PEN',
  FINISHED: 'FINISHED', FT: 'FINISHED', COMPLETED: 'FINISHED', ENDED: 'FINISHED',
  SCHEDULED: 'SCHEDULED', TIMED: 'SCHEDULED', NOT_STARTED: 'SCHEDULED', NS: 'SCHEDULED',
};

const MAX_EVENTS_PER_SNAPSHOT = 12;

type IngestEvent = { minute?: unknown; type?: unknown; teamId?: unknown; teamSide?: unknown; playerName?: unknown; detail?: unknown; sourceName?: unknown; sourceUrl?: unknown };

function configuredSecrets() {
  return [process.env.LIVE_INGEST_SECRET, process.env.CRON_SECRET, process.env.ADMIN_API_SECRET].map((value) => String(value || '').trim()).filter(Boolean);
}

function isAuthorized(req: Request) {
  const valid = configuredSecrets();
  if (!valid.length) return { valid: false, reason: 'LIVE_INGEST_SECRET, CRON_SECRET, or ADMIN_API_SECRET must be configured.' };
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [bearer, req.headers.get('x-live-ingest-secret')?.trim() || '', req.headers.get('x-cron-secret')?.trim() || '', req.headers.get('x-admin-secret')?.trim() || ''];
  return candidates.some((value) => value && valid.includes(value)) ? { valid: true, reason: null } : { valid: false, reason: 'Unauthorized' };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown) { return String(value ?? '').trim(); }
function cleanProvider(value: unknown) { return text(value || 'INTERNAL_INGEST').toUpperCase().replace(/[^A-Z0-9_:-]/g, '_').slice(0, 64) || 'INTERNAL_INGEST'; }

function nullableInt(value: unknown, min?: number, max?: number) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  return Math.max(min ?? rounded, Math.min(max ?? rounded, rounded));
}

function positiveInt(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.floor(number);
}

function normalizeStatus(value: unknown) {
  const raw = text(value).toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS_MAP[raw] || null;
}

function valueFromStats(payload: Record<string, any>, stats: Record<string, any>, field: typeof STAT_FIELDS[number]) {
  return nullableInt(payload[field] ?? stats[field]);
}

function matchWhere(payload: Record<string, any>) {
  const matchId = text(payload.matchId || payload.dbMatchId || payload.id);
  if (matchId) return { id: matchId };
  const animationMatchId = positiveInt(payload.animationMatchId ?? payload.providerMatchId ?? payload.matchProviderId);
  if (animationMatchId) return { animationMatchId };
  return null;
}

function eventTeamId(match: any, event: IngestEvent) {
  const explicit = text(event.teamId);
  if (explicit && (explicit === match.homeTeamId || explicit === match.awayTeamId)) return explicit;
  const side = text(event.teamSide).toLowerCase();
  if (side === 'home' || side === 'h') return match.homeTeamId;
  if (side === 'away' || side === 'a') return match.awayTeamId;
  return null;
}

function normalizeEvents(payload: Record<string, any>, match: any) {
  const rows = Array.isArray(payload.events) ? payload.events.slice(0, MAX_EVENTS_PER_SNAPSHOT) : [];
  return rows
    .map((row: IngestEvent) => {
      const detail = text(row?.detail).slice(0, 240);
      if (!detail) return null;
      return {
        matchId: match.id,
        minute: nullableInt(row.minute, 0, 130),
        type: text(row.type || 'match_event').toLowerCase().replace(/[^a-z0-9_:-]/g, '_').slice(0, 48) || 'match_event',
        teamId: eventTeamId(match, row),
        playerName: text(row.playerName).slice(0, 120) || null,
        detail,
        sourceName: text(row.sourceName || payload.provider || 'Internal Live Ingest').slice(0, 120) || 'Internal Live Ingest',
        sourceUrl: text(row.sourceUrl).slice(0, 500) || null,
      };
    })
    .filter(Boolean) as Array<{ matchId: string; minute: number | null; type: string; teamId: string | null; playerName: string | null; detail: string; sourceName: string; sourceUrl: string | null }>;
}

function eventDedupeKey(event: ReturnType<typeof normalizeEvents>[number]) {
  return [event.matchId, event.minute ?? '', event.type, event.teamId ?? '', event.playerName ?? '', event.detail, event.sourceName].join('|');
}

function dedupeEvents(events: ReturnType<typeof normalizeEvents>) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = eventDedupeKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function createEventIfMissing(event: ReturnType<typeof normalizeEvents>[number]) {
  const existing = await prisma.matchEvent.findFirst({
    where: { matchId: event.matchId, minute: event.minute, type: event.type, detail: event.detail, sourceName: event.sourceName },
    select: { id: true },
  });
  if (existing) return null;
  return prisma.matchEvent.create({ data: event, select: { id: true } });
}

export async function POST(req: Request) {
  const auth = isAuthorized(req);
  if (!auth.valid) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.reason === 'Unauthorized' ? 401 : 503, headers: { 'Cache-Control': 'no-store' } });

  let payload: Record<string, any>;
  try { payload = asRecord(await req.json()); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }

  const where = matchWhere(payload);
  if (!where) return NextResponse.json({ ok: false, error: 'matchId, dbMatchId, animationMatchId, or providerMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const match = await prisma.match.findFirst({
    where,
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
  });
  if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const provider = cleanProvider(payload.provider || payload.sourceName);
  const stats = asRecord(payload.stats);
  const status = normalizeStatus(payload.status ?? payload.providerStatus ?? stats.status);
  const providerMatchId = nullableInt(payload.providerMatchId ?? payload.animationMatchId ?? match.animationMatchId, 0);
  if (providerMatchId === null) return NextResponse.json({ ok: false, error: 'providerMatchId is required when the matched row has no animationMatchId' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const snapshotData: any = {
    id: randomUUID(), matchId: match.id, provider, providerMatchId,
    minute: nullableInt(payload.minute ?? stats.minute, 0, 130),
    rawData: { source: 'internal-live-ingest', provider, status, providerStatus: status, receivedAt: new Date().toISOString(), stats, raw: payload.rawData ?? null },
  };
  for (const field of STAT_FIELDS) snapshotData[field] = valueFromStats(payload, stats, field);

  const matchUpdate: any = {};
  if (status && match.status !== 'FINAL_VERIFIED') matchUpdate.status = status;
  if (snapshotData.homeScore !== null) matchUpdate.homeScore = snapshotData.homeScore;
  if (snapshotData.awayScore !== null) matchUpdate.awayScore = snapshotData.awayScore;

  const events = dedupeEvents(normalizeEvents(payload, match));

  // Keep every database operation short and independent. Render/Postgres can briefly be busy during deploys
  // and live polling; avoiding a long transaction prevents Prisma P2028 "Unable to start a transaction" errors.
  const snapshot = await prisma.matchStatsSnapshot.create({ data: snapshotData });
  const updatedMatch = Object.keys(matchUpdate).length
    ? await prisma.match.update({ where: { id: match.id }, data: matchUpdate, select: { id: true, status: true, homeScore: true, awayScore: true } })
    : { id: match.id, status: match.status, homeScore: match.homeScore, awayScore: match.awayScore };

  let savedEventsCount = 0;
  for (const event of events) {
    try {
      const saved = await createEventIfMissing(event);
      if (saved) savedEventsCount += 1;
    } catch (error: any) {
      console.warn('[live-ingest] skipped event write:', error?.message || String(error));
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'db_only_live_ingest_no_long_transaction',
    match: updatedMatch,
    snapshot: { id: snapshot.id, provider: snapshot.provider, providerMatchId: snapshot.providerMatchId, minute: snapshot.minute, capturedAt: snapshot.capturedAt },
    savedEventsCount,
    note: 'This endpoint only writes supplied payload data into the database. It never fetches external providers.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Use POST with a signed ingest payload.' }, { status: 405, headers: { 'Cache-Control': 'no-store' } });
}
