import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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

function asBool(value: any, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function dependencyMap(rows: Array<{ assetId: string; _count: { _all: number } }>) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.assetId, row._count._all || 0);
  return map;
}

async function lockedOfficialTeams() {
  const reports = await prisma.teamIntelligenceReport.findMany({
    where: {
      provider: 'MC_PRIME_OFFICIAL_RECONCILE',
      reportType: 'OFFICIAL_SQUAD',
    },
    select: {
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const seen = new Set<string>();
  return reports.filter((report) => {
    if (seen.has(report.teamId)) return false;
    seen.add(report.teamId);
    return true;
  });
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    route: '/api/admin/official-squads/prune',
    method: 'POST',
    policy: 'Deletes only hidden players from teams that already have MC_PRIME_OFFICIAL_RECONCILE reports.',
    dryRunDefault: true,
    applyPayload: {
      dryRun: false,
      confirmDeleteNonOfficialPlayers: true,
    },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const payload = await request.json().catch(() => ({}));
  const dryRun = asBool(payload?.dryRun ?? payload?.dry_run, true);
  const confirmDelete = asBool(payload?.confirmDeleteNonOfficialPlayers ?? payload?.confirm_delete_non_official_players, false);

  if (!dryRun && !confirmDelete) {
    return NextResponse.json({
      ok: false,
      error: 'delete_confirmation_required',
      message: 'Set confirmDeleteNonOfficialPlayers=true to permanently delete hidden non-official players.',
    }, { status: 400 });
  }

  const teams = await lockedOfficialTeams();
  const teamIds = teams.map((report) => report.teamId);

  if (!teamIds.length) {
    return NextResponse.json({
      ok: true,
      dryRun,
      lockedTeams: 0,
      candidates: 0,
      deleted: 0,
      blocked: 0,
      note: 'No official reconcile locks found.',
    });
  }

  const candidates = await prisma.asset.findMany({
    where: {
      type: 'PLAYER',
      teamId: { in: teamIds },
      isAvailable: false,
    },
    select: {
      id: true,
      name: true,
      teamId: true,
      team: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: [{ teamId: 'asc' }, { name: 'asc' }],
  });

  const ids = candidates.map((player) => player.id);

  const [holdings, transactions, marketNews] = ids.length
    ? await Promise.all([
      prisma.holding.groupBy({ by: ['assetId'], where: { assetId: { in: ids } }, _count: { _all: true } }),
      prisma.transaction.groupBy({ by: ['assetId'], where: { assetId: { in: ids } }, _count: { _all: true } }),
      prisma.marketNews.groupBy({ by: ['assetId'], where: { assetId: { in: ids } }, _count: { _all: true } }),
    ])
    : [[], [], []];

  const holdingsByAsset = dependencyMap(holdings as any);
  const transactionsByAsset = dependencyMap(transactions as any);
  const marketNewsByAsset = dependencyMap(marketNews as any);

  const blockedPlayers = [] as any[];
  const deletablePlayers = [] as any[];

  for (const player of candidates) {
    const dependencyCounts = {
      holdings: holdingsByAsset.get(player.id) || 0,
      transactions: transactionsByAsset.get(player.id) || 0,
      marketNews: marketNewsByAsset.get(player.id) || 0,
    };
    const blocked = dependencyCounts.holdings > 0 || dependencyCounts.transactions > 0 || dependencyCounts.marketNews > 0;
    const row = {
      id: player.id,
      name: player.name,
      teamCode: player.team?.code || null,
      teamName: player.team?.name || null,
      dependencies: dependencyCounts,
    };

    if (blocked) blockedPlayers.push(row);
    else deletablePlayers.push(row);
  }

  let deleted = 0;
  if (!dryRun && deletablePlayers.length) {
    const result = await prisma.asset.deleteMany({
      where: {
        type: 'PLAYER',
        isAvailable: false,
        id: { in: deletablePlayers.map((player) => player.id) },
      },
    });
    deleted = result.count;
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    lockedTeams: teams.length,
    candidates: candidates.length,
    deletable: deletablePlayers.length,
    blocked: blockedPlayers.length,
    deleted,
    blockedPlayers,
    deletedPlayers: dryRun ? [] : deletablePlayers,
    deletablePlayers: dryRun ? deletablePlayers : [],
  });
}
