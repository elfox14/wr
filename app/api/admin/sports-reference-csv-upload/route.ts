import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { buildSportsReferenceCsvDraft } from '@/lib/sportsReferenceCsvDraft';
import { createSourceAutomationLog } from '@/lib/sourceAutomationLog';
import { normalizeSearchText, textMatchesTeamAlias } from '@/lib/teamNameAliases';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

type CsvUploadPayload = {
  teamId?: string;
  teamCode?: string;
  teamName?: string;
  sourceName?: string;
  sourceUrl?: string;
  csvText?: string;
};

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function buildBody(sections: Record<string, string>) {
  return Object.entries(sections)
    .map(([title, content]) => `${title}: ${content}`)
    .join('\n\n');
}

async function findTeam(payload: CsvUploadPayload) {
  if (payload.teamId) {
    const byId = await prisma.asset.findFirst({
      where: { id: payload.teamId, type: 'TEAM' },
      select: { id: true, name: true, code: true },
    });
    if (byId) return byId;
  }

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  const explicitCode = String(payload.teamCode || '').trim().toLowerCase();
  const explicitName = normalizeSearchText(payload.teamName || '');
  const combined = `${payload.teamCode || ''} ${payload.teamName || ''}`;

  return teams.find((team) => {
    const code = String(team.code || '').toLowerCase();
    const name = normalizeSearchText(team.name);
    if (explicitCode && code === explicitCode) return true;
    if (explicitName && name === explicitName) return true;
    return textMatchesTeamAlias(combined, team);
  }) || null;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const payload = await request.json().catch(() => ({})) as CsvUploadPayload;
  const csvText = String(payload.csvText || '').trim();
  if (!csvText) {
    return NextResponse.json({ success: false, error: 'csvText is required.' }, { status: 400 });
  }

  const team = await findTeam(payload);
  if (!team) {
    await createSourceAutomationLog({
      job: 'sports-reference-csv-upload',
      status: 'skipped',
      imported: 0,
      skipped: 1,
      details: { reason: 'No matching team', teamCode: payload.teamCode || null, teamName: payload.teamName || null },
    });
    return NextResponse.json({ success: false, error: 'No matching team found. Choose a team or provide teamCode/teamName.' }, { status: 404 });
  }

  const sourceName = String(payload.sourceName || 'Sports Reference / Stathead / FBref subscription').trim();
  const sourceUrl = String(payload.sourceUrl || 'https://www.sports-reference.com/').trim();
  const draft = buildSportsReferenceCsvDraft({
    teamName: team.name,
    sourceName,
    sourceUrl,
    csvText,
  });

  if (!draft.detectedRows || draft.warnings.length) {
    await createSourceAutomationLog({
      job: 'sports-reference-csv-upload',
      status: 'warning',
      imported: 0,
      skipped: 1,
      details: { team, detectedRows: draft.detectedRows, warnings: draft.warnings, detectedColumns: draft.detectedColumns },
    });
    return NextResponse.json({ success: false, error: 'CSV could not produce a publishable draft.', draft }, { status: 422 });
  }

  await prisma.teamIntelligenceReport.deleteMany({
    where: {
      teamId: team.id,
      provider: 'SPORTS_REFERENCE_CSV_UPLOAD',
    },
  });

  const report = await prisma.teamIntelligenceReport.create({
    data: {
      teamId: team.id,
      title: `Sports Reference / FBref CSV upload — ${team.name}`,
      summary: draft.summary,
      body: buildBody(draft.sections),
      confidence: 'B',
      reportType: 'TEAM_PROFILE',
      sourceName,
      sourceUrl,
      sourceCategory: 'stats',
      provider: 'SPORTS_REFERENCE_CSV_UPLOAD',
      tacticalTags: ['Sports Reference', 'FBref', 'CSV upload', 'AUTO_IMPORTED'],
      strengths: [],
      weaknesses: [],
      metrics: {
        importMode: 'csv_upload',
        detectedRows: draft.detectedRows,
        detectedColumns: draft.detectedColumns,
        importedAt: new Date().toISOString(),
      },
      lastCheckedAt: new Date(),
    },
    include: { team: { select: { id: true, name: true, code: true } } },
  });

  await createSourceAutomationLog({
    job: 'sports-reference-csv-upload',
    status: 'success',
    imported: 1,
    skipped: 0,
    details: { reportId: report.id, team: report.team, detectedRows: draft.detectedRows, detectedColumns: draft.detectedColumns },
  });

  return NextResponse.json({
    success: true,
    report,
    draft: {
      detectedRows: draft.detectedRows,
      detectedColumns: draft.detectedColumns,
    },
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    message: 'POST CSV text with teamId/teamCode/teamName to import a Sports Reference / FBref report directly from the admin UI.',
    payload: {
      teamCode: 'MEX',
      sourceName: 'Sports Reference / Stathead / FBref subscription',
      sourceUrl: 'https://www.sports-reference.com/',
      csvText: 'Player,Min,Gls,Ast,xG,Sh,SoT\nPlayer A,900,5,2,4.8,28,12',
    },
  });
}
