import { spawn } from 'node:child_process';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_OUTPUT_CHARS = 30_000;

function allowedSecrets() {
  return [process.env.LIVE_INGEST_SECRET, process.env.CRON_SECRET, process.env.ADMIN_API_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function requestToken(request: Request) {
  const url = new URL(request.url);
  return (
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    request.headers.get('x-live-ingest-secret')?.trim() ||
    request.headers.get('x-cron-secret')?.trim() ||
    request.headers.get('x-admin-secret')?.trim() ||
    url.searchParams.get('secret')?.trim() ||
    ''
  );
}

function isAuthorized(request: Request) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;
  const token = requestToken(request);
  return Boolean(token && secrets.includes(token));
}

function appendBounded(current: string, chunk: Buffer) {
  const next = current + chunk.toString('utf8');
  return next.length > MAX_OUTPUT_CHARS ? next.slice(-MAX_OUTPUT_CHARS) : next;
}

function parseLastJson(stdout: string) {
  const start = stdout.lastIndexOf('\n{');
  const jsonText = (start >= 0 ? stdout.slice(start + 1) : stdout.slice(stdout.indexOf('{'))).trim();
  if (!jsonText.startsWith('{')) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function runCliWorker() {
  const timeoutMs = Number(process.env.LIVE_INGEST_ROUTE_TIMEOUT_MS || 55_000);
  const scriptPath = path.join(process.cwd(), 'scripts', 'automated-live-ingest-worker.mjs');

  return new Promise<{ code: number | null; stdout: string; stderr: string; summary: unknown | null }>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LIVE_INGEST_LOOP: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`live ingest worker timed out after ${timeoutMs}ms`));
    }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 55_000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const summary = parseLastJson(stdout);
      resolve({ code, stdout, stderr, summary });
    });
  });
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runCliWorker();
    if (result.code !== 0) {
      return NextResponse.json({
        ok: false,
        jobName: 'live-ingest-worker',
        mode: 'url_triggered_cli_worker',
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      jobName: 'live-ingest-worker',
      mode: 'url_triggered_cli_worker',
      summary: result.summary,
      stdout: result.summary ? undefined : result.stdout,
      stderr: result.stderr || undefined,
    });
  } catch (error: any) {
    console.error('live-ingest-worker cron failed:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
