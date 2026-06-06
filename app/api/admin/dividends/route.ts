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

    // Verify Admin Role
    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { assetId, amountPerShare, reason } = await request.json();

    if (!assetId || !amountPerShare || amountPerShare <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Find all users holding this asset (LONG positions only)
    const holdings = await prisma.holding.findMany({
      where: { assetId, quantity: { gt: 0 } },
      include: { user: { include: { captain: true } } }
    });

    let totalPaid = 0;
    let usersPaid = 0;

    await prisma.$transaction(async (tx) => {
      for (const holding of holdings) {
        let payout = holding.quantity * amountPerShare;

        // Apply Captaincy Multiplier
        const isCaptain = holding.user.captain?.assetId === asset.id;
        if (isCaptain) {
          payout *= 2; // Captain earns double dividends
        }

        // Add to user balance
        await tx.user.update({
          where: { id: holding.userId },
          data: { balance: { increment: payout } }
        });

        // Create Notification
        await tx.notification.create({
          data: {
            userId: holding.userId,
            title: 'توزيعات أرباح نقدية 💰',
            message: `حصلت على ${payout} عملة أرباح نقدية لامتلاكك ${holding.quantity} سهم من ${asset.name}${isCaptain ? ' (مضاعفة الكابتن x2)' : ''} بسبب: ${reason}`,
            type: 'SUCCESS'
          }
        });

        totalPaid += payout;
        usersPaid++;
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Dividends distributed to ${usersPaid} users. Total paid: ${totalPaid} coins.` 
    });

  } catch (error) {
    console.error('Dividends error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
