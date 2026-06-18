import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REAL_EVENT_SOURCES = ['THE_STATS_API', 'ISPORTS_TIMELINE'];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function normalizeText(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function eventFamily(type: any, detail: any) {
  const value = `${normalizeText(type)} ${normalizeText(detail)}`;
  if (value.includes('penalty') || value.includes('جزاء')) return value.includes('miss') || value.includes('مهد') ? 'penalty_missed' : 'goal';
  if (value.includes('goal') || value.includes('هدف') || value.includes('score_update')) return 'goal';
  if (value.includes('sub') || value.includes('تبديل')) return 'substitution';
  if (value.includes('corner') || value.includes('ركنية')) return 'corner';
  if (value.includes('yellow') || value.includes('صفراء')) return 'yellow_card';
  if (value.includes('red') || value.includes('حمراء')) return 'red_card';
  if (value.includes('var')) return 'var';
  if (value.includes('offside') || value.includes('تسلل')) return 'offside';
  if (value.includes('foul') || value.includes('خطأ')) return 'foul';
  return normalizeText(type) || 'note';
}

function sourceRank(sourceName: string | null) {
  const source = String(sourceName || '').toUpperCase();
  if (source === 'THE_STATS_API') return 100;
  if (source === 'ISPORTS_TIMELINE') return 60;
  if (source === 'THE_STATS_API_LIVE_SCORE') return 5;
  if (!source) return 40;
  return 30;
}

function duplicateKey(event: any) {
  const minute = event.minute === null || event.minute === undefined ? 'x' : String(event.minute);
  const family = eventFamily(event.type, event.detail);
  const team = event.teamId || 'n';
  return `${minute}|${family}|${team}`;
}

function shouldDeleteAsDuplicate(candidate: any, kept: any, includeManual: boolean) {
  const source = String(candidate.sourceName || '').toUpperCase();
  if (!includeManual && !source) return false;
  if (source === 'THE_STATS_API_LIVE_SCORE') return true;
  return sourceRank(candidate.sourceName) < sourceRank(kept.sourceName);
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || '';
  const dryRun = bool(url.searchParams.get('dryRun'), true);
  const includeManual = bool(url.searchParams.get('includeManual'), false);
  const cleanupSynthetic = bool(url.searchParams.get('cleanupSynthetic'), true);

  if (!matchId) return json({ ok: false, error: 'matchId is required' }, 400);

  const events = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, minute: true, type: true, teamId: true, playerName: true, detail: true, sourceName: true, createdAt: true },
  });

  const byKey = new Map<string, any[]>();
  for (const event of events) {
    const key = duplicateKey(event);
    const group = byKey.get(key) || [];
    group.push(event);
    byKey.set(key, group);
  }

  const toDelete = new Map<string, any>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => sourceRank(b.sourceName) - sourceRank(a.sourceName));
    const kept = sorted[0];
    for (const event of sorted.slice(1)) {
      if (shouldDeleteAsDuplicate(event, kept, includeManual)) toDelete.set(event.id, { ...event, duplicateOf: kept.id, keptSource: kept.sourceName });
    }
  }

  if (cleanupSynthetic) {
    const hasRealGoals = events.some((event) => REAL_EVENT_SOURCES.includes(String(event.sourceName || '').toUpperCase()) && eventFamily(event.type, event.detail) === 'goal');
    if (hasRealGoals) {
      for (const event of events) {
        if (String(event.sourceName || '').toUpperCase() === 'THE_STATS_API_LIVE_SCORE') toDelete.set(event.id, { ...event, reason: 'synthetic_score_event_replaced_by_real_timeline' });
      }
    }
  }

  let deleted = 0;
  if (!dryRun && toDelete.size) {
    const result = await prisma.matchEvent.deleteMany({ where: { id: { in: [...toDelete.keys()] } } });
    deleted = result.count;
  }

  return json({
    ok: true,
    mode: 'match_events_dedupe',
    dryRun,
    matchId,
    eventsChecked: events.length,
    duplicatesFound: toDelete.size,
    deleted,
    policy: {
      priority: ['THE_STATS_API', 'ISPORTS_TIMELINE', 'manual/null', 'other', 'THE_STATS_API_LIVE_SCORE'],
      manualEventsProtectedByDefault: !includeManual,
      syntheticScoreEventsRemovedWhenRealGoalsExist: cleanupSynthetic,
    },
    deletePreview: [...toDelete.values()].slice(0, 50),
  });
}

export async function POST(req: Request) { return GET(req); }
