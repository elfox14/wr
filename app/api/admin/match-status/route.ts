import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_STATUS = new Set(['SCHEDULED', 'IN_PLAY', 'LIVE', '1H', 'HT', '2H', 'FINISHED', 'FT']);

function text(value: string | null) {
  return String(value || '').trim();
}

function numberParam(value: string | null) {
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function boolParam(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function eventForStatus(status: string) {
  if (status === 'HT') return { minute: 45, type: 'period_end', detail: 'نهاية الشوط الأول — استراحة' };
  if (status === '2H') return { minute: 46, type: 'period_start', detail: 'بداية الشوط الثاني' };
  if (status === 'FINISHED' || status === 'FT') return { minute: 90, type: 'period_end', detail: 'نهاية المباراة' };
  if (status === '1H' || status === 'IN_PLAY' || status === 'LIVE') return { minute: null, type: 'period_start', detail: 'المباراة مباشرة الآن' };
  return null;
}

async function insertStatusEvent(matchId: string, status: string) {
  const event = eventForStatus(status);
  if (!event) return null;
  const existing = await prisma.matchEvent.findFirst({
    where: {
      matchId,
      type: event.type,
      detail: event.detail,
      sourceName: 'MC PRIME Match Control',
    },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.matchEvent.create({
    data: {
      id: `event_${randomUUID()}`,
      matchId,
      minute: event.minute,
      type: event.type,
      detail: event.detail,
      sourceName: 'MC PRIME Match Control',
      sourceUrl: null,
    },
  });
}

async function handle(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const url = new URL(req.url);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const matchId = text(body.matchId || url.searchParams.get('matchId') || url.searchParams.get('id'));
  const status = text(body.status || url.searchParams.get('status')).toUpperCase();
  const homeScore = numberParam(body.homeScore ?? url.searchParams.get('homeScore'));
  const awayScore = numberParam(body.awayScore ?? url.searchParams.get('awayScore'));
  const createEvent = boolParam(String(body.event ?? url.searchParams.get('event') ?? ''), true);

  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
  if (!ALLOWED_STATUS.has(status)) return NextResponse.json({ ok: false, error: 'Unsupported status', allowed: Array.from(ALLOWED_STATUS) }, { status: 400 });

  const update: Record<string, any> = { status };
  if (homeScore !== null) update.homeScore = homeScore;
  if (awayScore !== null) update.awayScore = awayScore;

  const match = await prisma.match.update({
    where: { id: matchId },
    data: update,
    select: { id: true, status: true, homeScore: true, awayScore: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });

  const event = createEvent ? await insertStatusEvent(match.id, status) : null;

  return NextResponse.json({
    ok: true,
    mode: 'match_status_control',
    match,
    eventCreatedOrFound: event ? { id: event.id } : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
