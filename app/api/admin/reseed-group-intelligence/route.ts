import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { seedTeamIntelligenceReports } from '@/lib/seedTeamIntelligenceReports';
import { getAllWorldCup2026Codes, getWorldCup2026GroupKey, WORLD_CUP_2026_GROUPS } from '@/lib/worldCup2026GroupConfig';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

function hasValidSecret(request: Request) {
  const secret = process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  return bearerToken === secret || url.searchParams.get('secret') === secret;
}

async function isAuthorized(request: Request) {
  if (hasValidSecret(request)) return true;
  const session = await getServerSession(authOptions as never) as AdminSession;
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function reseedGroup(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const group = getWorldCup2026GroupKey(url.searchParams.get('group'));
  const groupConfig = WORLD_CUP_2026_GROUPS[group];
  const candidateCodes = getAllWorldCup2026Codes(group);

  try {
    const groupTeams = await prisma.asset.findMany({
      where: {
        type: 'TEAM',
        code: { in: candidateCodes },
      },
      select: { id: true, name: true, code: true },
    });

    const deleted = await prisma.teamIntelligenceReport.deleteMany({
      where: {
        provider: 'MC_PRIME_CURATED',
        teamId: { in: groupTeams.map((team) => team.id) },
      },
    });

    const seedResult = await seedTeamIntelligenceReports(prisma);

    return NextResponse.json({
      success: true,
      group,
      groupName: `المجموعة ${groupConfig.arName}`,
      deletedCuratedReports: deleted.count,
      groupTeams,
      candidateCodes,
      ...seedResult,
    });
  } catch (error) {
    console.error(`Failed to reseed Group ${group} intelligence reports:`, error);
    return NextResponse.json({ error: `Failed to reseed Group ${group} intelligence reports` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return reseedGroup(request);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const group = getWorldCup2026GroupKey(url.searchParams.get('group'));
  const groupConfig = WORLD_CUP_2026_GROUPS[group];

  return NextResponse.json({
    ok: true,
    message: 'Use POST to delete and reseed curated intelligence reports for any World Cup 2026 group from A to L.',
    group,
    groupName: `المجموعة ${groupConfig.arName}`,
    candidateCodes: getAllWorldCup2026Codes(group),
  });
}
