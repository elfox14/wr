import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      include: {
        asset: {
          select: {
            name: true,
            code: true,
            image: true,
            type: true,
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
