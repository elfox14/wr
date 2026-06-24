import { NextResponse } from 'next/server';
import { generatePostMatchArticles } from '@/lib/post-match-content/generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function configuredSecrets() {
  return [
    process.env.POST_MATCH_CONTENT_SECRET,
    process.env.CRON_SECRET,
    process.env.ADMIN_API_SECRET,
    process.env.ADMIN_CRON_SECRET,
  ].map((value) => String(value || '').trim()).filter(Boolean);
}

function isAuthorized(req: Request) {
  const valid = configuredSecrets();
  if (!valid.length) {
    return { valid: false, reason: 'POST_MATCH_CONTENT_SECRET, CRON_SECRET, ADMIN_API_SECRET, or ADMIN_CRON_SECRET must be configured.' };
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-post-match-content-secret')?.trim() || '',
    req.headers.get('x-cron-secret')?.trim() || '',
    req.headers.get('x-admin-secret')?.trim() || '',
  ];

  return candidates.some((value) => value && valid.includes(value))
    ? { valid: true, reason: null }
    : { valid: false, reason: 'Unauthorized' };
}

function boolFrom(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export async function GET(req: Request) {
  const auth = isAuthorized(req);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: auth.reason },
      { status: auth.reason === 'Unauthorized' ? 401 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') || process.env.POST_MATCH_CONTENT_LIMIT || 5)));

  const allowFinished = boolFrom(url.searchParams.get('allowFinished'), process.env.POST_MATCH_CONTENT_ALLOW_FINISHED === 'true');
  const autoPublish = boolFrom(url.searchParams.get('autoPublish'), process.env.POST_MATCH_CONTENT_AUTO_PUBLISH === 'true');

  try {
    const result = await generatePostMatchArticles({ limit, allowFinished, autoPublish });
    return NextResponse.json({
      ok: true,
      mode: 'db_only_post_match_content_engine',
      allowFinished,
      autoPublish,
      ...result,
      note: 'This cron reads verified DB snapshots only. It never fetches external providers.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: String(error?.message || error),
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
