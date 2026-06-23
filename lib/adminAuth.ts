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

function envEnabled(name: string) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function isInternalISportsDiagnosticPath(req: Request) {
  try {
    const { pathname } = new URL(req.url);
    return pathname.startsWith('/api/internal/live-ingest/isports/');
  } catch {
    return false;
  }
}

function internalDiagnosticsDisabledResponse() {
  return NextResponse.json(
    { ok: false, error: 'Not Found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function hasValidAdminSecret(req: Request) {
  const expectedSecrets = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (!expectedSecrets.length) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const { searchParams } = new URL(req.url);
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret') || '',
    req.headers.get('x-cron-secret') || '',
    searchParams.get('adminSecret') || '',
    searchParams.get('cronSecret') || '',
    searchParams.get('key') || '',
  ].map((value) => String(value || '').trim()).filter(Boolean);

  return candidates.some((value) => expectedSecrets.includes(value));
}

export async function requireAdmin(req: Request) {
  if (
    isInternalISportsDiagnosticPath(req) &&
    !envEnabled('ENABLE_INTERNAL_ISPORTS_ROUTES') &&
    !envEnabled('ENABLE_INTERNAL_DIAGNOSTICS')
  ) {
    return { authorized: false, error: internalDiagnosticsDisabledResponse() };
  }

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
