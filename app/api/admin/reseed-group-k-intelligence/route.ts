import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { seedGroupKFbrefReports } from '@/lib/groupKFbrefStats';
import { seedTeamIntelligenceReports } from '@/lib/seedTeamIntelligenceReports';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

const GROUP_K_CODES = ['COL', 'CO', 'POR', 'PT', 'COD', 'CD', 'UZB', 'UZ'];

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
    const groupKTeams = await prisma.asset.findMany({
      where: {
        type: 'TEAM',
        code: { in: GROUP_K_CODES },
      },
      select: { id: true, name: true, code: true },
    });

    const deleted = await prisma.teamIntelligenceReport.deleteMany({
      where: {
        provider: { in: ['MC_PRIME_CURATED', 'FBREF_STATHEAD_SNAPSHOT'] },
        teamId: { in: groupKTeams.map((team) => team.id) },
      },
    });

    const seedResult = await seedTeamIntelligenceReports(prisma);
    const fbrefSeedResult = await seedGroupKFbrefReports(prisma);

    return NextResponse.json({
      success: true,
      deletedGroupKReports: deleted.count,
      groupKTeams,
      curatedSeed: seedResult,
      fbrefSeed: fbrefSeedResult,
    });
  } catch (error) {
    console.error('Failed to reseed Group K intelligence reports:', error);
    return NextResponse.json({ error: 'Failed to reseed Group K intelligence reports' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Use POST to delete and reseed curated + FBref copied-source Group K intelligence reports.',
    groupKCodes: GROUP_K_CODES,
  });
}
