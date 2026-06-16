import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return '';
  return authorization.slice(7).trim();
}

function hasAdminSecret(request: Request) {
  const url = new URL(request.url);
  const supplied = getBearerToken(request) || request.headers.get('x-admin-secret') || url.searchParams.get('token') || '';
  const expected = process.env.ADMIN_API_SECRET || process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET || '';
  return Boolean(expected && supplied && supplied === expected);
}

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin(request: Request) {
  if (hasAdminSecret(request)) return { session: null };
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const [teams, reconcileReports] = await Promise.all([
    prisma.asset.findMany({
      where: { type: 'TEAM' },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        group: true,
        players: {
          where: {
            type: 'PLAYER',
            isAvailable: true,
          },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            image: true,
            position: true,
          },
        },
      },
    }),
    prisma.teamIntelligenceReport.findMany({
      where: {
        provider: 'MC_PRIME_OFFICIAL_RECONCILE',
        reportType: 'OFFICIAL_SQUAD',
      },
      select: { teamId: true, updatedAt: true, sourceName: true, sourceUrl: true },
    }),
  ]);

  const lockedTeamIds = new Set(reconcileReports.map((report) => report.teamId));
  const teamRows = teams.map((team) => {
    const playerCount = team.players.length;
    const withImages = team.players.filter((player) => hasUsablePlayerImage(player.image)).length;
    const missingImages = team.players
      .filter((player) => !hasUsablePlayerImage(player.image))
      .map((player) => ({ id: player.id, name: player.name, position: player.position }));

    return {
      id: team.id,
      code: team.code,
      name: team.name,
      group: team.group,
      lockedOfficialSquad: lockedTeamIds.has(team.id),
      playerCount,
      withImages,
      missingImagesCount: missingImages.length,
      status: playerCount === 26 ? 'OK_26_PLAYERS' : 'COUNT_REVIEW_REQUIRED',
      missingImages,
    };
  });

  const officialTeams = teamRows.filter((team) => team.lockedOfficialSquad);
  const totalOfficialPlayers = officialTeams.reduce((sum, team) => sum + team.playerCount, 0);
  const totalWithImages = officialTeams.reduce((sum, team) => sum + team.withImages, 0);
  const totalMissingImages = officialTeams.reduce((sum, team) => sum + team.missingImagesCount, 0);
  const teamsNeedingCountReview = officialTeams.filter((team) => team.playerCount !== 26);
  const teamsMissingImages = officialTeams.filter((team) => team.missingImagesCount > 0);

  return NextResponse.json({
    ok: teamsNeedingCountReview.length === 0,
    lockedOfficialTeams: officialTeams.length,
    expectedOfficialTeams: 48,
    expectedPlayersPerTeam: 26,
    expectedOfficialPlayers: 1248,
    totalOfficialPlayers,
    totalWithImages,
    totalMissingImages,
    teamsWith26Players: officialTeams.filter((team) => team.playerCount === 26).length,
    teamsNeedingCountReview,
    teamsMissingImages,
    teams: officialTeams,
  });
}
