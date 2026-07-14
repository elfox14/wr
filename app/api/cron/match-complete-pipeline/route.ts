
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const LIVE = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'PAUSED', 'ET', 'BT', 'P', 'PEN_LIVE'];
const LIVE_SNAPSHOT_PROVIDERS = ['WORKER_ISPORTS', 'ISPORTS_ANIMATION_BROWSERLESS', 'AUTOMATED_LIVE_INGEST', 'ISPORTS_QUOTA_FALLBACK'];

type MatchWithData = Awaited<ReturnType<typeof loadMatchCandidates>>[number];

type PipelineStep = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  status?: number;
  durationMs: number;
  url?: string;
  result?: unknown;
  error?: string;
};

type ProviderBlock = { provider: string; blockedUntil: Date | null; reason: string | null };

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function dateOnly(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function isFinished(status: string) {
  return FINISHED.includes(String(status || '').toUpperCase());
}

function isLive(status: string) {
  return LIVE.includes(String(status || '').toUpperCase());
}

function isNearLive(match: { status: string; matchDate: Date }) {
  if (isLive(match.status)) return true;
  if (isFinished(match.status)) return false;
  const diffMinutes = (Date.now() - new Date(match.matchDate).getTime()) / 60000;
  return diffMinutes >= -30 && diffMinutes <= 160;
}

function isUpcomingSoon(match: { status: string; matchDate: Date }, hours = 6) {
  if (isFinished(match.status) || isLive(match.status)) return false;
  const diffHours = (new Date(match.matchDate).getTime() - Date.now()) / 36e5;
  return diffHours >= -3 && diffHours <= hours;
}

function normalizedOf(snapshot: any) {
  return snapshot?.rawData?.normalized || {};
}

function resolvedProviderMatchId(snapshot: any) {
  if (!snapshot) return null;
  const raw = snapshot?.rawData && typeof snapshot.rawData === 'object' ? snapshot.rawData : {};
  const value = raw.resolvedProviderMatchId || raw.providerMatchId || snapshot.providerMatchId;
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.startsWith('mt_')) return text;
  const digits = text.replace(/\D/g, '');
  return digits ? `mt_${digits}` : null;
}

function snapshotCounts(snapshot: any) {
  const normalized = normalizedOf(snapshot);
  const stats = normalized?.liveStats?.stats || normalized?.stats || {};
  const events = Array.isArray(normalized?.eventsDetailed?.all) ? normalized.eventsDetailed.all : [];
  const shots = Array.isArray(normalized?.shotmap) ? normalized.shotmap : [];
  const players = Array.isArray(normalized?.playerStats) ? normalized.playerStats : [];
  const playerRatings = players.filter((player: any) => player?.rating !== null && player?.rating !== undefined && player?.rating !== '').length;
  return { stats: Object.keys(stats || {}).length, events: events.length, shots: shots.length, players: players.length, playerRatings, lineups: normalized?.lineups ? 1 : 0 };
}

function hasSnapshotColumnStats(snapshot: any) {
  if (!snapshot) return false;
  return [
    snapshot.homePossession,
    snapshot.awayPossession,
    snapshot.homeShots,
    snapshot.awayShots,
    snapshot.homeShotsOnTarget,
    snapshot.awayShotsOnTarget,
    snapshot.homeCorners,
    snapshot.awayCorners,
  ].some((value) => value !== null && value !== undefined);
}

function articleMapRows(rows: any[]) {
  return new Map<string, any>(rows.map((row): [string, any] => [row.matchId, row]));
}

async function ensurePipelineStateTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CronProviderState" (
      "provider" TEXT PRIMARY KEY,
      "blockedUntil" TIMESTAMPTZ NULL,
      "reason" TEXT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => undefined);
}

async function getProviderBlock(provider: string): Promise<ProviderBlock | null> {
  await ensurePipelineStateTable();
  const rows = await prisma.$queryRawUnsafe<ProviderBlock[]>(
    `SELECT "provider", "blockedUntil", "reason" FROM "CronProviderState" WHERE "provider" = $1 LIMIT 1`,
    provider,
  ).catch(() => []);
  return rows[0] || null;
}

