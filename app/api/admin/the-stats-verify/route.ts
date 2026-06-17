import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getTheStatsApiConfigStatus,
  isTheStatsApiVerifyOnly,
  safeTheStatsApiError,
  theStatsApiFetch,
} from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type QueryMap = Record<string, string | number | boolean | null | undefined>;
type ControlInput = {
  providerPath?: string;
  matchId?: string;
  date?: string;
  dryRun?: boolean;
  apply?: boolean;
  includeRaw?: boolean;
  query?: QueryMap;
};

const CONTROL_KEYS = new Set([
  'providerPath',
  'path',
  'matchId',
  'id',
  'date',
  'dryRun',
  'apply',
  'includeRaw',
  'adminSecret',
  'cronSecret',
  'key',
]);

const FINISHED_STATUSES = new Set(['FINISHED', 'FT', 'FULL_TIME', 'AET', 'PEN', 'ENDED', 'FINAL']);
const LIVE_STATUSES = new Set(['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'ET']);
const SCHEDULED_STATUSES = new Set(['SCHEDULED', 'TIMED', 'NS', 'NOT_STARTED', 'TBD']);
const SAFE_APPLY_FIELDS = new Set(['status', 'homeScore', 'awayScore']);

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getAuth(req: Request, searchParams: URLSearchParams) {
  const validSecrets = configuredSecrets();
  if (!validSecrets.length) return { valid: false, method: 'missing_server_secret' };

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-admin-secret', value: req.headers.get('x-admin-secret')?.trim() || '' },
    { method: 'x-cron-secret', value: req.headers.get('x-cron-secret')?.trim() || '' },
    { method: 'adminSecret_query', value: searchParams.get('adminSecret')?.trim() || '' },
    { method: 'cronSecret_query', value: searchParams.get('cronSecret')?.trim() || '' },
    { method: 'key_query', value: searchParams.get('key')?.trim() || '' },
  ];

  const matched = candidates.find((item) => item.value && validSecrets.includes(item.value));
  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

function boolValue(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function first(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function asString(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}

function asNumber(...values: any[]) {
  const value = first(...values);
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

function normalizeProviderStatus(value?: string | null) {
  const status = String(value || '').trim().toUpperCase();
  if (FINISHED_STATUSES.has(status)) return 'FINISHED';
  if (LIVE_STATUSES.has(status)) return status === 'HALFTIME' ? 'HT' : 'IN_PLAY';
  if (SCHEDULED_STATUSES.has(status)) return 'SCHEDULED';
  return status || null;
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ['matches', 'fixtures', 'data', 'response', 'results', 'items']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  if (Array.isArray(payload?.data?.fixtures)) return payload.data.fixtures;
  return [];
}

function normalizeProviderMatch(row: any) {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  const score = row?.score || row?.scores || row?.goals || row?.result || {};
  const fullTime = score?.fullTime || score?.full_time || score?.ft || score;
  const statusObject = fixture?.status || row?.status || {};

  const providerId = asString(
    fixture?.id,
    fixture?.matchId,
    fixture?.match_id,
    row?.id,
    row?.matchId,
    row?.match_id,
    row?.fixtureId,
    row?.fixture_id,
  );

  return {
    providerId,
    homeName: asString(home?.name, home?.teamName, home?.team_name, row?.homeName, row?.home_name, row?.home_team_name),
    awayName: asString(away?.name, away?.teamName, away?.team_name, row?.awayName, row?.away_name, row?.away_team_name),
    status: normalizeProviderStatus(asString(statusObject?.short, statusObject?.long, row?.status, row?.matchStatus, row?.match_status)),
    homeScore: asNumber(fullTime?.home, fullTime?.homeTeam, score?.home, score?.homeScore, row?.homeScore, row?.home_score, row?.home_goals),
    awayScore: asNumber(fullTime?.away, fullTime?.awayTeam, score?.away, score?.awayScore, row?.awayScore, row?.away_score, row?.away_goals),
    matchDate: asString(
      fixture?.utc_date,
      fixture?.date,
      fixture?.matchDate,
      fixture?.match_date,
      row?.utc_date,
      row?.date,
      row?.matchDate,
      row?.match_date,
      row?.kickoff,
      row?.startTime,
      row?.start_time,
    ),
    competitionId: asString(row?.competition_id, row?.competitionId, row?.competition?.id, row?.league?.id),
    seasonId: asString(row?.season_id, row?.seasonId, row?.season?.id),
    stage: asString(row?.stage_name, row?.stage, row?.round, row?.league?.round, row?.competition_round),
    groupPhase: asString(row?.group_label, row?.group, row?.groupPhase, row?.group_phase, row?.league?.round),
    raw: row,
  };
}

function sameDay(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
}

function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / 36e5;
}

function providerMatchesLocal(providerMatch: any, localMatch: any) {
  if (!providerMatch || !localMatch) return false;
  if (providerMatch.providerId && localMatch.externalId && String(providerMatch.providerId) === String(localMatch.externalId)) return true;

  const providerHome = normalizeText(providerMatch.homeName);
  const providerAway = normalizeText(providerMatch.awayName);
  const localHome = normalizeText(localMatch.homeTeam?.name || localMatch.homeTeam?.code);
  const localAway = normalizeText(localMatch.awayTeam?.name || localMatch.awayTeam?.code);

  if (!providerHome || !providerAway || !localHome || !localAway) return false;
  const homeMatches = providerHome === localHome || providerHome.includes(localHome) || localHome.includes(providerHome);
  const awayMatches = providerAway === localAway || providerAway.includes(localAway) || localAway.includes(providerAway);
  return homeMatches && awayMatches && (sameDay(providerMatch.matchDate, localMatch.matchDate) || hoursApart(providerMatch.matchDate, localMatch.matchDate) <= 4);
}

function diffField(field: string, localValue: any, providerValue: any) {
  if (providerValue === undefined || providerValue === null || providerValue === '') return null;
  const matched = String(localValue ?? '') === String(providerValue ?? '');
  return {
    field,
    localValue: localValue ?? null,
    providerValue,
    status: matched ? 'matched' : localValue === null || localValue === undefined || localValue === '' ? 'missing_locally' : 'different',
  };
}

function buildDiffs(localMatch: any, providerMatch: any) {
  return [
    diffField('status', localMatch.status, providerMatch.status),
    diffField('homeScore', localMatch.homeScore, providerMatch.homeScore),
    diffField('awayScore', localMatch.awayScore, providerMatch.awayScore),
    diffField('matchDate', localMatch.matchDate?.toISOString?.() || localMatch.matchDate, providerMatch.matchDate),
    diffField('stage', localMatch.stage, providerMatch.stage),
    diffField('groupPhase', localMatch.groupPhase, providerMatch.groupPhase),
  ].filter(Boolean) as any[];
}

async function ensureVerificationLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DataVerificationLog" (
      "id" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "route" TEXT,
      "localMatchId" TEXT,
      "providerMatchId" TEXT,
      "field" TEXT,
      "localValue" TEXT,
      "providerValue" TEXT,
      "action" TEXT NOT NULL DEFAULT 'verified',
      "confidence" TEXT DEFAULT 'B',
      "notes" TEXT,
      "rawData" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataVerificationLog_provider_createdAt_idx" ON "DataVerificationLog" ("provider", "createdAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DataVerificationLog_match_createdAt_idx" ON "DataVerificationLog" ("localMatchId", "createdAt")');
}

async function logDiff(params: {
  providerPath: string;
  localMatchId: string;
  providerMatchId?: string | null;
  diff: any;
  action: string;
  raw: any;
}) {
  await ensureVerificationLogTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "DataVerificationLog" ("id", "provider", "route", "localMatchId", "providerMatchId", "field", "localValue", "providerValue", "action", "confidence", "notes", "rawData")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
    randomUUID(),
    'THE_STATS_API',
    params.providerPath,
    params.localMatchId,
    params.providerMatchId || null,
    params.diff.field,
    params.diff.localValue === null || params.diff.localValue === undefined ? null : String(params.diff.localValue),
    params.diff.providerValue === null || params.diff.providerValue === undefined ? null : String(params.diff.providerValue),
    params.action,
    params.diff.status === 'matched' ? 'A' : 'B',
    params.diff.status,
    JSON.stringify(params.raw ?? null),
  );
}

async function safeApply(localMatch: any, diffs: any[]) {
  const patch: Record<string, any> = {};
  const safeApplied: string[] = [];
  const providerStatus = diffs.find((diff) => diff.field === 'status')?.providerValue;
  const isFinished = normalizeProviderStatus(providerStatus) === 'FINISHED' || normalizeProviderStatus(localMatch.status) === 'FINISHED';

  for (const diff of diffs) {
    if (diff.status === 'matched' || !SAFE_APPLY_FIELDS.has(diff.field)) continue;
    if (diff.field === 'status' && ['FINISHED', 'IN_PLAY', 'SCHEDULED', 'HT'].includes(String(diff.providerValue))) {
      patch.status = diff.providerValue;
      safeApplied.push(diff.field);
    }
    if ((diff.field === 'homeScore' || diff.field === 'awayScore') && isFinished && Number.isFinite(Number(diff.providerValue))) {
      patch[diff.field] = Number(diff.providerValue);
      safeApplied.push(diff.field);
    }
  }

  if (Object.keys(patch).length) {
    await prisma.match.update({ where: { id: localMatch.id }, data: patch });
  }

  return { patch, safeApplied };
}

function readQueryParams(searchParams: URLSearchParams, body: ControlInput = {}) {
  const query: QueryMap = { ...(body.query || {}) };
  for (const [key, value] of searchParams.entries()) {
    if (!CONTROL_KEYS.has(key)) query[key] = value;
  }
  return query;
}

async function readInput(req: Request): Promise<ControlInput> {
  if (req.method !== 'POST') return {};
  return await req.json().catch(() => ({}));
}

async function loadLocalMatches(input: ControlInput) {
  const matchId = input.matchId?.trim();
  if (matchId) {
    const match = await prisma.match.findFirst({
      where: { OR: [{ id: matchId }, { externalId: matchId }] },
      include: { homeTeam: true, awayTeam: true },
    });
    return match ? [match] : [];
  }

  const date = input.date?.trim();
  if (date) {
    return prisma.match.findMany({
      where: {
        matchDate: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lt: new Date(`${date}T23:59:59.999Z`),
        },
      },
      include: { homeTeam: true, awayTeam: true },
      take: 80,
    });
  }

  return prisma.match.findMany({
    where: { matchDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000), lte: new Date(Date.now() + 48 * 60 * 60 * 1000) } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
    take: 40,
  });
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const body = await readInput(req);
  const input: ControlInput = {
    ...body,
    providerPath: String(url.searchParams.get('providerPath') || url.searchParams.get('path') || body.providerPath || '').trim(),
    matchId: String(url.searchParams.get('matchId') || url.searchParams.get('id') || body.matchId || '').trim(),
    date: String(url.searchParams.get('date') || body.date || '').trim(),
    dryRun: boolValue(url.searchParams.get('dryRun') ?? body.dryRun, true),
    apply: boolValue(url.searchParams.get('apply') ?? body.apply, false),
    includeRaw: boolValue(url.searchParams.get('includeRaw') ?? body.includeRaw, false),
  };

  const auth = getAuth(req, url.searchParams);
  if (!auth.valid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const config = getTheStatsApiConfigStatus();
  if (!input.providerPath) {
    return NextResponse.json({
      ok: false,
      error: 'providerPath is required. Example: /api/football/matches',
      config,
      safety: { defaultMode: 'verify_only', databaseIsSourceOfTruth: true },
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const providerQuery = readQueryParams(url.searchParams, body);
  if (input.date && !providerQuery.date && !providerQuery.from && !providerQuery.start_date) providerQuery.date = input.date;

  const hardVerifyOnly = isTheStatsApiVerifyOnly();
  const canApply = input.apply && !input.dryRun && !hardVerifyOnly;

  try {
    const [payload, localMatches] = await Promise.all([
      theStatsApiFetch(input.providerPath, providerQuery),
      loadLocalMatches(input),
    ]);

    const providerRows = extractArray(payload).map(normalizeProviderMatch);
    const comparisons: any[] = [];
    const logs: any[] = [];
    const applied: any[] = [];

    for (const localMatch of localMatches) {
      const providerMatch = providerRows.find((row) => providerMatchesLocal(row, localMatch));
      if (!providerMatch) {
        comparisons.push({
          localMatchId: localMatch.id,
          localTeams: `${localMatch.homeTeam?.name || 'Home'} vs ${localMatch.awayTeam?.name || 'Away'}`,
          status: 'no_provider_match_found',
        });
        continue;
      }

      const diffs = buildDiffs(localMatch, providerMatch);
      const actionable = diffs.filter((diff) => diff.status !== 'matched');
      const applyResult = canApply ? await safeApply(localMatch, actionable) : { patch: {}, safeApplied: [] as string[] };

      for (const diff of diffs) {
        const action = applyResult.safeApplied.includes(diff.field)
          ? 'safe_correction_applied'
          : diff.status === 'matched'
            ? 'verified'
            : 'reported_only';
        await logDiff({ providerPath: input.providerPath, localMatchId: localMatch.id, providerMatchId: providerMatch.providerId, diff, action, raw: input.includeRaw ? providerMatch.raw : null });
        logs.push({ localMatchId: localMatch.id, field: diff.field, action, status: diff.status });
      }

      if (applyResult.safeApplied.length) applied.push({ localMatchId: localMatch.id, ...applyResult });

      comparisons.push({
        localMatchId: localMatch.id,
        providerMatchId: providerMatch.providerId,
        localTeams: `${localMatch.homeTeam?.name || 'Home'} vs ${localMatch.awayTeam?.name || 'Away'}`,
        providerTeams: `${providerMatch.homeName || 'Home'} vs ${providerMatch.awayName || 'Away'}`,
        providerMatchDate: providerMatch.matchDate,
        providerCompetitionId: providerMatch.competitionId,
        providerSeasonId: providerMatch.seasonId,
        diffs,
        actionableCount: actionable.length,
        apply: canApply ? applyResult : { skipped: true, reason: hardVerifyOnly ? 'THE_STATS_API_VERIFY_ONLY=true' : input.dryRun ? 'dryRun=true' : 'apply=false' },
      });
    }

    return NextResponse.json({
      ok: true,
      provider: 'THE_STATS_API',
      providerPath: input.providerPath,
      config,
      authMethod: auth.method,
      mode: canApply ? 'safe_apply' : 'verify_only',
      dryRun: input.dryRun,
      hardVerifyOnly,
      localMatches: localMatches.length,
      providerRows: providerRows.length,
      comparisons,
      logsWritten: logs.length,
      applied,
      providerSample: providerRows.slice(0, 5).map((row) => ({
        providerId: row.providerId,
        teams: `${row.homeName || 'Home'} vs ${row.awayName || 'Away'}`,
        matchDate: row.matchDate,
        status: row.status,
        competitionId: row.competitionId,
        seasonId: row.seasonId,
      })),
      rawSample: input.includeRaw ? extractArray(payload).slice(0, 3) : undefined,
      safety: {
        databaseIsSourceOfTruth: true,
        publicRequestsDoNotCallProvider: true,
        prohibitedDataBlocked: true,
        prohibitedData: ['odds', 'betting', 'bookmakers', 'Bet365', 'Pinnacle', 'Betfair', 'Kambi', 'handicap'],
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      provider: 'THE_STATS_API',
      providerPath: input.providerPath,
      config,
      error: safeTheStatsApiError(error),
      safety: { databaseIsSourceOfTruth: true, prohibitedDataBlocked: true },
    }, { status: Number(error?.status) && Number(error.status) < 500 ? Number(error.status) : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
