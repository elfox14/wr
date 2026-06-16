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

function findNumberBefore(lines: string[], index: number) {
  for (let i = index - 1; i >= Math.max(0, index - 12); i -= 1) {
    if (isNumberToken(lines[i])) return numberFrom(lines[i]);
  }
  return null;
}

function findNumberAfter(lines: string[], index: number) {
  for (let i = index + 1; i <= Math.min(lines.length - 1, index + 12); i += 1) {
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
  const offTarget = findStatPair(text, ['Off-TGT', 'Off TGT', 'Off Target', 'Shots off Target']);
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
    JSON.stringify(rawData || null),
  );
  return id;
}

function jsonField(snippet: string, keys: string[]) {
  for (const key of keys) {
    const escaped = escapeRegExp(key);
    const match = snippet.match(new RegExp(`["']${escaped}["']\\s*:\\s*["']([^"']{2,80})["']`, 'i'))
      || snippet.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']{2,80})["']`, 'i'));
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return null;
}

function dateField(snippet: string) {
  return jsonField(snippet, ['matchTime', 'match_time', 'kickoffTime', 'startTime', 'date', 'time']);
}

function extractCandidateFromSnippet(providerMatchId: number, snippet: string, label?: string | null): DiscoveredISportsMatch {
  return {
    providerMatchId,
    sourceUrl: canonicalISportsSourceUrl(providerMatchId),
    label: cleanNullable(label || htmlToText(snippet).slice(0, 500)),
    homeName: cleanNullable(jsonField(snippet, ['homeName', 'home_name', 'homeTeamName', 'home_team_name'])),
    awayName: cleanNullable(jsonField(snippet, ['awayName', 'away_name', 'awayTeamName', 'away_team_name'])),
    date: cleanNullable(dateField(snippet)),
    status: cleanNullable(jsonField(snippet, ['status', 'statusCode', 'status_code', 'matchStatus', 'match_status'])),
  };
}

export function extractISportsHomepageCandidates(html: string): DiscoveredISportsMatch[] {
  const candidates = new Map<number, DiscoveredISportsMatch>();
  const linkRegex = /<a\b[^>]*href=["']([^"']*matchId=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const providerMatchId = extractISportsMatchId(match[1]);
    if (!providerMatchId) continue;
    const label = htmlToText(match[2] || '');
    candidates.set(providerMatchId, extractCandidateFromSnippet(providerMatchId, match[0], label));
  }

  const idRegex = /matchId["'\s:=?&]+(\d{6,})/gi;
  for (const match of html.matchAll(idRegex)) {
    const providerMatchId = Number(match[1]);
    if (!Number.isFinite(providerMatchId) || candidates.has(providerMatchId)) continue;
    const index = match.index || 0;
    const snippet = html.slice(Math.max(0, index - 900), Math.min(html.length, index + 1400));
    candidates.set(providerMatchId, extractCandidateFromSnippet(providerMatchId, snippet));
  }

  return [...candidates.values()].sort((a, b) => a.providerMatchId - b.providerMatchId);
}

function normalizeTeamName(value?: string | null) {
  const base = normalizeName(value || '')
    .replace(/\bfootball club\b|\bnational team\b|\bfc\b|\bu\d{2}\b|\bwomen\b/g, ' ')
    .replace(/\bkorea republic\b/g, 'south korea')
    .replace(/\bczech republic\b/g, 'czechia')
    .replace(/\bunited states of america\b|\busa\b/g, 'united states')
    .replace(/\bir iran\b/g, 'iran')
    .replace(/\s+/g, ' ')
    .trim();
  return base;
}

function tokenSet(value?: string | null) {
  return new Set(normalizeTeamName(value).split(' ').filter((token) => token.length >= 2));
}

function nameScore(a?: string | null, b?: string | null) {
  const left = normalizeTeamName(a);
  const right = normalizeTeamName(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 86;
  const aTokens = tokenSet(left);
  const bTokens = tokenSet(right);
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  let hits = 0;
  aTokens.forEach((token) => { if (bTokens.has(token)) hits += 1; });
  return Math.round((hits / union) * 82);
}

function scoreByLabel(localMatch: any, label?: string | null) {
  if (!label) return 0;
  const normalized = normalizeTeamName(label);
  const home = normalizeTeamName(localMatch.homeTeam?.name);
  const away = normalizeTeamName(localMatch.awayTeam?.name);
  let score = 0;
  if (home && normalized.includes(home)) score += 90;
  if (away && normalized.includes(away)) score += 90;
  return score;
}

function dateFromCandidate(candidate: DiscoveredISportsMatch) {
  if (!candidate.date) return null;
  const numeric = Number(candidate.date);
  const normalized = Number.isFinite(numeric) && numeric > 100000 ? (numeric < 10000000000 ? numeric * 1000 : numeric) : candidate.date;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function timeScore(localDate: Date, providerDate: Date | null) {
  if (!providerDate) return 8;
  const diffHours = Math.abs(localDate.getTime() - providerDate.getTime()) / 36e5;
  if (diffHours <= 2) return 24;
  if (diffHours <= 8) return 14;
  if (diffHours <= 24) return 5;
  return -25;
}

export function scoreDiscoveryCandidate(localMatch: any, candidate: DiscoveredISportsMatch) {
  const direct = nameScore(localMatch.homeTeam?.name, candidate.homeName) + nameScore(localMatch.awayTeam?.name, candidate.awayName);
  const swapped = nameScore(localMatch.homeTeam?.name, candidate.awayName) + nameScore(localMatch.awayTeam?.name, candidate.homeName);
  const labelScore = scoreByLabel(localMatch, candidate.label);
  const teamScore = Math.max(direct, swapped, labelScore);
  const orientation = teamScore === swapped ? 'swapped' : teamScore === labelScore ? 'label' : 'direct';
  const providerDate = dateFromCandidate(candidate);
  const finalScore = teamScore + timeScore(new Date(localMatch.matchDate), providerDate);
  return { finalScore, teamScore, orientation, providerDate };
}

export async function getLocalMatchesForDate(dateParam?: string | null) {
  const base = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const matches = await prisma.match.findMany({
    where: { matchDate: { gte: start, lt: end } },
    orderBy: { matchDate: 'asc' },
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
  });
  return { dateKey: start.toISOString().slice(0, 10), start, end, matches };
}

export async function discoverISportsHomepage(dateParam?: string | null, options: { dryRun?: boolean; threshold?: number; saveUnlinked?: boolean } = {}) {
  const started = Date.now();
  await ensureLiveIngestTables();
  const page = await loadRenderedPage(HOME_URL);
  const candidates = extractISportsHomepageCandidates(page.html);
  const { dateKey, matches } = await getLocalMatchesForDate(dateParam);
  const threshold = Number.isFinite(options.threshold) ? Number(options.threshold) : 140;
  const dryRun = options.dryRun !== false;

  const results: any[] = [];
  for (const candidate of candidates) {
    const ranked = matches
      .map((match) => ({ match, score: scoreDiscoveryCandidate(match, candidate) }))
      .sort((a, b) => b.score.finalScore - a.score.finalScore);
    const best = ranked[0] || null;
    const canLink = Boolean(best && best.score.finalScore >= threshold);
    let source = null;

    if (!dryRun && (canLink || options.saveUnlinked)) {
      if (canLink && best?.match) {
        await prisma.match.update({ where: { id: best.match.id }, data: { animationMatchId: candidate.providerMatchId } });
      }
      source = await upsertExternalMatchSource({
        matchId: canLink ? best?.match.id : null,
        providerMatchId: candidate.providerMatchId,
        sourceUrl: candidate.sourceUrl,
        rawLabel: candidate.label || `${candidate.homeName || ''} vs ${candidate.awayName || ''}`.trim(),
        status: canLink ? 'active' : 'unlinked',
        priority: 1,
      });
    }

    results.push({
      ...candidate,
      bestMatch: best ? {
        id: best.match.id,
        local: `${best.match.homeTeam.name} vs ${best.match.awayTeam.name}`,
        matchDate: best.match.matchDate.toISOString(),
        finalScore: best.score.finalScore,
        teamScore: best.score.teamScore,
        orientation: best.score.orientation,
        providerDate: best.score.providerDate?.toISOString?.() || null,
      } : null,
      linked: !dryRun && canLink,
      linkCandidate: canLink,
      sourceId: source?.id || null,
    });
  }

  await recordLiveIngestLog({
    status: candidates.length ? 'discover_completed' : 'discover_no_candidates',
    message: JSON.stringify({ dateKey, candidates: candidates.length, localMatches: matches.length, loader: page.loader, rendered: page.rendered, pageError: page.error || null }).slice(0, 1100),
    durationMs: Date.now() - started,
  });

  return { page, dateKey, localMatches: matches.length, candidates: results };
}

export async function scrapeISportsMatchPage(input: { sourceUrl?: string | null; providerMatchId?: number | null; match?: any; save?: boolean }) {
  const started = Date.now();
  await ensureLiveIngestTables();
  const providerMatchId = Number(input.providerMatchId || extractISportsMatchId(input.sourceUrl));
  if (!Number.isFinite(providerMatchId) || providerMatchId <= 0) throw new Error('providerMatchId or sourceUrl with matchId is required');
  const sourceUrl = input.sourceUrl || canonicalISportsSourceUrl(providerMatchId);
  const page = await loadRenderedPage(sourceUrl);
  const stats = parseISportsVisibleStats(page.text, input.match);
  const useful = hasUsefulStats(stats);
  let snapshotId: string | null = null;

  if (useful && input.match && input.save !== false) {
    snapshotId = await savePageStatsSnapshot(input.match, providerMatchId, stats, {
      source: PROVIDER,
      sourceUrl,
      loader: page.loader,
      rendered: page.rendered,
      pageError: page.error || null,
      rawText: page.text.slice(0, 24000),
    });
    await updateExternalMatchSourceStatus(providerMatchId, 'active', null);
  } else if (!useful) {
    await updateExternalMatchSourceStatus(providerMatchId, 'failed', 'No visible stats found in rendered page');
  }

  await recordLiveIngestLog({
    matchId: input.match?.id || null,
    status: useful ? 'pull_scraped_stats' : 'pull_no_visible_stats',
    message: JSON.stringify({ providerMatchId, loader: page.loader, rendered: page.rendered, snapshotId, pageError: page.error || null }).slice(0, 1100),
    durationMs: Date.now() - started,
  });

  return { provider: PROVIDER, providerMatchId, sourceUrl, loader: page.loader, rendered: page.rendered, pageError: page.error || null, hasStats: useful, stats, snapshotId, textSample: page.text.slice(0, 1200) };
}
