import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { extractISportsMatchId, htmlToText, parseISportsVisibleStats } from '@/lib/live-ingest/isports-page';
import { ensureStatsTable } from '@/lib/live-match-stats';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type FrameMode = 'live' | 'timeline';

type TimelineEvent = {
  side: 'home' | 'away' | null;
  teamId: string | null;
  minute: number | null;
  displayMinute: string | null;
  type: string;
  title: string;
  detail: string;
  cssClass: string | null;
};

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);
const TIMELINE_SOURCE = 'ISPORTS_TIMELINE';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function boolFromEnv(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function clamp(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
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
  for (const match of text.matchAll(regex)) if (match?.[1]) found = match[1];
  return found;
}

function extractFrameCredentials(html: string) {
  const ak = lastRegexValue(html, /USER_FEIJING88\.ak\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bak\s*:\s*["']([^"']+)["']/g);
  const sk = lastRegexValue(html, /USER_FEIJING88\.sk\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bsk\s*:\s*["']([^"']+)["']/g);
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

function unescapeHtml(value: string) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function attrValue(attrs: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const doubleQuoted = attrs.match(new RegExp(`\\b${escaped}\\s*=\\s*"([^"]*)"`, 'i'));
  if (doubleQuoted?.[1] !== undefined) return unescapeHtml(doubleQuoted[1]);
  const singleQuoted = attrs.match(new RegExp(`\\b${escaped}\\s*=\\s*'([^']*)'`, 'i'));
  if (singleQuoted?.[1] !== undefined) return unescapeHtml(singleQuoted[1]);
  return null;
}

function timelineType(title: string, cssClass?: string | null) {
  const lower = `${title} ${cssClass || ''}`.toLowerCase().replace(/\s+/g, ' ');
  if (lower.includes('yellow') || /(^|\s)yc(\s|$)/.test(lower)) return 'yellow_card';
  if (lower.includes('red') || /(^|\s)rc(\s|$)/.test(lower)) return 'red_card';
  if (lower.includes('goal') || /(^|\s)b(\s|$)/.test(lower)) return 'goal';
  if (lower.includes('corner') || /(^|\s)f(\s|$)/.test(lower)) return 'corner';
  if (lower.includes('substitution') || /(^|\s)c(\s|$)/.test(lower)) return 'substitution';
  if (lower.includes('dangerous')) return 'dangerous_attack';
  return 'timeline_event';
}

function arabicEventType(type: string) {
  if (type === 'goal') return 'هدف';
  if (type === 'corner') return 'ركنية';
  if (type === 'yellow_card') return 'بطاقة صفراء';
  if (type === 'red_card') return 'بطاقة حمراء';
  if (type === 'substitution') return 'تبديل';
  if (type === 'dangerous_attack') return 'هجمة خطيرة';
  return 'حدث';
}

function parseMinute(title: string) {
  const injury = title.match(/injury\s*time\s+(\d{1,3})\s*\+\s*(\d{1,2})['`′]?/i);
  if (injury) {
    const base = Number(injury[1]);
    const extra = Number(injury[2]);
    return { minute: Number.isFinite(base) && Number.isFinite(extra) ? base + extra : null, displayMinute: `${injury[1]}+${injury[2]}'` };
  }
  const normal = title.match(/(?:^|\s)(\d{1,3})\s*['`′]/);
  if (normal) {
    const minute = Number(normal[1]);
    return { minute: Number.isFinite(minute) ? minute : null, displayMinute: `${normal[1]}'` };
  }
  return { minute: null, displayMinute: null };
}

function sideForIcon(html: string, index: number): 'home' | 'away' | null {
  const before = html.slice(Math.max(0, index - 15000), index);
  const home = Math.max(before.lastIndexOf('id="homeLine_'), before.lastIndexOf("id='homeLine_"));
  const guest = Math.max(before.lastIndexOf('id="guestLine_'), before.lastIndexOf("id='guestLine_"));
  if (home < 0 && guest < 0) return null;
  return home > guest ? 'home' : 'away';
}

function teamNameForSide(side: 'home' | 'away' | null, match?: any) {
  if (side === 'home') return match?.homeTeam?.name || 'الفريق الأول';
  if (side === 'away') return match?.awayTeam?.name || 'الفريق الثاني';
  return 'غير محدد';
}

function extractTimelineEvents(html: string, match?: any): TimelineEvent[] {
  const events = new Map<string, TimelineEvent>();
  const iconRegex = /<i\b([^>]*)>/gi;
  for (const item of html.matchAll(iconRegex)) {
    const attrs = item[1] || '';
    const title = attrValue(attrs, 'title');
    if (!title) continue;
    const cssClass = attrValue(attrs, 'class') || null;
    const side = sideForIcon(html, item.index || 0);
    const { minute, displayMinute } = parseMinute(title);
    const type = timelineType(title, cssClass);
    const teamId = side === 'home' ? match?.homeTeamId || match?.homeTeam?.id || null : side === 'away' ? match?.awayTeamId || match?.awayTeam?.id || null : null;
    const minuteLabel = displayMinute ? `د${displayMinute}` : 'دقيقة غير محددة';
    const detail = `${teamNameForSide(side, match)} - ${minuteLabel} - ${arabicEventType(type)}`;
    const event: TimelineEvent = { side, teamId, minute, displayMinute, type, title, detail, cssClass };
    const key = `${side || 'n'}:${minute ?? 'x'}:${type}:${title}`.toLowerCase();
    events.set(key, event);
  }
  return [...events.values()].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.detail.localeCompare(b.detail));
}

function timelineStatCounts(events: TimelineEvent[]) {
  const counts = {
    minute: events.reduce<number | null>((max, event) => typeof event.minute === 'number' ? Math.max(max ?? 0, event.minute) : max, null),
    homeScore: 0,
    awayScore: 0,
    homeCorners: 0,
    awayCorners: 0,
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
  };
  for (const event of events) {
    const prefix = event.side === 'home' ? 'home' : event.side === 'away' ? 'away' : null;
    if (!prefix) continue;
    if (event.type === 'goal') counts[`${prefix}Score` as 'homeScore' | 'awayScore'] += 1;
    if (event.type === 'corner') counts[`${prefix}Corners` as 'homeCorners' | 'awayCorners'] += 1;
    if (event.type === 'yellow_card') counts[`${prefix}YellowCards` as 'homeYellowCards' | 'awayYellowCards'] += 1;
    if (event.type === 'red_card') counts[`${prefix}RedCards` as 'homeRedCards' | 'awayRedCards'] += 1;
  }
  return counts;
}

async function saveTimelineStatsSnapshot(match: any, providerMatchId: number, events: TimelineEvent[], replace = true) {
  if (!match?.id || !events.length) return { deleted: 0, inserted: 0, snapshotId: null };
  await ensureStatsTable();
  let deleted = 0;
  if (replace) {
    const result = await prisma.matchStatsSnapshot.deleteMany({ where: { matchId: match.id, provider: TIMELINE_SOURCE } });
    deleted = result.count;
  }
  const counts = timelineStatCounts(events);
  const snapshot = await prisma.matchStatsSnapshot.create({
    data: {
      id: randomUUID(),
      matchId: match.id,
      provider: TIMELINE_SOURCE,
      providerMatchId,
      minute: counts.minute,
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
      homeCorners: counts.homeCorners,
      awayCorners: counts.awayCorners,
      homeYellowCards: counts.homeYellowCards,
      awayYellowCards: counts.awayYellowCards,
      homeRedCards: counts.homeRedCards,
      awayRedCards: counts.awayRedCards,
      homeScore: counts.homeScore,
      awayScore: counts.awayScore,
      rawData: { source: TIMELINE_SOURCE, derivedFrom: 'timeline_icons', counts, eventsCount: events.length },
    },
    select: { id: true },
  });
  return { deleted, inserted: 1, snapshotId: snapshot.id, counts };
}

async function getMatchForTimeline(input: { dbMatchId?: string | null; providerMatchId: number }) {
  if (input.dbMatchId) {
    return prisma.match.findUnique({
      where: { id: input.dbMatchId },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
    });
  }
  return prisma.match.findFirst({
    where: { animationMatchId: input.providerMatchId },
    include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
  });
}

async function saveTimelineEvents(match: any, events: TimelineEvent[], sourceUrl: string, replace = true) {
  if (!match?.id || !events.length) return { deleted: 0, inserted: 0 };
  let deleted = 0;
  if (replace) {
    const result = await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: TIMELINE_SOURCE } });
    deleted = result.count;
  }
  await prisma.matchEvent.createMany({
    data: events.map((event) => ({
      id: randomUUID(),
      matchId: match.id,
      minute: event.minute,
      type: event.type,
      teamId: event.teamId,
      playerId: null,
      playerName: null,
      detail: event.detail,
      sourceName: TIMELINE_SOURCE,
      sourceUrl,
    })),
  });
  return { deleted, inserted: events.length };
}

async function fetchWrapper(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeISportsPull/1.0; +https://worldcup.mcprim.com)',
    },
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, html };
}

