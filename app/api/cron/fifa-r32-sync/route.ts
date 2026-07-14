import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { revalidateStatsViews } from '@/lib/revalidateStatsViews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const execFileAsync = promisify(execFile);
const KNOCKOUT_WORKER_PATH = 'scripts/fifa-knockout-sync-worker.mjs';

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

function parseWorkerSummary(stdout: string) {
  const text = String(stdout || '').trim();
  const index = text.lastIndexOf('\n{');
  const jsonText = index >= 0 ? text.slice(index + 1) : text;
  try { return JSON.parse(jsonText); }
  catch { return { raw: text.slice(-12000) }; }
}

function buildWorkerEnv(req: Request) {
  const url = new URL(req.url);
  const env: NodeJS.ProcessEnv = { ...process.env };
  const sourceUrl = String(url.searchParams.get('sourceUrl') || '').trim();
  const seasonId = String(url.searchParams.get('seasonId') || '').trim();
  const competitionId = String(url.searchParams.get('competitionId') || '').trim();
  const dryRun = url.searchParams.get('dryRun');

  if (sourceUrl) env.FIFA_MATCHES_SOURCE_URL = sourceUrl;
  if (seasonId) env.FIFA_SEASON_ID = seasonId;
  if (competitionId) env.FIFA_COMPETITION_ID = competitionId;
  if (dryRun !== null) {
    env.FIFA_KNOCKOUT_DRY_RUN = boolFrom(dryRun) ? 'true' : 'false';
    env.FIFA_R32_DRY_RUN = env.FIFA_KNOCKOUT_DRY_RUN;
  }

  return env;
}

async function runWorker(req: Request) {
  const timeoutRaw = Number(process.env.FIFA_KNOCKOUT_SYNC_HTTP_PROCESS_TIMEOUT_MS || process.env.FIFA_R32_SYNC_HTTP_PROCESS_TIMEOUT_MS || 55000);
  const timeout = Math.max(15000, Math.min(90000, timeoutRaw));
  const { stdout, stderr } = await execFileAsync(process.execPath, [KNOCKOUT_WORKER_PATH], {
    cwd: process.cwd(),
    env: buildWorkerEnv(req),
    timeout,
    maxBuffer: 1024 * 1024 * 4,
  });
  return { summary: parseWorkerSummary(String(stdout || '')), stderr: stderr ? String(stderr).slice(-4000) : '' };
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  const startedAt = Date.now();

  try {
    const worker = await runWorker(req);
    const revalidated = revalidateStatsViews('fifa-knockout-sync');
    return jsonResponse({ ok: true, mode: 'fifa_knockout_sync_cron_v2', durationMs: Date.now() - startedAt, result: worker.summary, revalidated, stderr: worker.stderr || undefined });
  } catch (error: unknown) {
    const anyError = error as { message?: string; stdout?: string; stderr?: string };
    return jsonResponse({ ok: false, mode: 'fifa_knockout_sync_cron_v2', durationMs: Date.now() - startedAt, error: anyError?.message || String(error), result: anyError?.stdout ? parseWorkerSummary(String(anyError.stdout)) : undefined, stderr: anyError?.stderr ? String(anyError.stderr).slice(-4000) : undefined }, 500);
  }
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
