import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { extractISportsMatchId } from '@/lib/live-ingest/isports-page';
import { ensureStatsTable, hasUsefulStats, type NormalizedStats } from '@/lib/live-match-stats';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);
const VISUAL_SOURCE = 'ISPORTS_REMOTE_LIVE';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
function boolParam(value?: string | null, fallback = false) {
  if (value === null || typeof value === 'undefined') return fallback;
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
  return url.toString();
}
function defaultWrapperUrl(matchId: number, lang = 'en', version = '1') {
  const url = new URL('https://www.isportslive8.com/football/pc.html');
  url.searchParams.set('matchId', String(matchId));
  url.searchParams.set('lang', lang);
  url.searchParams.set('v', version);
  return url.toString();
}
function functionEndpoint() {
  const raw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const url = new URL(raw.replace(/\/content\/?$/, '/function'));
  const token = process.env.BROWSERLESS_TOKEN;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}
function maskUrl(value: string) {
  const url = new URL(value);
  for (const key of ['accessKey', 'auth', 'ts', 'r', 'token']) if (url.searchParams.has(key)) url.searchParams.set(key, '***');
  return url.toString();
}
function emptyStats(): NormalizedStats {
  return { minute: null, homePossession: null, awayPossession: null, homeAttacks: null, awayAttacks: null, homeDangerousAttacks: null, awayDangerousAttacks: null, homeShots: null, awayShots: null, homeShotsOnTarget: null, awayShotsOnTarget: null, homeShotsOffTarget: null, awayShotsOffTarget: null, homeCorners: null, awayCorners: null, homeYellowCards: null, awayYellowCards: null, homeRedCards: null, awayRedCards: null, homeScore: null, awayScore: null };
}
function numberFrom(value: unknown) {
  const text = String(value ?? '').replace('%', '').replace(/[^0-9.-]/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function hasUndefinedPlaceholder(text: string) {
  const compact = String(text || '').replace(/\s+/g, ' ').toLowerCase();
  return compact.includes('undefined attack undefined') || compact.includes('undefined shots undefined') || compact.includes('undefined% possession undefined%');
}
function valueToken(value: string) {
  return /^\d+(?:\.\d+)?%?$/.test(String(value || '').trim());
}
function parseByRegex(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`(\\d+(?:\\.\\d+)?%?)\\s*${escaped}\\s*(\\d+(?:\\.\\d+)?%?)`, 'i'))
    || String(text || '').match(new RegExp(`${escaped}\\s*(\\d+(?:\\.\\d+)?%?)\\s*(\\d+(?:\\.\\d+)?%?)`, 'i'));
  return match ? [numberFrom(match[1]), numberFrom(match[2])] as const : [null, null] as const;
}
function parseByLines(lines: string[], aliases: string[]) {
  const isLabel = (value: string) => aliases.some((alias) => value.toLowerCase() === alias.toLowerCase());
  for (let i = 0; i < lines.length; i += 1) {
    if (!isLabel(lines[i])) continue;
    const prev = [...lines.slice(0, i)].reverse().find(valueToken);
    const next = lines.slice(i + 1).find(valueToken);
    if (prev && next) return [numberFrom(prev), numberFrom(next)] as const;
    const nextValues = lines.slice(i + 1).filter(valueToken).slice(0, 2);
    if (nextValues.length === 2) return [numberFrom(nextValues[0]), numberFrom(nextValues[1])] as const;
  }
  return [null, null] as const;
}
function applyPair(stats: NormalizedStats, homeKey: keyof NormalizedStats, awayKey: keyof NormalizedStats, pair: readonly [number | null, number | null]) {
  if (pair[0] !== null) (stats as any)[homeKey] = pair[0];
  if (pair[1] !== null) (stats as any)[awayKey] = pair[1];
}
function parseVisualStats(text: string) {
  const stats = emptyStats();
  const normalized = String(text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n');
  const lines = normalized.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const find = (aliases: string[]) => {
    for (const alias of aliases) {
      const pair = parseByRegex(normalized, alias);
      if (pair[0] !== null || pair[1] !== null) return pair;
    }
    return parseByLines(lines, aliases);
  };

  applyPair(stats, 'homeAttacks', 'awayAttacks', find(['Attack', 'ATT', 'Attacks']));
  applyPair(stats, 'homeShots', 'awayShots', find(['Shots', 'Shot']));
  applyPair(stats, 'homePossession', 'awayPossession', find(['Possession', 'Poss']));
  applyPair(stats, 'homeShotsOnTarget', 'awayShotsOnTarget', find(['On Target', 'On-TGT', 'On TGT']));
  applyPair(stats, 'homeShotsOffTarget', 'awayShotsOffTarget', find(['Off Target', 'Off-TGT', 'Off TGT']));
  return stats;
}
function browserlessCode() {
  return `export default async function ({ page, context }) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(context.url, { waitUntil: 'networkidle2', timeout: context.timeoutMs });
    await sleep(context.waitMs || 12000);
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const candidates = Array.from(document.querySelectorAll('button,a,div,span,li')).filter((el) => /statistics|stats/i.test((el.textContent || '').trim()));
      for (const el of candidates.slice(0, 3)) { try { el.click(); await sleep(700); } catch {} }
    });
    await sleep(1200);
    const data = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const nodes = Array.from(document.querySelectorAll('body *')).map((el) => ({
        tag: el.tagName,
        text: (el.textContent || '').trim(),
        cls: el.getAttribute('class') || '',
        style: el.getAttribute('style') || '',
      })).filter((x) => x.text && /attack|shots|possession|on target|off target|\\d+%?/i.test(x.text)).slice(0, 200);
      return { title: document.title, href: location.href, text, nodes };
    });
    return { data, type: 'application/json' };
  }`;
}
async function callBrowserless(url: string, timeoutMs: number, waitMs: number) {
  const endpoint = functionEndpoint();
  const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json,*/*' }, body: JSON.stringify({ code: browserlessCode(), context: { url, timeoutMs, waitMs } }) });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, endpoint: maskUrl(endpoint), rawLength: text.length, contentType: response.headers.get('content-type'), data: parsed?.data || parsed || null, rawSample: parsed ? null : text.slice(0, 1200) };
}
async function getMatch(input: { dbMatchId?: string | null; providerMatchId: number }) {
  if (input.dbMatchId) return prisma.match.findUnique({ where: { id: input.dbMatchId }, include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } } });
  return prisma.match.findFirst({ where: { animationMatchId: input.providerMatchId }, include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } } });
}
async function saveSnapshot(match: any, providerMatchId: number, stats: NormalizedStats, rawData: any, reliable: boolean) {
  if (!match?.id) return { inserted: 0, snapshotId: null, reason: 'no_match' };
  if (!reliable) return { inserted: 0, snapshotId: null, reason: 'no_reliable_visual_stats' };
  await ensureStatsTable();
  const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: VISUAL_SOURCE, providerMatchId, minute: stats.minute, homePossession: stats.homePossession, awayPossession: stats.awayPossession, homeAttacks: stats.homeAttacks, awayAttacks: stats.awayAttacks, homeDangerousAttacks: stats.homeDangerousAttacks, awayDangerousAttacks: stats.awayDangerousAttacks, homeShots: stats.homeShots, awayShots: stats.awayShots, homeShotsOnTarget: stats.homeShotsOnTarget, awayShotsOnTarget: stats.awayShotsOnTarget, homeShotsOffTarget: stats.homeShotsOffTarget, awayShotsOffTarget: stats.awayShotsOffTarget, homeCorners: stats.homeCorners, awayCorners: stats.awayCorners, homeYellowCards: stats.homeYellowCards, awayYellowCards: stats.awayYellowCards, homeRedCards: stats.homeRedCards, awayRedCards: stats.awayRedCards, homeScore: stats.homeScore, awayScore: stats.awayScore, rawData }, select: { id: true } });
  return { inserted: 1, snapshotId: snapshot.id };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  try {
    const url = new URL(req.url);
    const explicitSourceUrl = url.searchParams.get('sourceUrl');
    const rawMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || extractISportsMatchId(explicitSourceUrl));
    if (!Number.isFinite(rawMatchId) || rawMatchId <= 0) return json({ ok: false, error: 'matchId or sourceUrl is required' }, 400);
    if (String(process.env.LIVE_STATS_REMOTE_BROWSER || '').toLowerCase() !== 'browserless' || !process.env.BROWSERLESS_TOKEN) return json({ ok: false, error: 'Browserless is not configured' }, 400);
    const providerMatchId = Math.floor(rawMatchId);
    const wrapperUrl = explicitSourceUrl ? safeUrl(explicitSourceUrl) : defaultWrapperUrl(providerMatchId, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), 35000, 5000, 70000);
    const waitMs = clamp(url.searchParams.get('waitMs'), 12000, 1000, 30000);
    const save = boolParam(url.searchParams.get('save'), false);
    const rendered = await callBrowserless(wrapperUrl, timeoutMs, waitMs);
    const text = String(rendered.data?.text || '');
    const stats = parseVisualStats(text);
    const reliable = hasUsefulStats(stats) && !hasUndefinedPlaceholder(text);
    const match = (save || url.searchParams.get('includeMatch') === 'true') ? await getMatch({ dbMatchId: url.searchParams.get('dbMatchId'), providerMatchId }) : null;
    const saveResult = save ? match ? await saveSnapshot(match, providerMatchId, stats, { source: VISUAL_SOURCE, wrapperUrl, textSample: text.slice(0, 2400), nodesSample: rendered.data?.nodes?.slice?.(0, 40) || [], capturedBy: 'browserless_function_visual_stats' }, reliable) : { inserted: 0, snapshotId: null, error: 'No local match found' } : null;
    return json({ ok: true, mode: 'isports_remote_visual_stats_pull', remoteBrowser: { ok: rendered.ok, status: rendered.status, rawLength: rendered.rawLength, error: rendered.rawSample || null }, wrapper: { sourceUrl: wrapperUrl }, hasStats: reliable, stats, validation: { hasUsefulStats: hasUsefulStats(stats), reliable, rejectedPlaceholder: hasUndefinedPlaceholder(text) }, textSample: text.slice(0, 1600), nodesPreview: rendered.data?.nodes?.slice?.(0, 20) || [], match: match ? { id: match.id, status: match.status, homeTeam: match.homeTeam, awayTeam: match.awayTeam } : null, save: saveResult, note: 'Parses the visible Statistics panel from iSports pc.html after clicking Statistics/Stats when available.' });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
