import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getUser(session: unknown) {
  if (!session || typeof session !== 'object') return null;
  return (session as { user?: { email?: string | null; role?: string | null } }).user || null;
}

function isAdmin(session: unknown) {
  const user = getUser(session);
  const email = user?.email || '';
  return user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export async function GET() {
  const session = await getServerSession(authOptions as any);
  if (!getUser(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [teams, players, matches] = await Promise.all([
    prisma.asset.findMany({
      where: { type: 'TEAM' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, type: true },
      take: 80,
    }),
    prisma.asset.findMany({
      where: { type: 'PLAYER' },
      orderBy: [{ score: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true, type: true, teamId: true },
      take: 300,
    }),
    prisma.match.findMany({
      orderBy: { matchDate: 'desc' },
      include: { homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } },
      take: 160,
    }),
  ]);

  return NextResponse.json({ ok: true, teams, players, matches }, { headers: { 'Cache-Control': 'no-store' } });
}
