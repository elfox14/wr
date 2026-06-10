import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({
      orderBy: [
        { type: 'desc' }, // TEAM before PLAYER so national teams are visible first in market screens.
        { score: 'desc' },
        { marketPrice: 'desc' },
      ],
      include: {
        priceHistory: {
          orderBy: { timestamp: 'asc' },
        },
        players: true,
      },
    });

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
