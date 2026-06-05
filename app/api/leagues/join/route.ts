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

    const userId = (session.user as any).id;
    const { inviteCode } = await request.json();

    if (!inviteCode || inviteCode.trim().length === 0) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Find the league
    const league = await prisma.league.findUnique({
      where: { inviteCode: inviteCode.trim().toUpperCase() }
    });

    if (!league) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId: league.id,
          userId: userId
        }
      }
    });

    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this league' }, { status: 400 });
    }

    // Add user to league
    await prisma.leagueMember.create({
      data: {
        leagueId: league.id,
        userId: userId
      }
    });

    return NextResponse.json({ success: true, leagueId: league.id });
  } catch (error) {
    console.error('Error joining league:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
