import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const maxDuration = 60;

type StageResult = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  status?: number | null;
  durationMs?: number;
  url?: string;
  bodyBytes?: number;
  error?: string;
};

const DEFAULT_PUBLIC_ORIGIN = 'https://worldcup.mcprim.com';
const LIVE_STAGE_TIMEOUT_MS = 27_000;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}
function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
function cadence(value: string | null, defaultEveryMinutes: number, minuteBucket: number) {
  if (value !== null) return bool(value, true);
  return minuteBucket % Math.max(1, defaultEveryMinutes) === 0;
}
function secret() {
  return String(process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '').trim();
}
function hasPrimaryBrowserless() {
  return Boolean(String(process.env.BROWSERLESS_ENDPOINT || process.env.BROWSERLESS_TOKEN || '').trim());
}
function maskUrl(value: string) {
  return value.replace(/(key=|adminSecret=|cronSecret=)[^&]+/gi, '$1***').replace(/([?&]token=)[^&]+/gi, '$1***');
}
function cleanOrigin(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin; } catch { return null; }
}
function publicOrigin(req: Request, currentUrl: URL) {
  const explicit = cleanOrigin(process.env.LIVE_SYNC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL || process.env.PUBLIC_SITE_URL);
  if (explicit) return explicit;
  const forwardedHost = String(req.headers.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.get('host') || '').split(',')[0].trim();
  const forwardedProto = String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
  const headerOrigin = cleanOrigin(host ? `${forwardedProto}://${host}` : null);
  if (headerOrigin && !headerOrigin.includes('localhost') && !headerOrigin.includes('127.0.0.1')) return headerOrigin;
  if (!currentUrl.origin.includes('localhost') && !currentUrl.origin.includes('127.0.0.1')) return currentUrl.origin;
  return DEFAULT_PUBLIC_ORIGIN;
}
function remainingMs(startedAt: number, budgetMs: number) {
  return Math.max(0, budgetMs - (Date.now() - startedAt));
}

async function callJson(name: string, url: URL, timeoutMs: number, startedAt: number, budgetMs: number): Promise<StageResult> {
  const timeLeft = remainingMs(startedAt, budgetMs);
  if (timeLeft < 1_250) return { name, ok: false, skipped: true, url: maskUrl(url.toString()), error: 'time_budget_exhausted_before_stage' };
  const effectiveTimeout = Math.max(750, Math.min(timeoutMs, timeLeft - 350));
  const stageStartedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
    // Important: read and discard the inner response so internal routes finish normally,
    // but never return it to the external cron. This prevents output-size failures without
    // changing any data fetching/saving behavior.
    const text = await res.text().catch(() => '');
    return {
      name,
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - stageStartedAt,
      url: maskUrl(url.toString()),
      bodyBytes: text.length,
    };
  } catch (error: any) {
    return {
      name,
      ok: false,
      status: null,
      durationMs: Date.now() - stageStartedAt,
      url: maskUrl(url.toString()),
      error: String(error?.message || error).slice(0, 300),
    };
  } finally {
    clearTimeout(timer);
  }
}

