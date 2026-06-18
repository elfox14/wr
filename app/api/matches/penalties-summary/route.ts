import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PenaltyTotals = {
  total: number;
  scored: number;
  missed: number;
  unknown: number;
  sourceCount: number;
  examples: string[];
};

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textIncludesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function isPenaltyText(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  return textIncludesAny(text, ['penalty', 'spot kick', 'ركلة جزاء', 'ضربة جزاء', 'جزاء']);
}

function isMissedPenaltyText(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  return textIncludesAny(text, ['miss', 'missed', 'saved', 'failed', 'off target', 'ضائعة', 'مهدرة', 'اهدر', 'أهدر', 'تصدى', 'تصدي']);
}

function isScoredPenaltyText(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  if (isMissedPenaltyText(type, detail)) return false;
  return textIncludesAny(text, ['penalty_goal', 'penalty_scored', 'penalty goal', 'scored penalty', 'goal penalty', 'penalty converted', 'هدف من ركلة جزاء', 'هدف من ضربة جزاء', 'مسجلة']);
}

function addPenalty(totals: PenaltyTotals, status: 'scored' | 'missed' | 'unknown', example: string) {
  totals.total += 1;
  totals.sourceCount += 1;
  if (status === 'scored') totals.scored += 1;
  else if (status === 'missed') totals.missed += 1;
  else totals.unknown += 1;
  if (totals.examples.length < 8) totals.examples.push(example);
}

function penaltyStatusFromRawPenalty(penalty: any): 'scored' | 'missed' | 'unknown' {
  if (penalty?.scored === true) return 'scored';
  if (penalty?.scored === false) return 'missed';
  const type = String(penalty?.type || penalty?.result || penalty?.status || penalty?.outcome || '').toLowerCase();
  if (textIncludesAny(type, ['scored', 'converted', 'goal'])) return 'scored';
  if (textIncludesAny(type, ['miss', 'saved', 'failed', 'off target'])) return 'missed';
  return 'unknown';
}

function penaltyStatusFromGoal(goal: any): 'scored' | 'missed' | 'unknown' | null {
  const type = String(goal?.type || goal?.detail || '').toUpperCase();
  if (!type.includes('PENALTY')) return null;
  if (type.includes('MISSED') || type.includes('SAVED')) return 'missed';
  return 'scored';
}

function goalScorerName(goal: any) {
  return String(goal?.scorer?.name || goal?.player?.name || goal?.playerName || goal?.name || '').trim();
}

function penaltyPlayerName(penalty: any) {
  return String(penalty?.player?.name || penalty?.taker?.name || penalty?.scorer?.name || penalty?.playerName || penalty?.name || '').trim();
}

function matchLabel(rawData: any) {
  const home = rawData?.teams?.home?.localName || rawData?.teams?.home?.provider?.name || rawData?.homeTeam?.name || 'Home';
  const away = rawData?.teams?.away?.localName || rawData?.teams?.away?.provider?.name || rawData?.awayTeam?.name || 'Away';
  return `${home} vs ${away}`;
}

function rawPenaltyTotals(rawData: any, matchId: string, totals: PenaltyTotals) {
  let found = 0;
  for (const goal of safeArray(rawData?.goals)) {
    const status = penaltyStatusFromGoal(goal);
    if (!status) continue;
    found += 1;
    const name = goalScorerName(goal);
    addPenalty(totals, status, `${matchLabel(rawData)}${name ? ` — ${name}` : ''} (${matchId})`);
  }

  for (const penalty of safeArray(rawData?.penalties)) {
    found += 1;
    const status = penaltyStatusFromRawPenalty(penalty);
    const name = penaltyPlayerName(penalty);
    addPenalty(totals, status, `${matchLabel(rawData)}${name ? ` — ${name}` : ''} (${matchId})`);
  }
  return found;
}

