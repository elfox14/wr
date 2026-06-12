import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getUser(session: unknown) {
  if (!session || typeof session !== 'object') return null;
  return (session as { user?: { email?: string | null; role?: string | null } }).user || null;
}

function isAdmin(session: unknown) {
  const user = getUser(session);
  const email = user?.email || '';
  return user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MatchDigest" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT NOT NULL UNIQUE,
      "matchTitle" TEXT NOT NULL,
      "scoreLine" TEXT NOT NULL,
      "statusLabel" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "turningPoint" TEXT,
      "videoScript" TEXT NOT NULL,
      "facebookPost" TEXT,
      "infographicPoints" JSONB,
      "status" TEXT NOT NULL DEFAULT 'published',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchDigest_matchId_idx" ON "MatchDigest" ("matchId")');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PressNews" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'رصد صحفي',
      "sourceName" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "sourceType" TEXT NOT NULL DEFAULT 'internal',
      "language" TEXT NOT NULL DEFAULT 'ar',
      "status" TEXT NOT NULL DEFAULT 'published',
      "importance" INTEGER NOT NULL DEFAULT 70,
      "tags" JSONB,
      "relatedTeamId" TEXT,
      "relatedPlayerId" TEXT,
      "relatedMatchId" TEXT,
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedMatchId" TEXT');
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any);
  if (!getUser(session)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureTables();
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId');
  const items = matchId
    ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchDigest" WHERE "matchId" = ${quoteSql(matchId)} LIMIT 1`)
    : await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "MatchDigest" ORDER BY "updatedAt" DESC LIMIT 80');
  return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureTables();
  const body = await req.json().catch(() => ({}));
  const matchId = String(body.matchId || '').trim();
  const matchTitle = String(body.matchTitle || '').trim();
  const scoreLine = String(body.scoreLine || '').trim();
  const statusLabel = String(body.statusLabel || '').trim();
  const summary = String(body.summary || '').trim();
  const videoScript = String(body.videoScript || '').trim();
  if (!matchId) return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
  if (!matchTitle || !summary || !videoScript) return NextResponse.json({ error: 'بيانات الملخص ناقصة' }, { status: 400 });

  const id = `match_digest_${matchId}_${Date.now().toString(36)}`;
  const turningPoint = String(body.turningPoint || '').trim() || null;
  const facebookPost = String(body.facebookPost || '').trim() || null;
  const infographicPoints = Array.isArray(body.infographicPoints) ? body.infographicPoints : [];

  await prisma.$executeRawUnsafe(
    `INSERT INTO "MatchDigest" (
      "id", "matchId", "matchTitle", "scoreLine", "statusLabel", "summary", "turningPoint", "videoScript", "facebookPost", "infographicPoints", "status", "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("matchId") DO UPDATE SET
      "matchTitle"=EXCLUDED."matchTitle", "scoreLine"=EXCLUDED."scoreLine", "statusLabel"=EXCLUDED."statusLabel",
      "summary"=EXCLUDED."summary", "turningPoint"=EXCLUDED."turningPoint", "videoScript"=EXCLUDED."videoScript",
      "facebookPost"=EXCLUDED."facebookPost", "infographicPoints"=EXCLUDED."infographicPoints", "status"=EXCLUDED."status", "updatedAt"=CURRENT_TIMESTAMP`,
    id, matchId, matchTitle, scoreLine, statusLabel, summary, turningPoint, videoScript, facebookPost, JSON.stringify(infographicPoints), String(body.status || 'published').trim()
  );

  if (body.saveAsNews) {
    const newsId = `press_match_${matchId}_${Date.now().toString(36)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PressNews" (
        "id", "title", "body", "category", "sourceName", "sourceType", "language", "status", "importance", "tags", "relatedMatchId", "publishedAt", "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,'مباريات','تحليل داخلي','internal','ar','published',80,$4::jsonb,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      newsId,
      `ملخص مباراة: ${matchTitle}`,
      summary,
      JSON.stringify(['match-digest', 'بورصة المونديال']),
      matchId
    );
  }

  const item = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchDigest" WHERE "matchId" = ${quoteSql(matchId)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: item[0] }, { headers: { 'Cache-Control': 'no-store' } });
}
