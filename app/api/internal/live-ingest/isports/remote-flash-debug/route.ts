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
function md5(value: string) { return createHash('md5').update(value).digest('hex').toUpperCase(); }
function lastRegexValue(text: string, regex: RegExp) {
  let found: string | null = null;
  for (const match of text.matchAll(regex)) if (match?.[1]) found = match[1];
  return found;
}
function extractFrameCredentials(html: string) {
  const ak = lastRegexValue(html, /USER_FEIJING88\.ak\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bak\s*:\s*["']([^"']+)["']/g);
  const sk = lastRegexValue(html, /USER_FEIJING88\.sk\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bsk\s*:\s*["']([^"']+)["']/g);
  return ak && sk ? { ak, sk } : null;
}
function parseMode(value: string | null): FrameMode {
  const mode = String(value || 'timeline').toLowerCase();
  return mode === 'live' ? 'live' : 'timeline';
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
  frame.searchParams.set('lang', wrapper.searchParams.get('lang') || 'en');
  return frame.toString();
}
function maskUrl(value: string) {
  const url = new URL(value);
  for (const key of ['accessKey', 'auth', 'ts', 'r', 'token']) if (url.searchParams.has(key)) url.searchParams.set(key, '***');
  return url.toString();
}
async function fetchWrapper(url: string) {
  const response = await fetch(url, { cache: 'no-store', headers: { accept: 'text/html,*/*', 'user-agent': 'Mozilla/5.0 MCPrimeFlashDebug/1.0' } });
  return { ok: response.ok, status: response.status, html: await response.text() };
}
function functionEndpoint() {
  const raw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const url = new URL(raw.replace(/\/content\/?$/, '/function'));
  const token = process.env.BROWSERLESS_TOKEN;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function browserlessCode() {
  return `export default async function ({ page, context }) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const responses = [];
    const failed = [];
    const safeSample = (value, max = 3000) => String(value == null ? '' : value).slice(0, max);
    page.on('requestfailed', (req) => failed.push({ url: req.url(), failure: req.failure() ? req.failure().errorText : null }));
    page.on('response', async (res) => {
      const url = res.url();
      if (!String(url).toLowerCase().includes('flashdata')) return;
      const item = { url, status: res.status(), contentType: res.headers()['content-type'] || null, sample: null };
      try { item.sample = safeSample(await res.text(), 2500); } catch (e) { item.sample = safeSample(e && e.message || e, 500); }
      responses.push(item);
    });
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(context.url, { waitUntil: 'domcontentloaded', timeout: context.timeoutMs });
    await sleep(context.waitMs || 12000);
    const data = await page.evaluate(async () => {
      const sample = (value, max = 20) => Array.isArray(value) ? value.slice(0, max) : null;
      const scheduleID = window.scheduleID || null;
      let flashFetch = null;
      if (scheduleID) {
        try {
          const res = await fetch('/flashdata/get?id=' + encodeURIComponent(scheduleID) + '&t=' + Date.now(), { cache: 'no-store' });
          flashFetch = { ok: res.ok, status: res.status, contentType: res.headers.get('content-type'), text: (await res.text()).slice(0, 12000) };
        } catch (error) {
          flashFetch = { ok: false, error: String(error && error.message || error) };
        }
      }
      const attack = window.attakBarList || [];
      const goal = window.goalBarList || [];
      return {
        title: document.title,
        href: location.href,
        bodyText: (document.body ? document.body.innerText : '').slice(0, 2000),
        scheduleID,
        matchState: typeof window.matchState !== 'undefined' ? window.matchState : null,
        attackBars: { length: attack.length || 0, sample: sample(attack, 40) },
        goalBars: { length: goal.length || 0, sample: sample(goal, 40) },
        flashFetch,
        flashDataKeys: window.flashData ? Object.keys(window.flashData).slice(0, 40) : [],
        flashScheduleKeys: window.flashData && window.flashData.scheduleList && window.flashData.scheduleList.items ? Object.keys(window.flashData.scheduleList.items).slice(0, 20) : [],
        flashStatusKeys: window.flashData && window.flashData.statusList && window.flashData.statusList.items ? Object.keys(window.flashData.statusList.items).slice(0, 20) : [],
      };
    });
    return { data: { page: data, responses, failed }, type: 'application/json' };
  }`;
}
async function callFunction(targetUrl: string, timeoutMs: number, waitMs: number) {
  const endpoint = functionEndpoint();
  const response = await fetch(endpoint, {
    method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json,*/*' },
    body: JSON.stringify({ code: browserlessCode(), context: { url: targetUrl, timeoutMs, waitMs } }),
  });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, endpoint: maskUrl(endpoint), contentType: response.headers.get('content-type'), rawLength: text.length, data: parsed || null, rawSample: parsed ? null : text.slice(0, 1600) };
}

export async function GET(req: Request) {
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
    if (String(process.env.LIVE_STATS_REMOTE_BROWSER || '').toLowerCase() !== 'browserless' || !process.env.BROWSERLESS_TOKEN) return json({ ok: false, error: 'Browserless is not configured' }, 400);
    const wrapper = await fetchWrapper(wrapperUrl);
    const credentials = extractFrameCredentials(wrapper.html);
    if (!credentials) return json({ ok: false, error: 'Could not extract iframe credentials', wrapper: { ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length } }, 502);
    const frameUrl = buildFrameUrl(wrapperUrl, matchId, mode, credentials.ak, credentials.sk);
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), 30000, 5000, 60000);
    const waitMs = clamp(url.searchParams.get('waitMs'), 12000, 1000, 30000);
    const rendered = await callFunction(frameUrl, timeoutMs, waitMs);
    return json({
      ok: rendered.ok,
      mode: 'isports_remote_flash_debug',
      frameMode: mode,
      wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length },
      frame: { sourceUrl: maskUrl(frameUrl) },
      remoteBrowser: { endpoint: rendered.endpoint, ok: rendered.ok, status: rendered.status, rawLength: rendered.rawLength, contentType: rendered.contentType },
      debug: rendered.data || null,
      rawSample: rendered.rawSample,
      next: 'Send page.attackBars.sample, page.goalBars.sample, and page.flashFetch.text so we can add the parser and save real attacks/shots.',
    }, rendered.ok ? 200 : 502);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
