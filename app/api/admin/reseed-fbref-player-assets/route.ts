import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { seedFbrefPlayerAssets } from '@/lib/seedFbrefPlayerAssets';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function hasValidSecret(request: Request) {
  const secret = process.env.ADMIN_CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('secret') || '';

  return bearerToken === secret || queryToken === secret;
}

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function isAuthorized(request: Request) {
  if (hasValidSecret(request)) return true;

  const session = await getServerSession(authOptions as never) as AdminSession;
  return isAdminSession(session);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingPlayers = await prisma.asset.count({ where: { type: 'PLAYER' } });
  return NextResponse.json({
    ok: true,
    message: 'Use POST to upsert FBref copied roster players into Asset(type=PLAYER), then refresh /players.',
    existingPlayers,
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const before = await prisma.asset.count({ where: { type: 'PLAYER' } });
    const seedResult = await seedFbrefPlayerAssets(prisma);
    const after = await prisma.asset.count({ where: { type: 'PLAYER' } });

    return NextResponse.json({
      ok: true,
      before,
      after,
      addedOrUpdatedNow: seedResult.created + seedResult.updated,
      seedResult,
      next: 'Open /players after deploy and reseed. If missingRosterTeams are listed, those team pages were stored as team snapshots only and need roster rows copied/uploaded to create player cards.',
    });
  } catch (error) {
    console.error('Failed to seed FBref player assets:', error);
    return NextResponse.json({ error: 'Failed to seed FBref player assets' }, { status: 500 });
  }
}
