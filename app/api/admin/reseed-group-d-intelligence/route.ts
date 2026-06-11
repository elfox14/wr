import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { seedTeamIntelligenceReports } from '@/lib/seedTeamIntelligenceReports';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
  };
} | null;

const GROUP_D_CODES = ['USA', 'PAR', 'AUS', 'TUR'];

async function isAuthorized() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  return session?.user?.role === 'ADMIN';
}

export async function POST() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groupDTeams = await prisma.asset.findMany({
      where: {
        type: 'TEAM',
        code: { in: GROUP_D_CODES },
      },
      select: { id: true, name: true, code: true },
    });

    const deleted = await prisma.teamIntelligenceReport.deleteMany({
      where: {
        provider: 'MC_PRIME_CURATED',
        teamId: { in: groupDTeams.map((team) => team.id) },
      },
    });

    const seedResult = await seedTeamIntelligenceReports(prisma);

    return NextResponse.json({
      success: true,
      deletedCuratedReports: deleted.count,
      groupDTeams,
      ...seedResult,
    });
  } catch (error) {
    console.error('Failed to reseed Group D intelligence reports:', error);
    return NextResponse.json({ error: 'Failed to reseed Group D intelligence reports' }, { status: 500 });
  }
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Use POST to delete and reseed curated Group D intelligence reports.',
    groupDCodes: GROUP_D_CODES,
  });
}
