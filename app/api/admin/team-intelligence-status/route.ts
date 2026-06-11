import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

const GROUP_CODES = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'],
  B: ['CAN', 'BIH', 'QAT', 'SUI'],
} as const;

type SupportedGroup = keyof typeof GROUP_CODES;

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

function getRequestedGroup(request: Request): SupportedGroup {
  const url = new URL(request.url);
  const group = (url.searchParams.get('group') || 'A').toUpperCase();
  return group === 'B' ? 'B' : 'A';
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestedGroup = getRequestedGroup(request);
  const expectedCodes = GROUP_CODES[requestedGroup];

  const teams = await prisma.asset.findMany({
    where: {
      type: 'TEAM',
      code: { in: [...expectedCodes] },
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
  const missingTeamCodes = expectedCodes.filter((code) => !foundCodes.has(code));

  const status = teams.map((team) => {
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
    };
  });

  return NextResponse.json({
    ok: true,
    group: requestedGroup,
    expectedCodes,
    missingTeamCodes,
    teams: status,
    ready: missingTeamCodes.length === 0 && status.every((team) => team.hasCuratedReport),
  });
}
