import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      include: {
        homeTeam: true,
        awayTeam: true
      },
      orderBy: { matchDate: 'asc' }
    });

    return NextResponse.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
