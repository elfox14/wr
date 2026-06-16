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

function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }); }
function clamp(value: string | null, fallback: number, min: number, max: number) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }
function boolParam(value: string | null, fallback = false) { return value === null ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()); }
function safeUrl(value: string) { const url = new URL(value); if (!HOSTS.has(url.hostname.toLowerCase())) throw new Error('Only isportslive8.com URLs are allowed'); return url; }
function md5(value: string) { return createHash('md5').update(value).digest('hex').toUpperCase(); }
function lastRegexValue(text: string, regex: RegExp) { let found: string | null = null; for (const match of text.matchAll(regex)) if (match?.[1]) found = match[1]; return found; }
function numberFrom(value: unknown) { const n = Number(String(value ?? '').replace('%', '').trim()); return Number.isFinite(n) ? Math.round(n) : null; }
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
async function fetchWrapper(url: string) { const response = await fetch(url, { cache: 'no-store', headers: { accept: 'text/html,*/*', 'user-agent': 'Mozilla/5.0 MCPrimeFlashPull/1.0' } }); return { ok: response.ok, status: response.status, html: await response.text() }; }
function functionEndpoint() { const url = new URL((process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content').replace(/\/content\/?$/, '/function')); const token = process.env.BROWSERLESS_TOKEN; if (token && !url.searchParams.has('token')) url.searchParams.set('token', token); return url.toString(); }
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
async function callBrowserless(targetUrl: string, timeoutMs: number, waitMs: number) {
  const endpoint = functionEndpoint();
  const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json,*/*' }, body: JSON.stringify({ code: browserlessCode(), context: { url: targetUrl, timeoutMs, waitMs } }) });
  const text = await response.text(); let parsed: any = null; try { parsed = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, endpoint: maskUrl(endpoint), rawLength: text.length, contentType: response.headers.get('content-type'), data: parsed?.data || parsed || null, rawSample: parsed ? null : text.slice(0, 1200) };
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
async function getMatch(input: { dbMatchId?: string | null; providerMatchId: number }) {
  if (input.dbMatchId) return prisma.match.findUnique({ where: { id: input.dbMatchId }, include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } } });
  return prisma.match.findFirst({ where: { animationMatchId: input.providerMatchId }, include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } } });
}
async function saveSnapshot(match: any, providerMatchId: number, stats: NormalizedStats, rawData: any, replace = true) {
  if (!match?.id || !hasUsefulStats(stats)) return { deleted: 0, inserted: 0, snapshotId: null, reason: 'no_useful_flash_stats' };
  await ensureStatsTable(); let deleted = 0;
  if (replace) { const result = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId: match.id, provider: FLASH_SOURCE } }); deleted = result.count; }
  const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: FLASH_SOURCE, providerMatchId, minute: stats.minute, homePossession: stats.homePossession, awayPossession: stats.awayPossession, homeAttacks: stats.homeAttacks, awayAttacks: stats.awayAttacks, homeDangerousAttacks: stats.homeDangerousAttacks, awayDangerousAttacks: stats.awayDangerousAttacks, homeShots: stats.homeShots, awayShots: stats.awayShots, homeShotsOnTarget: stats.homeShotsOnTarget, awayShotsOnTarget: stats.awayShotsOnTarget, homeShotsOffTarget: stats.homeShotsOffTarget, awayShotsOffTarget: stats.awayShotsOffTarget, homeCorners: stats.homeCorners, awayCorners: stats.awayCorners, homeYellowCards: stats.homeYellowCards, awayYellowCards: stats.awayYellowCards, homeRedCards: stats.homeRedCards, awayRedCards: stats.awayRedCards, homeScore: stats.homeScore, awayScore: stats.awayScore, rawData }, select: { id: true } });
  return { deleted, inserted: 1, snapshotId: snapshot.id };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req); if (!auth.authorized) return auth.error;
  try {
    const url = new URL(req.url); const mode = parseMode(url.searchParams.get('mode')); const explicitSourceUrl = url.searchParams.get('sourceUrl');
    const rawMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || extractISportsMatchId(explicitSourceUrl));
    if (!Number.isFinite(rawMatchId) || rawMatchId <= 0) return json({ ok: false, error: 'matchId or sourceUrl is required' }, 400);
    if (String(process.env.LIVE_STATS_REMOTE_BROWSER || '').toLowerCase() !== 'browserless' || !process.env.BROWSERLESS_TOKEN) return json({ ok: false, error: 'Browserless is not configured' }, 400);
    const providerMatchId = Math.floor(rawMatchId); const wrapperUrl = explicitSourceUrl ? safeUrl(explicitSourceUrl).toString() : defaultWrapperUrl(providerMatchId, mode, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');
    const wrapper = await fetchWrapper(wrapperUrl); const credentials = extractFrameCredentials(wrapper.html);
    if (!credentials) return json({ ok: false, error: 'Could not extract iframe credentials', wrapper: { ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length } }, 502);
    const frameUrl = buildFrameUrl(wrapperUrl, providerMatchId, mode, credentials.ak, credentials.sk);
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), 30000, 5000, 60000); const waitMs = clamp(url.searchParams.get('waitMs'), 10000, 1000, 30000); const save = boolParam(url.searchParams.get('save'), false); const replace = boolParam(url.searchParams.get('replace'), true);
    const rendered = await callBrowserless(frameUrl, timeoutMs, waitMs); const flashText = String(rendered.data?.flashFetch?.text || ''); const parsed = parseFlashStats(flashText);
    const match = (save || url.searchParams.get('includeMatch') === 'true') ? await getMatch({ dbMatchId: url.searchParams.get('dbMatchId'), providerMatchId }) : null;
    const saveResult = save ? match ? await saveSnapshot(match, providerMatchId, parsed.stats, { source: FLASH_SOURCE, wrapperUrl, frameUrl: maskUrl(frameUrl), flashMeta: parsed.meta, recordsSample: parsed.records.slice(0, 20) }, replace) : { deleted: 0, inserted: 0, snapshotId: null, error: 'No local match found' } : null;
    return json({ ok: true, mode: 'isports_remote_flash_pull', frameMode: mode, remoteBrowser: { ok: rendered.ok, status: rendered.status, rawLength: rendered.rawLength, error: rendered.rawSample || null }, wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length }, frame: { sourceUrl: maskUrl(frameUrl) }, match: match ? { id: match.id, status: match.status, homeTeam: match.homeTeam, awayTeam: match.awayTeam } : null, hasStats: hasUsefulStats(parsed.stats), stats: parsed.stats, flash: { ok: rendered.data?.flashFetch?.ok ?? null, status: rendered.data?.flashFetch?.status ?? null, scheduleID: rendered.data?.scheduleID || parsed.meta.scheduleID, attackBarsLength: rendered.data?.attackBarsLength ?? null, recordsCount: parsed.records.length, meta: parsed.meta }, save: saveResult, note: 'Parses iSports flashdata. eventType 21 = attacks, 20 = dangerous attacks, dataType 2/eventType 1 = corners. Possession and shots remain null unless exposed by source.' });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
