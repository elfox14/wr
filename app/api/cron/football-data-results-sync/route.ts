import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hasValidAdminSecret } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const execFileAsync = promisify(execFile);

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}

function boolFrom(value: string | null | undefined, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function boolText(value: string | null, fallback: string) {
  if (value === null || value === '') return fallback;
  return boolFrom(value) ? 'true' : 'false';
}

function numberText(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return String(fallback);
  return String(Math.max(min, Math.min(max, Math.floor(parsed))));
}

function dateText(value: string | null) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function buildWorkerEnv(req: Request) {
  const url = new URL(req.url);
  const env: NodeJS.ProcessEnv = { ...process.env };

  env.FOOTBALL_DATA_RESULTS_LOOKBACK_DAYS = numberText(url.searchParams.get('lookbackDays'), 2, 0, 30);
  env.FOOTBALL_DATA_RESULTS_LOOKAHEAD_DAYS = numberText(url.searchParams.get('lookaheadDays'), 2, 0, 14);
  env.FOOTBALL_DATA_RESULTS_LOCAL_LIMIT = numberText(url.searchParams.get('localLimit') || url.searchParams.get('limit'), 120, 1, 300);
  env.FOOTBALL_DATA_MATCH_DATE_TOLERANCE_HOURS = numberText(url.searchParams.get('toleranceHours'), 36, 1, 96);
  env.FOOTBALL_DATA_RESULTS_DRY_RUN = boolText(url.searchParams.get('dryRun'), 'false');
  env.FOOTBALL_DATA_RESULTS_DEBUG = boolText(url.searchParams.get('debug'), 'false');
  env.FOOTBALL_DATA_RESULTS_SAVE_UNCHANGED_SNAPSHOT = boolText(url.searchParams.get('saveUnchangedSnapshot'), 'false');

  const dateFrom = dateText(url.searchParams.get('dateFrom'));
  const dateTo = dateText(url.searchParams.get('dateTo'));
  if (dateFrom) env.FOOTBALL_DATA_RESULTS_DATE_FROM = dateFrom;
  else delete env.FOOTBALL_DATA_RESULTS_DATE_FROM;
  if (dateTo) env.FOOTBALL_DATA_RESULTS_DATE_TO = dateTo;
  else delete env.FOOTBALL_DATA_RESULTS_DATE_TO;

  const competition = String(url.searchParams.get('competition') || url.searchParams.get('competitionCode') || '').trim();
  const season = String(url.searchParams.get('season') || '').trim();
  if (competition) env.FOOTBALL_DATA_COMPETITION = competition;
  if (season) env.FOOTBALL_DATA_SEASON = season;

  return env;
}

function parseWorkerSummary(stdout: string) {
  const text = String(stdout || '').trim();
  const index = text.lastIndexOf('\n{');
  const jsonText = index >= 0 ? text.slice(index + 1) : text;
  try { return JSON.parse(jsonText); }
  catch { return { raw: text.slice(-12000) }; }
}

async function runFreshWorkerProcess(req: Request) {
  const timeoutRaw = Number(process.env.FOOTBALL_DATA_RESULTS_HTTP_PROCESS_TIMEOUT_MS || 55000);
  const timeout = Math.max(15000, Math.min(90000, timeoutRaw));
  const { stdout, stderr } = await execFileAsync(process.execPath, ['scripts/football-data-results-sync-worker.mjs'], {
    cwd: process.cwd(),
    env: buildWorkerEnv(req),
    timeout,
    maxBuffer: 1024 * 1024 * 4,
  });

  return {
    summary: parseWorkerSummary(String(stdout || '')),
    stderr: stderr ? String(stderr).slice(-4000) : '',
  };
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const startedAt = Date.now();
  const quick = boolFrom(url.searchParams.get('quick'), false) || boolFrom(url.searchParams.get('background'), false);

  if (quick) {
    runFreshWorkerProcess(req).catch((error) => {
      console.error('[football-data-results-sync-cron] background failed:', error);
    });

    return jsonResponse({
      ok: true,
      mode: 'http_football_data_results_sync_cron_v2_quick_ack',
      durationMs: Date.now() - startedAt,
      note: 'Accepted. Worker is running asynchronously; check Render logs or saved snapshots for details.',
    });
  }

  try {
    const worker = await runFreshWorkerProcess(req);
    return jsonResponse({
      ok: true,
      mode: 'http_football_data_results_sync_cron_v1_fresh_process',
      durationMs: Date.now() - startedAt,
      result: worker.summary,
      stderr: worker.stderr || undefined,
    });
  } catch (error: unknown) {
    const anyError = error as { message?: string; stdout?: string; stderr?: string };
    return jsonResponse({
      ok: false,
      mode: 'http_football_data_results_sync_cron_v1_fresh_process',
      durationMs: Date.now() - startedAt,
      error: anyError?.message || String(error),
      result: anyError?.stdout ? parseWorkerSummary(String(anyError.stdout)) : undefined,
      stderr: anyError?.stderr ? String(anyError.stderr).slice(-4000) : undefined,
    }, 500);
  }
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
