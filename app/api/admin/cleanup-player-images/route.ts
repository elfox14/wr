import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { hasUsablePlayerImage, isLikelyFlagOrTeamImage } from '@/lib/playerDedupe';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function toBool(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

async function cleanup(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const dryRun = toBool(searchParams.get('dryRun'), true);
  const teamId = searchParams.get('teamId');

  const players = await prisma.asset.findMany({
    where: {
      type: 'PLAYER',
      image: { not: null },
      ...(teamId ? { teamId } : {}),
    },
    select: {
      id: true,
      name: true,
      image: true,
      teamId: true,
      team: { select: { name: true, code: true } },
    },
    orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }],
    take: 5000,
  });

  const invalid = players.filter((player) => player.image && (!hasUsablePlayerImage(player.image) || isLikelyFlagOrTeamImage(player.image)));

  if (!dryRun && invalid.length) {
    await prisma.asset.updateMany({
      where: { id: { in: invalid.map((player) => player.id) } },
      data: { image: null },
    });
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    checked: players.length,
    invalidImages: invalid.length,
    updated: dryRun ? 0 : invalid.length,
    samples: invalid.slice(0, 30).map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team?.name || player.teamId,
      image: player.image,
    })),
  });
}

export async function GET(req: Request) {
  return cleanup(req);
}

export async function POST(req: Request) {
  return cleanup(req);
}
