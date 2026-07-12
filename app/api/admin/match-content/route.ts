import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { generateVerifiedMatchArticle } from '@/lib/match-analysis/verified-article-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  try {
    const body = await req.json().catch(() => ({}));
    const matchId = String(body.matchId || '').trim();
    if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
    const result = await generateVerifiedMatchArticle(matchId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const code = String(error?.message || error);
    const status = code === 'MATCH_NOT_FOUND' ? 404 : code.includes('NOT_FINAL') || code.includes('SNAPSHOT') || code.includes('INSUFFICIENT') ? 409 : 500;
    return NextResponse.json({ ok: false, error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