export async function GET() {
  try {
    const latestSnapshots = await prisma.matchStatsSnapshot.findMany({
      where: { provider: { in: ['FOOTBALL_DATA_FULL', 'THE_STATS_API'] } },
      select: { matchId: true, provider: true, rawData: true, capturedAt: true },
      orderBy: { capturedAt: 'desc' },
      take: 500,
    });

    const totals: PenaltyTotals = { total: 0, scored: 0, missed: 0, unknown: 0, sourceCount: 0, examples: [] };
    const seenSnapshotMatches = new Set<string>();
    const matchesWithRawPenaltyData = new Set<string>();
    let rawPenaltyMatches = 0;
    let latestRawUpdatedAt: string | null = null;

    for (const snapshot of latestSnapshots) {
      if (seenSnapshotMatches.has(snapshot.matchId)) continue;
      seenSnapshotMatches.add(snapshot.matchId);
      const rawData = snapshot.rawData as any;
      const found = rawPenaltyTotals(rawData, snapshot.matchId, totals);
      if (found > 0) {
        rawPenaltyMatches += 1;
        matchesWithRawPenaltyData.add(snapshot.matchId);
        const updatedAt = snapshot.capturedAt instanceof Date ? snapshot.capturedAt.toISOString() : String(snapshot.capturedAt || '');
        if (updatedAt && (!latestRawUpdatedAt || updatedAt > latestRawUpdatedAt)) latestRawUpdatedAt = updatedAt;
      }
    }

    const events = await prisma.matchEvent.findMany({
      where: {
        playerName: { not: null },
        matchId: { notIn: Array.from(matchesWithRawPenaltyData) },
        OR: [
          { type: { in: ['penalty_goal', 'penalty_scored', 'penalty_missed', 'penalty'] } },
          { detail: { contains: 'جزاء', mode: 'insensitive' } },
          { detail: { contains: 'penalty', mode: 'insensitive' } },
        ],
      },
      select: {
        matchId: true,
        minute: true,
        type: true,
        detail: true,
        playerName: true,
        sourceName: true,
        sourceUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ matchId: 'asc' }, { minute: 'asc' }],
      take: 500,
    });

    let eventPenaltyTotal = 0;
    let latestEventUpdatedAt: string | null = null;
    const seenEvents = new Set<string>();

    for (const event of events) {
      if (!isPenaltyText(event.type, event.detail)) continue;
      const key = `${event.matchId}:${event.minute || ''}:${normalizeText(event.type)}:${normalizeText(event.playerName)}:${normalizeText(event.detail)}`;
      if (seenEvents.has(key)) continue;
      seenEvents.add(key);
      eventPenaltyTotal += 1;
      const status = isScoredPenaltyText(event.type, event.detail) ? 'scored' : isMissedPenaltyText(event.type, event.detail) ? 'missed' : 'unknown';
      addPenalty(totals, status, `${event.playerName || 'غير محدد'} — ${event.detail || event.type} (${event.matchId})`);
      const updatedAt = event.updatedAt instanceof Date ? event.updatedAt.toISOString() : event.createdAt instanceof Date ? event.createdAt.toISOString() : '';
      if (updatedAt && (!latestEventUpdatedAt || updatedAt > latestEventUpdatedAt)) latestEventUpdatedAt = updatedAt;
    }

    const provider = rawPenaltyMatches > 0 ? 'FOOTBALL_DATA_FULL' : eventPenaltyTotal > 0 ? 'MatchEvent' : 'FOOTBALL_DATA_FULL';
    const source = rawPenaltyMatches > 0 ? 'MatchStatsSnapshot.rawData.penalties_goals' : eventPenaltyTotal > 0 ? 'MatchEvent.penalty_events' : 'no_penalty_data_found';

    return NextResponse.json({
      ok: true,
      provider,
      source,
      available: totals.total > 0,
      penalties: {
        available: totals.total > 0,
        total: totals.total,
        scored: totals.scored,
        missed: totals.missed,
        unknown: totals.unknown,
        source: provider,
        sourcePath: source,
      },
      sourceStats: {
        rawPenaltyMatches,
        eventPenaltyTotal,
        rawSnapshotMatchesChecked: seenSnapshotMatches.size,
        sourceCount: totals.sourceCount,
      },
      examples: totals.examples,
      latestUpdatedAt: [latestRawUpdatedAt, latestEventUpdatedAt].filter(Boolean).sort().pop() || null,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('penalties-summary endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
