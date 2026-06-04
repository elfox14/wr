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

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const whereClause: any = { userId: (session.user as any).id };
    if (unreadOnly) {
      whereClause.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ids } = await request.json(); // Array of notification IDs to mark as read

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId: (session.user as any).id
      },
      data: { read: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
