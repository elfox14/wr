import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

async function ensurePressNewsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PressNews" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'رصد صحفي',
      "sourceName" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "sourceType" TEXT NOT NULL DEFAULT 'newsletter',
      "language" TEXT NOT NULL DEFAULT 'ar',
      "status" TEXT NOT NULL DEFAULT 'published',
      "importance" INTEGER NOT NULL DEFAULT 50,
      "tags" JSONB,
      "relatedTeamId" TEXT,
      "relatedPlayerId" TEXT,
      "relatedMatchId" TEXT,
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedTeamId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedPlayerId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedMatchId" TEXT');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_status_publishedAt_idx" ON "PressNews" ("status", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_category_publishedAt_idx" ON "PressNews" ("category", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_relatedTeamId_idx" ON "PressNews" ("relatedTeamId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_relatedPlayerId_idx" ON "PressNews" ("relatedPlayerId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_relatedMatchId_idx" ON "PressNews" ("relatedMatchId")');
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function nullableString(value: unknown) {
  const text = String(value || '').trim();
  return text || null;
}

function validatePayload(body: any) {
  const title = String(body.title || '').trim();
  const content = String(body.body || '').trim();
  const sourceName = String(body.sourceName || '').trim();
  if (!title || title.length < 8) return { error: 'عنوان الخبر قصير جدًا' };
  if (!content || content.length < 20) return { error: 'نص الخبر قصير جدًا' };
  if (!sourceName || sourceName.length < 2) return { error: 'اسم المصدر مطلوب' };
  return {
    title,
    content,
    sourceName,
    category: String(body.category || 'رصد صحفي').trim(),
    sourceUrl: nullableString(body.sourceUrl),
    sourceType: String(body.sourceType || 'newsletter').trim(),
    language: String(body.language || 'ar').trim(),
    status: String(body.status || 'published').trim(),
    importance: Math.max(1, Math.min(100, Number(body.importance || 50))),
    tags: normalizeTags(body.tags),
    relatedTeamId: nullableString(body.relatedTeamId),
    relatedPlayerId: nullableString(body.relatedPlayerId),
    relatedMatchId: nullableString(body.relatedMatchId),
  };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensurePressNewsTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "PressNews"
    ORDER BY "publishedAt" DESC
    LIMIT 100
  `);
  return NextResponse.json({ ok: true, items: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensurePressNewsTable();
  const body = await req.json().catch(() => ({}));
  const payload = validatePayload(body);
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 });

  const id = `press_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
  const safePublishedAt = Number.isFinite(publishedAt.getTime()) ? publishedAt : new Date();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "PressNews" (
      "id", "title", "body", "category", "sourceName", "sourceUrl", "sourceType", "language", "status", "importance", "tags", "relatedTeamId", "relatedPlayerId", "relatedMatchId", "publishedAt", "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    id, payload.title, payload.content, payload.category, payload.sourceName, payload.sourceUrl, payload.sourceType, payload.language,
    payload.status, payload.importance, JSON.stringify(payload.tags), payload.relatedTeamId, payload.relatedPlayerId, payload.relatedMatchId, safePublishedAt
  );

  const created = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "PressNews" WHERE "id" = ${quoteSql(id)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: created[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensurePressNewsTable();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const payload = validatePayload(body);
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 });

  await prisma.$executeRawUnsafe(
    `UPDATE "PressNews" SET
      "title"=$2, "body"=$3, "category"=$4, "sourceName"=$5, "sourceUrl"=$6,
      "sourceType"=$7, "language"=$8, "status"=$9, "importance"=$10, "tags"=$11::jsonb,
      "relatedTeamId"=$12, "relatedPlayerId"=$13, "relatedMatchId"=$14, "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1`,
    id, payload.title, payload.content, payload.category, payload.sourceName, payload.sourceUrl, payload.sourceType,
    payload.language, payload.status, payload.importance, JSON.stringify(payload.tags), payload.relatedTeamId, payload.relatedPlayerId, payload.relatedMatchId
  );

  const updated = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "PressNews" WHERE "id" = ${quoteSql(id)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: updated[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensurePressNewsTable();
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.$executeRawUnsafe(`DELETE FROM "PressNews" WHERE "id" = ${quoteSql(id)}`);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
