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

function normalizeName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function validMinute(value: unknown) {
  const minute = Number(value);
  return Number.isFinite(minute) && minute > 0 ? Math.floor(minute) : null;
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerMatchId = Number(searchParams.get('matchId') || searchParams.get('animationMatchId') || 0);
    const dbMatchId = searchParams.get('dbMatchId') || searchParams.get('id') || '';

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

    const events = await prisma.matchEvent.findMany({
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

    const playerAssets = await getPlayerAssetsForEvents(events);

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      pollingSeconds: 30,
      match: {
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        matchDate: toIso(match.matchDate),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
      events: events.map((event) => {
        const playerAsset = event.playerId
          ? playerAssets.get(`id:${event.playerId}`)
          : event.playerName
            ? playerAssets.get(`name:${normalizeName(event.playerName)}`)
            : null;
        return {
          id: event.id,
          minute: event.minute,
          minuteLabel: eventMinuteLabel(event, match.matchDate),
          type: event.type,
          teamId: event.teamId,
          playerId: event.playerId,
          playerName: event.playerName,
          playerImage: playerAsset?.image || null,
          playerAsset: playerAsset ? {
            id: playerAsset.id,
            name: playerAsset.name,
            code: playerAsset.code,
            image: playerAsset.image,
            position: playerAsset.position,
            teamId: playerAsset.teamId,
          } : null,
          detail: event.detail,
          sourceName: event.sourceName,
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
