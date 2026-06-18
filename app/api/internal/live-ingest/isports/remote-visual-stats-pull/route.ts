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

type VisualPair = { label: string; home: string | number | null; away: string | number | null; sourceUrl?: string | null };

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
function endpointToFunction(raw: string, token?: string | null) {
  const url = new URL(raw);
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/function';
  else if (/\/content\/?$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\/content\/?$/i, '/function');
  else if (!/\/function\/?$/i.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/, '')}/function`;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}
function functionEndpoints() {
  const candidates: string[] = [];
  const primaryRaw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const primaryToken = process.env.BROWSERLESS_TOKEN;
  if (primaryRaw && primaryToken) candidates.push(endpointToFunction(primaryRaw, primaryToken));

  const fallbackRaw = process.env.BROWSERLESS_FALLBACK_ENDPOINT || process.env.BROWSERLESS_BACKUP_ENDPOINT || 'https://browserless-backup-5k6y.onrender.com/content';
  const fallbackToken = process.env.BROWSERLESS_FALLBACK_TOKEN || process.env.BROWSERLESS_BACKUP_TOKEN || process.env.BROWSERLESS_TOKEN;
  if (fallbackRaw) candidates.push(endpointToFunction(fallbackRaw, fallbackToken));

  return [...new Set(candidates)];
}
function maskUrl(value?: string | null) {
  if (!value) return value || null;
  try {
    const url = new URL(value);
    for (const key of ['accessKey', 'auth', 'ts', 'r', 'token']) if (url.searchParams.has(key)) url.searchParams.set(key, '***');
    return url.toString();
  } catch {
    return value.replace(/(accessKey|auth|ts|r|token)=([^&\s]+)/gi, '$1=***');
  }
}
function scrubSensitive(value: unknown) {
  return String(value ?? '')
    .replace(/(accessKey|auth|ts|r|token)=([^&\s]+)/gi, '$1=***')
    .replace(/\b(ak|sk)\s*:\s*['"][^'"]+['"]/gi, "$1: '***'")
    .replace(/USER_FEIJING88\.ak\s*=\s*['"][^'"]+['"]/gi, "USER_FEIJING88.ak = '***'")
    .replace(/USER_FEIJING88\.sk\s*=\s*['"][^'"]+['"]/gi, "USER_FEIJING88.sk = '***'");
}
function emptyStats(): NormalizedStats {
  return {
    minute: null,
    homePossession: null,
    awayPossession: null,
    homeAttacks: null,
    awayAttacks: null,
    homeDangerousAttacks: null,
    awayDangerousAttacks: null,
    homeShots: null,
    awayShots: null,
    homeShotsOnTarget: null,
    awayShotsOnTarget: null,
    homeShotsOffTarget: null,
    awayShotsOffTarget: null,
    homeCorners: null,
    awayCorners: null,
    homeYellowCards: null,
    awayYellowCards: null,
    homeRedCards: null,
    awayRedCards: null,
    homeScore: null,
    awayScore: null,
  };
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
function sameLabel(value: string, aliases: string[]) {
  const normalized = String(value || '').trim().toLowerCase();
  return aliases.some((alias) => normalized === alias.toLowerCase());
}
function validRange(label: string, home: number | null, away: number | null) {
  if (home === null || away === null) return false;
  const name = label.toLowerCase();
  if (name.includes('possession') || name === 'poss') return home >= 0 && away >= 0 && home <= 100 && away <= 100 && Math.abs(home + away - 100) <= 5;
  if (name.includes('attack') || name === 'att' || name === 'd-att' || name.includes('shots') || name.includes('target')) return home >= 0 && away >= 0 && home <= 500 && away <= 500;
  return home >= 0 && away >= 0 && home <= 1000 && away <= 1000;
}
function exactLinePair(lines: string[], aliases: string[]) {
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^(\\d+(?:\\.\\d+)?%?)\\s*${escaped}\\s*(\\d+(?:\\.\\d+)?%?)$`, 'i');
    for (const line of lines) {
      const match = line.match(regex);
      if (match) return [numberFrom(match[1]), numberFrom(match[2])] as const;
    }
  }
  return [null, null] as const;
}
function valueToken(value: string) {
  return /^\d+(?:\.\d+)?%?$/.test(String(value || '').trim());
}
function parseByLines(lines: string[], aliases: string[]) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!sameLabel(lines[i], aliases)) continue;
    const prev = [...lines.slice(Math.max(0, i - 4), i)].reverse().find(valueToken);
    const next = lines.slice(i + 1, i + 5).find(valueToken);
    if (prev && next) return [numberFrom(prev), numberFrom(next)] as const;
  }
  return [null, null] as const;
}
function visualPair(pairs: VisualPair[], aliases: string[], label: string) {
  const visual = pairs.find((pair) => sameLabel(pair.label, aliases));
  if (!visual) return [null, null] as const;
  const pair = [numberFrom(visual.home), numberFrom(visual.away)] as const;
  return validRange(label, pair[0], pair[1]) ? pair : [null, null] as const;
}
function choosePair(text: string, pairs: VisualPair[], aliases: string[], label: string) {
  const normalized = String(text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n');
  const lines = normalized.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const exact = exactLinePair(lines, aliases);
  if (validRange(label, exact[0], exact[1])) return exact;
  const byLines = parseByLines(lines, aliases);
  if (validRange(label, byLines[0], byLines[1])) return byLines;
  const visual = visualPair(pairs, aliases, label);
  if (validRange(label, visual[0], visual[1])) return visual;
  return [null, null] as const;
}
function applyPair(stats: NormalizedStats, homeKey: keyof NormalizedStats, awayKey: keyof NormalizedStats, pair: readonly [number | null, number | null]) {
  if (pair[0] !== null) (stats as any)[homeKey] = pair[0];
  if (pair[1] !== null) (stats as any)[awayKey] = pair[1];
}
function parseVisualStats(text: string, pairs: VisualPair[]) {
  const stats = emptyStats();
  applyPair(stats, 'homePossession', 'awayPossession', choosePair(text, pairs, ['Possession', 'Poss'], 'Possession'));
  applyPair(stats, 'homeAttacks', 'awayAttacks', choosePair(text, pairs, ['Attack', 'ATT', 'Attacks'], 'Attack'));
  applyPair(stats, 'homeDangerousAttacks', 'awayDangerousAttacks', choosePair(text, pairs, ['D-ATT', 'D ATT', 'Dangerous Attack', 'Dangerous Attacks'], 'D-ATT'));
  applyPair(stats, 'homeShotsOffTarget', 'awayShotsOffTarget', choosePair(text, pairs, ['Off Target', 'Off-TGT', 'Off TGT', 'Off-TARGET'], 'Off Target'));
  applyPair(stats, 'homeShots', 'awayShots', choosePair(text, pairs, ['Shots', 'Shot'], 'Shots'));
  applyPair(stats, 'homeShotsOnTarget', 'awayShotsOnTarget', choosePair(text, pairs, ['On Target', 'On-TGT', 'On TGT', 'On-TARGET'], 'On Target'));
  return stats;
}
function browserlessCode() {
  return `export default async function ({ page, context }) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function clickStatsInFrame(frame) {
      try {
        const handles = await frame.$$('button,a,div,span,li');
        for (const handle of handles.slice(0, 260)) {
          try {
            const txt = await handle.evaluate((el) => (el.textContent || '').trim());
            if (/statistics|stats/i.test(txt)) { await handle.click({ timeout: 1000 }); await sleep(700); }
          } catch {}
        }
      } catch {}
    }
    async function readFrame(frame, index) {
      try {
        return await frame.evaluate((idx) => {
          const visible = (el) => {
            const tag = el.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) !== 0;
          };
          const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
          const rawNodes = Array.from(document.querySelectorAll('body *'))
            .filter(visible)
            .map((el) => {
              const rect = el.getBoundingClientRect();
              return { tag: el.tagName, text: clean(el.textContent), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height, cls: el.getAttribute('class') || '' };
            })
            .filter((node) => node.text && node.text.length <= 40);
          const labels = rawNodes.filter((node) => /^(Attack|ATT|Attacks|D-ATT|D ATT|Shots|Shot|Possession|Poss|On Target|On-TGT|On TGT|Off Target|Off-TGT|Off TGT)$/i.test(node.text));
          const values = rawNodes.filter((node) => /^\d+(?:\.\d+)?%?$/.test(node.text));
          const pairs = labels.map((label) => {
            const rowValues = values.filter((value) => Math.abs(value.y - label.y) <= Math.max(12, label.h + 8));
            const left = rowValues.filter((value) => value.x < label.x).sort((a, b) => Math.abs(a.x - label.x) - Math.abs(b.x - label.x))[0];
            const right = rowValues.filter((value) => value.x > label.x).sort((a, b) => Math.abs(a.x - label.x) - Math.abs(b.x - label.x))[0];
            return { label: label.text, home: left ? left.text : null, away: right ? right.text : null, sourceUrl: location.href };
          }).filter((pair) => pair.home || pair.away);
          const text = rawNodes.map((node) => node.text).join('\n');
          const nodes = rawNodes.filter((x) => /statistics|stats|attack|shots|possession|target|\d+%?/i.test(x.text)).slice(0, 160);
          return { index: idx, url: location.href, title: document.title, text, nodes, pairs };
        }, index);
      } catch (error) {
        return { index, url: frame.url(), title: '', text: '', nodes: [], pairs: [], error: String(error && error.message || error) };
      }
    }
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(context.url, { waitUntil: 'networkidle2', timeout: context.timeoutMs });
    await sleep(context.waitMs || 15000);
    for (const frame of page.frames()) await clickStatsInFrame(frame);
    await sleep(1800);
    for (const frame of page.frames()) await clickStatsInFrame(frame);
    await sleep(1200);
    const frames = [];
    let idx = 0;
    for (const frame of page.frames()) frames.push(await readFrame(frame, idx++));
    const pairs = frames.flatMap((frame) => frame.pairs || []);
    const text = frames.map((frame) => ['FRAME ' + frame.index, frame.url, frame.title, frame.text].filter(Boolean).join('\n')).join('\n---FRAME---\n');
    return { data: { title: await page.title(), href: page.url(), frameCount: frames.length, text, frames, pairs }, type: 'application/json' };
  }`;
}
async function callBrowserless(url: string, timeoutMs: number, waitMs: number) {
  const attempts: any[] = [];
  for (const endpoint of functionEndpoints()) {
    try {
      const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json,*/*' }, body: JSON.stringify({ code: browserlessCode(), context: { url, timeoutMs, waitMs } }) });
      const text = await response.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch {}
      const attempt = { ok: response.ok, status: response.status, endpoint: maskUrl(endpoint), rawLength: text.length, contentType: response.headers.get('content-type'), data: parsed?.data || parsed || null, rawSample: parsed ? null : text.slice(0, 1200) };
      attempts.push({ ...attempt, data: undefined });
      if (response.ok) return { ...attempt, attempts };
    } catch (error: any) {
      attempts.push({ ok: false, status: null, endpoint: maskUrl(endpoint), error: String(error?.message || error).slice(0, 1000) });
    }
  }
  return { ok: false, status: null, endpoint: null, rawLength: 0, contentType: null, data: null, rawSample: 'No Browserless function endpoint succeeded', attempts };
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
    if (!functionEndpoints().length) return json({ ok: false, error: 'Browserless function endpoint is not configured' }, 400);
    const providerMatchId = Math.floor(rawMatchId);
    const wrapperUrl = explicitSourceUrl ? safeUrl(explicitSourceUrl) : defaultWrapperUrl(providerMatchId, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), 45000, 5000, 80000);
    const waitMs = clamp(url.searchParams.get('waitMs'), 15000, 1000, 35000);
    const save = boolParam(url.searchParams.get('save'), false);
    const rendered = await callBrowserless(wrapperUrl, timeoutMs, waitMs);
    const text = scrubSensitive(rendered.data?.text || '');
    const rawPairs = Array.isArray(rendered.data?.pairs) ? rendered.data.pairs : [];
    const pairs = rawPairs.map((pair: VisualPair) => ({ ...pair, sourceUrl: maskUrl(pair.sourceUrl) }));
    const stats = parseVisualStats(text, pairs);
    const reliable = hasUsefulStats(stats) && !hasUndefinedPlaceholder(text);
    const match = (save || url.searchParams.get('includeMatch') === 'true') ? await getMatch({ dbMatchId: url.searchParams.get('dbMatchId'), providerMatchId }) : null;
    const framesSample = rendered.data?.frames?.map?.((frame: any) => ({
      url: maskUrl(frame.url),
      title: frame.title,
      pairs: (frame.pairs || []).map((pair: VisualPair) => ({ ...pair, sourceUrl: maskUrl(pair.sourceUrl) })),
      text: scrubSensitive(frame.text).slice(0, 900),
      nodes: frame.nodes?.slice?.(0, 30) || [],
      error: frame.error || null,
    })) || [];
    const saveResult = save ? match ? await saveSnapshot(match, providerMatchId, stats, { source: VISUAL_SOURCE, wrapperUrl, visualPairs: pairs, textSample: text.slice(0, 4000), framesSample, capturedBy: 'browserless_function_visual_stats_frames' }, reliable) : { inserted: 0, snapshotId: null, error: 'No local match found' } : null;
    return json({ ok: true, mode: 'isports_remote_visual_stats_pull', remoteBrowser: { ok: rendered.ok, status: rendered.status, endpoint: maskUrl(rendered.endpoint), attempts: rendered.attempts, rawLength: rendered.rawLength, error: rendered.rawSample || null }, wrapper: { sourceUrl: wrapperUrl }, hasStats: reliable, stats, validation: { hasUsefulStats: hasUsefulStats(stats), reliable, rejectedPlaceholder: hasUndefinedPlaceholder(text), frameCount: rendered.data?.frameCount || 0, pairs }, textSample: text.slice(0, 2200), framesPreview: framesSample.map((frame: any) => ({ ...frame, text: String(frame.text || '').slice(0, 500), nodes: frame.nodes?.slice?.(0, 10) || [] })), match: match ? { id: match.id, status: match.status, homeTeam: match.homeTeam, awayTeam: match.awayTeam } : null, save: saveResult, note: 'Parses exact statistic lines like 54%Poss46%, 113ATT99, 32D-ATT27, 11Shots6 to avoid merged-number errors.' });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}