function withSecret(url: URL, key: string) {
  url.searchParams.set('key', key);
  url.searchParams.set('adminSecret', key);
  url.searchParams.set('cronSecret', key);
  return url;
}
function optionalTarget(url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  if (target.dbMatchId) url.searchParams.set('dbMatchId', target.dbMatchId);
  if (target.providerMatchId) url.searchParams.set('matchId', target.providerMatchId);
  return url;
}
function buildFootballDataUrl(origin: string, key: string, url: URL) {
  const next = new URL('/api/cron/football-data-sync', origin);
  next.searchParams.set('daysBack', String(int(url.searchParams.get('daysBack'), 1, 0, 7)));
  next.searchParams.set('daysAhead', String(int(url.searchParams.get('daysAhead'), 2, 0, 7)));
  return withSecret(next, key);
}
function buildFullSyncUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/cron/live-match-full-sync', origin);
  next.searchParams.set('dryRun', 'false');
  next.searchParams.set('theStats', 'true');
  next.searchParams.set('matchInfo', 'true');
  next.searchParams.set('theStatsExtras', 'false');
  next.searchParams.set('theStatsExtrasRaw', 'false');
  next.searchParams.set('forceExtras', 'false');
  next.searchParams.set('forceCoreISports', 'false');
  next.searchParams.set('isports', 'false');
  next.searchParams.set('isportStats', 'false');
  next.searchParams.set('dedupe', 'true');
  next.searchParams.set('postmatchEventsFromTheStats', 'true');
  next.searchParams.set('wakeFallback', 'false');
  next.searchParams.set('mapISports', 'false');
  next.searchParams.set('limit', String(int(url.searchParams.get('limit'), 3, 1, 8)));
  next.searchParams.set('minutesBack', String(int(url.searchParams.get('minutesBack'), 240, 15, 480)));
  next.searchParams.set('minutesForward', String(int(url.searchParams.get('minutesForward'), 300, 0, 360)));
  return withSecret(optionalTarget(next, target), key);
}
function buildISportsTimelineUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const targeted = Boolean(target.dbMatchId || target.providerMatchId);
  const browserlessPrimary = hasPrimaryBrowserless();
  const useBrowserless = targeted && browserlessPrimary;
  const next = new URL('/api/cron/isports-live-sync', origin);
  next.searchParams.set('take', String(int(url.searchParams.get('isportsTake'), targeted ? 1 : 5, 1, 5)));
  next.searchParams.set('save', 'true');
  next.searchParams.set('replace', 'true');
  next.searchParams.set('includeTimeline', 'true');
  next.searchParams.set('includeFlash', 'false');
  next.searchParams.set('asyncFlash', 'false');
  next.searchParams.set('includeLive', 'false');
  next.searchParams.set('timeoutMs', String(int(url.searchParams.get('isportsTimeoutMs'), useBrowserless ? 18_000 : targeted ? 12_000 : 26_000, 5_000, 45_000)));
  next.searchParams.set('waitMs', String(int(url.searchParams.get('isportsWaitMs'), useBrowserless ? 3_000 : targeted ? 2_000 : 5_000, 1_000, 15_000)));
  next.searchParams.set('directTimeoutMs', String(int(url.searchParams.get('directTimeoutMs'), targeted ? 6_000 : 12_000, 2_000, 30_000)));
  next.searchParams.set('wrapperTimeoutMs', String(int(url.searchParams.get('wrapperTimeoutMs'), targeted ? 6_000 : 10_000, 2_000, 15_000)));
  next.searchParams.set('skipBrowserFallback', bool(url.searchParams.get('skipBrowserFallback'), targeted && !browserlessPrimary) ? 'true' : 'false');
  return withSecret(optionalTarget(next, target), key);
}
function buildISportsFlashStateUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/cron/isports-flash-state', origin);
  next.searchParams.set('save', 'true');
  next.searchParams.set('replace', 'true');
  next.searchParams.set('mode', 'timeline');
  next.searchParams.set('timeoutMs', String(int(url.searchParams.get('flashStateTimeoutMs'), 10_000, 5_000, 25_000)));
  next.searchParams.set('waitMs', String(int(url.searchParams.get('flashStateWaitMs'), 2_000, 1_000, 10_000)));
  next.searchParams.set('stateSource', 'isports_flash_schedule_state');
  next.searchParams.set('statusFromMinute', 'false');
  return withSecret(optionalTarget(next, target), key);
}
function buildISportsVisualUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/cron/isports-live-sync', origin);
  next.searchParams.set('take', '1');
  next.searchParams.set('save', 'true');
  next.searchParams.set('replace', 'true');
  next.searchParams.set('includeTimeline', 'false');
  next.searchParams.set('includeFlash', 'false');
  next.searchParams.set('includeLive', 'true');
  next.searchParams.set('asyncLive', 'true');
  next.searchParams.set('timeoutMs', String(int(url.searchParams.get('visualTimeoutMs'), 25_000, 5_000, 45_000)));
  next.searchParams.set('waitMs', String(int(url.searchParams.get('visualWaitMs'), 8_000, 1_000, 15_000)));
  return withSecret(optionalTarget(next, target), key);
}
function buildPostmatchUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/cron/isports-postmatch-confirm', origin);
  next.searchParams.set('take', '1');
  next.searchParams.set('save', 'true');
  next.searchParams.set('replace', 'true');
  next.searchParams.set('includeTimeline', 'true');
  next.searchParams.set('includeFlash', 'false');
  next.searchParams.set('includeLive', 'false');
  next.searchParams.set('missingOnly', 'true');
  next.searchParams.set('windowBeforeMinutes', String(int(url.searchParams.get('postmatchWindowBeforeMinutes'), 720, 30, 1440)));
  next.searchParams.set('minConfirmIntervalMinutes', String(int(url.searchParams.get('postmatchMinConfirmIntervalMinutes'), 120, 0, 1440)));
  next.searchParams.set('order', 'desc');
  next.searchParams.set('timeoutMs', String(int(url.searchParams.get('postmatchTimeoutMs'), 12_000, 5_000, 25_000)));
  next.searchParams.set('waitMs', String(int(url.searchParams.get('postmatchWaitMs'), 2_000, 1_000, 10_000)));
  return withSecret(optionalTarget(next, target), key);
}
function buildDedupeUrl(origin: string, key: string, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/admin/match-events-dedupe', origin);
  if (target.dbMatchId) next.searchParams.set('matchId', target.dbMatchId);
  next.searchParams.set('dryRun', 'false');
  next.searchParams.set('preferTheStats', 'true');
  next.searchParams.set('preferTheStatsMinEvents', '1');
  return withSecret(next, key);
}
function buildStaleGuardUrl(origin: string, key: string) {
  return withSecret(new URL('/api/cron/expire-stale-matches', origin), key);
}
function buildStatusUrl(origin: string, key: string) {
  return withSecret(new URL('/api/admin/live-sources/status', origin), key);
}

