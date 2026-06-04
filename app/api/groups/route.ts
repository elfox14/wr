import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Helper to generate a random code
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Get leagues user is a member of
    const userLeagues = await prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            _count: {
              select: { members: true }
            }
          }
        }
      }
    });

    const leagues = userLeagues.map(lm => ({
      id: lm.league.id,
      name: lm.league.name,
      inviteCode: lm.league.inviteCode,
      memberCount: lm.league._count.members,
      isCreator: lm.league.creatorId === userId
    }));

    return NextResponse.json(leagues);
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { name } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const inviteCode = generateInviteCode();

    // Create league and add creator as member
    const newLeague = await prisma.league.create({
      data: {
        name,
        inviteCode,
        creatorId: userId,
        members: {
          create: {
            userId
          }
        }
      }
    });

    return NextResponse.json(newLeague);
  } catch (error) {
    console.error('Error creating league:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
