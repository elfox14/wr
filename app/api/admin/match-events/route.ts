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

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function ensureMatchEventTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MatchEvent" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT NOT NULL,
      "minute" INTEGER,
      "type" TEXT NOT NULL DEFAULT 'note',
      "teamId" TEXT,
      "playerName" TEXT,
      "detail" TEXT NOT NULL,
      "sourceName" TEXT,
      "sourceUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchEvent_matchId_minute_idx" ON "MatchEvent" ("matchId", "minute")');
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function normalizeEventPayload(body: any) {
  const matchId = String(body.matchId || '').trim();
  const type = String(body.type || 'note').trim();
  const detail = String(body.detail || '').trim();
  const teamId = String(body.teamId || '').trim() || null;
  const playerName = String(body.playerName || '').trim() || null;
  const sourceName = String(body.sourceName || '').trim() || null;
  const sourceUrl = String(body.sourceUrl || '').trim() || null;
  const minuteRaw = body.minute === '' || body.minute === null || typeof body.minute === 'undefined' ? null : Number(body.minute);
  const minute = Number.isFinite(minuteRaw as number) ? Math.max(0, Math.min(130, Number(minuteRaw))) : null;
  if (!matchId) return { error: 'اختر المباراة أولًا' };
  if (!detail || detail.length < 4) return { error: 'تفاصيل الحدث قصيرة جدًا' };
  return { matchId, type, detail, teamId, playerName, sourceName, sourceUrl, minute };
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await ensureMatchEventTable();
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || '';
  if (!matchId) return NextResponse.json({ error: 'matchId is required' }, { status: 400 });

  const items = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "MatchEvent"
    WHERE "matchId" = ${quoteSql(matchId)}
    ORDER BY COALESCE("minute", 999), "createdAt" ASC
    LIMIT 100
  `);

  return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await ensureMatchEventTable();
  const body = await req.json().catch(() => ({}));
  const payload = normalizeEventPayload(body);
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 });

  const match = await prisma.match.findUnique({ where: { id: payload.matchId }, select: { id: true } });
  if (!match) return NextResponse.json({ error: 'المباراة غير موجودة' }, { status: 404 });

  const id = `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MatchEvent" (
      "id", "matchId", "minute", "type", "teamId", "playerName", "detail", "sourceName", "sourceUrl", "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    id, payload.matchId, payload.minute, payload.type, payload.teamId, payload.playerName, payload.detail, payload.sourceName, payload.sourceUrl
  );

  const created = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchEvent" WHERE "id" = ${quoteSql(id)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: created[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await ensureMatchEventTable();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const payload = normalizeEventPayload(body);
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 });

  await prisma.$executeRawUnsafe(
    `UPDATE "MatchEvent" SET
      "matchId"=$2, "minute"=$3, "type"=$4, "teamId"=$5, "playerName"=$6,
      "detail"=$7, "sourceName"=$8, "sourceUrl"=$9, "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1`,
    id, payload.matchId, payload.minute, payload.type, payload.teamId, payload.playerName, payload.detail, payload.sourceName, payload.sourceUrl
  );

  const updated = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchEvent" WHERE "id" = ${quoteSql(id)} LIMIT 1`);
  return NextResponse.json({ ok: true, item: updated[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await ensureMatchEventTable();
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await prisma.$executeRawUnsafe(`DELETE FROM "MatchEvent" WHERE "id" = ${quoteSql(id)}`);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
