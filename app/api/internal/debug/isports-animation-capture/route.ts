import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchISportsAnimationBrowserlessText } from '@/scripts/isports-animation-browserless-fallback.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isDebugCaptureEnabled() {
  return process.env.ENABLE_ISPORTS_DEBUG_CAPTURE === 'true';
}

function disabledResponse() {
  return NextResponse.json(
    { ok: false, error: 'Not Found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  );
}

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

function cleanUrl(urlStr: string | null | undefined): string {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    if (url.searchParams.has('token')) {
      url.searchParams.set('token', 'REDACTED');
    }
    if (url.searchParams.has('api_key')) {
      url.searchParams.set('api_key', 'REDACTED');
    }
    return url.toString();
  } catch {
    return urlStr
      .replace(/([\?&]token=)[^&]*/gi, '$1REDACTED')
      .replace(/([\?&]api_key=)[^&]*/gi, '$1REDACTED');
  }
}

async function handle(request: Request) {
  if (!isDebugCaptureEnabled()) {
    return disabledResponse();
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const { searchParams } = new URL(request.url);
  let matchId = searchParams.get('matchId') || '';
  let providerMatchId = searchParams.get('providerMatchId') || '';

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (body.matchId) matchId = String(body.matchId);
      if (body.providerMatchId) providerMatchId = String(body.providerMatchId);
    } catch {
      // Ignore JSON body parse errors
    }
  }

  if (!providerMatchId && matchId) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });
      providerMatchId = match?.animationMatchId ? String(match.animationMatchId) : '';
    } catch (dbError) {
      console.error('[debug-capture] Prisma lookup failed:', dbError);
    }
  }

  if (!providerMatchId) {
    return NextResponse.json(
      { ok: false, error: 'Missing or unresolved providerMatchId (animationMatchId)' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const originalFallback = process.env.LIVE_INGEST_USE_BROWSERLESS_FALLBACK;
  const originalMaxBrowserless = process.env.LIVE_INGEST_MAX_BROWSERLESS_REQUESTS;

  let result: any;
  let durationMs = 0;
  const start = Date.now();

  try {
    process.env.LIVE_INGEST_USE_BROWSERLESS_FALLBACK = 'true';
    process.env.LIVE_INGEST_MAX_BROWSERLESS_REQUESTS = '999';

    result = await fetchISportsAnimationBrowserlessText(providerMatchId);
    durationMs = Date.now() - start;
  } catch (error: any) {
    durationMs = Date.now() - start;
    result = {
      enabled: true,
      error: error?.message || String(error),
      rawData: {
        loader: 'failed',
        functionError: error?.message || String(error),
        htmlLength: 0,
        textSample: '',
        jsonPayloads: [],
        networkSamples: [],
      },
    };
  } finally {
    process.env.LIVE_INGEST_USE_BROWSERLESS_FALLBACK = originalFallback;
    process.env.LIVE_INGEST_MAX_BROWSERLESS_REQUESTS = originalMaxBrowserless;
  }

  const rawData = result.rawData || {};
  const loader = rawData.loader || '';
  const contentFallbackUsed = loader.startsWith('browserless_content');
  const sanitizedSourceUrl = cleanUrl(result.sourceUrl || rawData.sourceUrl || '');

  const networkSamples = (rawData.networkSamples || []).map((sample: any) => ({
    url: cleanUrl(sample.url),
    contentType: sample.contentType,
    textSample: sample.textSample ? String(sample.textSample).slice(0, 300) : '',
  }));

  const jsonPayloads = (rawData.jsonPayloads || []).map((payload: any) => {
    const str = JSON.stringify(payload);
    return str.length > 400 ? str.slice(0, 400) + '…' : str;
  });

  const finalResponse = {
    ok: Boolean(result.hasText || (result.text && result.text.length > 0)),
    providerMatchId,
    sourceUrl: sanitizedSourceUrl,
    loader,
    functionError: rawData.functionError || result.error || null,
    contentFallbackUsed,
    textSample: result.text ? String(result.text).slice(0, 500) : '',
    networkSamples,
    jsonPayloads,
    durationMs,
  };

  const sensitiveStrings = [
    process.env.LIVE_INGEST_SECRET,
    process.env.ADMIN_API_SECRET,
    process.env.CRON_SECRET,
    process.env.BROWSERLESS_TOKEN,
    process.env.BROWSERLESS_FALLBACK_TOKEN,
    process.env.ISPORTS_API_KEY,
    process.env.ISPORTS_ANIMATION_ACCESS_KEY,
    process.env.THE_STATS_API_KEY,
    process.env.DATABASE_URL,
  ]
    .map((s) => String(s || '').trim())
    .filter((s) => s.length > 5);

  let responseJson = JSON.stringify(finalResponse);
  for (const secret of sensitiveStrings) {
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    responseJson = responseJson.replace(regex, '[REDACTED_SECRET]');
  }

  const sanitizedObj = JSON.parse(responseJson);
  return NextResponse.json(sanitizedObj, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
