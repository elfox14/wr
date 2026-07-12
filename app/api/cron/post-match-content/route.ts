import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { ensureMatchArticleTables, generateVerifiedMatchArticle } from '@/lib/match-analysis/verified-article-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!hasValidAdminSecret(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  await ensureMatchArticleTables();
  const limit = Math.max(1, Math.min(10, Number(req.nextUrl.searchParams.get('limit') || 3)));
  const matches = await prisma.match.findMany({ where: { status: 'FINAL_VERIFIED' }, orderBy: { matchDate: 'asc' }, take: 40, select: { id: true } });
  const ids = matches.map((match) => match.id);
  const existing = ids.length ? await prisma.$queryRawUnsafe<Array<{ matchId: string }>>(`SELECT "matchId" FROM "MatchArticle" WHERE "matchId" = ANY($1::text[]) AND "language"='ar'`, ids).catch(() => []) : [];
  const completed = new Set(existing.map((row) => row.matchId));
  const selected = matches.filter((match) => !completed.has(match.id)).slice(0, limit);
  const results: any[] = [];
  for (const match of selected) {
    try { results.push(await generateVerifiedMatchArticle(match.id)); }
    catch (error: any) { results.push({ ok: false, matchId: match.id, error: String(error?.message || error) }); }
  }
  return NextResponse.json({ ok: results.every((item) => item.ok), mode: 'verified_match_article_engine', selected: selected.length, results }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) { return GET(req); }
