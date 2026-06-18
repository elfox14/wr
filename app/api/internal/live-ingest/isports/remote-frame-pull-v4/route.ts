import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { extractISportsMatchId, htmlToText } from '@/lib/live-ingest/isports-page';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type Side = 'home' | 'away' | null;
type TimelineEvent = {
  side: Side;
  teamId: string | null;
  minute: number | null;
  displayMinute: string | null;
  type: string;
  title: string;
  detail: string;
  cssClass: string | null;
};

const SOURCE = 'ISPORTS_TIMELINE';
const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);
const DEFAULT_FALLBACK = 'https://browserless-backup-5k6y.onrender.com';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function bool(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function clamp(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function md5(value: string) {
  return createHash('md5').update(value).digest('hex').toUpperCase();
}

function mask(value: string) {
  const url = new URL(value);
  for (const key of ['accessKey', 'auth', 'ts', 'r', 'token']) if (url.searchParams.has(key)) url.searchParams.set(key, '***');
  return url.toString();
}

function safeUrl(value: string) {
  const url = new URL(value);
  if (!HOSTS.has(url.hostname.toLowerCase())) throw new Error('Only isportslive8.com URLs are allowed');
  return url;
}

function defaultWrapper(matchId: number, mode: string, lang = 'en', version = '1') {
  const path = mode === 'timeline' ? '/football/process/demo.html' : '/football/pc.html';
  const url = new URL(`https://www.isportslive8.com${path}`);
  url.searchParams.set('matchId', String(matchId));
  url.searchParams.set('lang', lang);
  url.searchParams.set('v', version);
  return url.toString();
}

function lastRegexValue(text: string, regex: RegExp) {
  let found: string | null = null;
  for (const match of text.matchAll(regex)) if (match?.[1]) found = match[1];
  return found;
}

function extractCredentials(html: string) {
  const ak = lastRegexValue(html, /USER_FEIJING88\.ak\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bak\s*:\s*["']([^"']+)["']/g);
  const sk = lastRegexValue(html, /USER_FEIJING88\.sk\s*=\s*["']([^"']+)["']/g) || lastRegexValue(html, /\bsk\s*:\s*["']([^"']+)["']/g);
  return ak && sk ? { ak, sk } : null;
}

function buildFrame(wrapperUrl: string, matchId: number, mode: string, ak: string, sk: string) {
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

async function fetchText(url: string, timeoutMs: number, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text, contentType: response.headers.get('content-type'), error: response.ok ? null : text.slice(0, 1000) };
  } catch (error: any) {
    return { ok: false, status: null, text: '', contentType: null, error: String(error?.message || error).slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
}

function htmlFromBrowserResponse(text: string, contentType: string | null) {
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

function browserEndpointVariants(value: string | null | undefined) {
  if (!value) return [];
  try {
    const base = new URL(value);
    const variants: string[] = [];
    if (base.pathname === '/' || base.pathname === '') {
      const content = new URL(base.toString());
      content.pathname = '/content';
      variants.push(content.toString());
    }
    variants.push(base.toString());
    return variants;
  } catch {
    return [];
  }
}

function browserEndpoints(backupOverride: string | null) {
  const candidates = [
    ...browserEndpointVariants(process.env.BROWSERLESS_ENDPOINT),
    ...browserEndpointVariants(backupOverride),
    ...browserEndpointVariants(process.env.BROWSERLESS_FALLBACK_ENDPOINT),
    ...browserEndpointVariants(process.env.BROWSERLESS_BACKUP_ENDPOINT),
    ...browserEndpointVariants(DEFAULT_FALLBACK),
  ];
  const seen = new Set<string>();
  return candidates.filter((endpoint) => {
    if (seen.has(endpoint)) return false;
    seen.add(endpoint);
    return true;
  });
}

async function renderWithBrowsers(targetUrl: string, timeoutMs: number, waitMs: number, backupOverride: string | null) {
  const attempts: any[] = [];
  for (const endpoint of browserEndpoints(backupOverride)) {
    const url = new URL(endpoint);
    const token = url.hostname.includes('browserless.io') ? process.env.BROWSERLESS_TOKEN : process.env.BROWSERLESS_FALLBACK_TOKEN || process.env.BROWSERLESS_BACKUP_TOKEN;
    if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
    const finalEndpoint = url.toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs + 8000, 12000));
    try {
      const response = await fetch(finalEndpoint, {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: 'text/html,application/json,*/*' },
        body: JSON.stringify({ url: targetUrl, bestAttempt: true, gotoOptions: { waitUntil: 'networkidle2', timeout: timeoutMs }, waitForTimeout: waitMs }),
      });
      const text = await response.text();
      const html = htmlFromBrowserResponse(text, response.headers.get('content-type'));
      const attempt = { endpoint: mask(finalEndpoint), ok: response.ok, status: response.status, rawLength: text.length, htmlLength: html.length, contentType: response.headers.get('content-type'), error: response.ok ? null : text.slice(0, 1000) };
      attempts.push(attempt);
      if (response.ok && html.trim().length > 100) return { ...attempt, html, attempts };
    } catch (error: any) {
      attempts.push({ endpoint: mask(finalEndpoint), ok: false, status: null, rawLength: 0, htmlLength: 0, contentType: null, error: String(error?.message || error).slice(0, 1000) });
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: null, html: '', rawLength: 0, htmlLength: 0, contentType: null, error: 'No browser endpoint succeeded', attempts };
}

function unescapeHtml(value: string) {
  return String(value || '').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
}

function attr(attrs: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return unescapeHtml(attrs.match(new RegExp(`\\b${escaped}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] || attrs.match(new RegExp(`\\b${escaped}\\s*=\\s*'([^']*)'`, 'i'))?.[1] || '');
}

function eventType(title: string, cssClass: string | null) {
  const lower = `${title} ${cssClass || ''}`.toLowerCase().replace(/\s+/g, ' ');
  if (lower.includes('yellow') || /(^|\s)yc(\s|$)/.test(lower)) return 'yellow_card';
  if (lower.includes('red') || /(^|\s)rc(\s|$)/.test(lower)) return 'red_card';
  if (lower.includes('goal') || /(^|\s)b(\s|$)/.test(lower)) return 'goal';
  if (lower.includes('corner') || /(^|\s)f(\s|$)/.test(lower)) return 'corner';
  if (lower.includes('substitution') || /(^|\s)c(\s|$)/.test(lower)) return 'substitution';
  if (lower.includes('dangerous')) return 'dangerous_attack';
  return 'timeline_event';
}

function arType(type: string) {
  if (type === 'goal') return 'هدف';
  if (type === 'corner') return 'ركنية';
  if (type === 'yellow_card') return 'بطاقة صفراء';
  if (type === 'red_card') return 'بطاقة حمراء';
  if (type === 'substitution') return 'تبديل';
  if (type === 'dangerous_attack') return 'هجمة خطيرة';
  return 'حدث';
}

function minute(title: string) {
  const injury = title.match(/injury\s*time\s+(\d{1,3})\s*\+\s*(\d{1,2})['`′]?/i);
  if (injury) return { minute: Number(injury[1]) + Number(injury[2]), displayMinute: `${injury[1]}+${injury[2]}'` };
  const normal = title.match(/(?:^|\s)(\d{1,3})\s*['`′]/);
  if (normal) return { minute: Number(normal[1]), displayMinute: `${normal[1]}'` };
  return { minute: null, displayMinute: null };
}

function sideFor(html: string, index: number): Side {
  const before = html.slice(Math.max(0, index - 15000), index);
  const home = Math.max(before.lastIndexOf('id="homeLine_'), before.lastIndexOf("id='homeLine_"));
  const away = Math.max(before.lastIndexOf('id="guestLine_'), before.lastIndexOf("id='guestLine_"));
  if (home < 0 && away < 0) return null;
  return home > away ? 'home' : 'away';
}

function sideName(side: Side, match: any) {
  if (side === 'home') return match?.homeTeam?.name || 'الفريق الأول';
  if (side === 'away') return match?.awayTeam?.name || 'الفريق الثاني';
  return 'غير محدد';
}

function extractEvents(html: string, match: any): TimelineEvent[] {
  const events = new Map<string, TimelineEvent>();
  for (const item of html.matchAll(/<i\b([^>]*)>/gi)) {
    const attrs = item[1] || '';
    const title = attr(attrs, 'title');
    if (!title) continue;
    const cssClass = attr(attrs, 'class') || null;
    const side = sideFor(html, item.index || 0);
    const time = minute(title);
    const type = eventType(title, cssClass);
    const teamId = side === 'home' ? match?.homeTeamId || match?.homeTeam?.id || null : side === 'away' ? match?.awayTeamId || match?.awayTeam?.id || null : null;
    const detail = `${sideName(side, match)} - ${time.displayMinute ? `د${time.displayMinute}` : 'دقيقة غير محددة'} - ${arType(type)}`;
    const event = { side, teamId, minute: time.minute, displayMinute: time.displayMinute, type, title, detail, cssClass };
    events.set(`${side || 'n'}:${time.minute ?? 'x'}:${type}:${title}`.toLowerCase(), event);
  }
  return [...events.values()].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.detail.localeCompare(b.detail));
}

function directUsable(html: string, eventsCount: number) {
  const sample = htmlToText(html).toLowerCase().trim();
  if (eventsCount > 0) return true;
  if (!html || html.length < 100) return false;
  if (sample === 'loading...' || sample === 'loading' || sample.length < 30) return false;
  return html.includes('homeLine_') || html.includes('guestLine_');
}

function counts(events: TimelineEvent[]) {
  const c = { minute: null as number | null, homeScore: 0, awayScore: 0, homeCorners: 0, awayCorners: 0, homeYellowCards: 0, awayYellowCards: 0, homeRedCards: 0, awayRedCards: 0 };
  for (const event of events) {
    if (typeof event.minute === 'number') c.minute = Math.max(c.minute ?? 0, event.minute);
    const prefix = event.side === 'home' ? 'home' : event.side === 'away' ? 'away' : null;
    if (!prefix) continue;
    if (event.type === 'goal') c[`${prefix}Score` as 'homeScore' | 'awayScore'] += 1;
    if (event.type === 'corner') c[`${prefix}Corners` as 'homeCorners' | 'awayCorners'] += 1;
    if (event.type === 'yellow_card') c[`${prefix}YellowCards` as 'homeYellowCards' | 'awayYellowCards'] += 1;
    if (event.type === 'red_card') c[`${prefix}RedCards` as 'homeRedCards' | 'awayRedCards'] += 1;
  }
  return c;
}

async function localMatch(dbMatchId: string | null, animationId: number) {
  if (dbMatchId) return prisma.match.findUnique({ where: { id: dbMatchId }, include: { homeTeam: true, awayTeam: true } });
  return prisma.match.findFirst({ where: { animationMatchId: animationId }, include: { homeTeam: true, awayTeam: true } });
}

async function mapAnimationId(match: any, animationId: number) {
  if (!match?.id) return { updated: false, reason: 'no_local_match' };
  if (match.animationMatchId === animationId) return { updated: false, reason: 'already_mapped', animationMatchId: animationId };
  if (match.animationMatchId && match.animationMatchId !== animationId) return { updated: false, reason: 'different_animation_match_id_exists', current: match.animationMatchId };
  await prisma.match.update({ where: { id: match.id }, data: { animationMatchId: animationId } });
  return { updated: true, animationMatchId: animationId };
}

async function saveEvents(match: any, events: TimelineEvent[], sourceUrl: string, animationId: number, replace: boolean) {
  if (!match?.id || !events.length) return { events: { deleted: 0, inserted: 0 }, snapshot: { deleted: 0, inserted: 0, snapshotId: null } };
  let deletedEvents = 0;
  let deletedSnapshots = 0;
  if (replace) {
    deletedEvents = (await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: SOURCE } })).count;
    deletedSnapshots = (await prisma.matchStatsSnapshot.deleteMany({ where: { matchId: match.id, provider: SOURCE } })).count;
  }
  await prisma.matchEvent.createMany({ data: events.map((event) => ({ id: randomUUID(), matchId: match.id, minute: event.minute, type: event.type, teamId: event.teamId, detail: event.detail, sourceName: SOURCE, sourceUrl })) });
  const c = counts(events);
  const snapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: SOURCE, providerMatchId: animationId, minute: c.minute, homeCorners: c.homeCorners, awayCorners: c.awayCorners, homeYellowCards: c.homeYellowCards, awayYellowCards: c.awayYellowCards, homeRedCards: c.homeRedCards, awayRedCards: c.awayRedCards, homeScore: c.homeScore, awayScore: c.awayScore, rawData: { source: SOURCE, derivedFrom: 'timeline_icons', counts: c, eventsCount: events.length } }, select: { id: true } });
  return { events: { deleted: deletedEvents, inserted: events.length }, snapshot: { deleted: deletedSnapshots, inserted: 1, snapshotId: snapshot.id, counts: c } };
}

