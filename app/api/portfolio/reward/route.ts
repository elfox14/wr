import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // In a real app, you would verify the user session and validate the ad completion token
    // For this prototype, we'll assume the user is "user-1" and add 500 coins.

    const userId = "user-1";

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: 500
        }
      }
    });

    return NextResponse.json({ success: true, balance: user.balance });
  } catch (error) {
    console.error('Error granting reward:', error);
    return NextResponse.json({ error: 'Failed to grant reward' }, { status: 500 });
  }
}
