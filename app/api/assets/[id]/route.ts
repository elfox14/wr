import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        marketNews: {
          orderBy: { publishedAt: 'desc' }
        },
        priceHistory: {
          orderBy: { timestamp: 'asc' }
        },
        team: true,
        players: true
      }
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
