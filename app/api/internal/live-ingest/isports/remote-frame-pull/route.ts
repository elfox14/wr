import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { extractISportsMatchId, htmlToText, parseISportsVisibleStats } from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type FrameMode = 'live' | 'timeline';

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function boolFromEnv(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function clamp(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeUrl(value: string) {
  const url = new URL(value);
  if (!HOSTS.has(url.hostname.toLowerCase())) throw new Error('Only isportslive8.com URLs are allowed');
  return url;
}

function md5(value: string) {
  return createHash('md5').update(value).digest('hex').toUpperCase();
}

function lastRegexValue(text: string, regex: RegExp) {
  let found: string | null = null;
  for (const match of text.matchAll(regex)) {
    if (match?.[1]) found = match[1];
  }
  return found;
}

function extractFrameCredentials(html: string) {
  const ak = lastRegexValue(html, /USER_FEIJING88\.ak\s*=\s*["']([^"']+)["']/g)
    || lastRegexValue(html, /\bak\s*:\s*["']([^"']+)["']/g);
  const sk = lastRegexValue(html, /USER_FEIJING88\.sk\s*=\s*["']([^"']+)["']/g)
    || lastRegexValue(html, /\bsk\s*:\s*["']([^"']+)["']/g);
  if (!ak || !sk) return null;
  return { ak, sk };
}

function parseMode(value: string | null): FrameMode {
  const mode = String(value || 'live').toLowerCase();
  return mode === 'timeline' || mode === 'process' || mode === 'postmatch' ? 'timeline' : 'live';
}

function defaultWrapperUrl(matchId: number, mode: FrameMode, lang = 'en', version = '1') {
  const path = mode === 'timeline' ? '/football/process/demo.html' : '/football/pc.html';
  const url = new URL(`https://www.isportslive8.com${path}`);
  url.searchParams.set('matchId', String(matchId));
  url.searchParams.set('lang', lang);
  url.searchParams.set('v', version);
  return url.toString();
}

function buildFrameUrl(wrapperUrl: string, matchId: number, mode: FrameMode, ak: string, sk: string) {
  const wrapper = new URL(wrapperUrl);
  const ts = Math.floor(Date.now() / 1000);
  const auth = md5(`${ak}${ts}${sk}`);
  const frame = new URL(mode === 'timeline' ? '/football/process/attackdetail.aspx' : '/football/detail.html', wrapper.origin);
  frame.searchParams.set('matchId', String(matchId));
  frame.searchParams.set('accessKey', ak);
  frame.searchParams.set('ts', String(ts));
  frame.searchParams.set('auth', auth);
  if (mode === 'timeline') frame.searchParams.set('r', String(Date.now()));
  const lang = wrapper.searchParams.get('lang') || 'en';
  const version = wrapper.searchParams.get('v');
  const isDark = wrapper.searchParams.get('isDark') || wrapper.searchParams.get('isdark');
  if (lang) frame.searchParams.set('lang', lang);
  if (mode === 'live' && (!version || version === '3')) frame.searchParams.set('statsPanel', 'simple');
  if (mode === 'timeline' && isDark !== null) frame.searchParams.set('isDark', isDark);
  if (mode === 'timeline' && version === '2') frame.searchParams.set('showLogo', '1');
  return frame.toString();
}

function maskUrl(value: string) {
  const url = new URL(value);
  for (const key of ['accessKey', 'auth', 'ts', 'r', 'token']) {
    if (url.searchParams.has(key)) url.searchParams.set(key, '***');
  }
  return url.toString();
}

async function fetchWrapper(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeRemoteFramePull/1.0; +https://worldcup.mcprim.com)',
    },
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, html };
}

