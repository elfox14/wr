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

type PlayerLite = {
  id: string;
  name: string;
  image: string | null;
  position: string | null;
  teamId: string | null;
  isAvailable: boolean;
  apiFootballId: number | null;
};

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

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeName(value?: string | null) {
  return stripAccents(String(value || ''))
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(el|al)\b/g, ' ')
    .replace(/[^a-z0-9.\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\by\b/g, 'i');
}

function nameTokens(value?: string | null) {
  return normalizeName(value).split(' ').filter(Boolean);
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function tokenClose(a?: string, b?: string) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length === 1 || right.length === 1) return left[0] === right[0];
  const distance = editDistance(left, right);
  return distance <= (Math.max(left.length, right.length) <= 6 ? 1 : 2);
}

function isLikelySamePlayer(a: PlayerLite, b: PlayerLite) {
  if (!a.teamId || !b.teamId || a.teamId !== b.teamId) return false;
  if (a.apiFootballId && b.apiFootballId && a.apiFootballId === b.apiFootballId) return true;

  const aName = normalizeName(a.name);
  const bName = normalizeName(b.name);
  if (!aName || !bName) return false;
  if (aName === bName) return true;

  const aTokens = nameTokens(a.name);
  const bTokens = nameTokens(b.name);
  if (!aTokens.length || !bTokens.length) return false;

  const aFirst = aTokens[0];
  const bFirst = bTokens[0];
  const aLast = aTokens[aTokens.length - 1];
  const bLast = bTokens[bTokens.length - 1];

  if (tokenClose(aFirst, bFirst) && tokenClose(aLast, bLast)) return true;
  if (`${aFirst[0] || ''}:${aLast}` === `${bFirst[0] || ''}:${bLast}` && tokenClose(aLast, bLast)) return true;

  return false;
}

async function lockedOfficialTeams() {
  const reports = await prisma.teamIntelligenceReport.findMany({
    where: {
      provider: 'MC_PRIME_OFFICIAL_RECONCILE',
      reportType: 'OFFICIAL_SQUAD',
    },
    select: { teamId: true },
  });
  return Array.from(new Set(reports.map((report) => report.teamId)));
}

function candidateScore(player: PlayerLite) {
  let score = 0;
  if (!player.isAvailable) score += 20;
  if (player.id.startsWith('official-player-')) score += 15;
  if (player.id.includes('api') || player.id.includes('data')) score += 10;
  if (player.apiFootballId) score += 25;
  if (hasUsablePlayerImage(player.image)) score += 100;
  return score;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    route: '/api/admin/official-squads/repair-images',
    method: 'POST',
    policy: 'Repairs missing official player images only. It does not add, remove, or rename players.',
    dryRunDefault: true,
    applyPayload: {
      dryRun: false,
      confirmRepairOfficialPlayerImages: true,
    },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const payload = await request.json().catch(() => ({}));
  const dryRun = asBool(payload?.dryRun ?? payload?.dry_run, true);
  const confirmRepair = asBool(payload?.confirmRepairOfficialPlayerImages ?? payload?.confirm_repair_official_player_images, false);

  if (!dryRun && !confirmRepair) {
    return NextResponse.json({
      ok: false,
      error: 'repair_confirmation_required',
      message: 'Set confirmRepairOfficialPlayerImages=true to update official player image URLs.',
    }, { status: 400 });
  }

  const teamIds = await lockedOfficialTeams();
  if (!teamIds.length) {
    return NextResponse.json({ ok: true, dryRun, lockedTeams: 0, missingOfficialImages: 0, repairable: 0, updated: 0, repairs: [] });
  }

  const players = await prisma.asset.findMany({
    where: {
      type: 'PLAYER',
      teamId: { in: teamIds },
    },
    select: {
      id: true,
      name: true,
      image: true,
      position: true,
      teamId: true,
      isAvailable: true,
      apiFootballId: true,
      team: { select: { code: true, name: true } },
    },
  });

  const missingOfficialImages = players.filter((player) => player.isAvailable && !hasUsablePlayerImage(player.image));
  const imageCandidates = players.filter((player) => hasUsablePlayerImage(player.image));
  const repairs = [] as any[];

  for (const player of missingOfficialImages) {
    const candidates = imageCandidates
      .filter((candidate) => candidate.id !== player.id && isLikelySamePlayer(player as PlayerLite, candidate as PlayerLite))
      .sort((a, b) => candidateScore(b as PlayerLite) - candidateScore(a as PlayerLite));

    const best = candidates[0];
    if (!best?.image) continue;

    repairs.push({
      playerId: player.id,
      playerName: player.name,
      teamCode: player.team?.code || null,
      teamName: player.team?.name || null,
      fromCandidateId: best.id,
      fromCandidateName: best.name,
      fromCandidateAvailable: best.isAvailable,
      image: best.image,
    });
  }

  let updated = 0;
  if (!dryRun && repairs.length) {
    for (const repair of repairs) {
      await prisma.asset.update({ where: { id: repair.playerId }, data: { image: repair.image } });
      updated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    lockedTeams: teamIds.length,
    missingOfficialImages: missingOfficialImages.length,
    imageCandidates: imageCandidates.length,
    repairable: repairs.length,
    updated,
    repairs,
  });
}
