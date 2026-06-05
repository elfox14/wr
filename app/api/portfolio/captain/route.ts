import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId } = await request.json();

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const asset = await prisma.asset.findUnique({ where: { id: assetId, type: 'PLAYER' } });
    if (!asset) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Must hold the asset to make them captain
    const holding = await prisma.holding.findFirst({
      where: { userId: user.id, assetId: asset.id, quantity: { gt: 0 } }
    });

    if (!holding) {
      return NextResponse.json({ error: 'You must own shares of this player to make them Captain' }, { status: 400 });
    }

    // Upsert CaptainSelection
    await prisma.captainSelection.upsert({
      where: { userId: user.id },
      update: { assetId: asset.id, createdAt: new Date() },
      create: { userId: user.id, assetId: asset.id }
    });

    return NextResponse.json({ success: true, message: `تم تعيين ${asset.name} ككابتن لمحفظتك! ستتضاعف أرباحه x2.` });

  } catch (error) {
    console.error('Captaincy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
