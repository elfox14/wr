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

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function matchStatusLabel(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'IN_PLAY' || value === 'LIVE' || value === 'HT') return 'مباشر الآن';
  if (value === 'FINISHED') return 'انتهت';
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
        "matchId", "homeScore", "awayScore", "capturedAt"
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 6), 60);
    const now = new Date();
    const liveWindowStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const liveWindowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const finishedWindowStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    const eventsWindowStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const upcomingWindow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const [liveMatches, finishedMatches, upcomingMatches, recentEvents] = await Promise.all([
      prisma.match.findMany({
        where: {
          status: { in: ['IN_PLAY', 'LIVE', 'HT'] },
          matchDate: { gte: liveWindowStart, lte: liveWindowEnd },
        },
        orderBy: { matchDate: 'asc' },
        take: 8,
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findMany({
        where: {
          status: 'FINISHED',
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
      ...liveMatches,
      ...finishedMatches,
      ...recentEvents.map((event) => event.match).filter(Boolean),
    ].map((match: any) => match.id);
    const scoreSnapshots = await fetchLatestScoreSnapshots(Array.from(new Set(relatedMatchIds)));
    const items: TickerItem[] = [];

    for (const match of liveMatches) {
      items.push({
        id: `match-live-${match.id}`,
        type: 'MATCH_EVENT',
        title: `${matchStatusLabel(match.status)}: ${matchTitle(match, scoreSnapshots.get(match.id))}`,
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
      items.push({
        id: `match-finished-${match.id}`,
        type: 'MATCH_EVENT',
        title: `${matchStatusLabel(match.status)}: ${matchTitle(match, scoreSnapshots.get(match.id))}`,
        matchId: match.id,
        href: animationHref(match),
        timestamp: now.toISOString(),
        source: 'finished_match',
        priority: 80,
      });
    }

    for (const match of upcomingMatches) {
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
      responseMode: 'matches_only',
      scoreSource: 'latest_snapshot_then_match',
      counts: {
        live: liveMatches.length,
        events: recentEvents.length,
        finished: finishedMatches.length,
        upcoming: upcomingMatches.length,
      },
      items: (sortedItems.length ? sortedItems : fallbackMatchItems(now)).slice(0, limit).map(stripInternalFields),
    }, { headers: noStoreHeaders });
  } catch (error: any) {
    console.error('Live ticker error:', error);
    const now = new Date();
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch live ticker',
      responseMode: 'matches_only',
      items: fallbackMatchItems(now).map(stripInternalFields),
    }, { status: 200, headers: noStoreHeaders });
  }
}
