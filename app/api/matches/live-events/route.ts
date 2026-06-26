import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toIso(value: any) {
  return value instanceof Date ? value.toISOString() : value || null;
}

const IMPORTANT_TYPES = [
  'goal',
  'yellow_card',
  'red_card',
  'corner',
  'dangerous_attack',
  'shot_on_target',
  'penalty',
  'var',
  'substitution',
];

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

function isFinishedStatus(status?: string | null) {
  return FINISHED_STATUSES.includes(String(status || '').toUpperCase());
}

function normalizeName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validMinute(value: unknown) {
  const minute = Number(value);
  return Number.isFinite(minute) && minute > 0 ? Math.floor(minute) : null;
}

function firstText(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && text !== '[object Object]') return text;
    }
    if (value && typeof value === 'object') {
      const nested = firstText(value.name, value.fullName, value.full_name, value.title, value.label, value.displayName, value.display_name);
      if (nested) return nested;
    }
  }
  return null;
}

function normalizeEventType(value: unknown) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('goal')) return 'goal';
  if (raw.includes('yellow')) return 'yellow_card';
  if (raw.includes('red')) return 'red_card';
  if (raw.includes('sub')) return 'substitution';
  if (raw.includes('penalty')) return 'penalty';
  if (raw.includes('corner')) return 'corner';
  if (raw.includes('shot')) return 'shot';
  if (raw.includes('var')) return 'var';
  return firstText(value) || 'event';
}

function wasEventSavedDuringFirstHalf(event: any, matchDate?: Date | string | null) {
  const kickoff = matchDate ? new Date(matchDate).getTime() : NaN;
  const created = event?.createdAt ? new Date(event.createdAt).getTime() : NaN;
  if (!Number.isFinite(kickoff) || !Number.isFinite(created)) return false;
  const diff = created - kickoff;
  return diff >= 0 && diff <= 65 * 60 * 1000;
}

function eventMinuteLabel(event: any, matchDate?: Date | string | null) {
  const minute = validMinute(event?.minute);
  if (!minute) return null;
  const detail = String(event?.detail || '').toLowerCase();
  const explicitStoppage = detail.match(/45\s*\+\s*(\d{1,2})/);
  if (explicitStoppage) return `45+${Number(explicitStoppage[1])}`;
  const firstHalfHint = /الشوط\s*الأول|first\s*half|1h/.test(detail);
  const secondHalfHint = /الشوط\s*الثاني|second\s*half|2h/.test(detail);
  const firstHalfByTime = wasEventSavedDuringFirstHalf(event, matchDate);
  if (minute > 45 && minute < 60 && !secondHalfHint && (firstHalfHint || firstHalfByTime)) return `45+${minute - 45}`;
  return String(minute);
}

async function getPlayerAssetsForEvents(events: any[]) {
  const playerIds = [...new Set(events.map((event) => String(event.playerId || '').trim()).filter(Boolean))];
  const playerNames = [...new Set(events.map((event) => String(event.playerName || '').trim()).filter(Boolean))];
  if (!playerIds.length && !playerNames.length) return new Map<string, any>();

  const where: any[] = [];
  if (playerIds.length) where.push({ id: { in: playerIds } });
  if (playerNames.length) where.push({ name: { in: playerNames } });

  const assets = await prisma.asset.findMany({
    where: { OR: where },
    select: { id: true, name: true, code: true, image: true, teamId: true, type: true, position: true },
    take: 200,
  });

  const map = new Map<string, any>();
  for (const asset of assets) {
    if (asset.id) map.set(`id:${asset.id}`, asset);
    if (asset.name) map.set(`name:${normalizeName(asset.name)}`, asset);
  }
  return map;
}

function snapshotEvents(snapshot: any) {
  const normalized = snapshot?.rawData?.normalized || {};
  const events = normalized?.eventsDetailed?.all;
  return Array.isArray(events) ? events : [];
}

function teamIdFromEvent(match: any, event: any) {
  const providerTeamId = firstText(event?.providerTeamId, event?.teamId, event?.team?.id);
  if (providerTeamId && String(providerTeamId) === String(match.homeTeamId)) return match.homeTeamId;
  if (providerTeamId && String(providerTeamId) === String(match.awayTeamId)) return match.awayTeamId;

  const teamName = normalizeName(firstText(event?.teamName, event?.team, event?.team_name, event?.teamName));
  const homeName = normalizeName(match.homeTeam?.name || match.homeTeam?.code || '');
  const awayName = normalizeName(match.awayTeam?.name || match.awayTeam?.code || '');
  const homeCode = normalizeName(match.homeTeam?.code || '');
  const awayCode = normalizeName(match.awayTeam?.code || '');

  if (teamName && (teamName === homeName || teamName.includes(homeName) || homeName.includes(teamName) || teamName === homeCode)) return match.homeTeamId;
  if (teamName && (teamName === awayName || teamName.includes(awayName) || awayName.includes(teamName) || teamName === awayCode)) return match.awayTeamId;
  return null;
}

