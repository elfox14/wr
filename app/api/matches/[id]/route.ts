import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const matchId = resolvedParams.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          include: {
            players: true
          }
        },
        awayTeam: {
          include: {
            players: true
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json(match);
  } catch (error) {
    console.error('Error fetching match details:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
