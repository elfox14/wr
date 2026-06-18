import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_STATUSES = ['draft', 'published', 'archived'] as const;
type NewsStatus = typeof ALLOWED_STATUSES[number];

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
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
}

function normalizeStatus(value: unknown): NewsStatus | null {
  const status = String(value || '').trim() as NewsStatus;
  return ALLOWED_STATUSES.includes(status) ? status : null;
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await ensurePressNewsTable();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const status = normalizeStatus(body.status);

  if (!id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });
  if (!status) {
    return NextResponse.json({ ok: false, error: 'status must be draft, published, or archived' }, { status: 400 });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "PressNews"
     SET "status" = $2,
         "publishedAt" = CASE WHEN $2 = 'published' THEN CURRENT_TIMESTAMP ELSE "publishedAt" END,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = $1
     RETURNING "id", "title", "status", "updatedAt", "publishedAt"`,
    id,
    status
  );

  if (!rows[0]) return NextResponse.json({ ok: false, error: 'Article not found' }, { status: 404 });

  return NextResponse.json({ ok: true, item: rows[0], url: `/news/${id}` }, { headers: { 'Cache-Control': 'no-store' } });
}
