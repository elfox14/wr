import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

const DEFAULT_CANDIDATES = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/opt/google/chrome/chrome',
];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

function boolEnv(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

async function inspectCandidate(path: string) {
  const result: Record<string, unknown> = { path, exists: false, version: null, error: null };
  try {
    await access(path);
    result.exists = true;
  } catch (error: any) {
    result.error = error?.code || error?.message || 'not accessible';
    return result;
  }

  try {
    const { stdout, stderr } = await execFileAsync(path, ['--version'], { timeout: 5000, maxBuffer: 64 * 1024 });
    result.version = String(stdout || stderr || '').trim() || null;
  } catch (error: any) {
    result.error = error?.message || 'version check failed';
  }
  return result;
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const envCandidates = [process.env.LIVE_STATS_CHROME_PATH, process.env.CHROME_EXECUTABLE_PATH]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const candidates = [...new Set([...envCandidates, ...DEFAULT_CANDIDATES])];
  const inspected = await Promise.all(candidates.map(inspectCandidate));
  const selected = inspected.find((candidate: any) => candidate.exists) || null;

  return json({
    ok: true,
    mode: 'isports_browser_check',
    browserDisabled: boolEnv(process.env.LIVE_STATS_DISABLE_BROWSER),
    env: {
      LIVE_STATS_CHROME_PATH: process.env.LIVE_STATS_CHROME_PATH ? 'set' : 'not_set',
      CHROME_EXECUTABLE_PATH: process.env.CHROME_EXECUTABLE_PATH ? 'set' : 'not_set',
      LIVE_STATS_BROWSER_TIMEOUT_MS: process.env.LIVE_STATS_BROWSER_TIMEOUT_MS || null,
      LIVE_STATS_VIRTUAL_TIME_BUDGET_MS: process.env.LIVE_STATS_VIRTUAL_TIME_BUDGET_MS || null,
    },
    selected,
    candidates: inspected,
    ready: Boolean(selected) && !boolEnv(process.env.LIVE_STATS_DISABLE_BROWSER),
    note: 'If ready=false, frame-pull and page ingestors will fall back to fetch_html and JavaScript-rendered timeline pages will stay at Loading.',
  });
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
