import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const DEFAULT_FALLBACK_ENDPOINT = 'https://browserless-backup-5k6y.onrender.com';

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  const incoming = new URL(req.url);
  const target = new URL('/api/internal/live-ingest/isports/remote-frame-pull-v2', incoming.origin);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const fallbackEndpoint = incoming.searchParams.get('backupEndpoint')
    || incoming.searchParams.get('fallbackEndpoint')
    || process.env.BROWSERLESS_FALLBACK_ENDPOINT
    || process.env.BROWSERLESS_BACKUP_ENDPOINT
    || DEFAULT_FALLBACK_ENDPOINT;

  if (!target.searchParams.has('backupEndpoint')) {
    target.searchParams.set('backupEndpoint', fallbackEndpoint);
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  for (const name of ['authorization', 'x-admin-secret', 'x-cron-secret']) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }

  const response = await fetch(target.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers,
  });
  const text = await response.text();
  const contentType = response.headers.get('content-type') || 'application/json';

  if (contentType.includes('application/json')) {
    try {
      const payload = JSON.parse(text);
      return NextResponse.json({
        ...payload,
        fallbackEnvAlias: {
          supported: true,
          envName: 'BROWSERLESS_FALLBACK_ENDPOINT',
          usedEndpoint: fallbackEndpoint.replace(/([?&]token=)[^&]+/i, '$1***'),
        },
      }, { status: response.status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    } catch {}
  }

  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': contentType, 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
