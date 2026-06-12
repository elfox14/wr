import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getAllWorldCup2026Codes, getWorldCup2026GroupKey, WORLD_CUP_2026_GROUPS } from '@/lib/worldCup2026GroupConfig';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

async function isAuthorized() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export async function GET(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedGroup = getWorldCup2026GroupKey(url.searchParams.get('group'));
  const groupConfig = WORLD_CUP_2026_GROUPS[requestedGroup];
  const candidateCodes = getAllWorldCup2026Codes(requestedGroup);

  const teams = await prisma.asset.findMany({
    where: {
      type: 'TEAM',
      code: { in: candidateCodes },
    },
    select: {
      id: true,
      name: true,
      code: true,
      group: true,
      intelligenceReports: {
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          sourceName: true,
          confidence: true,
          provider: true,
          publishedAt: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  const status = groupConfig.teams.map((expectedTeam) => {
    const team = teams.find((candidate) => expectedTeam.codes.some((code) => candidate.code.toLowerCase() === code.toLowerCase()));
    if (!team) {
      return {
        id: '',
        name: expectedTeam.name,
        code: expectedTeam.codes[0],
        group: requestedGroup,
        reportCount: 0,
        curatedReportCount: 0,
        hasCuratedReport: false,
        latestReport: null,
        missing: true,
      };
    }

    const curatedReports = team.intelligenceReports.filter((report) => report.provider === 'MC_PRIME_CURATED');
    return {
      id: team.id,
      name: team.name,
      code: team.code,
      group: team.group,
      reportCount: team.intelligenceReports.length,
      curatedReportCount: curatedReports.length,
      hasCuratedReport: curatedReports.length > 0,
      latestReport: team.intelligenceReports[0] || null,
      missing: false,
    };
  });

  const missingTeamCodes = status.filter((team) => team.missing).map((team) => team.code);

  return NextResponse.json({
    ok: true,
    group: requestedGroup,
    groupName: `المجموعة ${groupConfig.arName}`,
    expectedCodes: groupConfig.teams.map((team) => team.codes[0]),
    candidateCodes,
    missingTeamCodes,
    teams: status,
    ready: missingTeamCodes.length === 0 && status.every((team) => team.hasCuratedReport),
  });
}
