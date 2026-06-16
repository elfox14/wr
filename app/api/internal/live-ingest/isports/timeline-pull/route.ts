import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { extractISportsMatchId } from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);
const DEFAULT_WRAPPER = 'https://www.isportslive8.com/football/process/demo.html';
const DOMAIN = '$$';
const DATA_TYPE = '!';
const SPLIT_RECORD = '^';
const SPLIT_COLUMN = ',';

type TimelineEventKind = 'dangerous_attack' | 'corner' | 'goal' | 'card_or_substitution' | 'unknown';

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
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

function toNumber(value?: string | null) {
  const cleaned = String(value ?? '').trim().replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function timelineWrapperUrl(matchId: number, lang = 'en', version = '1') {
  const url = new URL(DEFAULT_WRAPPER);
  url.searchParams.set('v', version);
  url.searchParams.set('matchId', String(matchId));
  url.searchParams.set('lang', lang);
  return url.toString();
}

async function fetchText(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      accept: '*/*',
      referer: 'https://www.isportslive8.com/football/process/attackdetail.aspx',
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeTimelinePull/1.0; +https://worldcup.mcprim.com)',
      ...(options?.headers || {}),
    },
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text, contentType: response.headers.get('content-type') };
}

function extractFrameCredentials(html: string) {
  const ak = lastRegexValue(html, /USER_FEIJING88\.ak\s*=\s*["']([^"']+)["']/g)
    || lastRegexValue(html, /\bak\s*:\s*["']([^"']+)["']/g);
  const sk = lastRegexValue(html, /USER_FEIJING88\.sk\s*=\s*["']([^"']+)["']/g)
    || lastRegexValue(html, /\bsk\s*:\s*["']([^"']+)["']/g);
  if (!ak || !sk) return null;
  return { ak, sk };
}

function parseJsonSafe(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

function eventKind(category?: string | null): TimelineEventKind {
  switch (String(category || '')) {
    case '1': return 'dangerous_attack';
    case '2': return 'corner';
    case '3': return 'goal';
    case '4': return 'card_or_substitution';
    default: return 'unknown';
  }
}

function parseEventRecord(raw: string) {
  const fields = String(raw || '').split(SPLIT_COLUMN);
  const category = fields[1] || null;
  return {
    raw,
    fields,
    id: fields[0] || null,
    category,
    kind: eventKind(category),
    eventType: fields[2] || null,
    teamId: fields[3] || null,
    minute: toNumber(fields[4]),
    injuryTime: toNumber(fields[5]),
    playerId: fields[6] || null,
  };
}

function parseFlashDomain(domainText: string) {
  const sections = String(domainText || '').split(DATA_TYPE);
  const scheduleFields = (sections[0] || '').split(SPLIT_RECORD);
  const initialEventText = sections[4] || '';
  const updateEventText = sections[2] || '';
  const eventRecords = [initialEventText, updateEventText]
    .filter(Boolean)
    .flatMap((text) => text.split(SPLIT_RECORD).map((record) => record.trim()).filter(Boolean))
    .map(parseEventRecord);

  return {
    raw: domainText.slice(0, 3000),
    sectionsCount: sections.length,
    sectionLengths: sections.map((section) => section.length),
    schedule: {
      providerScheduleId: scheduleFields[0] || null,
      homeScore: toNumber(scheduleFields[1]),
      awayScore: toNumber(scheduleFields[2]),
      state: scheduleFields[3] || null,
      time: scheduleFields[4] || null,
      detailTime: scheduleFields[5] || null,
      fields: scheduleFields,
    },
    events: eventRecords,
    eventCounts: eventRecords.reduce((acc: Record<string, number>, event) => {
      acc[event.kind] = (acc[event.kind] || 0) + 1;
      return acc;
    }, {}),
  };
}

function parseFlashData(data: string) {
  const domains = String(data || '')
    .split(DOMAIN)
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    rawLength: String(data || '').length,
    rawSample: String(data || '').slice(0, 2400),
    domainCount: domains.length,
    domains: domains.map(parseFlashDomain),
  };
}

async function handler(req: Request) {
  const authz = await requireAdmin(req);
  if (!authz.authorized) return authz.error;

  try {
    const url = new URL(req.url);
    const explicitSourceUrl = url.searchParams.get('sourceUrl');
    const rawMatchId = Number(url.searchParams.get('matchId') || url.searchParams.get('providerMatchId') || extractISportsMatchId(explicitSourceUrl));
    if (!Number.isFinite(rawMatchId) || rawMatchId <= 0) return json({ ok: false, error: 'matchId or sourceUrl is required' }, 400);
    const matchId = Math.floor(rawMatchId);
    const wrapperUrl = explicitSourceUrl ? safeUrl(explicitSourceUrl).toString() : timelineWrapperUrl(matchId, url.searchParams.get('lang') || 'en', url.searchParams.get('v') || '1');

    const wrapper = await fetchText(wrapperUrl);
    const credentials = extractFrameCredentials(wrapper.text);
    if (!credentials) return json({ ok: false, error: 'Could not extract iSports credentials from wrapper', wrapper: { status: wrapper.status, ok: wrapper.ok, htmlLength: wrapper.text.length } }, 502);

    const ts = Math.floor(Date.now() / 1000);
    const auth = md5(`${credentials.ak}${ts}${credentials.sk}`);
    const configBody = {
      type: 260011,
      messageData: {
        accessKey: credentials.ak,
        timestamp: ts,
        host: 'www.isportslive8.com',
        auth,
        type: 0,
      },
    };

    const configResponse = await fetchText('https://www.isportslive8.com/iapi', {
      method: 'POST',
      body: JSON.stringify(configBody),
      headers: { 'content-type': 'application/json;charset=utf8', origin: 'https://www.isportslive8.com' },
    });
    const configJson = parseJsonSafe(configResponse.text);

    const flashUrl = `https://www.isportslive8.com/flashdata/get?id=${encodeURIComponent(String(matchId))}&t=${Date.now()}`;
    const flash = await fetchText(flashUrl, { headers: { referer: `https://www.isportslive8.com/football/process/attackdetail.aspx?matchId=${matchId}` } });
    const parsedFlash = parseFlashData(flash.text);

    return json({
      ok: true,
      mode: 'isports_timeline_pull',
      matchId,
      wrapper: { sourceUrl: wrapperUrl, ok: wrapper.ok, status: wrapper.status, htmlLength: wrapper.text.length },
      config: { ok: configResponse.ok, status: configResponse.status, resultCode: configJson?.resultCode ?? null, sample: configResponse.text.slice(0, 1000) },
      flash: { sourceUrl: flashUrl, ok: flash.ok, status: flash.status, contentType: flash.contentType, textLength: flash.text.length, parsed: parsedFlash },
      note: 'Diagnostic only. It pulls /flashdata/get?id=matchId and parses schedule/events using the protocol found in event.js.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