async function setProviderBlock(provider: string, blockedUntil: Date, reason: string) {
  await ensurePipelineStateTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CronProviderState" ("provider", "blockedUntil", "reason", "updatedAt")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT ("provider") DO UPDATE SET "blockedUntil" = EXCLUDED."blockedUntil", "reason" = EXCLUDED."reason", "updatedAt" = NOW()`,
    provider,
    blockedUntil,
    reason.slice(0, 500),
  ).catch(() => undefined);
}

function isBlockActive(block: ProviderBlock | null) {
  const until = block?.blockedUntil ? new Date(block.blockedUntil).getTime() : 0;
  return Number.isFinite(until) && until > Date.now();
}

function nextProviderResetDate() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 30, 0));
  if (next.getTime() <= now.getTime()) return new Date(now.getTime() + 6 * 36e5);
  return next;
}

async function loadArticles(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, any>();
  const rows = await prisma.$queryRawUnsafe<Array<{ matchId: string; slug: string; status: string; infographicImageUrl: string | null }>>(
    `SELECT "matchId", "slug", "status", "infographicImageUrl" FROM "MatchArticle" WHERE "matchId" = ANY($1::text[]) AND "language" = 'ar'`,
    matchIds,
  ).catch(() => []);
  const entries = rows.map((row) => [row.matchId, row] as [string, any]);
  return new Map<string, any>(entries);
}

async function loadMatchCandidates(options: { matchId?: string | null; lookbackDays: number; lookaheadHours: number; take: number }) {
  const now = Date.now();
  const where = options.matchId
    ? { id: options.matchId }
    : {
        matchDate: {
          gte: new Date(now - options.lookbackDays * 864e5),
          lte: new Date(now + options.lookaheadHours * 36e5),
        },
      };

  const matches = await prisma.match.findMany({
    where: where as any,
    orderBy: { matchDate: 'asc' },
    take: options.matchId ? 1 : options.take,
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: {
        orderBy: { capturedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          provider: true,
          providerMatchId: true,
          capturedAt: true,
          homePossession: true,
          awayPossession: true,
          homeShots: true,
          awayShots: true,
          homeShotsOnTarget: true,
          awayShotsOnTarget: true,
          homeCorners: true,
          awayCorners: true,
          rawData: true,
        },
      },
    },
  });

  const articles = await loadArticles(matches.map((match) => match.id));
  return matches.map((match) => ({ ...match, article: articles.get(match.id) || null }));
}

function completeness(match: MatchWithData) {
  const finalSnapshot = match.statsSnapshots.find((snapshot) => snapshot.provider.startsWith('THE_STATS_API')) || null;
  const liveSnapshot = match.statsSnapshots.find((snapshot) => LIVE_SNAPSHOT_PROVIDERS.some((provider) => snapshot.provider.includes(provider))) || null;
  const finalCounts = snapshotCounts(finalSnapshot);
  const liveLinked = Boolean(match.animationMatchId);
  const liveSnapshotReady = Boolean(liveSnapshot);
  const resultSynced = isFinished(match.status) || isLive(match.status) || match.homeScore !== 0 || match.awayScore !== 0;
  const finalStatsReady = Boolean(finalSnapshot && (finalCounts.stats > 0 || hasSnapshotColumnStats(finalSnapshot)));
  const finalEventsReady = Boolean(finalSnapshot && finalCounts.events > 0);
  const playerRatingsReady = Boolean(finalSnapshot && finalCounts.playerRatings > 0);
  const articleReady = Boolean(match.article?.slug);
  const infographicReady = Boolean(match.article?.infographicImageUrl);

  const weights = [
    [liveLinked, 10],
    [liveSnapshotReady || isFinished(match.status), 10],
    [resultSynced, 15],
    [finalStatsReady || !isFinished(match.status), 20],
    [finalEventsReady || !isFinished(match.status), 15],
    [playerRatingsReady || !isFinished(match.status), 10],
    [articleReady || !isFinished(match.status), 15],
    [infographicReady || !isFinished(match.status), 5],
  ] as const;

  const score = weights.reduce((sum, [ok, value]) => sum + (ok ? value : 0), 0);
  const missing = {
    liveLinked: !liveLinked,
    liveSnapshotReady: !liveSnapshotReady && !isFinished(match.status),
    resultSynced: !resultSynced,
    finalStatsReady: !finalStatsReady && isFinished(match.status),
    finalEventsReady: !finalEventsReady && isFinished(match.status),
    playerRatingsReady: !playerRatingsReady && isFinished(match.status),
    articleReady: !articleReady && isFinished(match.status),
    infographicReady: !infographicReady && isFinished(match.status),
  };

  return {
    percent: Math.max(0, Math.min(100, score)),
    finalSnapshotId: finalSnapshot?.id || null,
    finalProviderMatchId: resolvedProviderMatchId(finalSnapshot),
    liveSnapshotId: liveSnapshot?.id || null,
    finalCounts,
    flags: { liveLinked, liveSnapshotReady, resultSynced, finalStatsReady, finalEventsReady, playerRatingsReady, articleReady, infographicReady },
    missing,
  };
}

