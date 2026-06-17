import { NextResponse } from 'next/server';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const validSecrets = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret') || '',
    req.headers.get('x-cron-secret') || '',
    searchParams.get('adminSecret') || '',
    searchParams.get('cronSecret') || '',
    searchParams.get('key') || '',
  ];
  return candidates.some((value) => String(value).trim() && validSecrets.includes(String(value).trim()));
}

function valueType(value: any) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function primitivePreview(value: any) {
  if (value === null || value === undefined) return value;
  if (['string', 'number', 'boolean'].includes(typeof value)) return value;
  return `[${valueType(value)}]`;
}

function objectShape(value: any, depth = 0): any {
  if (depth > 2) return { type: valueType(value) };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      firstItemShape: value.length ? objectShape(value[0], depth + 1) : null,
    };
  }
  if (!value || typeof value !== 'object') return { type: valueType(value), preview: primitivePreview(value) };
  const entries = Object.entries(value).slice(0, 25);
  const keys = Object.keys(value).slice(0, 50);
  const children: Record<string, any> = {};
  for (const [key, child] of entries) {
    children[key] = depth === 2 ? { type: valueType(child), preview: primitivePreview(child) } : objectShape(child, depth + 1);
  }
  return { type: 'object', keys, children };
}

function samplePrimitiveLeaves(value: any, output: Array<{ path: string; value: any }> = [], prefix = '', depth = 0) {
  if (output.length >= 60 || depth > 4) return output;
  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, index) => samplePrimitiveLeaves(item, output, `${prefix}[${index}]`, depth + 1));
    return output;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value).slice(0, 20)) {
      samplePrimitiveLeaves(child, output, prefix ? `${prefix}.${key}` : key, depth + 1);
      if (output.length >= 60) break;
    }
    return output;
  }
  if (prefix) output.push({ path: prefix, value: primitivePreview(value) });
  return output;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const path = url.searchParams.get('path') || '/api/football/matches';
  const matchId = url.searchParams.get('matchId');
  const finalPath = matchId && path.includes('{matchId}') ? path.replace('{matchId}', encodeURIComponent(matchId)) : path;

  const params: Record<string, string | number> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (['adminSecret', 'cronSecret', 'key', 'path', 'matchId'].includes(key)) continue;
    params[key] = value;
  }

  try {
    const payload = await theStatsApiFetch(finalPath, params, { timeoutMs: 15000 });
    return NextResponse.json({
      ok: true,
      provider: 'THE_STATS_API',
      mode: 'raw_probe_shape_only',
      config: getTheStatsApiConfigStatus(),
      path: finalPath,
      queryKeys: Object.keys(params),
      shape: objectShape(payload),
      primitiveSamples: samplePrimitiveLeaves(payload),
      safety: {
        shapeOnly: true,
        noDatabaseWrites: true,
        fullPayloadNotReturned: true,
        prohibitedOddsStillBlocked: true,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      provider: 'THE_STATS_API',
      mode: 'raw_probe_shape_only',
      path: finalPath,
      error: safeTheStatsApiError(error),
      config: getTheStatsApiConfigStatus(),
    }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
