import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { seedGroupCFbrefReports } from '@/lib/groupCFbrefStats';
import { seedTeamIntelligenceReports } from '@/lib/seedTeamIntelligenceReports';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

const GROUP_C_CODES = ['BRA', 'MAR', 'HAI', 'SCO'];

function hasValidSecret(request: Request) {
  const secret = process.env.ADMIN_CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret') || '';

  return bearerToken === secret || queryToken === secret;
}

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function isAuthorized(request: Request) {
  if (hasValidSecret(request)) return true;

  const session = await getServerSession(authOptions as never) as AdminSession;
  return isAdminSession(session);
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groupCTeams = await prisma.asset.findMany({
      where: {
        type: 'TEAM',
        code: { in: GROUP_C_CODES },
      },
      select: { id: true, name: true, code: true },
    });

    const deleted = await prisma.teamIntelligenceReport.deleteMany({
      where: {
        provider: { in: ['MC_PRIME_CURATED', 'FBREF_STATHEAD_SNAPSHOT'] },
        teamId: { in: groupCTeams.map((team) => team.id) },
      },
    });

    const seedResult = await seedTeamIntelligenceReports(prisma);
    const fbrefSeedResult = await seedGroupCFbrefReports(prisma);

    return NextResponse.json({
      success: true,
      deletedGroupCReports: deleted.count,
      groupCTeams,
      curatedSeed: seedResult,
      fbrefSeed: fbrefSeedResult,
    });
  } catch (error) {
    console.error('Failed to reseed Group C intelligence reports:', error);
    return NextResponse.json({ error: 'Failed to reseed Group C intelligence reports' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Use POST to delete and reseed curated + FBref copied-source Group C intelligence reports.',
    groupCCodes: GROUP_C_CODES,
  });
}
