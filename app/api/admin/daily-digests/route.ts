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
function quoteSql(value: string) { return `'${String(value).replace(/'/g, "''")}'`; }
async function ensureTables() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DailyDigest" ("id" TEXT PRIMARY KEY,"digestDate" TEXT NOT NULL UNIQUE,"headline" TEXT NOT NULL,"summary" TEXT NOT NULL,"videoScript" TEXT NOT NULL,"facebookPost" TEXT,"youtubeTitle" TEXT,"youtubeDescription" TEXT,"infographicPoints" JSONB,"status" TEXT NOT NULL DEFAULT 'published',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DailyDigest_digestDate_idx" ON "DailyDigest" ("digestDate")');
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PressNews" ("id" TEXT PRIMARY KEY,"title" TEXT NOT NULL,"body" TEXT NOT NULL,"category" TEXT NOT NULL DEFAULT 'رصد صحفي',"sourceName" TEXT NOT NULL,"sourceUrl" TEXT,"sourceType" TEXT NOT NULL DEFAULT 'internal',"language" TEXT NOT NULL DEFAULT 'ar',"status" TEXT NOT NULL DEFAULT 'published',"importance" INTEGER NOT NULL DEFAULT 70,"tags" JSONB,"relatedTeamId" TEXT,"relatedPlayerId" TEXT,"relatedMatchId" TEXT,"publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}
async function requireAdmin() {
  const session = await getServerSession(authOptions as any);
  if (!getUser(session)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}
function parsePayload(body: any) {
  const digestDate = String(body.digestDate || new Date().toISOString().slice(0, 10)).trim();
  const headline = String(body.headline || '').trim();
  const summary = String(body.summary || '').trim();
  const videoScript = String(body.videoScript || '').trim();
  if (!headline || headline.length < 5) return { error: 'headline is required' };
  if (!summary || summary.length < 10) return { error: 'summary is required' };
  if (!videoScript || videoScript.length < 10) return { error: 'videoScript is required' };
  return { digestDate, headline, summary, videoScript, facebookPost: String(body.facebookPost || '').trim() || null, youtubeTitle: String(body.youtubeTitle || '').trim() || null, youtubeDescription: String(body.youtubeDescription || '').trim() || null, infographicPoints: Array.isArray(body.infographicPoints) ? body.infographicPoints : [], status: String(body.status || 'published').trim() };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureTables();
  const items = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "DailyDigest" ORDER BY "digestDate" DESC LIMIT 60');
  return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureTables();
  const body = await req.json().catch(() => ({}));
  const payload = parsePayload(body);
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 });
  const id = `daily_${payload.digestDate}_${Date.now().toString(36)}`;
  await prisma.$executeRawUnsafe(`INSERT INTO "DailyDigest" ("id","digestDate","headline","summary","videoScript","facebookPost","youtubeTitle","youtubeDescription","infographicPoints","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("digestDate") DO UPDATE SET "headline"=EXCLUDED."headline","summary"=EXCLUDED."summary","videoScript"=EXCLUDED."videoScript","facebookPost"=EXCLUDED."facebookPost","youtubeTitle"=EXCLUDED."youtubeTitle","youtubeDescription"=EXCLUDED."youtubeDescription","infographicPoints"=EXCLUDED."infographicPoints","status"=EXCLUDED."status","updatedAt"=CURRENT_TIMESTAMP`, id, payload.digestDate, payload.headline, payload.summary, payload.videoScript, payload.facebookPost, payload.youtubeTitle, payload.youtubeDescription, JSON.stringify(payload.infographicPoints), payload.status);
  if (body.saveAsNews) {
    const newsId = `press_daily_${payload.digestDate}_${Date.now().toString(36)}`;
    await prisma.$executeRawUnsafe(`INSERT INTO "PressNews" ("id","title","body","category","sourceName","sourceType","language","status","importance","tags","publishedAt","createdAt","updatedAt") VALUES ($1,$2,$3,'ملخص اليوم','تحليل داخلي','internal','ar','published',75,$4::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, newsId, `ملخص اليوم: ${payload.headline}`, payload.summary, JSON.stringify(['daily-digest', 'بورصة المونديال']));
  }
  const item = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "DailyDigest" WHERE "digestDate" = ${quoteSql(payload.digestDate)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: item[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureTables();
  const body = await req.json().catch(() => ({}));
  const payload = parsePayload(body);
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 });
  await prisma.$executeRawUnsafe(`UPDATE "DailyDigest" SET "headline"=$2,"summary"=$3,"videoScript"=$4,"facebookPost"=$5,"youtubeTitle"=$6,"youtubeDescription"=$7,"infographicPoints"=$8::jsonb,"status"=$9,"updatedAt"=CURRENT_TIMESTAMP WHERE "digestDate"=$1`, payload.digestDate, payload.headline, payload.summary, payload.videoScript, payload.facebookPost, payload.youtubeTitle, payload.youtubeDescription, JSON.stringify(payload.infographicPoints), payload.status);
  const item = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "DailyDigest" WHERE "digestDate" = ${quoteSql(payload.digestDate)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: item[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureTables();
  const url = new URL(req.url);
  const digestDate = url.searchParams.get('digestDate') || '';
  if (!digestDate) return NextResponse.json({ error: 'digestDate is required' }, { status: 400 });
  await prisma.$executeRawUnsafe(`DELETE FROM "DailyDigest" WHERE "digestDate" = ${quoteSql(digestDate)}`);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
