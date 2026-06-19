import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TickerItem = {
  id: string;
  type: 'MATCH_EVENT' | 'FALLBACK';
  title: string;
  body?: string;
  matchId?: string;
  href?: string;
  timestamp: string;
  source: 'live_match' | 'finished_match' | 'upcoming_match' | 'match_event' | 'fallback';
  priority: number;
};

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT', '1H', '2H', 'ET'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const FINAL_MINUTE_FALLBACK = 120;

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isFinalMinute(minute: number | null) {
  return minute !== null && minute >= FINAL_MINUTE_FALLBACK;
}

function normalizeStatus(status?: string | null, minute?: number | null) {
  const value = String(status || '').toUpperCase();
  if (FINISHED_STATUSES.includes(value) || value === '-1' || value === '4') return 'FINISHED';
  if (isFinalMinute(minute ?? null) && !['ET', 'AET', 'P', 'PEN', '5'].includes(value)) return 'FINISHED';
  if (value === '1H' || value === '2H' || value === 'ET' || value === 'IN_PLAY' || value === 'LIVE') return 'IN_PLAY';
  if (value === 'HT' || value === 'HALFTIME' || value === 'HALF_TIME' || value === 'HALF-TIME') return 'HT';
  return value || 'SCHEDULED';
}

function matchStatusLabel(status?: string | null, scoreSnapshot?: any) {
  const snapshotMinute = nullableNumber(scoreSnapshot?.minute);
  const value = normalizeStatus(status, snapshotMinute);
  if (value === 'FINISHED') return 'انتهت';
  if (value === 'HT') return 'استراحة';
  if (value === 'IN_PLAY') return 'مباشر الآن';
  const snapshotScore = (nullableNumber(scoreSnapshot?.homeScore) || 0) + (nullableNumber(scoreSnapshot?.awayScore) || 0);
  if (snapshotMinute !== null || snapshotScore > 0) return 'مباشر الآن';
  return 'قادمة';
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function scoreLabel(match: any, scoreSnapshot?: any) {
  const homeScore = nullableNumber(scoreSnapshot?.homeScore) ?? nullableNumber(match.homeScore) ?? 0;
  const awayScore = nullableNumber(scoreSnapshot?.awayScore) ?? nullableNumber(match.awayScore) ?? 0;
  return `${homeScore} - ${awayScore}`;
}

function matchTitle(match: any, scoreSnapshot?: any) {
  return `${match.homeTeam?.name || 'الفريق الأول'} ${scoreLabel(match, scoreSnapshot)} ${match.awayTeam?.name || 'الفريق الثاني'}`;
}

function animationHref(match: any) {
  const id = match?.animationMatchId;
  return id ? `/animation-live/player?matchId=${encodeURIComponent(String(id))}&lang=en&statsPanel=simple&teamPanel=1` : '/animation-live';
}

function eventLabel(event: any) {
  const type = String(event?.type || '').toLowerCase();
  if (type.includes('goal')) return 'هدف';
  if (type.includes('card') || type.includes('yellow') || type.includes('red')) return 'بطاقة';
  if (type.includes('sub')) return 'تبديل';
  if (type.includes('var')) return 'VAR';
  return 'حدث مباراة';
}

function eventTitle(event: any, scoreSnapshot?: any) {
  const minute = event?.minute ? `د${event.minute} — ` : '';
  const match = event?.match;
  const score = match ? matchTitle(match, scoreSnapshot) : '';
  const detail = event?.detail || eventLabel(event);
  const player = event?.playerName ? ` — ${event.playerName}` : '';
  return `${minute}${eventLabel(event)}: ${detail}${player}${score ? ` — ${score}` : ''}`;
}

async function fetchLatestScoreSnapshots(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, any>();
  try {
    const idList = matchIds.map(quoteSql).join(',');
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ON ("matchId")
        "matchId", "homeScore", "awayScore", "minute", "capturedAt"
      FROM "MatchStatsSnapshot"
      WHERE "matchId" IN (${idList})
      ORDER BY "matchId", "capturedAt" DESC
    `);
    return new Map(rows.map((row) => [row.matchId, row]));
  } catch (error: any) {
    if (!String(error?.message || '').includes('MatchStatsSnapshot')) {
      console.warn('live ticker score snapshot lookup failed:', error?.message || error);
    }
    return new Map<string, any>();
  }
}

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

function sortTickerItems(items: TickerItem[]) {
  return items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function stripInternalFields(item: TickerItem) {
  const { priority, ...publicItem } = item;
  return publicItem;
}

function fallbackMatchItems(now: Date): TickerItem[] {
  return [
    {
      id: 'fallback-match-1',
      type: 'FALLBACK',
      title: 'شريط المباريات يعرض الأهداف، الأحداث، والنتائج فقط.',
      href: '/animation-live',
      timestamp: now.toISOString(),
      source: 'fallback',
      priority: 1,
    },
    {
      id: 'fallback-match-2',
      type: 'FALLBACK',
      title: 'لا توجد أحداث مباشرة متاحة الآن — تابع بث الانيميشن عند بدء المباريات.',
      href: '/animation-live',
      timestamp: now.toISOString(),
      source: 'fallback',
      priority: 1,
    },
  ];
}

function hasLiveEvidence(match: any, scoreSnapshot: any, now: Date) {
  const snapshotMinute = nullableNumber(scoreSnapshot?.minute);
  const status = normalizeStatus(match.status, snapshotMinute);
  if (status === 'FINISHED') return false;
  if (isFinalMinute(snapshotMinute)) return false;
  if (status === 'IN_PLAY' || status === 'HT') return true;
  const snapshotScore = (nullableNumber(scoreSnapshot?.homeScore) || 0) + (nullableNumber(scoreSnapshot?.awayScore) || 0);
  if (snapshotMinute !== null || snapshotScore > 0) return true;
  const start = new Date(match.matchDate || '').getTime();
  return Number.isFinite(start) && now.getTime() >= start && now.getTime() <= start + 150 * 60_000;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 6), 60);
    const now = new Date();
    const liveWindowStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const liveWindowEnd = new Date(now.getTime() + 15 * 60 * 1000);
    const finishedWindowStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    const eventsWindowStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const upcomingWindow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const [liveMatchCandidates, finishedMatches, upcomingMatches, recentEvents] = await Promise.all([
      prisma.match.findMany({
        where: {
          OR: [
            { status: { in: LIVE_STATUSES } },
            { status: { notIn: FINISHED_STATUSES }, matchDate: { gte: liveWindowStart, lte: liveWindowEnd } },
          ],
        },
        orderBy: { matchDate: 'asc' },
        take: 12,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({
        where: {
          status: { in: FINISHED_STATUSES },
          matchDate: { gte: finishedWindowStart, lte: now },
        },
        orderBy: { matchDate: 'desc' },
        take: 8,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({
        where: {
          status: 'SCHEDULED',
          matchDate: { gte: now, lte: upcomingWindow },
        },
        orderBy: { matchDate: 'asc' },
        take: 8,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.matchEvent.findMany({
        where: { createdAt: { gte: eventsWindowStart } },
        orderBy: [{ minute: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        include: { match: { include: { homeTeam: true, awayTeam: true } } },
      }),
    ]);

    const relatedMatchIds = [
      ...liveMatchCandidates,
      ...finishedMatches,
      ...recentEvents.map((event) => event.match).filter(Boolean),
    ].map((match: any) => match.id);
    const scoreSnapshots = await fetchLatestScoreSnapshots(Array.from(new Set(relatedMatchIds)));
    const liveMatches = liveMatchCandidates.filter((match) => hasLiveEvidence(match, scoreSnapshots.get(match.id), now));
    const liveMatchIdSet = new Set(liveMatches.map((match) => match.id));
    const items: TickerItem[] = [];

    for (const match of liveMatches) {
      const scoreSnapshot = scoreSnapshots.get(match.id);
      items.push({
        id: `match-live-${match.id}`,
        type: 'MATCH_EVENT',
        title: `${matchStatusLabel(match.status, scoreSnapshot)}: ${matchTitle(match, scoreSnapshot)}`,
        matchId: match.id,
        href: animationHref(match),
        timestamp: now.toISOString(),
        source: 'live_match',
        priority: 100,
      });
    }

    for (const event of recentEvents) {
      const match = event.match;
      items.push({
        id: `match-event-${event.id}`,
        type: 'MATCH_EVENT',
        title: eventTitle(event, match ? scoreSnapshots.get(match.id) : null),
        body: event.detail,
        matchId: event.matchId,
        href: match ? animationHref(match) : '/animation-live',
        timestamp: (event.updatedAt || event.createdAt || now).toISOString(),
        source: 'match_event',
        priority: String(event.type || '').toLowerCase().includes('goal') ? 95 : 85,
      });
    }

    for (const match of finishedMatches) {
      if (liveMatchIdSet.has(match.id)) continue;
      items.push({
        id: `match-finished-${match.id}`,
        type: 'MATCH_EVENT',
        title: `${matchStatusLabel(match.status, scoreSnapshots.get(match.id))}: ${matchTitle(match, scoreSnapshots.get(match.id))}`,
        matchId: match.id,
        href: animationHref(match),
        timestamp: now.toISOString(),
        source: 'finished_match',
        priority: 80,
      });
    }

    for (const match of upcomingMatches) {
      if (liveMatchIdSet.has(match.id)) continue;
      items.push({
        id: `match-upcoming-${match.id}`,
        type: 'MATCH_EVENT',
        title: `مباراة قريبة: ${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'} — ${new Date(match.matchDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
        matchId: match.id,
        href: animationHref(match),
        timestamp: match.matchDate.toISOString(),
        source: 'upcoming_match',
        priority: 40,
      });
    }

    const sortedItems = sortTickerItems(items);
    return NextResponse.json({
      success: true,
      updatedAt: now.toISOString(),
      count: sortedItems.length,
      items: (sortedItems.length ? sortedItems : fallbackMatchItems(now)).slice(0, limit).map(stripInternalFields),
    }, { headers: noStoreHeaders });
  } catch (error: any) {
    console.error('live ticker failed:', error);
    const now = new Date();
    return NextResponse.json({
      success: false,
      error: error?.message || 'live ticker unavailable',
      updatedAt: now.toISOString(),
      items: fallbackMatchItems(now).map(stripInternalFields),
    }, { status: 200, headers: noStoreHeaders });
  }
}
