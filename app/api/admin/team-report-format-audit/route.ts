import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeSearchText } from '@/lib/teamNameAliases';
import { WORLD_CUP_2026_GROUPS } from '@/lib/worldCup2026GroupConfig';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

const REQUIRED_SECTIONS = [
  'بطاقة المنتخب',
  'ملخص تنفيذي موثق',
  'القوة الهجومية',
  'القوة الدفاعية',
  'وسط الملعب والتحكم',
  'الكرات الثابتة',
  'أسماء بارزة في القائمة',
  'معلومات غير متوفرة',
  'سجل المصادر',
];

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
  if (assetName.includes(expectedName) || expectedName.includes(assetName)) return true;
  return expected.codes.some((code) => assetName === normalizeSearchText(code));
}

function auditBody(body: string | null | undefined) {
  const value = body || '';
  const missingSections = REQUIRED_SECTIONS.filter((section) => !value.includes(section));
  return {
    ok: missingSections.length === 0,
    missingSections,
  };
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const assets = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: {
      id: true,
      name: true,
      code: true,
      group: true,
      intelligenceReports: {
        where: { provider: 'MC_PRIME_CURATED' },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          body: true,
          sourceName: true,
          provider: true,
          confidence: true,
          publishedAt: true,
        },
      },
    },
  });

  const groups = Object.entries(WORLD_CUP_2026_GROUPS).map(([groupKey, group]) => {
    const teams = group.teams.map((expectedTeam) => {
      const asset = assets.find((candidate) => matchesExpectedTeam(candidate, expectedTeam));
      const report = asset?.intelligenceReports[0] || null;
      const bodyAudit = auditBody(report?.body);

      return {
        expectedName: expectedTeam.name,
        expectedCodes: expectedTeam.codes,
        matched: Boolean(asset),
        asset: asset ? { id: asset.id, name: asset.name, code: asset.code, group: asset.group } : null,
        hasCuratedReport: Boolean(report),
        report: report ? {
          id: report.id,
          title: report.title,
          sourceName: report.sourceName,
          provider: report.provider,
          confidence: report.confidence,
          publishedAt: report.publishedAt,
        } : null,
        formatOk: Boolean(report) && bodyAudit.ok,
        missingSections: bodyAudit.missingSections,
      };
    });

    return {
      group: groupKey,
      groupName: `المجموعة ${group.arName}`,
      ready: teams.every((team) => team.matched && team.hasCuratedReport && team.formatOk),
      teams,
      missingTeams: teams.filter((team) => !team.matched).map((team) => team.expectedName),
      missingReports: teams.filter((team) => team.matched && !team.hasCuratedReport).map((team) => team.asset?.code || team.expectedName),
      wrongFormat: teams.filter((team) => team.hasCuratedReport && !team.formatOk).map((team) => ({ code: team.asset?.code || team.expectedName, missingSections: team.missingSections })),
    };
  });

  const summary = {
    groups: groups.length,
    expectedTeams: groups.reduce((sum, group) => sum + group.teams.length, 0),
    matchedTeams: groups.reduce((sum, group) => sum + group.teams.filter((team) => team.matched).length, 0),
    teamsWithCuratedReports: groups.reduce((sum, group) => sum + group.teams.filter((team) => team.hasCuratedReport).length, 0),
    teamsWithNewFormat: groups.reduce((sum, group) => sum + group.teams.filter((team) => team.formatOk).length, 0),
    missingTeams: groups.flatMap((group) => group.missingTeams),
    missingReports: groups.flatMap((group) => group.missingReports),
    wrongFormat: groups.flatMap((group) => group.wrongFormat),
  };

  return NextResponse.json({
    ok: true,
    ready: groups.every((group) => group.ready),
    requiredSections: REQUIRED_SECTIONS,
    summary,
    groups,
  });
}
