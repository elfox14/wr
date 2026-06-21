import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_JOBS: Record<string, string> = {
  'live-market-sync': '/api/cron/live-market-sync',
  'football-auto-sync': '/api/cron/football-auto-sync',
  'sync-animation-matches': '/api/cron/sync-animation-matches',
};

function getAuth(req: Request) {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';
  if (!expected) return { valid: false, method: 'missing_server_secret' };

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  const adminHeader = req.headers.get('x-admin-secret') || '';
  const { searchParams } = new URL(req.url);
  const cronQuery = searchParams.get('cronSecret') || '';
  const adminQuery = searchParams.get('adminSecret') || '';
  const keyQuery = searchParams.get('key') || '';

  const matched = [
    { method: 'authorization_bearer', value: bearer },
    { method: 'x-cron-secret', value: cronHeader },
    { method: 'x-admin-secret', value: adminHeader },
    { method: 'cronSecret_query', value: cronQuery },
    { method: 'adminSecret_query', value: adminQuery },
    { method: 'key_query', value: keyQuery },
  ].find((item) => item.value && item.value === expected);

  return matched ? { valid: true, method: matched.method } : { valid: false, method: null };
}

export async function GET(req: Request) {
  const auth = getAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const { searchParams } = new URL(req.url);
  const job = searchParams.get('job') || '';
  const path = ALLOWED_JOBS[job];

  if (!path) {
    return NextResponse.json({
      ok: false,
      error: 'Invalid job',
      allowedJobs: Object.keys(ALLOWED_JOBS),
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const origin = new URL(req.url).origin;
  const targetUrl = new URL(`${origin}${path}`);

  for (const [key, value] of searchParams.entries()) {
    if (['job', 'cronSecret', 'adminSecret', 'key'].includes(key)) continue;
    targetUrl.searchParams.set(key, value);
  }

  const secret = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || '';
  const response = await fetch(targetUrl.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${secret}`,
      'x-cron-secret': secret,
      accept: 'application/json',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => null);

  return NextResponse.json({
    ok: response.ok,
    job,
    target: path,
    authMethod: auth.method,
    status: response.status,
    payload,
  }, {
    status: response.ok ? 200 : 207,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  });
}

export async function POST(req: Request) {
  return GET(req);
}
