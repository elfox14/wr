import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import prisma from '@/lib/prisma';
import { ensureStatsTable, hasUsefulStats, type NormalizedStats } from '@/lib/live-match-stats';
import { normalizeName } from '@/lib/apiFootball';

const execFileAsync = promisify(execFile);
const PROVIDER = 'ISPORTS_PAGE';
const HOME_URL = 'https://www.isportslive8.com/';
const MATCH_URL_BASE = 'https://www.isportslive8.com/football/pc.html';

export type PageLoadResult = {
  url: string;
  loader: 'chrome_dump_dom' | 'fetch_html';
  rendered: boolean;
  html: string;
  text: string;
  error?: string | null;
};

export type DiscoveredISportsMatch = {
  providerMatchId: number;
  sourceUrl: string;
  label?: string | null;
  homeName?: string | null;
  awayName?: string | null;
  date?: string | null;
  status?: string | null;
};

type SourceInput = {
  matchId?: string | null;
  providerMatchId: number;
  sourceUrl?: string | null;
  status?: string | null;
  priority?: number;
  rawLabel?: string | null;
  lastError?: string | null;
};

const EMPTY_STATS: NormalizedStats = {
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

function truncate(value: unknown, max = 1200) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function cleanNullable(value?: string | null) {
  const text = String(value || '').trim();
  return text || null;
}

function boolFromEnv(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

export function canonicalISportsSourceUrl(providerMatchId: number, lang = 'en', version = '1') {
  const url = new URL(MATCH_URL_BASE);
  url.searchParams.set('matchId', String(providerMatchId));
  url.searchParams.set('lang', lang);
  url.searchParams.set('v', version);
  return url.toString();
}

export function extractISportsMatchId(value?: string | null) {
  const text = String(value || '');
  const id = Number(text.match(/[?&]matchId=(\d+)/i)?.[1] || text.match(/\bmatchId["'\s:=]+(\d+)/i)?.[1] || text.match(/\b(\d{6,})\b/)?.[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function safeUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (hostname !== 'isportslive8.com' && hostname !== 'www.isportslive8.com') {
    throw new Error('Only isportslive8.com URLs are allowed for this ingestor');
  }
  return url.toString();
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findChromeExecutable() {
  const fromEnv = process.env.LIVE_STATS_CHROME_PATH || process.env.CHROME_EXECUTABLE_PATH;
  const candidates = [
    fromEnv,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/opt/google/chrome/chrome',
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function htmlToText(html: string) {
  return decodeEntities(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '\n')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>|<\/p>|<\/li>|<\/tr>|<\/td>|<\/span>|<\/a>|<\/button>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n'))
    .trim();
}

async function fetchHtml(url: string): Promise<PageLoadResult> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeLiveStats/1.0; +https://worldcup.mcprim.com)',
    },
  });
  const html = await response.text();
  return { url, loader: 'fetch_html', rendered: false, html, text: htmlToText(html), error: response.ok ? null : `HTTP ${response.status}` };
}

export async function loadRenderedPage(urlInput: string, options: { timeoutMs?: number; virtualTimeBudgetMs?: number } = {}): Promise<PageLoadResult> {
  const url = safeUrl(urlInput);
  const timeoutMs = Math.max(3000, Math.min(Number(options.timeoutMs || process.env.LIVE_STATS_BROWSER_TIMEOUT_MS || 14000), 30000));
  const virtualTimeBudgetMs = Math.max(1000, Math.min(Number(options.virtualTimeBudgetMs || process.env.LIVE_STATS_VIRTUAL_TIME_BUDGET_MS || 7000), 20000));

  if (boolFromEnv(process.env.LIVE_STATS_DISABLE_BROWSER)) return fetchHtml(url);

  const chrome = await findChromeExecutable();
  if (!chrome) return fetchHtml(url);

  try {
    const { stdout, stderr } = await execFileAsync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--hide-scrollbars',
      `--virtual-time-budget=${virtualTimeBudgetMs}`,
      '--run-all-compositor-stages-before-draw',
      '--dump-dom',
      url,
    ], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
    const html = String(stdout || '');
    if (!html.trim()) return { ...(await fetchHtml(url)), error: truncate(stderr || 'Chrome returned empty DOM') };
    return { url, loader: 'chrome_dump_dom', rendered: true, html, text: htmlToText(html), error: stderr ? truncate(stderr, 600) : null };
  } catch (error: any) {
    const fallback = await fetchHtml(url);
    return { ...fallback, error: truncate(error?.message || error || 'Chrome render failed') };
  }
}

export async function ensureLiveIngestTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ExternalMatchSource" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT REFERENCES "Match"("id") ON DELETE SET NULL,
      "provider" TEXT NOT NULL DEFAULT 'ISPORTS_PAGE',
      "providerMatchId" INTEGER NOT NULL,
      "sourceUrl" TEXT NOT NULL,
      "priority" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL DEFAULT 'active',
      "lastSuccessAt" TIMESTAMP(3),
      "lastError" TEXT,
      "rawLabel" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ExternalMatchSource_provider_providerMatchId_key" ON "ExternalMatchSource" ("provider", "providerMatchId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ExternalMatchSource_matchId_idx" ON "ExternalMatchSource" ("matchId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ExternalMatchSource_status_idx" ON "ExternalMatchSource" ("status")');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveIngestLog" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT,
      "sourceId" TEXT,
      "provider" TEXT NOT NULL DEFAULT 'ISPORTS_PAGE',
      "status" TEXT NOT NULL,
      "message" TEXT,
      "durationMs" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LiveIngestLog_matchId_createdAt_idx" ON "LiveIngestLog" ("matchId", "createdAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LiveIngestLog_provider_createdAt_idx" ON "LiveIngestLog" ("provider", "createdAt")');
}

export async function recordLiveIngestLog(input: { matchId?: string | null; sourceId?: string | null; status: string; message?: string | null; durationMs?: number | null }) {
  await ensureLiveIngestTables();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "LiveIngestLog" ("id", "matchId", "sourceId", "provider", "status", "message", "durationMs") VALUES ($1,$2,$3,$4,$5,$6,$7)',
    randomUUID(), input.matchId || null, input.sourceId || null, PROVIDER, input.status, truncate(input.message || '', 1200), input.durationMs ?? null,
  );
}

