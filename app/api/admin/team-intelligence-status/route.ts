import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
  };
} | null;

const GROUP_A_CODES = ['MEX', 'RSA', 'KOR', 'CZE'];

async function isAuthorized() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teams = await prisma.asset.findMany({
    where: {
      type: 'TEAM',
      code: { in: GROUP_A_CODES },
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

  const foundCodes = new Set(teams.map((team) => team.code));
  const missingTeamCodes = GROUP_A_CODES.filter((code) => !foundCodes.has(code));

  const status = teams.map((team) => {
    const curatedReports = team.intelligenceReports.filter((report) => report.provider === 'MC_PRIME_CURATED');
    return {
      id: team.id,
      name: team.name,
      code: team.code,
      group: team.group,
      reportCount: team.intelligenceReports.length,
      curatedReportCount: curatedReports.length,
      hasGroupAReport: curatedReports.length > 0,
      latestReport: team.intelligenceReports[0] || null,
    };
  });

  return NextResponse.json({
    ok: true,
    expectedCodes: GROUP_A_CODES,
    missingTeamCodes,
    teams: status,
    ready: missingTeamCodes.length === 0 && status.every((team) => team.hasGroupAReport),
  });
}