async function fetchFrameDirect(targetUrl: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 5000));
  try {
    const response = await fetch(targetUrl, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        referer: 'https://www.isportslive8.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
      },
    });
    const html = await response.text();
    return { ok: response.ok, status: response.status, html, rawLength: html.length, contentType: response.headers.get('content-type'), error: response.ok ? null : html.slice(0, 1000) };
  } catch (error: any) {
    return { ok: false, status: null, html: '', rawLength: 0, contentType: null, error: String(error?.message || error).slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
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
      headers: { 'content-type': 'application/json', accept: 'text/html,application/json,*/*' },
      body: JSON.stringify({
        url: targetUrl,
        bestAttempt: true,
        gotoOptions: { waitUntil: 'networkidle2', timeout: timeoutMs },
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

async function getCachedTimeline(matchId?: string | null) {
  if (!matchId) return { events: [], snapshot: null };
  const [events, snapshot] = await Promise.all([
    prisma.matchEvent.findMany({ where: { matchId, sourceName: TIMELINE_SOURCE }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 200 }),
    prisma.matchStatsSnapshot.findFirst({ where: { matchId, provider: TIMELINE_SOURCE }, orderBy: { capturedAt: 'desc' } }),
  ]);
  return { events, snapshot };
}

async function autoMapAnimationId(match: any, providerMatchId: number, enabled: boolean) {
  if (!enabled || !match?.id) return { updated: false, reason: 'disabled_or_no_match' };
  const current = Number(match.animationMatchId || 0);
  if (current === providerMatchId) return { updated: false, reason: 'already_mapped' };
  if (current && current !== providerMatchId) return { updated: false, reason: 'different_animation_match_id_exists', current };
  await prisma.match.update({ where: { id: match.id }, data: { animationMatchId: providerMatchId } });
  return { updated: true, animationMatchId: providerMatchId };
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

    const browserlessConfigured = String(process.env.LIVE_STATS_REMOTE_BROWSER || '').toLowerCase() === 'browserless'
      && Boolean(process.env.BROWSERLESS_TOKEN)
      && Boolean(process.env.BROWSERLESS_ENDPOINT);

    const wrapper = await fetchWrapper(wrapperUrl);
    const credentials = extractFrameCredentials(wrapper.html);
    if (!credentials) return json({ ok: false, mode: 'isports_remote_frame_pull', error: 'Could not extract iframe credentials from wrapper', wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length } }, 502);

    const frameUrl = buildFrameUrl(wrapperUrl, matchId, mode, credentials.ak, credentials.sk);
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_TIMEOUT_MS || 25000), 5000, 60000);
    const waitMs = clamp(url.searchParams.get('waitMs'), Number(process.env.LIVE_STATS_REMOTE_BROWSER_WAIT_MS || 8000), 1000, 25000);
    const save = boolFromEnv(url.searchParams.get('save'));
    const replace = url.searchParams.get('replace') === null ? true : boolFromEnv(url.searchParams.get('replace'));
    const dbMatchId = url.searchParams.get('dbMatchId');
    const autoMap = url.searchParams.get('autoMap') === null ? true : boolFromEnv(url.searchParams.get('autoMap'));

    const match = mode === 'timeline' && (save || url.searchParams.get('includeMatch') === 'true' || dbMatchId)
      ? await getMatchForTimeline({ dbMatchId, providerMatchId: matchId })
      : null;
    const mapping = mode === 'timeline' ? await autoMapAnimationId(match, matchId, autoMap) : null;

    const directFirst = mode === 'timeline' && url.searchParams.get('loader') !== 'browserless';
    const direct = directFirst ? await fetchFrameDirect(frameUrl, clamp(url.searchParams.get('directTimeoutMs'), 12000, 3000, 30000)) : null;
    const directHasUsableHtml = Boolean(direct?.ok && direct.html && direct.html.trim().length > 100);
    const shouldUseBrowserless = !directHasUsableHtml && browserlessConfigured;
    const browserless = shouldUseBrowserless ? await renderWithBrowserless(frameUrl, timeoutMs, waitMs) : null;
    const renderedHtml = directHasUsableHtml ? direct!.html : browserless?.html || direct?.html || '';
    const loader = directHasUsableHtml ? 'direct_signed_iframe_fetch' : browserless ? 'browserless_content' : 'direct_signed_iframe_fetch_failed';

    const text = htmlToText(renderedHtml);
    const stats = parseISportsVisibleStats(text);
    const timelineEvents = mode === 'timeline' ? extractTimelineEvents(renderedHtml, match) : [];
    const saveResult = save && mode === 'timeline'
      ? match ? await saveTimelineEvents(match, timelineEvents, wrapperUrl, replace) : { error: 'No local match found by dbMatchId or animationMatchId', deleted: 0, inserted: 0 }
      : null;
    const statsSaveResult = save && mode === 'timeline'
      ? match ? await saveTimelineStatsSnapshot(match, matchId, timelineEvents, replace) : { error: 'No local match found by dbMatchId or animationMatchId', deleted: 0, inserted: 0, snapshotId: null }
      : null;
    const cache = await getCachedTimeline(match?.id || dbMatchId);

    return json({
      ok: true,
      mode: 'isports_remote_frame_pull',
      frameMode: mode,
      loader,
      directFrame: direct ? {
        attempted: true,
        ok: direct.ok,
        status: direct.status,
        contentType: direct.contentType,
        rawLength: direct.rawLength,
        error: direct.error,
      } : { attempted: false },
      remoteBrowser: {
        provider: 'browserless',
        configured: browserlessConfigured,
        used: Boolean(browserless),
        endpoint: browserless?.endpoint || (browserlessConfigured ? maskUrl(browserlessEndpoint()) : null),
        ok: browserless?.ok ?? null,
        status: browserless?.status ?? null,
        contentType: browserless?.contentType ?? null,
        rawLength: browserless?.rawLength ?? 0,
        error: browserless?.error ?? null,
      },
      wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.html.length },
      frame: {
        sourceUrl: maskUrl(frameUrl),
        loader,
        rendered: Boolean(renderedHtml.trim()),
        htmlLength: renderedHtml.length,
        textLength: text.length,
        textSample: text.slice(0, 1600),
      },
      match: match ? { id: match.id, status: match.status, animationMatchId: match.animationMatchId, homeTeam: match.homeTeam, awayTeam: match.awayTeam } : null,
      mapping,
      hasStats: Object.entries(stats).some(([key, value]) => !['homeScore', 'awayScore', 'minute'].includes(key) && value !== null),
      stats,
      timeline: {
        eventsCount: timelineEvents.length,
        events: timelineEvents,
        save: saveResult,
        statsSave: statsSaveResult,
      },
      cachedTimeline: {
        eventsCount: cache.events.length,
        events: cache.events.slice(-20),
        hasSnapshot: Boolean(cache.snapshot),
        snapshot: cache.snapshot,
        usedWhenCurrentPullEmpty: timelineEvents.length === 0 && cache.events.length > 0,
      },
      resilience: {
        directFrameFirstForTimeline: true,
        browserlessOnlyFallback: true,
        doesNotDeleteOldEventsWhenCurrentPullEmpty: true,
        canContinueWithCachedTimeline: true,
      },
      note: save ? 'Timeline pull is resilient: it tries direct signed iframe fetch first, uses Browserless only when direct fetch fails, never deletes old iSport events on empty pulls, and returns cached timeline data when the current pull is blocked or empty.' : 'Diagnostic only unless save=true.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
