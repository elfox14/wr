import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { extractISportsMatchId } from '@/lib/live-ingest/isports-page';
import { ensureStatsTable, hasUsefulStats, type NormalizedStats } from '@/lib/live-match-stats';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type FrameMode = 'live' | 'timeline';
type FlashRecord = { id: string; dataType: string; teamId: string; eventType: string; minute: number | null; injuryTime: number | null; raw: string };
const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);
const FLASH_SOURCE = 'ISPORTS_FLASH';
const FINAL_MINUTE_FALLBACK = 120;

function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }); }
function clamp(value: string | null, fallback: number, min: number, max: number) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }
function boolParam(value: string | null, fallback = false) { return value === null ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()); }
function safeUrl(value: string) { const url = new URL(value); if (!HOSTS.has(url.hostname.toLowerCase())) throw new Error('Only isportslive8.com URLs are allowed'); return url; }
function md5(value: string) { return createHash('md5').update(value).digest('hex').toUpperCase(); }
function lastRegexValue(text: string, regex: RegExp) { let found: string | null = null; for (const match of text.matchAll(regex)) if (match?.[1]) found = match[1]; return found; }
function numberFrom(value: unknown) { const n = Number(String(value ?? '').replace('%', '').trim()); return Number.isFinite(n) ? Math.round(n) : null; }
function isFinalMinute(minute: number | null) { return minute !== null && minute >= FINAL_MINUTE_FALLBACK; }
function extractFrameCredentials(html: string) {
  const ak = lastRegexValue(html, /USER_FEIJING88\.ak\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bak\s*:\s*["']([^"']+)["']/g);
  const sk = lastRegexValue(html, /USER_FEIJING88\.sk\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bsk\s*:\s*["']([^"']+)["']/g);
  return ak && sk ? { ak, sk } : null;
}
function parseMode(value: string | null): FrameMode { return String(value || 'timeline').toLowerCase() === 'live' ? 'live' : 'timeline'; }
function defaultWrapperUrl(matchId: number, mode: FrameMode, lang = 'en', version = '1') {
  const url = new URL(`https://www.isportslive8.com${mode === 'timeline' ? '/football/process/demo.html' : '/football/pc.html'}`);
  url.searchParams.set('matchId', String(matchId)); url.searchParams.set('lang', lang); url.searchParams.set('v', version); return url.toString();
}
function buildFrameUrl(wrapperUrl: string, matchId: number, mode: FrameMode, ak: string, sk: string) {
  const wrapper = new URL(wrapperUrl); const ts = Math.floor(Date.now() / 1000); const auth = md5(`${ak}${ts}${sk}`);
  const frame = new URL(mode === 'timeline' ? '/football/process/attackdetail.aspx' : '/football/detail.html', wrapper.origin);
  frame.searchParams.set('matchId', String(matchId)); frame.searchParams.set('accessKey', ak); frame.searchParams.set('ts', String(ts)); frame.searchParams.set('auth', auth);
  if (mode === 'timeline') frame.searchParams.set('r', String(Date.now()));
  frame.searchParams.set('lang', wrapper.searchParams.get('lang') || 'en');
  return frame.toString();
}
function maskUrl(value: string) { const url = new URL(value); for (const key of ['accessKey', 'auth', 'ts', 'r', 'token']) if (url.searchParams.has(key)) url.searchParams.set(key, '***'); return url.toString(); }
function maskMaybe(value?: string | null) { if (!value) return value || null; try { return maskUrl(value); } catch { return value.replace(/([?&](?:accessKey|auth|ts|r|token)=)[^&\s]+/gi, '$1***'); } }
async function fetchWrapper(url: string) { const response = await fetch(url, { cache: 'no-store', headers: { accept: 'text/html,*/*', 'user-agent': 'Mozilla/5.0 MCPrimeFlashPull/1.0' } }); return { ok: response.ok, status: response.status, html: await response.text() }; }
function endpointTo(raw: string, path: 'content' | 'function', token?: string | null) {
  const url = new URL(raw);
  if (url.pathname === '/' || url.pathname === '') url.pathname = `/${path}`;
  else if (/\/(content|function)\/?$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\/(content|function)\/?$/i, `/${path}`);
  else url.pathname = `${url.pathname.replace(/\/$/, '')}/${path}`;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}
