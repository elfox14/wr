import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { ensureMatchArticleTables } from '@/lib/match-analysis/verified-article-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SECTION_KEYS = ['matchSummary', 'tacticalReading', 'statsAnalysis', 'turningPoints', 'playerAnalysis', 'groupImpact', 'conclusion'] as const;

function text(value: unknown, max = 20000) {
  return String(value || '').trim().slice(0, max);
}

function sectionsOf(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(SECTION_KEYS.map((key) => [key, text(source[key])])) as Record<(typeof SECTION_KEYS)[number], string>;
}

async function articleById(id: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchArticle" WHERE "id"=$1 LIMIT 1`, id);
  return rows[0] || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  await ensureMatchArticleTables();
  const { id } = await params;
  const article = await articleById(id);
  return article ? NextResponse.json({ ok: true, article }) : NextResponse.json({ ok: false, error: 'Article not found' }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  await ensureMatchArticleTables();
  const { id } = await params;
  const current = await articleById(id);
  if (!current) return NextResponse.json({ ok: false, error: 'Article not found' }, { status: 404 });
  const input = await req.json().catch(() => ({}));
  const action = String(input.action || 'save');
  const sections = sectionsOf(input.sections || current.sections);
  const title = text(input.title || current.title, 180);
  const metaTitle = text(input.metaTitle || current.metaTitle, 80);
  const metaDescription = text(input.metaDescription || current.metaDescription, 200);
  const excerpt = text(input.excerpt || current.excerpt, 500);
  const required = [title, metaTitle, metaDescription, excerpt, ...SECTION_KEYS.map((key) => sections[key])];
  if (required.some((value) => !value)) return NextResponse.json({ ok: false, error: 'All article sections and SEO fields are required' }, { status: 400 });

  let status = current.status === 'PUBLISHED' ? 'DRAFT_READY' : current.status;
  let publishedAt: Date | null = current.publishedAt || null;
  if (action === 'publish') {
    if (!current.sourceSnapshotId) return NextResponse.json({ ok: false, error: 'A verified sourceSnapshotId is required before publishing' }, { status: 409 });
    if (current.status === 'REVIEW_REQUIRED' && input.confirmReviewed !== true) return NextResponse.json({ ok: false, error: 'confirmReviewed=true is required for articles that failed automatic validation' }, { status: 409 });
    status = 'PUBLISHED'; publishedAt = new Date();
  } else if (action === 'request_review') {
    status = 'REVIEW_REQUIRED'; publishedAt = null;
  } else {
    status = 'DRAFT_READY'; publishedAt = null;
  }
  const body = SECTION_KEYS.map((key) => sections[key]).join('\n\n');
  await prisma.$executeRawUnsafe(`UPDATE "MatchArticle" SET "title"=$1,"metaTitle"=$2,"metaDescription"=$3,"excerpt"=$4,"body"=$5,"sections"=$6::jsonb,"status"=$7,"publishedAt"=$8,"updatedAt"=NOW() WHERE "id"=$9`, title, metaTitle, metaDescription, excerpt, body, JSON.stringify({ ...(current.sections || {}), ...sections }), status, publishedAt, id);
  await prisma.$executeRawUnsafe(`INSERT INTO "EditorialReview" ("id","articleId","reviewer","status","notes","reviewedAt") VALUES ($1,$2,$3,$4,$5,$6)`, randomUUID(), id, String((auth as any).session?.user?.email || 'admin'), status === 'PUBLISHED' ? 'APPROVED' : 'PENDING', text(input.notes, 2000) || null, status === 'PUBLISHED' ? new Date() : null);
  const article = await articleById(id);
  return NextResponse.json({ ok: true, article }, { headers: { 'Cache-Control': 'no-store' } });
}
