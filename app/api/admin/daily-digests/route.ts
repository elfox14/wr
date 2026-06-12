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

async function ensureDailyDigestTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyDigest" (
      "id" TEXT PRIMARY KEY,
      "digestDate" TEXT NOT NULL UNIQUE,
      "headline" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "videoScript" TEXT NOT NULL,
      "facebookPost" TEXT,
      "youtubeTitle" TEXT,
      "youtubeDescription" TEXT,
      "infographicPoints" JSONB,
      "status" TEXT NOT NULL DEFAULT 'published',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DailyDigest_digestDate_idx" ON "DailyDigest" ("digestDate")');
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any);
  if (!getUser(session)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureDailyDigestTable();
  const items = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "DailyDigest" ORDER BY "digestDate" DESC LIMIT 60');
  return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureDailyDigestTable();
  const body = await req.json().catch(() => ({}));
  const digestDate = String(body.digestDate || new Date().toISOString().slice(0, 10)).trim();
  const headline = String(body.headline || '').trim();
  const summary = String(body.summary || '').trim();
  const videoScript = String(body.videoScript || '').trim();
  if (!headline || headline.length < 5) return NextResponse.json({ error: 'headline is required' }, { status: 400 });
  if (!summary || summary.length < 10) return NextResponse.json({ error: 'summary is required' }, { status: 400 });
  if (!videoScript || videoScript.length < 10) return NextResponse.json({ error: 'videoScript is required' }, { status: 400 });

  const id = `daily_${digestDate}_${Date.now().toString(36)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "DailyDigest" (
      "id", "digestDate", "headline", "summary", "videoScript", "facebookPost", "youtubeTitle", "youtubeDescription", "infographicPoints", "status", "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("digestDate") DO UPDATE SET
      "headline"=EXCLUDED."headline", "summary"=EXCLUDED."summary", "videoScript"=EXCLUDED."videoScript",
      "facebookPost"=EXCLUDED."facebookPost", "youtubeTitle"=EXCLUDED."youtubeTitle", "youtubeDescription"=EXCLUDED."youtubeDescription",
      "infographicPoints"=EXCLUDED."infographicPoints", "status"=EXCLUDED."status", "updatedAt"=CURRENT_TIMESTAMP`,
    id,
    digestDate,
    headline,
    summary,
    videoScript,
    String(body.facebookPost || '').trim() || null,
    String(body.youtubeTitle || '').trim() || null,
    String(body.youtubeDescription || '').trim() || null,
    JSON.stringify(Array.isArray(body.infographicPoints) ? body.infographicPoints : []),
    String(body.status || 'published').trim()
  );
  const item = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "DailyDigest" WHERE "digestDate" = ${quoteSql(digestDate)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: item[0] }, { headers: { 'Cache-Control': 'no-store' } });
}
