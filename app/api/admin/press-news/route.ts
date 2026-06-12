import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
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
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_status_publishedAt_idx" ON "PressNews" ("status", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_category_publishedAt_idx" ON "PressNews" ("category", "publishedAt")');
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export async function GET() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensurePressNewsTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "PressNews"
    ORDER BY "publishedAt" DESC
    LIMIT 100
  `);
  return NextResponse.json({ ok: true, items: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensurePressNewsTable();
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const content = String(body.body || '').trim();
  const sourceName = String(body.sourceName || '').trim();

  if (!title || title.length < 8) return NextResponse.json({ error: 'عنوان الخبر قصير جدًا' }, { status: 400 });
  if (!content || content.length < 20) return NextResponse.json({ error: 'نص الخبر قصير جدًا' }, { status: 400 });
  if (!sourceName || sourceName.length < 2) return NextResponse.json({ error: 'اسم المصدر مطلوب' }, { status: 400 });

  const id = `press_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const category = String(body.category || 'رصد صحفي').trim();
  const sourceUrl = String(body.sourceUrl || '').trim() || null;
  const sourceType = String(body.sourceType || 'newsletter').trim();
  const language = String(body.language || 'ar').trim();
  const status = String(body.status || 'published').trim();
  const importance = Math.max(1, Math.min(100, Number(body.importance || 50)));
  const tags = normalizeTags(body.tags);
  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
  const safePublishedAt = Number.isFinite(publishedAt.getTime()) ? publishedAt : new Date();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "PressNews" (
      "id", "title", "body", "category", "sourceName", "sourceUrl", "sourceType", "language", "status", "importance", "tags", "publishedAt", "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    id,
    title,
    content,
    category,
    sourceName,
    sourceUrl,
    sourceType,
    language,
    status,
    importance,
    JSON.stringify(tags),
    safePublishedAt
  );

  const created = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "PressNews" WHERE "id" = ${quoteSql(id)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: created[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
