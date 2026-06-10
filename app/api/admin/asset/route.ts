import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.email !== 'worldcup@mcprim.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, name, code, image, current_price, teamId } = await request.json();

    if (!name || !code || !current_price || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const price = parseInt(current_price, 10);
    const id = type === 'PLAYER' && teamId 
      ? `player-${teamId.replace('team-', '')}-${code.toLowerCase()}`
      : `${type.toLowerCase()}-${code.toLowerCase()}`;

    // Check if exists
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (existing) {
      return NextResponse.json({ error: 'Asset with this code already exists' }, { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: {
        id,
        type,
        name,
        code,
        image: image || '⚽',
        teamId: type === 'PLAYER' ? teamId : undefined,
        current_price: price,
        high_price: price,
        low_price: price,
        market_cap: '100M',
        volume: '1M',
        change: 0,
        priceHistory: {
          create: { price }
        }
      }
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
