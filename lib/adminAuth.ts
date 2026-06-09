import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
} | null;

export function hasValidAdminSecret(req: Request) {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-admin-secret') || '';
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('adminSecret') || '';

  return [bearer, headerSecret, querySecret].some((value) => value && value === expectedSecret);
}

export async function requireAdmin(req: Request) {
  if (hasValidAdminSecret(req)) return { authorized: true, mode: 'secret' as const };

  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) {
    return { authorized: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { authorized: true, mode: 'session' as const, session };
}
