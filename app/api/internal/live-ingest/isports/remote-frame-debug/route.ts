import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { extractISportsMatchId } from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type FrameMode = 'live' | 'timeline';

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
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
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeRemoteFrameDebug/1.0; +https://worldcup.mcprim.com)',
    },
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, html };
}

function browserlessFunctionEndpoint() {
  const raw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const url = new URL(raw.replace(/\/content\/?$/, '/function'));
  const token = process.env.BROWSERLESS_TOKEN;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function browserlessDebugCode() {
  return `export default async function ({ page, context }) {
  const logs = [];
  const responses = [];
  const requestsFailed = [];
  const maxItems = 80;
  const interestingTerms = ['flashdata', 'get?', '/api', '/iapi', 'commoninterface', 'sockethelper', 'event.js', 'pako', 'stream', 'attackdetail', 'detail.html'];
  const isInteresting = (url) => {
    const lower = String(url || '').toLowerCase();
    return interestingTerms.some((term) => lower.includes(term));
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pushLimited = (arr, value) => { if (arr.length < maxItems) arr.push(value); };
  page.on('console', (msg) => pushLimited(logs, { type: msg.type(), text: msg.text().slice(0, 600) }));
  page.on('requestfailed', (request) => pushLimited(requestsFailed, { url: request.url(), method: request.method(), failure: request.failure() ? request.failure().errorText : null }));
  page.on('response', async (response) => {
    const url = response.url();
    if (!isInteresting(url)) return;
    const item = { url, status: response.status(), contentType: response.headers()['content-type'] || null, sample: null };
    try {
      const ct = item.contentType || '';
      if (/json|text|javascript|html/i.test(ct)) item.sample = (await response.text()).slice(0, 1000);
    } catch (error) { item.sample = String(error && error.message || error).slice(0, 300); }
    pushLimited(responses, item);
  });
  await page.setViewport({ width: context.width || 1280, height: context.height || 720, deviceScaleFactor: 1 });
  await page.goto(context.url, { waitUntil: 'domcontentloaded', timeout: context.timeoutMs });
  await sleep(context.waitMs || 12000);
  const pageData = await page.evaluate(() => {
    const css = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const st = window.getComputedStyle(el);
      return { display: st.display, visibility: st.visibility, opacity: st.opacity, height: st.height, width: st.width };
    };
    const q = (selector) => document.querySelector(selector);
    const text = (selector) => q(selector) ? q(selector).innerText || q(selector).textContent || '' : null;
    const html = (selector) => q(selector) ? q(selector).innerHTML || '' : null;
    const count = (selector) => document.querySelectorAll(selector).length;
    return {
      title: document.title,
      location: location.href,
      bodyText: (document.body ? document.body.innerText : '').slice(0, 5000),
      loadDivText: text('#loadDiv'),
      loadDivStyle: css('#loadDiv'),
      tipsText: text('#tipsDiv'),
      tipsStyle: css('#tipsDiv'),
      legendText: text('#legend'),
      attackInfoText: text('#attackInfo'),
      attackInfoHtml: (html('#attackInfo') || '').slice(0, 5000),
      homeLineHtml: (html('#homeLine') || '').slice(0, 3000),
      guestLineHtml: (html('#guestLine') || '').slice(0, 3000),
      domCounts: {
        scripts: count('script'),
        images: count('img'),
        icons: count('i'),
        canvases: count('canvas'),
        svgs: count('svg'),
        timelineDivs: count('.timeLine, .timeline, .ant, #attackInfo, #lineBox'),
      },
      globals: {
        scheduleID: window.scheduleID || null,
        matchState: typeof window.matchState !== 'undefined' ? window.matchState : null,
        configResultCode: window.configObj && typeof window.configObj.resultCode !== 'undefined' ? window.configObj.resultCode : null,
        configKeys: window.configObj ? Object.keys(window.configObj).slice(0, 40) : [],
        flashScheduleKeys: window.flashData && window.flashData.scheduleList && window.flashData.scheduleList.items ? Object.keys(window.flashData.scheduleList.items).slice(0, 20) : [],
        flashStatusKeys: window.flashData && window.flashData.statusList && window.flashData.statusList.items ? Object.keys(window.flashData.statusList.items).slice(0, 20) : [],
        attakBarListLength: window.attakBarList ? window.attakBarList.length : null,
        goalBarListLength: window.goalBarList ? window.goalBarList.length : null,
      },
      htmlSample: document.documentElement.outerHTML.slice(0, 8000),
    };
  });
  return { data: { pageData, logs, responses, requestsFailed }, type: 'application/json' };
}`;
}

async function callBrowserlessFunction(targetUrl: string, timeoutMs: number, waitMs: number) {
  const endpoint = browserlessFunctionEndpoint();
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json', accept: 'application/json,text/plain,*/*' },
    body: JSON.stringify({
      code: browserlessDebugCode(),
      context: { url: targetUrl, timeoutMs, waitMs, width: 1280, height: 720 },
    }),
  });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, endpoint: maskUrl(endpoint), contentType: response.headers.get('content-type'), rawLength: text.length, data: parsed || null, rawSample: parsed ? null : text.slice(0, 1600) };
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
      return json({ ok: false, mode: 'isports_remote_frame_debug', error: 'Browserless is not configured. Set LIVE_STATS_REMOTE_BROWSER=browserless, BROWSERLESS_ENDPOINT, and BROWSERLESS_TOKEN.' }, 400);
    }

    const wrapper = await fetchWrapper(wrapperUrl);
    const credentials = extractFrameCredentials(wrapper.html);
    if (!credentials) return json({ ok: false, mode: 'isports_remote_frame_debug', error: 'Could not extract iframe credentials from wrapper', wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length } }, 502);

    const frameUrl = buildFrameUrl(wrapperUrl, matchId, mode, credentials.ak, credentials.sk);
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_TIMEOUT_MS || 25000), 5000, 60000);
    const waitMs = clamp(url.searchParams.get('waitMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_WAIT_MS || 12000), 1000, 30000);
    const rendered = await callBrowserlessFunction(frameUrl, timeoutMs, waitMs);

    return json({
      ok: rendered.ok,
      mode: 'isports_remote_frame_debug',
      frameMode: mode,
      wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length },
      frame: { sourceUrl: maskUrl(frameUrl) },
      remoteBrowser: { provider: 'browserless', endpoint: rendered.endpoint, ok: rendered.ok, status: rendered.status, contentType: rendered.contentType, rawLength: rendered.rawLength },
      debug: rendered.data || null,
      rawSample: rendered.rawSample,
      note: 'Diagnostic only. Uses Browserless /function to collect DOM, globals, console logs, and relevant network responses from the signed iframe.',
    }, rendered.ok ? 200 : 502);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
