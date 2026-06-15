import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const teams = await prisma.asset.findMany({
      where: { type: 'TEAM' },
      select: {
        id: true,
        name: true,
        code: true,
        apiFootballId: true,
        _count: {
          select: {
            // Check if there are any relations we can count
            performances: true
          }
        }
      }
    });

    const playerCount = await prisma.asset.count({
      where: { type: 'PLAYER' }
    });

    return NextResponse.json({
      ok: true,
      playerCount,
      teamsCount: teams.length,
      teams
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
