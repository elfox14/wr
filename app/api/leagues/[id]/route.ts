import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const userId = (session.user as any).id;
    const leagueId = resolvedParams.id;

    // Verify membership
    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get league details with members
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
                total_profit: true
              }
            }
          }
        }
      }
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Sort members by profit descending
    const leaderboard = league.members.map(m => m.user).sort((a, b) => b.total_profit - a.total_profit);

    return NextResponse.json({
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      creatorId: league.creatorId,
      createdAt: league.createdAt,
      leaderboard
    });
  } catch (error) {
    console.error('Error fetching league details:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
