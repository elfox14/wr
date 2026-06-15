import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { seedGroupEFbrefReports } from '@/lib/groupEFbrefStats';
import { seedTeamIntelligenceReports } from '@/lib/seedTeamIntelligenceReports';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

const GROUP_E_CODES = ['GER', 'DE', 'CUW', 'CW', 'ECU', 'EC', 'CIV', 'CI'];

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
    const groupETeams = await prisma.asset.findMany({
      where: {
        type: 'TEAM',
        code: { in: GROUP_E_CODES },
      },
      select: { id: true, name: true, code: true },
    });

    const deleted = await prisma.teamIntelligenceReport.deleteMany({
      where: {
        provider: { in: ['MC_PRIME_CURATED', 'FBREF_STATHEAD_SNAPSHOT'] },
        teamId: { in: groupETeams.map((team) => team.id) },
      },
    });

    const seedResult = await seedTeamIntelligenceReports(prisma);
    const fbrefSeedResult = await seedGroupEFbrefReports(prisma);

    return NextResponse.json({
      success: true,
      deletedGroupEReports: deleted.count,
      groupETeams,
      curatedSeed: seedResult,
      fbrefSeed: fbrefSeedResult,
    });
  } catch (error) {
    console.error('Failed to reseed Group E intelligence reports:', error);
    return NextResponse.json({ error: 'Failed to reseed Group E intelligence reports' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Use POST to delete and reseed curated + FBref copied-source Group E intelligence reports.',
    groupECodes: GROUP_E_CODES,
  });
}
