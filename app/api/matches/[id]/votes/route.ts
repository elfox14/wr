import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Choice = 'home' | 'draw' | 'away';
type RouteContext = { params: Promise<{ id: string }> };
const choices: Choice[] = ['home', 'draw', 'away'];

function key(req: Request) {
  return createHash('sha256').update(`${req.headers.get('x-forwarded-for') || ''}|${req.headers.get('user-agent') || ''}|match-vote-v1`).digest('hex');
}

async function ensureTable() {
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "MatchVote" ("id" TEXT PRIMARY KEY, "matchId" TEXT NOT NULL, "voterKey" TEXT NOT NULL, "choice" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "MatchVote_matchId_voterKey_key" ON "MatchVote" ("matchId", "voterKey")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchVote_matchId_choice_idx" ON "MatchVote" ("matchId", "choice")');
}

async function totals(matchId: string) {
  await ensureTable();
  const rows = await prisma.$queryRaw<Array<{ choice: Choice; count: bigint }>>`SELECT "choice", COUNT(*)::bigint AS "count" FROM "MatchVote" WHERE "matchId" = ${matchId} GROUP BY "choice"`;
  const out = { home: 0, draw: 0, away: 0, total: 0 };
  for (const row of rows) if (choices.includes(row.choice)) { const count = Number(row.count || 0); out[row.choice] = count; out.total += count; }
  return out;
}

async function mine(matchId: string, voterKey: string) {
  await ensureTable();
  const rows = await prisma.$queryRaw<Array<{ choice: Choice }>>`SELECT "choice" FROM "MatchVote" WHERE "matchId" = ${matchId} AND "voterKey" = ${voterKey} LIMIT 1`;
  return rows[0]?.choice || null;
}

export async function GET(req: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: true, matchId: id, totals: await totals(id), myVote: await mine(id, key(req)) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const choice = String(body?.choice || '').toLowerCase() as Choice;
  if (!id || !choices.includes(choice)) return NextResponse.json({ ok: false }, { status: 400 });
  await ensureTable();
  const voterKey = key(req);
  await prisma.$executeRaw`INSERT INTO "MatchVote" ("id", "matchId", "voterKey", "choice", "createdAt", "updatedAt") VALUES (${randomUUID()}, ${id}, ${voterKey}, ${choice}, NOW(), NOW()) ON CONFLICT ("matchId", "voterKey") DO UPDATE SET "choice" = EXCLUDED."choice", "updatedAt" = NOW()`;
  return NextResponse.json({ ok: true, matchId: id, myVote: choice, totals: await totals(id) }, { headers: { 'Cache-Control': 'no-store' } });
}