export async function upsertExternalMatchSource(input: SourceInput) {
  await ensureLiveIngestTables();
  const providerMatchId = Number(input.providerMatchId);
  if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) throw new Error('providerMatchId is required');
  const sourceUrl = input.sourceUrl || canonicalISportsSourceUrl(providerMatchId);
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    INSERT INTO "ExternalMatchSource" (
      "id", "matchId", "provider", "providerMatchId", "sourceUrl", "priority", "status", "lastError", "rawLabel"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT ("provider", "providerMatchId") DO UPDATE SET
      "matchId" = COALESCE(EXCLUDED."matchId", "ExternalMatchSource"."matchId"),
      "sourceUrl" = EXCLUDED."sourceUrl",
      "priority" = LEAST("ExternalMatchSource"."priority", EXCLUDED."priority"),
      "status" = EXCLUDED."status",
      "lastError" = EXCLUDED."lastError",
      "rawLabel" = COALESCE(EXCLUDED."rawLabel", "ExternalMatchSource"."rawLabel"),
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `, randomUUID(), input.matchId || null, PROVIDER, providerMatchId, sourceUrl, input.priority ?? 1, input.status || 'active', input.lastError || null, input.rawLabel || null);
  return rows[0] || null;
}

export async function updateExternalMatchSourceStatus(providerMatchId: number, status: string, lastError?: string | null) {
  await ensureLiveIngestTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    UPDATE "ExternalMatchSource"
    SET "status" = $2,
        "lastSuccessAt" = CASE WHEN $2 = 'active' THEN CURRENT_TIMESTAMP ELSE "lastSuccessAt" END,
        "lastError" = $3,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "provider" = $1 AND "providerMatchId" = $4
    RETURNING *
  `, PROVIDER, status, lastError || null, providerMatchId);
  return rows[0] || null;
}

export async function getExternalSourceByProviderMatchId(providerMatchId: number) {
  await ensureLiveIngestTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM "ExternalMatchSource" WHERE "provider" = $1 AND "providerMatchId" = $2 LIMIT 1',
    PROVIDER,
    providerMatchId,
  );
  return rows[0] || null;
}

