import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { WORLD_CUP_2026_GROUPS } from '@/lib/worldCup2026GroupConfig';

export const dynamic = 'force-dynamic';

type AdminSession = { user?: { role?: string | null } } | null;

async function isAdmin() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const codes = Object.values(WORLD_CUP_2026_GROUPS).flatMap((group) => group.teams.flatMap((team) => team.codes));
  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM', code: { in: codes } },
    select: {
      id: true,
      name: true,
      code: true,
      intelligenceReports: {
        orderBy: { publishedAt: 'desc' },
        select: { id: true, title: true, provider: true, confidence: true, publishedAt: true },
      },
    },
  });

  const groups = Object.entries(WORLD_CUP_2026_GROUPS).map(([groupKey, groupConfig]) => {
    const slots = groupConfig.teams.map((expectedTeam) => {
      const matchedTeam = teams.find((team) => expectedTeam.codes.some((code) => team.code.toLowerCase() === code.toLowerCase()));
      const curatedReports = matchedTeam?.intelligenceReports.filter((report) => report.provider === 'MC_PRIME_CURATED') || [];
      return {
        expectedName: expectedTeam.name,
        expectedCode: expectedTeam.codes[0],
        matched: Boolean(matchedTeam),
        id: matchedTeam?.id || null,
        name: matchedTeam?.name || expectedTeam.name,
        code: matchedTeam?.code || expectedTeam.codes[0],
        reportCount: matchedTeam?.intelligenceReports.length || 0,
        curatedReportCount: curatedReports.length,
        hasCuratedReport: curatedReports.length > 0,
        latestReport: matchedTeam?.intelligenceReports[0] || null,
      };
    });

    return {
      group: groupKey,
      groupName: `المجموعة ${groupConfig.arName}`,
      ready: slots.every((slot) => slot.matched && slot.hasCuratedReport),
      missingTeamCodes: slots.filter((slot) => !slot.matched).map((slot) => slot.expectedCode),
      missingCuratedReportCodes: slots.filter((slot) => slot.matched && !slot.hasCuratedReport).map((slot) => slot.code),
      teams: slots,
    };
  });

  return NextResponse.json({ ok: true, ready: groups.every((group) => group.ready), groups });
}
