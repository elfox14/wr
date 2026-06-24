import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTeamVisualTheme } from '@/lib/teamVisualThemes';
import {
  animationEventLabel,
  inferLiveAnimationSpatial,
  normalizeAnimationEventType,
  type AnimationTeamSide,
} from '@/lib/liveAnimationSpatial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'BREAK'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];

function statusKind(status?: string | null) {
  const raw = String(status || '').toUpperCase();
  if (LIVE_STATUSES.includes(raw)) return 'live';
  if (raw === 'HT') return 'halftime';
  if (FINISHED_STATUSES.includes(raw)) return 'finished';
  return 'scheduled';
}

function safeNumber(value: any, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function eventIcon(type: string) {
  const key = String(type || '').toLowerCase();
  if (key.includes('goal')) return '⚽';
  if (key.includes('yellow')) return '🟨';
  if (key.includes('red')) return '🟥';
  if (key.includes('sub')) return '🔁';
  if (key.includes('shot')) return '🎯';
  if (key.includes('corner')) return '🚩';
  if (key.includes('penalty')) return '🥅';
  if (key.includes('var')) return '📺';
  if (key.includes('foul')) return '✋';
  return '●';
}

function eventColor(type: string) {
  const key = String(type || '').toLowerCase();
  if (key.includes('goal')) return '#F8C846';
  if (key.includes('yellow')) return '#F8C846';
  if (key.includes('red')) return '#FF5C5C';
  if (key.includes('sub')) return '#38BDF8';
  if (key.includes('shot')) return '#18E58F';
  if (key.includes('corner')) return '#A78BFA';
  return '#E5E7EB';
}

function sideFromTeam(teamId: string | null | undefined, homeTeamId: string, awayTeamId: string): AnimationTeamSide {
  if (teamId === homeTeamId) return 'home';
  if (teamId === awayTeamId) return 'away';
  return 'unknown';
}

function normalizeLiveRow(row: any, index: number, homeTeamId: string, awayTeamId: string) {
  const eventType = String(row?.eventType || row?.type || 'note');
  const teamSide = sideFromTeam(row?.teamId, homeTeamId, awayTeamId);
  const spatial = inferLiveAnimationSpatial({
    id: String(row?.id || `event-${index}`),
    type: eventType,
    detail: row?.detail || row?.eventLabel,
    minute: row?.minute,
    teamSide,
    index,
    explicitX: row?.x,
    explicitY: row?.y,
    explicitEndX: row?.endX,
    explicitEndY: row?.endY,
  });
  const x = row?.x === null || row?.x === undefined ? spatial.x : safeNumber(row.x, spatial.x);
  const y = row?.y === null || row?.y === undefined ? spatial.y : safeNumber(row.y, spatial.y);

  return {
    id: String(row?.id || `event-${index}`),
    sequenceNumber: safeNumber(row?.sequenceNumber, index + 1),
    minute: row?.minute === null || row?.minute === undefined ? null : safeNumber(row.minute, 0),
    second: row?.second === null || row?.second === undefined ? null : safeNumber(row.second, 0),
    teamId: row?.teamId || null,
    playerId: row?.playerId || null,
    playerName: row?.playerName || null,
    jerseyNumber: row?.jerseyNumber || null,
    eventType,
    eventLabel: row?.eventLabel || animationEventLabel(eventType),
    detail: row?.detail || row?.eventLabel || animationEventLabel(eventType),
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
    endX: row?.endX === null || row?.endX === undefined ? spatial.endX : Math.max(0, Math.min(100, safeNumber(row.endX, x))),
    endY: row?.endY === null || row?.endY === undefined ? spatial.endY : Math.max(0, Math.min(100, safeNumber(row.endY, y))),
    zone: row?.zone || spatial.zone,
    coordinateSource: row?.coordinateSource || spatial.coordinateSource,
    coordinateConfidence: row?.coordinateConfidence || spatial.coordinateConfidence,
    eventSide: row?.eventSide || spatial.eventSide,
    isInferred: row?.isInferred === null || row?.isInferred === undefined ? spatial.isInferred : Boolean(row.isInferred),
    anchorZone: row?.anchorZone || spatial.anchorZone,
    displayPriority: safeNumber(row?.displayPriority, spatial.displayPriority),
    provider: row?.provider || 'MATCH_EVENT_FALLBACK',
    icon: eventIcon(eventType),
    color: eventColor(eventType),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

async function readAnimationEvents(matchId: string, afterSeq: number, limit: number, homeTeamId: string, awayTeamId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "sequenceNumber",
        "minute",
        "second",
        "teamId",
        "playerId",
        "playerName",
        "jerseyNumber",
        "eventType",
        "eventLabel",
        "x",
        "y",
        "endX",
        "endY",
        "zone",
        "coordinateSource",
        "coordinateConfidence",
        "eventSide",
        "isInferred",
        "anchorZone",
        "displayPriority",
        "provider",
        "createdAt"
      FROM "LiveAnimationEvent"
      WHERE "matchId" = $1 AND "sequenceNumber" > $2
      ORDER BY "sequenceNumber" ASC
      LIMIT $3
    `, matchId, afterSeq, limit);

    if (rows.length) {
      return rows.map((row, index) => normalizeLiveRow(row, index, homeTeamId, awayTeamId));
    }
  } catch {
    // The spatial migration may not be applied yet. Fallback to MatchEvent keeps the UI useful.
  }

  const matchEvents = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  }).catch(() => [] as any[]);

  return matchEvents
    .map((event, index) => {
      const eventType = normalizeAnimationEventType(event.type, event.detail);
      return normalizeLiveRow({
        id: event.id,
        sequenceNumber: safeNumber(event.minute, index + 1) * 100 + index + 1,
        minute: event.minute,
        teamId: event.teamId,
        playerId: event.playerId,
        playerName: event.playerName,
        eventType,
        eventLabel: animationEventLabel(eventType),
        detail: event.detail,
        provider: event.sourceName || 'MATCH_EVENT_FALLBACK',
        createdAt: event.createdAt,
      }, index, homeTeamId, awayTeamId);
    })
    .filter((event) => event.sequenceNumber > afterSeq);
}

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(req.url);
  const afterSeq = Math.max(0, Math.floor(Number(url.searchParams.get('afterSeq') || 0)) || 0);
  const limit = Math.max(1, Math.min(80, Math.floor(Number(url.searchParams.get('limit') || 40)) || 40));

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, image: true } },
      awayTeam: { select: { id: true, name: true, code: true, image: true } },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
    },
  });

  if (!match) {
    return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const latestSnapshot = match.statsSnapshots?.[0] || null;
  const homeScore = latestSnapshot?.homeScore ?? match.homeScore;
  const awayScore = latestSnapshot?.awayScore ?? match.awayScore;
  const minute = latestSnapshot?.minute ?? null;
  const events = await readAnimationEvents(match.id, afterSeq, limit, match.homeTeam.id, match.awayTeam.id);
  const lastSequence = events.reduce((max, event) => Math.max(max, Number(event.sequenceNumber || 0)), afterSeq);
  const homeTheme = getTeamVisualTheme(match.homeTeam.code, match.homeTeam.name);
  const awayTheme = getTeamVisualTheme(match.awayTeam.code, match.awayTeam.name);

  return NextResponse.json({
    ok: true,
    mode: 'db_only_live_animation_state',
    matchId: match.id,
    title: `${match.homeTeam.name} ضد ${match.awayTeam.name}`,
    phase: statusKind(match.status),
    status: match.status,
    minute,
    score: {
      home: safeNumber(homeScore, 0),
      away: safeNumber(awayScore, 0),
    },
    teams: {
      home: { ...match.homeTeam, theme: homeTheme },
      away: { ...match.awayTeam, theme: awayTheme },
    },
    visualTheme: {
      home: homeTheme,
      away: awayTheme,
    },
    lastSequence,
    events,
    source: events.some((event) => event.provider !== 'MATCH_EVENT_FALLBACK') ? 'LiveAnimationEvent' : 'MatchEvent fallback',
    lastUpdatedAt: latestSnapshot?.capturedAt ? latestSnapshot.capturedAt.toISOString() : new Date().toISOString(),
    note: 'This endpoint reads saved database state only. It never fetches external providers.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