function browserlessEndpoint() {
  const raw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const url = new URL(raw);
  const token = process.env.BROWSERLESS_TOKEN;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function extractHtmlFromBrowserless(text: string, contentType: string | null) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (contentType?.includes('application/json') || /^[{[]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      return String(parsed?.data || parsed?.html || parsed?.content || parsed?.body || text || '');
    } catch {}
  }
  return text;
}

async function renderWithBrowserless(targetUrl: string, timeoutMs: number, waitMs: number) {
  const endpoint = browserlessEndpoint();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs + 8000, 12000));
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        accept: 'text/html,application/json,*/*',
      },
      body: JSON.stringify({
        url: targetUrl,
        bestAttempt: true,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: timeoutMs,
        },
        waitForTimeout: waitMs,
      }),
    });
    const text = await response.text();
    const html = extractHtmlFromBrowserless(text, response.headers.get('content-type'));
    return { ok: response.ok, status: response.status, endpoint: maskUrl(endpoint), html, rawLength: text.length, contentType: response.headers.get('content-type'), error: response.ok ? null : text.slice(0, 1000) };
  } catch (error: any) {
    return { ok: false, status: null, endpoint: maskUrl(endpoint), html: '', rawLength: 0, contentType: null, error: String(error?.message || error).slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const url = new URL(req.url);
    const mode = parseMode(url.searchParams.get('mode'));
    const explicitSourceUrl = url.searchParams.get('sourceUrl');
    const rawMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || extractISportsMatchId(explicitSourceUrl));
    if (!Number.isFinite(rawMatchId) || rawMatchId <= 0) return json({ ok: false, error: 'matchId or sourceUrl is required' }, 400);
    const matchId = Math.floor(rawMatchId);
    const wrapperUrl = explicitSourceUrl ? safeUrl(explicitSourceUrl).toString() : defaultWrapperUrl(matchId, mode, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');

    const configured = String(process.env.LIVE_STATS_REMOTE_BROWSER || '').toLowerCase() === 'browserless'
      && Boolean(process.env.BROWSERLESS_TOKEN)
      && Boolean(process.env.BROWSERLESS_ENDPOINT);
    if (!configured) {
      return json({ ok: false, mode: 'isports_remote_frame_pull', error: 'Browserless is not configured. Set LIVE_STATS_REMOTE_BROWSER=browserless, BROWSERLESS_ENDPOINT, and BROWSERLESS_TOKEN.' }, 400);
    }

    const wrapper = await fetchWrapper(wrapperUrl);
    const credentials = extractFrameCredentials(wrapper.html);
    if (!credentials) return json({ ok: false, mode: 'isports_remote_frame_pull', error: 'Could not extract iframe credentials from wrapper', wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length } }, 502);

    const frameUrl = buildFrameUrl(wrapperUrl, matchId, mode, credentials.ak, credentials.sk);
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_TIMEOUT_MS || 25000), 5000, 60000);
    const waitMs = clamp(url.searchParams.get('waitMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_WAIT_MS || 8000), 1000, 25000);
    const rendered = await renderWithBrowserless(frameUrl, timeoutMs, waitMs);
    const text = htmlToText(rendered.html);
    const stats = parseISportsVisibleStats(text);

    return json({
      ok: true,
      mode: 'isports_remote_frame_pull',
      frameMode: mode,
      remoteBrowser: {
        provider: 'browserless',
        configured: true,
        endpoint: rendered.endpoint,
        ok: rendered.ok,
        status: rendered.status,
        contentType: rendered.contentType,
        rawLength: rendered.rawLength,
        error: rendered.error,
      },
      wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length },
      frame: {
        sourceUrl: maskUrl(frameUrl),
        loader: 'browserless_content',
        rendered: Boolean(rendered.ok && rendered.html.trim()),
        htmlLength: rendered.html.length,
        textLength: text.length,
        textSample: text.slice(0, 1600),
      },
      hasStats: Object.entries(stats).some(([key, value]) => !['homeScore', 'awayScore', 'minute'].includes(key) && value !== null),
      stats,
      note: 'Diagnostic only. This renders the signed iframe through Browserless /content without requiring Chromium on Render.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
