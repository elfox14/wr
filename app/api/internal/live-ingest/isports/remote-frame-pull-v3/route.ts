import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const DEFAULT_FALLBACK_ENDPOINT = 'https://browserless-backup-5k6y.onrender.com';

function mask(value: string) {
  return value.replace(/([?&]token=)[^&]+/i, '$1***');
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
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

    if (incoming.searchParams.get('explain') === 'true') {
      return NextResponse.json({
        ok: true,
        mode: 'isports_remote_frame_pull_v3',
        behavior: 'redirects_to_v2_with_browserless_fallback_endpoint',
        targetPath: `${target.pathname}?${target.searchParams.toString().replace(/(key=)[^&]+/i, '$1***')}`,
        fallbackEnvAlias: {
          supported: true,
          envName: 'BROWSERLESS_FALLBACK_ENDPOINT',
          usedEndpoint: mask(fallbackEndpoint),
        },
      }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    return NextResponse.redirect(target.toString(), 307);
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      mode: 'isports_remote_frame_pull_v3',
      error: error?.message || 'Internal Server Error',
      fallbackEnvAlias: {
        supported: true,
        envName: 'BROWSERLESS_FALLBACK_ENDPOINT',
      },
    }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
