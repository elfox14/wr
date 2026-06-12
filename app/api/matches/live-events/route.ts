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
      select: { id: true, animationMatchId: true, status: true },
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
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      pollingSeconds: 30,
      match: {
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
      },
      events: events.map((event) => ({
        id: event.id,
        minute: event.minute,
        type: event.type,
        teamId: event.teamId,
        playerId: event.playerId,
        playerName: event.playerName,
        detail: event.detail,
        sourceName: event.sourceName,
        createdAt: toIso(event.createdAt),
        updatedAt: toIso(event.updatedAt),
      })),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('live-events endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
