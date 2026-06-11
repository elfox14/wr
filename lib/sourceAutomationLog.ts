import prisma from '@/lib/prisma';

type AutomationLogInput = {
  job: string;
  status: 'success' | 'warning' | 'error' | 'skipped';
  title?: string;
  summary?: string;
  imported?: number;
  skipped?: number;
  failed?: number;
  details?: unknown;
};

const SYSTEM_TEAM_CODE_CANDIDATES = ['SYSTEM', 'SYS', 'MEX'];

async function getFallbackTeamId() {
  const systemTeam = await prisma.asset.findFirst({
    where: {
      type: 'TEAM',
      OR: SYSTEM_TEAM_CODE_CANDIDATES.map((code) => ({ code })),
    },
    select: { id: true },
  });

  if (systemTeam?.id) return systemTeam.id;

  const firstTeam = await prisma.asset.findFirst({
    where: { type: 'TEAM' },
    select: { id: true },
    orderBy: { name: 'asc' },
  });

  return firstTeam?.id || null;
}

export async function createSourceAutomationLog(input: AutomationLogInput) {
  const teamId = await getFallbackTeamId();
  if (!teamId) return null;

  const imported = input.imported || 0;
  const skipped = input.skipped || 0;
  const failed = input.failed || 0;

  return prisma.teamIntelligenceReport.create({
    data: {
      teamId,
      title: input.title || `Automation log — ${input.job}`,
      summary: input.summary || `${input.job}: ${input.status}. imported=${imported}, skipped=${skipped}, failed=${failed}.`,
      body: JSON.stringify(input.details || {}, null, 2),
      confidence: input.status === 'success' ? 'B' : input.status === 'warning' ? 'C' : 'D',
      reportType: 'SOURCE_AUTOMATION_LOG',
      sourceName: 'MC PRIME Source Automation',
      sourceCategory: 'automation',
      provider: `AUTOMATION_LOG_${input.job.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
      metrics: {
        job: input.job,
        status: input.status,
        imported,
        skipped,
        failed,
        checkedAt: new Date().toISOString(),
      },
      tacticalTags: ['automation-log', input.job, input.status],
      strengths: imported ? [`imported=${imported}`] : [],
      weaknesses: failed || skipped ? [`skipped=${skipped}`, `failed=${failed}`] : [],
      lastCheckedAt: new Date(),
    },
    select: { id: true },
  });
}

export async function getLatestSourceAutomationLogs(take = 20) {
  return prisma.teamIntelligenceReport.findMany({
    where: { reportType: 'SOURCE_AUTOMATION_LOG' },
    orderBy: { lastCheckedAt: 'desc' },
    take,
    select: {
      id: true,
      title: true,
      summary: true,
      provider: true,
      metrics: true,
      lastCheckedAt: true,
      createdAt: true,
    },
  });
}