async function ensureCronRunLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CronRunLog" (
      "id" TEXT PRIMARY KEY,
      "jobName" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "message" TEXT,
      "details" JSONB,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" TIMESTAMP(3),
      "durationMs" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CronRunLog_jobName_startedAt_idx" ON "CronRunLog" ("jobName", "startedAt" DESC)');
}

async function logCronRun(jobName: string, status: 'success' | 'error', startedAt: Date, message: string, details: Record<string, unknown>) {
  try {
    await ensureCronRunLogTable();
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CronRunLog" ("id", "jobName", "status", "message", "details", "startedAt", "finishedAt", "durationMs") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      `${jobName}-${finishedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      jobName,
      status,
      message,
      JSON.stringify(details),
      startedAt,
      finishedAt,
      durationMs
    );
  } catch (error) {
    console.error('Failed to log cron run to DB:', error);
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const key = secret();
  if (!key) return json({ ok: false, error: 'CRON_SECRET or ADMIN_API_SECRET is required' }, 500);

  const startedAt = Date.now();
  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
  const budgetMs = int(url.searchParams.get('budgetMs'), LIVE_STAGE_TIMEOUT_MS, 5_000, 28_000);
  const minuteBucket = Math.floor(startedAt / 60_000);
  const dbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
  const providerMatchId = url.searchParams.get('matchId') || url.searchParams.get('providerMatchId');
  const target = { dbMatchId, providerMatchId };
  const mode = url.searchParams.get('mode') || 'all'; // 'primary' | 'secondary' | 'all'
  const runTheStats = bool(url.searchParams.get('theStats'), mode !== 'secondary');
  const runISportsTimeline = bool(url.searchParams.get('isportsTimeline'), runTheStats);
  const targetedBrowserless = Boolean(dbMatchId || providerMatchId) && hasPrimaryBrowserless();
  const stages: StageResult[] = [];

  if (runTheStats) stages.push(await callJson('the_stats_full_sync', buildFullSyncUrl(origin, key, url, target), 14_000, startedAt, budgetMs));
  if (runISportsTimeline) stages.push(await callJson('isports_timeline_core', buildISportsTimelineUrl(origin, key, url, target), targetedBrowserless ? 19_000 : target.dbMatchId ? 13_000 : 18_000, startedAt, budgetMs));
  if (runISportsTimeline && targetedBrowserless) stages.push(await callJson('isports_flash_state', buildISportsFlashStateUrl(origin, key, url, target), 8_000, startedAt, budgetMs));
  if (runTheStats && runISportsTimeline && target.dbMatchId) stages.push(await callJson('post_isports_the_stats_dedupe', buildDedupeUrl(origin, key, target), 5_000, startedAt, budgetMs));

  if (mode === 'all' || mode === 'secondary') {
    if (cadence(url.searchParams.get('footballData'), 5, minuteBucket)) stages.push(await callJson('football_data_sync', buildFootballDataUrl(origin, key, url), 4_000, startedAt, budgetMs));
    if (cadence(url.searchParams.get('postmatch'), 5, minuteBucket)) stages.push(await callJson('postmatch_timeline_safe', buildPostmatchUrl(origin, key, url, target), 4_000, startedAt, budgetMs));
    if (bool(url.searchParams.get('isportsVisual'), false)) stages.push(await callJson('isports_visual_async', buildISportsVisualUrl(origin, key, url, target), 3_000, startedAt, budgetMs));
    if (cadence(url.searchParams.get('staleGuard'), 10, minuteBucket)) stages.push(await callJson('expire_stale_matches_guard', buildStaleGuardUrl(origin, key), 2_000, startedAt, budgetMs));
    if (cadence(url.searchParams.get('status'), 5, minuteBucket)) stages.push(await callJson('live_sources_status', buildStatusUrl(origin, key), 2_000, startedAt, budgetMs));
  }

  const hardFailures = stages.filter((stage) => !stage.ok && !stage.skipped);

  const runStatusText = hardFailures.length === 0 ? 'success' : 'error';
  const runMessage = hardFailures.length === 0 
    ? `Completed successfully: ${stages.filter(s => s.ok).length} stages ok.`
    : `Completed with ${hardFailures.length} failures.`;
  await logCronRun(
    'worldcup-live-auto',
    runStatusText,
    new Date(startedAt),
    runMessage,
    { stages }
  );

  return json({
    ok: true,
    mode: 'worldcup_live_auto_orchestrator',
    authMode: auth.mode,
    origin,
    target,
    budgetMs,
    browserlessPrimary: hasPrimaryBrowserless(),
    durationMs: Date.now() - startedAt,
    summary: {
      stages: stages.length,
      ok: stages.filter((stage) => stage.ok).length,
      skipped: stages.filter((stage) => stage.skipped).length,
      degraded: hardFailures.length,
      output: 'ultra_compact_no_inner_bodies',
    },
    stages,
    compactOutput: 'ultra',
    note: hardFailures.length
      ? 'Cron completed in degraded mode. Inner responses were discarded from output only; data fetching/saving behavior is unchanged.'
      : 'Cron completed. Inner responses were discarded from output only; data fetching/saving behavior is unchanged.',
  });
}
