import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONTROL_KEYS = new Set(['key', 'cronSecret', 'adminSecret', 'apply', 'dryRun']);

function configuredSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_API_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getSuppliedSecret(req: Request, searchParams: URLSearchParams) {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return String(
    req.headers.get('x-cron-secret')?.trim() ||
    req.headers.get('x-admin-secret')?.trim() ||
    bearer ||
    searchParams.get('cronSecret')?.trim() ||
    searchParams.get('adminSecret')?.trim() ||
    searchParams.get('key')?.trim() ||
    '',
  ).trim();
}

function isAuthorized(secret: string) {
  const validSecrets = configuredSecrets();
  return !!secret && validSecrets.includes(secret);
}

function internalOrigin(fallback: string) {
  const port = process.env.PORT;
  return port ? `http://127.0.0.1:${port}` : fallback;
}

export async function GET(req: Request) {
  const incomingUrl = new URL(req.url);
  const suppliedSecret = getSuppliedSecret(req, incomingUrl.searchParams);

  if (!isAuthorized(suppliedSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const adminUrl = new URL('/api/admin/the-stats-verify', internalOrigin(incomingUrl.origin));
  adminUrl.searchParams.set('providerPath', incomingUrl.searchParams.get('providerPath') || '/api/football/matches');
  adminUrl.searchParams.set('competition_id', incomingUrl.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107');
  adminUrl.searchParams.set('season_id', incomingUrl.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868');
  adminUrl.searchParams.set('per_page', incomingUrl.searchParams.get('per_page') || '100');
  adminUrl.searchParams.set('dryRun', 'true');
  adminUrl.searchParams.set('includeRaw', incomingUrl.searchParams.get('includeRaw') || 'false');

  for (const [key, value] of incomingUrl.searchParams.entries()) {
    if (!CONTROL_KEYS.has(key) && !adminUrl.searchParams.has(key)) adminUrl.searchParams.set(key, value);
  }

  const response = await fetch(adminUrl, {
    method: 'GET',
    headers: { 'x-cron-secret': suppliedSecret },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({ ok: false, error: 'Invalid JSON response from admin verification endpoint' }));

  return NextResponse.json({
    ok: response.ok && payload?.ok !== false,
    cron: true,
    mode: 'verify_only',
    forcedDryRun: true,
    upstreamStatus: response.status,
    usedInternalOrigin: adminUrl.origin,
    result: payload,
    safety: {
      databaseIsSourceOfTruth: true,
      publicRequestsDoNotCallProvider: true,
      cronDoesNotApplyChanges: true,
      prohibitedDataBlocked: true,
    },
  }, { status: response.ok ? 200 : response.status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
