import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({
      include: {
        priceHistory: {
          orderBy: { timestamp: 'asc' },
        },
        players: true
      }
    });

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
