import { NextResponse } from 'next/server';
import { runOnce, setPrisma } from '@/scripts/automated-live-ingest-worker.mjs';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

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

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    setPrisma(prisma);
    const summary = await runOnce();
    return NextResponse.json({
      ok: true,
      jobName: 'live-ingest-worker',
      mode: 'in_process_worker',
      summary,
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
