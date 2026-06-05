import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const news = await prisma.marketNews.findMany({
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        asset: {
          select: {
            name: true,
            code: true,
            image: true
          }
        }
      }
    });

    return NextResponse.json(news);
  } catch (error: any) {
    console.error('Fetch Market News Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
