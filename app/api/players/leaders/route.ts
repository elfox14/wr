import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LeaderMetric = 'goals' | 'assists';

type LeaderRow = {
  player: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    teamId: string | null;
    team: {
      id: string;
      name: string;
      code: string | null;
      image: string | null;
    } | null;
  };
  value: number;
};

function topLeader(rows: any[], metric: LeaderMetric): LeaderRow | null {
  const map = new Map<string, LeaderRow>();

  rows.forEach((row) => {
    if (!row?.asset?.id) return;
    const value = Number(row?.[metric] || 0);
    if (!Number.isFinite(value) || value <= 0) return;

    const current = map.get(row.asset.id) || { player: row.asset, value: 0 };
    current.value += value;
    map.set(row.asset.id, current);
  });

  return Array.from(map.values()).sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'ar'))[0] || null;
}

function publicLeader(row: LeaderRow | null) {
  if (!row) return null;
  return {
    id: row.player.id,
    name: row.player.name,
    code: row.player.code,
    image: row.player.image,
    teamId: row.player.teamId,
    team: row.player.team,
    value: row.value,
  };
}

export async function GET() {
  try {
    const rows = await prisma.playerPerformance.findMany({
      where: { OR: [{ goals: { gt: 0 } }, { assists: { gt: 0 } }] },
      select: {
        goals: true,
        assists: true,
        asset: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
            teamId: true,
            team: { select: { id: true, name: true, code: true, image: true } },
          },
        },
      },
    });

    const topScorer = topLeader(rows, 'goals');
    const topAssister = topLeader(rows, 'assists');

    return NextResponse.json({
      ok: true,
      source: 'database_player_performance',
      refreshSeconds: 60,
      updatedAt: new Date().toISOString(),
      leaders: {
        topScorer: publicLeader(topScorer),
        topAssister: publicLeader(topAssister),
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('players leaders endpoint error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
