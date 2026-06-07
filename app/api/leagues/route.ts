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

    // Get leagues user is a member of, along with all members' holdings to calculate ranks
    const userLeagues = await prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            members: {
              include: {
                user: {
                  include: {
                    holdings: {
                      include: {
                        asset: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const leagues = userLeagues.map(lm => {
      const league = lm.league;
      
      // Compute net worth for all members
      const membersData = league.members.map(m => {
        const u = m.user;
        let holdingsValue = 0;
        for (const h of u.holdings) {
          const marketPrice = Math.round(h.asset.marketPrice ?? h.asset.current_price);
          holdingsValue += h.quantity * marketPrice;
        }
        return {
          id: u.id,
          name: u.name || u.username,
          netWorth: u.balance + holdingsValue
        };
      });

      // Sort by net worth descending
      membersData.sort((a, b) => b.netWorth - a.netWorth);

      // Find current user's rank
      const myIndex = membersData.findIndex(m => m.id === userId);
      const myRank = myIndex !== -1 ? myIndex + 1 : null;
      const myNetWorth = myIndex !== -1 ? membersData[myIndex].netWorth : 0;
      
      // Top member
      const topMemberName = membersData.length > 0 ? membersData[0].name : null;

      return {
        id: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        memberCount: membersData.length,
        isCreator: league.creatorId === userId,
        myRank,
        myNetWorth,
        topMemberName
      };
    });

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
