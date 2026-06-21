import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

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
const DEFAULT_BUDGET_MS = 28_000;

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
function maskUrl(value: string) {
  return value.replace(/(key=|adminSecret=|cronSecret=)[^&]+/gi, '$1***').replace(/([?&]token=)[^&]+/gi, '$1***');
}
function remainingMs(startedAt: number, budgetMs: number) {
  return Math.max(0, budgetMs - (Date.now() - startedAt));
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
async function callJson(name: string, url: URL, timeoutMs: number, startedAt: number, budgetMs: number): Promise<StageResult> {
  const timeLeft = remainingMs(startedAt, budgetMs);
  if (timeLeft < 1_250) return { name, ok: false, skipped: true, url: maskUrl(url.toString()), error: 'time_budget_exhausted_before_stage' };
  const effectiveTimeout = Math.max(750, Math.min(timeoutMs, timeLeft - 350));
  const stageStartedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
    const text = await res.text().catch(() => '');
    return { name, ok: res.ok, status: res.status, durationMs: Date.now() - stageStartedAt, url: maskUrl(url.toString()), bodyBytes: text.length };
  } catch (error: any) {
    return { name, ok: false, status: null, durationMs: Date.now() - stageStartedAt, url: maskUrl(url.toString()), error: String(error?.message || error).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}
function buildSafeLiveUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/cron/worldcup-live-auto', origin);
  next.searchParams.set('theStats', 'false');
  next.searchParams.set('isportsTimeline', 'true');
  next.searchParams.set('footballData', 'false');
  next.searchParams.set('postmatch', 'false');
  next.searchParams.set('staleGuard', 'false');
  next.searchParams.set('status', 'true');
  next.searchParams.set('isportsVisual', bool(url.searchParams.get('isportsVisual'), false) ? 'true' : 'false');
  next.searchParams.set('limit', String(int(url.searchParams.get('limit'), 5, 1, 8)));
  next.searchParams.set('minutesBack', String(int(url.searchParams.get('minutesBack'), 240, 15, 720)));
  next.searchParams.set('minutesForward', String(int(url.searchParams.get('minutesForward'), 300, 0, 720)));
  next.searchParams.set('budgetMs', String(int(url.searchParams.get('innerBudgetMs'), 24_000, 5_000, 28_000)));
  return withSecret(optionalTarget(next, target), key);
}
function buildFootballDataUrl(origin: string, key: string, url: URL) {
  const next = new URL('/api/cron/football-data-sync', origin);
  next.searchParams.set('daysBack', String(int(url.searchParams.get('daysBack'), 1, 0, 7)));
  next.searchParams.set('daysAhead', String(int(url.searchParams.get('daysAhead'), 2, 0, 7)));
  next.searchParams.set('applyMarketEvents', bool(url.searchParams.get('applyMarketEvents'), true) ? 'true' : 'false');
  next.searchParams.set('createMissing', bool(url.searchParams.get('createMissing'), false) ? 'true' : 'false');
  return withSecret(next, key);
}
function buildPostmatchUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/cron/isports-postmatch-confirm', origin);
  next.searchParams.set('take', String(int(url.searchParams.get('postmatchTake'), target.dbMatchId || target.providerMatchId ? 1 : 3, 1, 5)));
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
function buildTheStatsEnrichmentUrl(origin: string, key: string, url: URL, target: { dbMatchId?: string | null; providerMatchId?: string | null }) {
  const next = new URL('/api/cron/live-match-full-sync', origin);
  next.searchParams.set('dryRun', 'false');
  next.searchParams.set('theStats', 'true');
  next.searchParams.set('matchInfo', 'true');
  next.searchParams.set('lineups', bool(url.searchParams.get('lineups'), false) ? 'true' : 'false');
  next.searchParams.set('dedupe', 'true');
  next.searchParams.set('theStatsPostmatch', 'true');
  next.searchParams.set('theStatsPageData', 'true');
  next.searchParams.set('postmatchEventsFromTheStats', 'true');
  next.searchParams.set('limit', String(int(url.searchParams.get('theStatsLimit'), target.dbMatchId || target.providerMatchId ? 1 : 3, 1, 5)));
  next.searchParams.set('minutesBack', String(int(url.searchParams.get('theStatsMinutesBack'), 240, 15, 480)));
  next.searchParams.set('minutesForward', String(int(url.searchParams.get('theStatsMinutesForward'), 90, 0, 360)));
  next.searchParams.set('postMatchMinutes', String(int(url.searchParams.get('theStatsPostMatchMinutes'), 720, 30, 720)));
  next.searchParams.set('pagePhase', url.searchParams.get('pagePhase') || 'auto');
  return withSecret(optionalTarget(next, target), key);
}
function buildStatusUrl(origin: string, key: string) {
  return withSecret(new URL('/api/admin/live-sources/status', origin), key);
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const key = secret();
  if (!key) return json({ ok: false, error: 'CRON_SECRET or ADMIN_API_SECRET is required' }, 500);

  const startedAt = Date.now();
  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
  const budgetMs = int(url.searchParams.get('budgetMs'), DEFAULT_BUDGET_MS, 5_000, 28_000);
  const minuteBucket = Math.floor(startedAt / 60_000);
  const dbMatchId = url.searchParams.get('dbMatchId') || url.searchParams.get('id');
  const providerMatchId = url.searchParams.get('matchId') || url.searchParams.get('providerMatchId');
  const target = { dbMatchId, providerMatchId };
  const stages: StageResult[] = [];

  if (bool(url.searchParams.get('live'), true)) stages.push(await callJson('safe_isports_live_timeline', buildSafeLiveUrl(origin, key, url, target), 20_000, startedAt, budgetMs));
  if (cadence(url.searchParams.get('footballData'), 5, minuteBucket)) stages.push(await callJson('football_data_confirmation', buildFootballDataUrl(origin, key, url), 5_000, startedAt, budgetMs));
  if (cadence(url.searchParams.get('postmatch'), 10, minuteBucket)) stages.push(await callJson('isports_postmatch_confirm', buildPostmatchUrl(origin, key, url, target), 5_000, startedAt, budgetMs));
  if (cadence(url.searchParams.get('theStatsEnrichment'), 15, minuteBucket)) stages.push(await callJson('the_stats_provider_status_enrichment', buildTheStatsEnrichmentUrl(origin, key, url, target), 12_000, startedAt, budgetMs));
  if (cadence(url.searchParams.get('status'), 5, minuteBucket)) stages.push(await callJson('live_sources_status', buildStatusUrl(origin, key), 2_000, startedAt, budgetMs));

  const hardFailures = stages.filter((stage) => !stage.ok && !stage.skipped);
  return json({
    ok: true,
    mode: 'live_autopilot_no_time_inference',
    authMode: auth.mode,
    origin,
    target,
    budgetMs,
    durationMs: Date.now() - startedAt,
    policy: {
      live: 'iSports timeline/state is used for live updates. TheStats live stage is not used to force FINISHED from elapsed minutes.',
      confirmation: 'football-data confirms fixture status and final scores every 5 minutes by default.',
      enrichment: 'TheStats enrichment runs on a slower cadence and the patched full-sync only finishes matches from explicit provider status.',
      publicUi: 'The public match page reads database snapshots/events only.',
    },
    summary: {
      stages: stages.length,
      ok: stages.filter((stage) => stage.ok).length,
      skipped: stages.filter((stage) => stage.skipped).length,
      degraded: hardFailures.length,
    },
    stages,
    note: hardFailures.length ? 'Autopilot completed in degraded mode. Check the failed stage URLs and provider keys.' : 'Autopilot completed.',
  });
}

export async function POST(req: Request) {
  return GET(req);
}