function browserlessEndpoints(path: 'content' | 'function') {
  const candidates: string[] = [];
  const primaryRaw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const primaryToken = process.env.BROWSERLESS_TOKEN;
  if (primaryRaw && primaryToken) candidates.push(endpointTo(primaryRaw, path, primaryToken));
  const fallbackRaw = process.env.BROWSERLESS_FALLBACK_ENDPOINT || process.env.BROWSERLESS_BACKUP_ENDPOINT || 'https://browserless-backup-5k6y.onrender.com/content';
  const fallbackToken = process.env.BROWSERLESS_FALLBACK_TOKEN || process.env.BROWSERLESS_BACKUP_TOKEN || process.env.BROWSERLESS_TOKEN;
  if (fallbackRaw) candidates.push(endpointTo(fallbackRaw, path, fallbackToken));
  return [...new Set(candidates)];
}
function browserlessCode() {
  return `export default async function ({ page, context }) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(context.url, { waitUntil: 'domcontentloaded', timeout: context.timeoutMs });
    await sleep(context.waitMs || 10000);
    const payload = await page.evaluate(async () => {
      const scheduleID = window.scheduleID || null;
      let flashFetch = null;
      if (scheduleID) {
        try {
          const res = await fetch('/flashdata/get?id=' + encodeURIComponent(scheduleID) + '&t=' + Date.now(), { cache: 'no-store' });
          flashFetch = { ok: res.ok, status: res.status, contentType: res.headers.get('content-type'), text: await res.text() };
        } catch (error) { flashFetch = { ok: false, error: String(error && error.message || error), text: '' }; }
      }
      const attack = window.attakBarList || [];
      const goal = window.goalBarList || [];
      return { scheduleID, matchState: typeof window.matchState !== 'undefined' ? window.matchState : null, bodyText: (document.body ? document.body.innerText : '').slice(0, 1500), attackBarsLength: attack.length || 0, goalBarsLength: goal.length || 0, flashFetch };
    });
    return { data: payload, type: 'application/json' };
  }`;
}
async function callBrowserlessFunction(targetUrl: string, timeoutMs: number, waitMs: number) {
  const attempts: any[] = [];
  for (const endpoint of browserlessEndpoints('function')) {
    try {
      const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json,*/*' }, body: JSON.stringify({ code: browserlessCode(), context: { url: targetUrl, timeoutMs, waitMs } }) });
      const text = await response.text(); let parsed: any = null; try { parsed = JSON.parse(text); } catch {}
      const result = { ok: response.ok, status: response.status, endpoint: maskMaybe(endpoint), rawLength: text.length, contentType: response.headers.get('content-type'), data: parsed?.data || parsed || null, rawSample: parsed ? null : text.slice(0, 1200) };
      attempts.push({ ...result, data: undefined });
      if (response.ok && result.data?.flashFetch?.text) return { ...result, attempts, loader: 'browserless_function' };
    } catch (error: any) {
      attempts.push({ ok: false, status: null, endpoint: maskMaybe(endpoint), error: String(error?.message || error).slice(0, 1000) });
    }
  }
  return { ok: false, status: null, endpoint: null, rawLength: 0, contentType: null, data: null, rawSample: 'No Browserless function endpoint succeeded', attempts, loader: 'browserless_function_failed' };
}
async function callBrowserlessContent(targetUrl: string, timeoutMs: number, waitMs: number) {
  const attempts: any[] = [];
  for (const endpoint of browserlessEndpoints('content')) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json', accept: 'text/html,application/json,*/*' },
        body: JSON.stringify({ url: targetUrl, bestAttempt: true, gotoOptions: { waitUntil: 'domcontentloaded', timeout: timeoutMs }, waitForTimeout: waitMs }),
      });
      const text = await response.text();
      const result = { ok: response.ok, status: response.status, endpoint: maskMaybe(endpoint), rawLength: text.length, contentType: response.headers.get('content-type'), html: text, rawSample: text.slice(0, 600) };
      attempts.push({ ...result, html: undefined });
      if (response.ok && text && !/^\s*Loading\.?\s*$/i.test(text)) return { ...result, attempts, loader: 'browserless_content' };
    } catch (error: any) {
      attempts.push({ ok: false, status: null, endpoint: maskMaybe(endpoint), error: String(error?.message || error).slice(0, 1000) });
    }
  }
  return { ok: false, status: null, endpoint: null, rawLength: 0, contentType: null, html: '', rawSample: 'No Browserless content endpoint succeeded', attempts, loader: 'browserless_content_failed' };
}
function extractScheduleID(text: string) {
  return lastRegexValue(text, /\bscheduleID\s*=\s*["']?([A-Za-z0-9_-]+)["']?/gi)
    || lastRegexValue(text, /\bscheduleId\s*=\s*["']?([A-Za-z0-9_-]+)["']?/gi)
    || lastRegexValue(text, /\bscheduleid\s*[:=]\s*["']?([A-Za-z0-9_-]+)["']?/gi)
    || lastRegexValue(text, /flashdata\/get\?id=([A-Za-z0-9_-]+)/gi);
}
async function fetchFlashBySchedule(frameUrl: string, scheduleID: string) {
  const frame = new URL(frameUrl);
  const url = new URL('/flashdata/get', frame.origin);
  url.searchParams.set('id', scheduleID);
  url.searchParams.set('t', String(Date.now()));
  const response = await fetch(url.toString(), { cache: 'no-store', headers: { accept: 'text/plain,*/*', referer: frameUrl, 'user-agent': 'Mozilla/5.0 MCPrimeFlashPull/1.0' } });
  return { ok: response.ok, status: response.status, contentType: response.headers.get('content-type'), url: maskMaybe(url.toString()), text: await response.text() };
}
async function callBrowserless(targetUrl: string, timeoutMs: number, waitMs: number) {
  const fn = await callBrowserlessFunction(targetUrl, timeoutMs, waitMs);
  if (fn.data?.flashFetch?.text) return fn;
  const content = await callBrowserlessContent(targetUrl, timeoutMs, waitMs);
  const scheduleID = extractScheduleID(content.html || '');
  let flashFetch: any = null;
  if (scheduleID) flashFetch = await fetchFlashBySchedule(targetUrl, scheduleID);
  return {
    ok: Boolean(flashFetch?.text) || content.ok,
    status: flashFetch?.status ?? content.status,
    endpoint: content.endpoint,
    rawLength: content.rawLength,
    contentType: content.contentType,
    data: { scheduleID, bodyText: String(content.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500), flashFetch },
    rawSample: flashFetch?.text ? null : content.rawSample,
    attempts: [...(fn.attempts || []), ...(content.attempts || [])],
    loader: flashFetch?.text ? 'browserless_content_plus_direct_flashdata' : 'browserless_content_no_schedule',
  };
}
function emptyStats(): NormalizedStats { return { minute: null, homePossession: null, awayPossession: null, homeAttacks: null, awayAttacks: null, homeDangerousAttacks: null, awayDangerousAttacks: null, homeShots: null, awayShots: null, homeShotsOnTarget: null, awayShotsOnTarget: null, homeShotsOffTarget: null, awayShotsOffTarget: null, homeCorners: null, awayCorners: null, homeYellowCards: null, awayYellowCards: null, homeRedCards: null, awayRedCards: null, homeScore: null, awayScore: null }; }
function parseFlashRecords(text: string) {
  const records: FlashRecord[] = [];
  for (const section of String(text || '').split('!')) {
    for (const raw of section.split('^')) {
      const cols = raw.split(',');
      if (cols.length < 5) continue;
      if (!/^\d+$/.test(cols[0] || '') || !/^\d+$/.test(cols[1] || '') || !/^\d+$/.test(cols[2] || '0') || !/^\d+$/.test(cols[3] || '') || !/^\d+$/.test(cols[4] || '')) continue;
      records.push({ id: cols[0], dataType: cols[1], teamId: cols[2], eventType: cols[3], minute: numberFrom(cols[4]), injuryTime: numberFrom(cols[5]), raw });
    }
  }
  return records;
}
function parseFlashStats(text: string) {
  const sections = String(text || '').split('!');
  const schedule = (sections[0] || '').split('^');
  const homeProviderTeamId = schedule[4] || null;
  const awayProviderTeamId = schedule[5] || null;
  const stats = emptyStats();
  stats.homeScore = numberFrom(schedule[6]); stats.awayScore = numberFrom(schedule[7]); stats.minute = numberFrom(schedule[9]);
  const records = parseFlashRecords(text);
  const counts: Record<string, number> = {};
  const inc = (key: string) => { counts[key] = (counts[key] || 0) + 1; };
  for (const record of records) {
    const side = record.teamId === homeProviderTeamId ? 'home' : record.teamId === awayProviderTeamId ? 'away' : null;
    if (!side) continue;
    inc(`${record.dataType}:${record.eventType}:${side}`);
  }
  stats.homeAttacks = counts['1:21:home'] ?? null;
  stats.awayAttacks = counts['1:21:away'] ?? null;
  stats.homeDangerousAttacks = counts['1:20:home'] ?? null;
  stats.awayDangerousAttacks = counts['1:20:away'] ?? null;
  stats.homeCorners = counts['2:1:home'] ?? null;
  stats.awayCorners = counts['2:1:away'] ?? null;
  const maxMinute = records.reduce((max, record) => typeof record.minute === 'number' ? Math.max(max, record.minute) : max, stats.minute || 0);
  if (maxMinute > 0) stats.minute = maxMinute;
  return { stats, records, meta: { scheduleID: schedule[0] || null, homeProviderTeamId, awayProviderTeamId, matchState: schedule[8] || null, scheduleMinute: numberFrom(schedule[9]), eventTypeCounts: counts } };
}
function providerStatus(matchState: unknown, minute: number | null) {
  const state = String(matchState ?? '').trim().toUpperCase();
  if (state === '-1' || state === '4' || state === 'FT' || state === 'FINISHED' || state === 'ENDED' || state === 'COMPLETED') return 'FINISHED';
  if (isFinalMinute(minute) && !['ET', 'AET', 'P', 'PEN', '5'].includes(state)) return 'FINISHED';
  if (state === '2' || state === 'HT' || state.includes('HALF')) return 'HT';
  if (state === '3' || state === '2H' || state.includes('SECOND')) return '2H';
  if (state === '1' || state === '1H' || state.includes('FIRST')) return '1H';
  if (state === '5' || state === 'P' || state === 'PEN') return 'PEN';
  return isFinalMinute(minute) ? 'FINISHED' : null;
}
async function getMatch(input: { dbMatchId?: string | null; providerMatchId: number }) {
  if (input.dbMatchId) return prisma.match.findUnique({ where: { id: input.dbMatchId }, include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } } });
  return prisma.match.findFirst({ where: { animationMatchId: input.providerMatchId }, include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } } });
}
async function updateMatchScore(match: any, stats: NormalizedStats, meta: any) {
  const data: any = {};
  if (typeof stats.homeScore === 'number' && Number.isFinite(stats.homeScore)) data.homeScore = stats.homeScore;
  if (typeof stats.awayScore === 'number' && Number.isFinite(stats.awayScore)) data.awayScore = stats.awayScore;
  const nextStatus = providerStatus(meta?.matchState, stats.minute ?? meta?.scheduleMinute ?? null);
  if (nextStatus) data.status = nextStatus;
  if (!Object.keys(data).length) return null;
  return prisma.match.update({ where: { id: match.id }, data, select: { id: true, homeScore: true, awayScore: true, status: true } });
}
async function saveSnapshot(match: any, providerMatchId: number, stats: NormalizedStats, rawData: any, replace = true) {
  if (!match?.id || !hasUsefulStats(stats)) return { deleted: 0, inserted: 0, snapshotId: null, reason: 'no_useful_flash_stats' };
  await ensureStatsTable(); let deleted = 0;
  if (replace) { const result = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId: match.id, provider: FLASH_SOURCE } }); deleted = result.count; }
  const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: FLASH_SOURCE, providerMatchId, minute: stats.minute, homePossession: stats.homePossession, awayPossession: stats.awayPossession, homeAttacks: stats.homeAttacks, awayAttacks: stats.awayAttacks, homeDangerousAttacks: stats.homeDangerousAttacks, awayDangerousAttacks: stats.awayDangerousAttacks, homeShots: stats.homeShots, awayShots: stats.awayShots, homeShotsOnTarget: stats.homeShotsOnTarget, awayShotsOnTarget: stats.awayShotsOnTarget, homeShotsOffTarget: stats.homeShotsOffTarget, awayShotsOffTarget: stats.awayShotsOffTarget, homeCorners: stats.homeCorners, awayCorners: stats.awayCorners, homeYellowCards: stats.homeYellowCards, awayYellowCards: stats.awayYellowCards, homeRedCards: stats.homeRedCards, awayRedCards: stats.awayRedCards, homeScore: stats.homeScore, awayScore: stats.awayScore, rawData }, select: { id: true } });
  const matchUpdate = await updateMatchScore(match, stats, rawData?.flashMeta || {});
  return { deleted, inserted: 1, snapshotId: snapshot.id, matchUpdate };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req); if (!auth.authorized) return auth.error;
  try {
    const url = new URL(req.url); const mode = parseMode(url.searchParams.get('mode')); const explicitSourceUrl = url.searchParams.get('sourceUrl');
    const rawMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || extractISportsMatchId(explicitSourceUrl));
    if (!Number.isFinite(rawMatchId) || rawMatchId <= 0) return json({ ok: false, error: 'matchId or sourceUrl is required' }, 400);
    const providerMatchId = Math.floor(rawMatchId); const wrapperUrl = explicitSourceUrl ? safeUrl(explicitSourceUrl).toString() : defaultWrapperUrl(providerMatchId, mode, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');
    const wrapper = await fetchWrapper(wrapperUrl); const credentials = extractFrameCredentials(wrapper.html);
    if (!credentials) return json({ ok: false, error: 'Could not extract iframe credentials', wrapper: { ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length } }, 502);
    const frameUrl = buildFrameUrl(wrapperUrl, providerMatchId, mode, credentials.ak, credentials.sk);
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), 30000, 5000, 60000); const waitMs = clamp(url.searchParams.get('waitMs'), 10000, 1000, 30000); const save = boolParam(url.searchParams.get('save'), false); const replace = boolParam(url.searchParams.get('replace'), true);
    const rendered = await callBrowserless(frameUrl, timeoutMs, waitMs); const flashText = String(rendered.data?.flashFetch?.text || ''); const parsed = parseFlashStats(flashText);
    const match = (save || url.searchParams.get('includeMatch') === 'true') ? await getMatch({ dbMatchId: url.searchParams.get('dbMatchId'), providerMatchId }) : null;
    const saveResult = save ? match ? await saveSnapshot(match, providerMatchId, parsed.stats, { source: FLASH_SOURCE, wrapperUrl, frameUrl: maskUrl(frameUrl), loader: rendered.loader, flashMeta: parsed.meta, recordsSample: parsed.records.slice(0, 20) }, replace) : { deleted: 0, inserted: 0, snapshotId: null, error: 'No local match found' } : null;
    return json({ ok: true, mode: 'isports_remote_flash_pull', frameMode: mode, loader: rendered.loader, remoteBrowser: { ok: rendered.ok, status: rendered.status, endpoint: maskMaybe(rendered.endpoint), attempts: rendered.attempts, rawLength: rendered.rawLength, error: rendered.rawSample || null }, wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length }, frame: { sourceUrl: maskUrl(frameUrl) }, match: match ? { id: match.id, status: match.status, homeTeam: match.homeTeam, awayTeam: match.awayTeam } : null, hasStats: hasUsefulStats(parsed.stats), stats: parsed.stats, flash: { ok: rendered.data?.flashFetch?.ok ?? null, status: rendered.data?.flashFetch?.status ?? null, scheduleID: rendered.data?.scheduleID || parsed.meta.scheduleID, attackBarsLength: rendered.data?.attackBarsLength ?? null, recordsCount: parsed.records.length, meta: parsed.meta, providerStatus: providerStatus(parsed.meta.matchState, parsed.stats.minute) }, save: saveResult, note: 'Parses iSports flashdata and updates score plus match phase when provider exposes matchState. If iSports keeps state as second-half while minute reaches 120+, the match is treated as finished to stop stale running clocks.' });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