function candidatePriority(match: MatchWithData, options: { preSyncHours: number; iSportsBlocked: boolean }) {
  const c = completeness(match);
  if (!options.iSportsBlocked && isNearLive(match) && !c.flags.liveLinked) return 1000;
  if (!options.iSportsBlocked && isNearLive(match) && c.flags.liveLinked) return 950;
  if (!options.iSportsBlocked && isUpcomingSoon(match, options.preSyncHours) && !c.flags.liveLinked) return 850;
  if (isFinished(match.status) && !c.flags.finalStatsReady) return 800;
  if (isFinished(match.status) && (!c.flags.finalEventsReady || !c.flags.playerRatingsReady) && match.externalId) return 760;
  if (isFinished(match.status) && c.flags.finalStatsReady && !c.flags.articleReady) return 700;
  if (isFinished(match.status) && c.flags.articleReady && !c.flags.infographicReady) return 680;
  return 100 - c.percent;
}

function pickMatch(matches: MatchWithData[], options: { preSyncHours: number; iSportsBlocked: boolean }) {
  return [...matches]
    .map((match) => ({ match, priority: candidatePriority(match, options), completeness: completeness(match) }))
    .sort((a, b) => b.priority - a.priority || new Date(a.match.matchDate).getTime() - new Date(b.match.matchDate).getTime())[0] || null;
}

function maskSensitiveUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of ['key', 'secret', 'token', 'cronSecret', 'adminSecret']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '***');
    }
    return url.toString();
  } catch {
    return value.replace(/([?&](?:key|secret|token|cronSecret|adminSecret)=)[^&]+/gi, '$1***');
  }
}

async function callJson(name: string, url: string, init?: RequestInit, timeoutMs = 45000): Promise<PipelineStep> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const safeUrl = maskSensitiveUrl(url);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const text = await res.text();
    let result: unknown = text;
    try { result = JSON.parse(text); } catch {}
    return { name, ok: res.ok, status: res.status, durationMs: Date.now() - startedAt, url: safeUrl, result };
  } catch (error: any) {
    return { name, ok: false, durationMs: Date.now() - startedAt, url: safeUrl, error: error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(error?.message || error) };
  } finally {
    clearTimeout(timeout);
  }
}

function textOf(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value || {});
}

function isQuotaText(value: unknown) {
  return /quota|limit|rate|too many|200 trials|try again tomorrow/i.test(textOf(value));
}

function stepResult(step: PipelineStep): any {
  return step.result && typeof step.result === 'object' ? step.result as any : {};
}

function syncStepHasQuota(step: PipelineStep) {
  if (step.name !== 'sync-animation-matches') return false;
  const result = stepResult(step);
  return isQuotaText(result.providerErrors) || isQuotaText(result.error) || isQuotaText(step.error);
}

function syncStepNoUsefulUpdate(step: PipelineStep) {
  if (step.name !== 'sync-animation-matches') return false;
  const result = stepResult(step);
  const matched = Number(result.matched || 0);
  const updated = Number(result.updated || 0);
  return step.ok && matched === 0 && updated === 0;
}

function cleanOrigin(value: string | null | undefined) {
  const text = String(value || '').trim().replace(/\/$/, '');
  if (!text) return null;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(text)) return null;
  if (!/^https?:\/\//i.test(text)) return `https://${text}`;
  return text;
}

function forwardedOrigin(req: Request) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return cleanOrigin(host ? `${proto}://${host}` : null);
}

function endpointBase(req: Request) {
  const envCandidates = [
    process.env.MATCH_PIPELINE_TARGET_ORIGIN,
    process.env.FOOTBALL_DATA_SYNC_TARGET_ORIGIN,
    process.env.POST_MATCH_STATS_SYNC_TARGET_ORIGIN,
    process.env.LIVE_INGEST_TARGET_ORIGIN,
    process.env.LIVE_SYNC_PUBLIC_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.APP_BASE_URL,
  ];

  for (const candidate of envCandidates) {
    const origin = cleanOrigin(candidate);
    if (origin) return origin;
  }

  return forwardedOrigin(req) || 'https://worldcup.mcprim.com';
}