function normalizeSnapshotEvent(event: any, index: number, match: any, snapshot: any) {
  const player = event?.player || event?.athlete || event?.scorer || {};
  const minute = validMinute(event?.minute ?? event?.time?.minute ?? event?.elapsed ?? event?.match_minute ?? event?.event_minute);
  const type = normalizeEventType(firstText(event?.type, event?.event_type, event?.incident_type, event?.name));
  const detail = firstText(event?.detail, event?.description, event?.comment, event?.text, event?.message, event?.assistName);
  const playerId = firstText(event?.playerId, event?.player_id, event?.player?.id, player?.id);
  const playerName = firstText(event?.playerName, event?.player_name, event?.playerName, player?.name, event?.scorer?.name);

  return {
    id: `thestats:${snapshot.id}:${index}`,
    minute,
    minuteLabel: minute ? String(minute) : null,
    type,
    teamId: teamIdFromEvent(match, event),
    playerId,
    playerName,
    playerImage: null,
    playerAsset: null,
    detail: detail || type,
    sourceName: null,
    createdAt: toIso(snapshot.capturedAt),
    updatedAt: toIso(snapshot.capturedAt),
    finalSource: 'the_stats_snapshot',
  };
}

function dedupeEvents(events: any[]) {
  const seen = new Set<string>();
  const out = [];
  for (const event of events) {
    const key = [
      event.minute ?? '',
      normalizeEventType(event.type),
      normalizeName(event.teamId || ''),
      normalizeName(event.playerName || ''),
      normalizeName(event.detail || ''),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

function sortEventsDesc(a: any, b: any) {
  const ma = Number(a.minute || 0);
  const mb = Number(b.minute || 0);
  if (mb !== ma) return mb - ma;
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerMatchId = Number(searchParams.get('matchId') || searchParams.get('animationMatchId') || 0);
    const dbMatchId = searchParams.get('dbMatchId') || searchParams.get('id') || '';
    const preferFinal = !['0', 'false', 'no'].includes(String(searchParams.get('preferFinal') || 'true').toLowerCase());

    if (!providerMatchId && !dbMatchId) {
      return NextResponse.json({ ok: false, error: 'matchId or dbMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const match = await prisma.match.findFirst({
      where: dbMatchId ? { id: dbMatchId } : { animationMatchId: providerMatchId },
      select: {
        id: true,
        animationMatchId: true,
        status: true,
        matchDate: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { id: true, name: true, code: true, image: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ ok: false, linkedInDatabase: false, error: 'Match is not linked in database yet.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const dbEvents = await prisma.matchEvent.findMany({
      where: {
        matchId: match.id,
        OR: [
          { type: { in: IMPORTANT_TYPES } },
          { type: { contains: 'goal' } },
          { type: { contains: 'card' } },
          { type: { contains: 'corner' } },
          { type: { contains: 'danger' } },
          { type: { contains: 'shot' } },
        ],
      },
      orderBy: [{ minute: 'desc' }, { createdAt: 'desc' }],
      take: 80,
    });

    let finalSnapshot: any = null;
    let finalEvents: any[] = [];
    if (preferFinal && isFinishedStatus(match.status)) {
      finalSnapshot = await prisma.matchStatsSnapshot.findFirst({
        where: {
          matchId: match.id,
          provider: { startsWith: 'THE_STATS_API' },
        },
        orderBy: { capturedAt: 'desc' },
        select: { id: true, provider: true, capturedAt: true, rawData: true },
      });

      finalEvents = dedupeEvents(
        snapshotEvents(finalSnapshot)
          .map((event, index) => normalizeSnapshotEvent(event, index, match, finalSnapshot))
          .filter((event) => event.minute || event.type),
      ).sort(sortEventsDesc).slice(0, 120);
    }

    const useFinalEvents = finalEvents.length > 0;
    const events = useFinalEvents ? finalEvents : dbEvents;
    const playerAssets = await getPlayerAssetsForEvents(events);

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      pollingSeconds: isFinishedStatus(match.status) ? 300 : 30,
      eventSource: useFinalEvents ? 'THE_STATS_FINAL_SNAPSHOT' : 'MATCH_EVENT',
      finalSnapshot: finalSnapshot ? { id: finalSnapshot.id, provider: finalSnapshot.provider, capturedAt: toIso(finalSnapshot.capturedAt), events: finalEvents.length } : null,
      match: {
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        matchDate: toIso(match.matchDate),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
      events: events.map((event: any) => {
        const playerAsset = event.playerId
          ? playerAssets.get(`id:${event.playerId}`)
          : event.playerName
            ? playerAssets.get(`name:${normalizeName(event.playerName)}`)
            : null;
        return {
          id: event.id,
          minute: event.minute,
          minuteLabel: event.minuteLabel || eventMinuteLabel(event, match.matchDate),
          type: event.type,
          teamId: event.teamId,
          playerId: event.playerId,
          playerName: event.playerName,
          playerImage: event.playerImage || playerAsset?.image || null,
          playerAsset: playerAsset ? {
            id: playerAsset.id,
            name: playerAsset.name,
            code: playerAsset.code,
            image: playerAsset.image,
            position: playerAsset.position,
            teamId: playerAsset.teamId,
          } : null,
          detail: event.detail,
          sourceName: null,
          createdAt: toIso(event.createdAt),
          updatedAt: toIso(event.updatedAt),
        };
      }),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('live-events endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
