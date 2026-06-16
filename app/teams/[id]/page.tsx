import prisma from '@/lib/prisma';
import TeamIntelligenceHub from '@/components/teams/TeamIntelligenceHub';
import { dedupePlayers } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

function toIsoDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapPerformance(performance: any) {
  return {
    ...performance,
    matchDate: toIsoDate(performance?.matchDate),
    createdAt: toIsoDate(performance?.createdAt),
    updatedAt: toIsoDate(performance?.updatedAt),
  };
}

function mapPlayer(player: any) {
  return {
    ...player,
    performances: Array.isArray(player?.performances) ? player.performances.map(mapPerformance) : [],
  };
}

function mapStatsSnapshot(snapshot: any) {
  return {
    ...snapshot,
    capturedAt: toIsoDate(snapshot?.capturedAt),
  };
}

function mapMatch(match: any) {
  return {
    id: match.id,
    externalId: match.externalId,
    animationMatchId: match.animationMatchId,
    matchDate: toIsoDate(match.matchDate),
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    groupPhase: match.groupPhase,
    stage: match.stage,
    homeTeam: match.homeTeam || null,
    awayTeam: match.awayTeam || null,
    statsSnapshots: Array.isArray(match.statsSnapshots) ? match.statsSnapshots.map(mapStatsSnapshot) : [],
  };
}

function mapReport(report: any) {
  if (!report) return null;
  return {
    ...report,
    publishedAt: toIsoDate(report.publishedAt),
    createdAt: toIsoDate(report.createdAt),
    updatedAt: toIsoDate(report.updatedAt),
    lastCheckedAt: toIsoDate(report.lastCheckedAt),
  };
}

function chooseBestReport(reports: any[] = []) {
  return (
    reports.find((item) => item.provider === 'MC_PRIME_CURATED') ||
    reports.find((item) => item.reportType === 'TEAM_PROFILE') ||
    reports.find((item) => item.provider !== 'MC_PRIME_DATA_HUB') ||
    reports[0] ||
    null
  );
}

function createSafeDemoTeam(id: string, dataError?: string) {
  return {
    id,
    name: id === 'test-team' ? 'صفحة اختبار المنتخب' : 'منتخب غير موثق',
    code: String(id || 'TEST').slice(0, 8).toUpperCase(),
    image: null,
    group: null,
    continent: null,
    fifaRank: null,
    coach: null,
    participations: null,
    players: [],
    rawPlayersCount: 0,
    isDemo: true,
    dataNotice: dataError || 'لا توجد بيانات موثقة لهذا المنتخب في قاعدة البيانات الحالية.',
  };
}

export default async function TeamPage({ params }: Props) {
  const { id } = await params;
  let team: any = null;
  let players: any[] = [];
  let matches: any[] = [];
  let report: any = null;
  let dataError: string | undefined;

  try {
    team = await prisma.asset.findUnique({
      where: { id },
      include: {
        intelligenceReports: {
          orderBy: { publishedAt: 'desc' },
          take: 8,
        },
      },
    });

    if (team) {
      players = await prisma.asset.findMany({
        where: { teamId: team.id, type: 'PLAYER', isAvailable: true },
        include: {
          performances: { take: 20, orderBy: { matchDate: 'desc' } },
        },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      });

      matches = await prisma.match.findMany({
        where: { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
        orderBy: { matchDate: 'asc' },
        include: {
          homeTeam: { select: { id: true, name: true, image: true, code: true } },
          awayTeam: { select: { id: true, name: true, image: true, code: true } },
          statsSnapshots: { take: 10, orderBy: { capturedAt: 'desc' } },
        },
      });

      report = chooseBestReport(team.intelligenceReports || []);
    }
  } catch (error) {
    console.error('Team page database error:', error);
    dataError = 'تعذر الاتصال بقاعدة البيانات، لذلك يتم عرض الصفحة بدون أرقام موثقة.';
  }

  const mappedPlayers = players.map(mapPlayer);
  const dedupedPlayers = dedupePlayers(mappedPlayers);
  const safeTeam = team
    ? { ...team, intelligenceReports: undefined, players: dedupedPlayers, rawPlayersCount: mappedPlayers.length, isDemo: false }
    : createSafeDemoTeam(id, dataError);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <TeamIntelligenceHub
        team={safeTeam}
        players={dedupedPlayers}
        matches={matches.map(mapMatch)}
        intelligenceReport={mapReport(report)}
      />
    </main>
  );
}