function numberFrom(value?: string | null) {
  if (!value) return null;
  const cleaned = String(value).replace('%', '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textLines(text: string) {
  return String(text || '')
    .split(/\n|\r|\t/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isNumberToken(value?: string | null) {
  return /^-?\d{1,4}%?$/.test(String(value || '').trim());
}

function isStatSearchBlocker(value?: string | null) {
  const line = String(value || '').trim().toLowerCase();
  if (!line) return false;
  return line === 'undefined'
    || line === 'no data'
    || line === 'vs'
    || line === 'ended'
    || line === 'kick-off'
    || line === 'statistics'
    || line === 'days'
    || line === 'hrs'
    || line === 'hours'
    || line === 'mins'
    || line === 'secs'
    || line === 'possession'
    || line.includes('upgrade your plan');
}

function findNumberBefore(lines: string[], index: number) {
  for (let i = index - 1; i >= Math.max(0, index - 4); i -= 1) {
    if (isStatSearchBlocker(lines[i])) break;
    if (isNumberToken(lines[i])) return numberFrom(lines[i]);
  }
  return null;
}

function findNumberAfter(lines: string[], index: number) {
  for (let i = index + 1; i <= Math.min(lines.length - 1, index + 4); i += 1) {
    if (isStatSearchBlocker(lines[i])) break;
    if (isNumberToken(lines[i])) return numberFrom(lines[i]);
  }
  return null;
}

function findStatPair(text: string, labels: string[]) {
  const compact = text.replace(/[\t\r\n]+/g, ' ');
  for (const label of labels) {
    const inline = compact.match(new RegExp(`(?:^|\\s)(-?\\d{1,4}%?)\\s+${escapeRegExp(label)}\\s+(-?\\d{1,4}%?)(?:\\s|$)`, 'i'));
    if (inline) return { home: numberFrom(inline[1]), away: numberFrom(inline[2]) };
  }

  const lines = textLines(text);
  for (const label of labels) {
    const idx = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
    if (idx >= 0) {
      if (isStatSearchBlocker(lines[idx - 1]) || isStatSearchBlocker(lines[idx + 1])) return null;
      const home = findNumberBefore(lines, idx);
      const away = findNumberAfter(lines, idx);
      if (home !== null || away !== null) return { home, away };
    }
  }
  return null;
}

function firstScorePair(text: string) {
  const match = text.match(/(?:^|\s)(\d{1,2})\s*[:]\s*(\d{1,2})(?:\s|$)/);
  if (!match) return null;
  return { home: numberFrom(match[1]), away: numberFrom(match[2]) };
}

function firstMinute(text: string) {
  const candidates = [
    text.match(/(?:^|\s)(\d{1,3})\s*[`'′]\s*(?:\n|\s|$)/),
    text.match(/(?:minute|min|time)\D{0,8}(\d{1,3})/i),
  ];
  for (const match of candidates) {
    const minute = numberFrom(match?.[1] || null);
    if (minute !== null && minute >= 0 && minute <= 130) return minute;
  }
  return null;
}

export function parseISportsVisibleStats(text: string, match?: any): NormalizedStats {
  const stats: NormalizedStats = { ...EMPTY_STATS };
  stats.minute = firstMinute(text);
  const score = firstScorePair(text);
  stats.homeScore = score?.home ?? match?.homeScore ?? null;
  stats.awayScore = score?.away ?? match?.awayScore ?? null;

  const possession = findStatPair(text, ['Poss', 'Possession', 'Ball Possession']);
  const attacks = findStatPair(text, ['ATT', 'Attack', 'Attacks']);
  const dangerousAttacks = findStatPair(text, ['D-ATT', 'D ATT', 'Dangerous Attack', 'Dangerous Attacks']);
  const shots = findStatPair(text, ['Shots', 'Shot']);
  const onTarget = findStatPair(text, ['On-TGT', 'On TGT', 'On Target', 'Shots on Target']);
  const offTarget = findStatPair(text, ['Off-TGT', 'Off TGT', 'Off Target']);
  const corners = findStatPair(text, ['Corner', 'Corners', 'CK']);
  const yellow = findStatPair(text, ['Yellow', 'Yellow Cards']);
  const red = findStatPair(text, ['Red', 'Red Cards']);

  if (possession) { stats.homePossession = possession.home; stats.awayPossession = possession.away; }
  if (attacks) { stats.homeAttacks = attacks.home; stats.awayAttacks = attacks.away; }
  if (dangerousAttacks) { stats.homeDangerousAttacks = dangerousAttacks.home; stats.awayDangerousAttacks = dangerousAttacks.away; }
  if (shots) { stats.homeShots = shots.home; stats.awayShots = shots.away; }
  if (onTarget) { stats.homeShotsOnTarget = onTarget.home; stats.awayShotsOnTarget = onTarget.away; }
  if (offTarget) { stats.homeShotsOffTarget = offTarget.home; stats.awayShotsOffTarget = offTarget.away; }
  if (corners) { stats.homeCorners = corners.home; stats.awayCorners = corners.away; }
  if (yellow) { stats.homeYellowCards = yellow.home; stats.awayYellowCards = yellow.away; }
  if (red) { stats.homeRedCards = red.home; stats.awayRedCards = red.away; }

  return stats;
}

export async function savePageStatsSnapshot(match: any, providerMatchId: number, stats: NormalizedStats, rawData: any) {
  await ensureStatsTable();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MatchStatsSnapshot" (
      "id", "matchId", "provider", "providerMatchId", "minute",
      "homePossession", "awayPossession", "homeAttacks", "awayAttacks",
      "homeDangerousAttacks", "awayDangerousAttacks", "homeShots", "awayShots",
      "homeShotsOnTarget", "awayShotsOnTarget", "homeShotsOffTarget", "awayShotsOffTarget",
      "homeCorners", "awayCorners", "homeYellowCards", "awayYellowCards", "homeRedCards", "awayRedCards",
      "homeScore", "awayScore", "rawData"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb)`,
    id,
    match.id,
    PROVIDER,
    providerMatchId,
    stats.minute,
    stats.homePossession,
    stats.awayPossession,
    stats.homeAttacks,
    stats.awayAttacks,
    stats.homeDangerousAttacks,
    stats.awayDangerousAttacks,
    stats.homeShots,
    stats.awayShots,
    stats.homeShotsOnTarget,
    stats.awayShotsOnTarget,
    stats.homeShotsOffTarget,
    stats.awayShotsOffTarget,
    stats.homeCorners,
    stats.awayCorners,
    stats.homeYellowCards,
    stats.awayYellowCards,
    stats.homeRedCards,
    stats.awayRedCards,
    stats.homeScore,
    stats.awayScore,
    JSON.stringify(rawData || null)
  );
  return id;
}

export async function scrapeISportsMatchPage(input: { sourceUrl?: string | null; providerMatchId: number; match?: any; save?: boolean }) {
  const sourceUrl = safeUrl(input.sourceUrl || canonicalISportsSourceUrl(input.providerMatchId));
  const loaded = await loadRenderedPage(sourceUrl);
  const stats = parseISportsVisibleStats(loaded.text, input.match);
  const hasStats = hasUsefulStats(stats);
  let snapshotId: string | null = null;
  if (input.save && hasStats && input.match) {
    snapshotId = await savePageStatsSnapshot(input.match, input.providerMatchId, stats, { sourceUrl, loader: loaded.loader, rendered: loaded.rendered, textSample: loaded.text.slice(0, 2000) });
  }
  await updateExternalMatchSourceStatus(input.providerMatchId, hasStats ? 'active' : 'no_stats', loaded.error || null).catch(() => null);
  return { ...loaded, sourceUrl, stats, hasStats, snapshotId };
}

function normalizeComparable(value?: string | null) {
  return normalizeName(String(value || '').replace(/\b(fc|cf|sc|national|team)\b/gi, '').trim());
}

function confidenceScore(candidate: DiscoveredISportsMatch, match: any) {
  const haystack = normalizeComparable(`${candidate.label || ''} ${candidate.homeName || ''} ${candidate.awayName || ''}`);
  const home = normalizeComparable(match.homeTeam?.name || '');
  const away = normalizeComparable(match.awayTeam?.name || '');
  let score = 0;
  if (candidate.providerMatchId === Number(match.animationMatchId)) score += 120;
  if (home && haystack.includes(home)) score += 50;
  if (away && haystack.includes(away)) score += 50;
  return score;
}

export async function discoverISportsHomepage(dateInput?: string | null, options: { dryRun?: boolean; threshold?: number } = {}) {
  const dateKey = dateInput || new Date().toISOString().slice(0, 10);
  const pageUrl = `${HOME_URL}?date=${encodeURIComponent(dateKey)}`;
  const loaded = await loadRenderedPage(pageUrl, { timeoutMs: 22000, virtualTimeBudgetMs: 14000 });
  const candidates = new Map<number, DiscoveredISportsMatch>();
  const linkRegex = /matchId=(\d{6,})/gi;
  for (const match of loaded.html.matchAll(linkRegex)) {
    const providerMatchId = Number(match[1]);
    if (!Number.isFinite(providerMatchId)) continue;
    const sourceUrl = canonicalISportsSourceUrl(providerMatchId);
    const start = Math.max(0, (match.index || 0) - 350);
    const raw = loaded.html.slice(start, (match.index || 0) + 700);
    const label = htmlToText(raw).slice(0, 260);
    candidates.set(providerMatchId, { providerMatchId, sourceUrl, label });
  }
  return { dateKey, pageUrl, loaded, candidates: [...candidates.values()] };
}
