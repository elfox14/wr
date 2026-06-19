import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type StageResult = { name: string; ok: boolean; skipped?: boolean; status?: number | null; durationMs?: number; url?: string; body?: any; error?: string };

const DEFAULT_PUBLIC_ORIGIN = 'https://worldcup.mcprim.com';
const DEFAULT_BUDGET_MS = 52_000;

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

function secret() {
  return String(process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '').trim();
}

function maskUrl(value: string) {
  return value.replace(/(key=|adminSecret=|cronSecret=)[^&]+/gi, '$1***').replace(/([?&]token=)[^&]+/gi, '$1***');
}

function cleanOrigin(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
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
  if (timeLeft < 1_000) return { name, ok: true, skipped: true, url: maskUrl(url.toString()), error: 'time_budget_exhausted_before_stage' };
  const effectiveTimeout = Math.max(800, Math.min(timeoutMs, timeLeft - 250));
  const stageStartedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    return { name, ok: res.ok, status: res.status, durationMs: Date.now() - stageStartedAt, url: maskUrl(url.toString()), body };
  } catch (error: any) {
    return { name, ok: false, status: null, durationMs: Date.now() - stageStartedAt, url: maskUrl(url.toString()), error: String(error?.message || error).slice(0, 1000) };
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
  next.searchParams.set('isports', 'true');
  next.searchParams.set('isportStats', 'true');
  next.searchParams.set('isportVisualStats', String(bool(url.searchParams.get('isportVisualStats'), false)));
  next.searchParams.set('dedupe', 'true');
  next.searchParams.set('mapISports', 'true');
  next.searchParams.set('theStatsEnrichment', 'true');
  next.searchParams.set('enrichLineups', 'true');
  next.searchParams.set('postmatchTheStats', 'true');
  next.searchParams.set('officialTimelineMinEvents', String(int(url.searchParams.get('officialTimelineMinEvents'), 1, 1, 500)));
  next.searchParams.set('limit', String(int(url.searchParams.get('limit'), 8, 1, 20)));
  next.searchParams.set('minutesBack', String(int(url.searchParams.get('minutesBack'), 240, 15, 720)));
  next.searchParams.set('minutesForward', String(int(url.searchParams.get('minutesForward'), 300, 0, 360)));
  next.searchParams.set('delayMs', String(int(url.searchParams.get('delayMs'), 250, 0, 5000)));
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
  const budgetMs = int(url.searchParams.get('budgetMs'), DEFAULT_BUDGET_MS, 5_000, 55_000);
  const target = { dbMatchId: url.searchParams.get('dbMatchId') || url.searchParams.get('id'), providerMatchId: url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') };
  const stages: StageResult[] = [];

  if (bool(url.searchParams.get('footballData'), true)) stages.push(await callJson('football_data_sync', buildFootballDataUrl(origin, key, url), 8_000, startedAt, budgetMs));
  if (bool(url.searchParams.get('fullSync'), true)) stages.push(await callJson('the_stats_and_isports_full_sync', buildFullSyncUrl(origin, key, url, target), 46_000, startedAt, budgetMs));
  if (bool(url.searchParams.get('status'), true)) stages.push(await callJson('live_sources_status', buildStatusUrl(origin, key), 3_000, startedAt, budgetMs));

  const hardFailures = stages.filter((stage) => !stage.ok && !stage.skipped);
  return json({
    ok: true,
    mode: 'worldcup_live_auto_orchestrator',
    authMode: auth.mode,
    origin,
    target,
    budgetMs,
    durationMs: Date.now() - startedAt,
    summary: { stages: stages.length, ok: stages.filter((stage) => stage.ok).length, skipped: stages.filter((stage) => stage.skipped).length, degraded: hardFailures.length },
    policy: {
      fullSync: 'TheStats + iSport Animation + iSport Flash Stats run together while live',
      lineups: 'TheStats enrichment is automatic until official lineup is saved',
      postmatch: 'TheStats final events/stats replace iSport events through dedupe when available',
      cancelledGoals: 'cancelled/disallowed goals remain separate from valid goals',
    },
    stages,
    note: hardFailures.length ? 'Cron completed in degraded mode. Inspect failed stages for provider-specific issues.' : 'Cron completed with TheStats and iSport live sync policy.',
  });
}

export async function POST(req: Request) { return GET(req); }
