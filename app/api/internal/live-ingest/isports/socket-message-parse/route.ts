import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type ParsedRecord = {
  raw: string;
  fields: string[];
  providerScheduleId: string | null;
  state: string | null;
  clock: string | null;
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  numericFields: Array<number | null>;
  eventLike: boolean;
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function toNumber(value?: string | null) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function maybeMinute(value?: string | null) {
  const text = String(value ?? '');
  const match = text.match(/^(\d{1,3})(?::\d{1,2})?$/);
  const n = toNumber(match?.[1] || text);
  return n !== null && n >= 0 && n <= 130 ? n : null;
}

function tryJson(value: string) {
  try { return JSON.parse(value); } catch { return null; }
}

function parsePayloadValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join('^');
  return String(value ?? '');
}

function splitRecords(value: string) {
  return String(value || '')
    .split(/\$\$|\r?\n|;/)
    .map((record) => record.trim())
    .filter(Boolean);
}

function parseRecord(raw: string): ParsedRecord {
  const fields = String(raw || '').split('^');
  const numericFields = fields.map((field) => toNumber(field));
  const providerScheduleId = fields[0] || null;
  const state = fields[1] || null;
  const clock = fields.find((field) => /^\d{1,3}:\d{1,2}$/.test(field)) || null;
  const minute = maybeMinute(clock || fields[2]);
  const scoreCandidates = fields
    .map((field, index) => ({ index, value: toNumber(field) }))
    .filter((item) => item.value !== null && item.value >= 0 && item.value <= 30);
  const homeScore = scoreCandidates.length >= 2 ? scoreCandidates[scoreCandidates.length - 2].value : null;
  const awayScore = scoreCandidates.length >= 2 ? scoreCandidates[scoreCandidates.length - 1].value : null;
  const eventLike = fields.length >= 5 && Boolean(providerScheduleId) && numericFields.filter((v) => v !== null).length >= 4;

  return { raw, fields, providerScheduleId, state, clock, minute, homeScore, awayScore, numericFields, eventLike };
}

function normalizeInput(reqUrl: URL, bodyText: string | null) {
  const raw = bodyText || reqUrl.searchParams.get('sample') || reqUrl.searchParams.get('message') || reqUrl.searchParams.get('payload') || '';
  const parsed = tryJson(raw);
  if (parsed && typeof parsed === 'object') {
    const entries = Object.entries(parsed as Record<string, unknown>);
    return entries.map(([channel, value]) => ({ channel, payload: parsePayloadValue(value) }));
  }
  const channel = reqUrl.searchParams.get('channel') || 'unknown';
  return [{ channel, payload: raw }];
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const reqUrl = new URL(req.url);
    const bodyText = req.method === 'POST' ? await req.text() : null;
    const inputs = normalizeInput(reqUrl, bodyText);
    const parsedChannels = inputs.map((input) => {
      const records = splitRecords(input.payload).map(parseRecord);
      return {
        channel: input.channel,
        rawPayload: input.payload.slice(0, 2500),
        recordCount: records.length,
        records,
      };
    });

    const scheduleIds = [...new Set(parsedChannels.flatMap((item) => item.records.map((record) => record.providerScheduleId).filter(Boolean)))] as string[];

    return json({
      ok: true,
      mode: 'isports_socket_message_parse',
      scheduleIds,
      parsedChannels,
      note: 'Diagnostic parser for decoded websocket payloads. It identifies provider schedule ids and record fields before we map them to local matches/events.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
