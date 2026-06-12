import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeSearchText } from '@/lib/teamNameAliases';
import { normalizeTeamReportBody } from '@/lib/teamReportFormat';
import { WORLD_CUP_2026_GROUPS } from '@/lib/worldCup2026GroupConfig';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

async function isAdmin() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function matchesExpectedTeam(asset: { code: string; name: string }, expected: { name: string; codes: readonly string[] }) {
  const assetCode = asset.code.toLowerCase();
  const assetName = normalizeSearchText(asset.name);
  const expectedName = normalizeSearchText(expected.name);
  const expectedCodes = expected.codes.map((code) => code.toLowerCase());

  if (expectedCodes.includes(assetCode)) return true;
  if (assetName === expectedName) return true;
  return assetName.includes(expectedName) || expectedName.includes(assetName);
}

async function repairReports() {
  const assets = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: {
      id: true,
      name: true,
      code: true,
      intelligenceReports: {
        where: { provider: 'MC_PRIME_CURATED' },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          summary: true,
          body: true,
          sourceName: true,
          sourceUrl: true,
          tacticalTags: true,
        },
      },
    },
  });

  const results: Array<{ code: string; name: string; reportId?: string; status: string; missingSections?: string[] }> = [];

  for (const group of Object.values(WORLD_CUP_2026_GROUPS)) {
    for (const expectedTeam of group.teams) {
      const asset = assets.find((candidate) => matchesExpectedTeam(candidate, expectedTeam));
      if (!asset) {
        results.push({ code: expectedTeam.codes[0], name: expectedTeam.name, status: 'missing_team' });
        continue;
      }

      const report = asset.intelligenceReports[0];
      if (!report) {
        results.push({ code: asset.code, name: asset.name, status: 'missing_report' });
        continue;
      }

      const normalized = normalizeTeamReportBody({
        teamName: asset.name,
        title: report.title,
        summary: report.summary,
        body: report.body,
        sourceName: report.sourceName,
        sourceUrl: report.sourceUrl,
      });

      if (!normalized.changed) {
        results.push({ code: asset.code, name: asset.name, reportId: report.id, status: 'already_ok' });
        continue;
      }

      await prisma.teamIntelligenceReport.update({
        where: { id: report.id },
        data: {
          body: normalized.body,
          tacticalTags: Array.from(new Set([...report.tacticalTags, 'normalized-card-format'])),
          lastCheckedAt: new Date(),
        },
      });

      results.push({ code: asset.code, name: asset.name, reportId: report.id, status: 'repaired', missingSections: normalized.missingSections });
    }
  }

  return {
    success: true,
    repaired: results.filter((item) => item.status === 'repaired').length,
    alreadyOk: results.filter((item) => item.status === 'already_ok').length,
    missingTeam: results.filter((item) => item.status === 'missing_team').length,
    missingReport: results.filter((item) => item.status === 'missing_report').length,
    results,
  };
}

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await repairReports());
}

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get('run') === '1') {
    return NextResponse.json(await repairReports());
  }

  return NextResponse.json({
    ok: true,
    message: 'Use POST or open ?run=1 to repair existing MC_PRIME_CURATED team reports so their bodies follow the new card format.',
    endpoint: '/api/admin/repair-team-report-format',
    browserRunEndpoint: '/api/admin/repair-team-report-format?run=1',
  });
}
