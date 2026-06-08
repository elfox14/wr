import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isportsFetch } from '@/lib/isportsApi';

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
} | null;

function hasValidAdminSecret(req: Request) {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-admin-secret') || '';
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('adminSecret') || '';

  return [bearer, headerSecret, querySecret].some((value) => value && value === expectedSecret);
}

async function requireAdmin(req: Request) {
  if (hasValidAdminSecret(req)) return { secret: true };

  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.user.role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function sanitizePayload(payload: any) {
  if (!payload || typeof payload !== 'object') return payload;
  return payload;
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') || '/sport/football/livescores';
  const params: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    if (!['path', 'adminSecret'].includes(key)) params[key] = value;
  });

  try {
    const data = await isportsFetch(path, params);
    return NextResponse.json({
      success: true,
      path,
      params,
      data: sanitizePayload(data),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'iSportsAPI test failed',
      primary: error.primary || null,
      fallback: error.fallback || null,
    }, { status: error.status || 500 });
  }
}
