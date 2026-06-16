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
  numericFields: Array<number | null>;
  fieldMap: Record<string, string | null>;
  likelyPayload: 'timeline_state' | 'event_record' | 'unknown';
  eventLike: boolean;
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function toNumber(value?: string | null) {
  const cleaned = String(value ?? '').trim().replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function maybeMinute(value?: string | null) {
  const text = String(value ?? '').trim();
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

function inferPayloadType(fields: string[]) {
  if (fields.length >= 10 && /^\d{1,3}:\d{1,2}$/.test(fields[2] || '')) return 'timeline_state' as const;
  if (fields.length >= 5 && fields.some((field) => /^\d{1,3}$/.test(field))) return 'event_record' as const;
  return 'unknown' as const;
}

function parseRecord(raw: string): ParsedRecord {
  const fields = String(raw || '').split('^');
  const numericFields = fields.map((field) => toNumber(field));
  const providerScheduleId = fields[0] || null;
  const state = fields[1] || null;
  const clock = fields.find((field) => /^\d{1,3}:\d{1,2}$/.test(field)) || null;
  const minute = maybeMinute(clock || fields[2]);
  const likelyPayload = inferPayloadType(fields);
  const eventLike = fields.length >= 5 && Boolean(providerScheduleId) && numericFields.filter((v) => v !== null).length >= 4;
  const fieldMap = Object.fromEntries(fields.map((field, index) => [`f${index}`, field || null]));

  return { raw, fields, providerScheduleId, state, clock, minute, numericFields, fieldMap, likelyPayload, eventLike };
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
      note: 'Diagnostic parser for decoded websocket payloads. It does not infer score from timeline-state fields until the column protocol is confirmed.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