function withKey(path: string, key: string, params: Record<string, string | number | boolean | null | undefined> = {}, req?: Request) {
  const base = req ? endpointBase(req) : 'https://worldcup.mcprim.com';
  const url = new URL(`${base}${path}`);
  url.searchParams.set('key', key);
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(name, String(value));
  }
  return url.toString();
}

function requestKey(req: Request) {
  const url = new URL(req.url);
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return bearer || url.searchParams.get('key') || url.searchParams.get('cronSecret') || url.searchParams.get('adminSecret') || '';
}

async function refreshMatch(matchId: string) {
  const matches = await loadMatchCandidates({ matchId, lookbackDays: 14, lookaheadHours: 120, take: 1 });
  return matches[0] || null;
}

async function runNextStep(req: Request, match: MatchWithData, key: string, options: { includeResults: boolean; includeContent: boolean; maxStepTimeoutMs: number; preSyncHours: number; iSportsBlocked: boolean; iSportsBlockedUntil: string | null }) {
  const c = completeness(match);
  const date = dateOnly(match.matchDate);

  if (options.iSportsBlocked && !c.flags.liveLinked && (isNearLive(match) || isUpcomingSoon(match, options.preSyncHours))) {
    return { name: 'sync-animation-matches', ok: true, skipped: true, durationMs: 0, result: { reason: 'isports-quota-blocked', blockedUntil: options.iSportsBlockedUntil } } satisfies PipelineStep;
  }

  if (!options.iSportsBlocked && isNearLive(match) && !c.flags.liveLinked) {
    return callJson('sync-animation-matches', withKey('/api/cron/sync-animation-matches', key, {
      limit: 80,
      lookbackHours: 12,
      lookaheadHours: 120,
      threshold: 65,
      dryRun: false,
      includeAlreadyLinked: false,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (!options.iSportsBlocked && isUpcomingSoon(match, options.preSyncHours) && !c.flags.liveLinked) {
    return callJson('sync-animation-matches', withKey('/api/cron/sync-animation-matches', key, {
      limit: 80,
      lookbackHours: 12,
      lookaheadHours: 120,
      threshold: 65,
      dryRun: false,
      includeAlreadyLinked: false,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (!options.iSportsBlocked && isNearLive(match) && c.flags.liveLinked && !isFinished(match.status)) {
    return callJson('live-ingest', withKey('/api/cron/live-ingest', key, {
      limit: 1,
      maxExternalRequests: 1,
      maxBrowserlessRequests: 1,
      lookaheadMinutes: 45,
      lookbackHours: 3,
      finishedHours: 0,
      minIntervalSeconds: 60,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (options.includeResults && (isNearLive(match) || isFinished(match.status))) {
    return callJson('football-data-results-sync', withKey('/api/cron/football-data-results-sync', key, {
      dateFrom: date,
      dateTo: date,
      localLimit: 30,
      lookbackDays: 1,
      lookaheadDays: 1,
      season: 2026,
      competition: 'WC',
      dryRun: false,
    }, req), undefined, options.maxStepTimeoutMs);
  }

  if (isFinished(match.status) && !c.flags.finalStatsReady) {
    return callJson('the-stats-finalize-matches', withKey('/api/cron/the-stats-finalize-matches', key, {
      matchId: match.id,
      apply: true,
      limit: 1,
      days: 60,
      requestsPerMinute: 110,
      timeoutMs: 20000,
      includeRaw: false,
      writeMatchEvents: false,
      purgeISportsSnapshots: false,
      dryRun: false,
    }, req), undefined, Math.max(options.maxStepTimeoutMs, 55000));
  }

  if (isFinished(match.status) && (!c.flags.finalEventsReady || !c.flags.playerRatingsReady) && c.finalProviderMatchId) {
    return callJson('manual-final-import', withKey('/api/cron/manual-final-import', key, {
      matchId: match.id,
      providerMatchId: c.finalProviderMatchId,
      scope: 'full',
      dryRun: false,
      includeRaw: false,
      syncAnimation: true,
      timeoutMs: 25000,
      delayMs: 1000,
    }, req), undefined, Math.max(options.maxStepTimeoutMs, 55000));
  }

  if (options.includeContent && isFinished(match.status) && c.flags.finalStatsReady && !c.flags.articleReady) {
    return callJson('generate-match-content', withKey('/api/admin/match-content', key, {}, req), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, autoPublish: false }),
    }, options.maxStepTimeoutMs);
  }

  return { name: 'no-action', ok: true, skipped: true, durationMs: 0, result: { reason: 'match already complete or not yet ready for the next source', completeness: c } } satisfies PipelineStep;
}

function nextActionHint(finalCompleteness: ReturnType<typeof completeness>, steps: PipelineStep[]) {
  if (finalCompleteness.percent >= 100) return 'complete';
  if (steps.some(syncStepHasQuota)) return 'iSports quota is exhausted. Live linking is paused until provider reset; pipeline can still process finished matches and TheStats when available.';
  if (steps.some(syncStepNoUsefulUpdate)) return 'No confident iSports match was found. Run again later closer to kickoff, or enter animationMatchId manually in admin.';
  return 'run again in 5 minutes or use admin manual IDs when provider matching fails';
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return response({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const key = String(requestKey(req)).trim();
  const startedAt = Date.now();
  const matchId = url.searchParams.get('matchId');
  const maxSteps = intParam(url, 'maxSteps', 2, 1, 5);
  const lookbackDays = intParam(url, 'lookbackDays', 7, 1, 60);
  const lookaheadHours = intParam(url, 'lookaheadHours', 120, 1, 24 * 14);
  const preSyncHours = intParam(url, 'preSyncHours', 6, 1, 120);
  const take = intParam(url, 'candidateLimit', 80, 1, 200);
  const maxStepTimeoutMs = intParam(url, 'stepTimeoutMs', 45000, 5000, 90000);
  const includeResults = boolParam(url, 'includeResults', true);
  const includeContent = boolParam(url, 'includeContent', true);

  const iSportsBlock = await getProviderBlock('ISPORTS');
  let iSportsBlocked = isBlockActive(iSportsBlock);
  let iSportsBlockedUntil = iSportsBlocked && iSportsBlock?.blockedUntil ? new Date(iSportsBlock.blockedUntil).toISOString() : null;

  const candidates = await loadMatchCandidates({ matchId, lookbackDays, lookaheadHours, take });
  const picked = matchId ? (candidates[0] ? { match: candidates[0], priority: 9999, completeness: completeness(candidates[0]) } : null) : pickMatch(candidates, { preSyncHours, iSportsBlocked });

  if (!picked) {
    return response({ ok: true, mode: 'match_complete_pipeline_v2_quota_aware', status: 'no_candidates', durationMs: Date.now() - startedAt, providerState: { iSportsBlocked, iSportsBlockedUntil } });
  }

  const steps: PipelineStep[] = [];
  let current = picked.match;

  for (let index = 0; index < maxSteps; index += 1) {
    const step = await runNextStep(req, current, key, { includeResults: includeResults && index === 0, includeContent, maxStepTimeoutMs, preSyncHours, iSportsBlocked, iSportsBlockedUntil });
    steps.push(step);

    if (syncStepHasQuota(step)) {
      const until = nextProviderResetDate();
      await setProviderBlock('ISPORTS', until, 'iSports daily quota exceeded while syncing animation matches');
      iSportsBlocked = true;
      iSportsBlockedUntil = until.toISOString();
      break;
    }

    if (syncStepNoUsefulUpdate(step)) break;
    if (!step.ok || step.skipped) break;

    const fresh = await refreshMatch(current.id);
    if (!fresh) break;
    current = fresh;
  }

  const finalCompleteness = completeness(current);
  return response({
    ok: true,
    mode: 'match_complete_pipeline_v2_quota_aware',
    durationMs: Date.now() - startedAt,
    selected: {
      matchId: current.id,
      teams: `${current.homeTeam?.name || current.homeTeamId} vs ${current.awayTeam?.name || current.awayTeamId}`,
      status: current.status,
      matchDate: current.matchDate,
      priority: picked.priority,
    },
    providerState: { iSportsBlocked, iSportsBlockedUntil },
    policy: { includeResults, includeContent },
    before: picked.completeness,
    after: finalCompleteness,
    steps,
    nextActionHint: nextActionHint(finalCompleteness, steps),
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