async function cached(matchId?: string | null) {
  if (!matchId) return { events: [], snapshot: null };
  const [events, snapshot] = await Promise.all([
    prisma.matchEvent.findMany({ where: { matchId, sourceName: SOURCE }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 200 }),
    prisma.matchStatsSnapshot.findFirst({ where: { matchId, provider: SOURCE }, orderBy: { capturedAt: 'desc' } }),
  ]);
  return { events, snapshot };
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const url = new URL(req.url);
    const mode = String(url.searchParams.get('mode') || 'timeline').toLowerCase() === 'live' ? 'live' : 'timeline';
    const sourceUrl = url.searchParams.get('sourceUrl');
    const animationId = Math.floor(Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || extractISportsMatchId(sourceUrl)));
    if (!Number.isFinite(animationId) || animationId <= 0) return json({ ok: false, error: 'matchId or sourceUrl is required' }, 400);

    const wrapperUrl = sourceUrl ? safeUrl(sourceUrl).toString() : defaultWrapper(animationId, mode, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');
    const wrapper = await fetchText(wrapperUrl, 15000, { accept: 'text/html,*/*', 'user-agent': 'Mozilla/5.0 (compatible; MCPrimeISportsV4/1.0)' });
    const creds = extractCredentials(wrapper.text);
    if (!creds) return json({ ok: false, mode: 'isports_remote_frame_pull_v4', error: 'Could not extract iframe credentials', wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.text.length } }, 502);

    const frameUrl = buildFrame(wrapperUrl, animationId, mode, creds.ak, creds.sk);
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), 25000, 5000, 60000);
    const waitMs = clamp(url.searchParams.get('waitMs'), 8000, 1000, 25000);
    const replace = url.searchParams.get('replace') === null ? true : bool(url.searchParams.get('replace'));
    const shouldSave = bool(url.searchParams.get('save'));
    const dbMatchId = url.searchParams.get('dbMatchId');
    const match = await localMatch(dbMatchId, animationId);
    const mapping = shouldSave ? await mapAnimationId(match, animationId) : null;

    const direct = await fetchText(frameUrl, clamp(url.searchParams.get('directTimeoutMs'), 12000, 3000, 30000), { accept: 'text/html,*/*', referer: 'https://www.isportslive8.com/', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome Safari/537.36' });
    let html = direct.ok ? direct.text : '';
    let events = mode === 'timeline' ? extractEvents(html, match) : [];
    let loader = 'direct_signed_iframe_fetch';
    let browser: any = null;

    if (!directUsable(html, events.length)) {
      browser = await renderWithBrowsers(frameUrl, timeoutMs, waitMs, url.searchParams.get('backupEndpoint') || url.searchParams.get('fallbackEndpoint'));
      if (browser.html) {
        html = browser.html;
        events = mode === 'timeline' ? extractEvents(html, match) : [];
        loader = 'browserless_primary_or_fallback';
      } else {
        loader = 'direct_loading_shell_and_browserless_failed';
      }
    }

    const text = htmlToText(html);
    const saveResult = shouldSave ? await saveEvents(match, events, wrapperUrl, animationId, replace) : null;
    const cache = await cached(match?.id || dbMatchId);

    return json({
      ok: true,
      mode: 'isports_remote_frame_pull_v4',
      frameMode: mode,
      loader,
      wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.text.length },
      frame: { sourceUrl: mask(frameUrl), rendered: Boolean(html), htmlLength: html.length, textLength: text.length, textSample: text.slice(0, 1200) },
      directFrame: { ok: direct.ok, status: direct.status, contentType: direct.contentType, rawLength: direct.text.length, textSample: htmlToText(direct.text).slice(0, 200), usable: directUsable(direct.text, mode === 'timeline' ? extractEvents(direct.text, match).length : 0), error: direct.error },
      remoteBrowser: browser ? { used: true, ok: browser.ok, status: browser.status, contentType: browser.contentType, rawLength: browser.rawLength, htmlLength: browser.htmlLength, error: browser.error, attempts: browser.attempts } : { used: false },
      match: match ? { id: match.id, status: match.status, animationMatchId: match.animationMatchId, homeTeam: match.homeTeam, awayTeam: match.awayTeam } : null,
      mapping,
      timeline: { eventsCount: events.length, events, save: saveResult },
      cachedTimeline: { eventsCount: cache.events.length, events: cache.events.slice(-20), hasSnapshot: Boolean(cache.snapshot), snapshot: cache.snapshot, usedWhenCurrentPullEmpty: events.length === 0 && cache.events.length > 0 },
      resilience: { directLoadingShellIsNotAccepted: true, fallbackEnv: 'BROWSERLESS_FALLBACK_ENDPOINT', noDeleteWhenCurrentPullEmpty: true, cacheReturned: true },
    });
  } catch (error: any) {
    return json({ ok: false, mode: 'isports_remote_frame_pull_v4', error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
