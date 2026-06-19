import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type VoteChoice = 'home' | 'draw' | 'away';
const choices: VoteChoice[] = ['home', 'draw', 'away'];

async function ensureVotesTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MatchVote" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT NOT NULL,
      "voterKey" TEXT NOT NULL,
      "choice" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MatchVote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "MatchVote_choice_check" CHECK ("choice" IN ('home', 'draw', 'away'))
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MatchVote_matchId_voterKey_key" ON "MatchVote" ("matchId", "voterKey");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MatchVote_matchId_choice_idx" ON "MatchVote" ("matchId", "choice");`);
}

function voterKey(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const ip = req.headers.get('cf-connecting-ip') || forwardedFor.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown-ip';
  const userAgent = req.headers.get('user-agent') || 'unknown-agent';
  const acceptLanguage = req.headers.get('accept-language') || '';
  return createHash('sha256').update(`${ip}|${userAgent}|${acceptLanguage}|match-vote-v1`).digest('hex');
}

function emptyCounts() {
  return { home: 0, draw: 0, away: 0, total: 0 };
}

async function counts(matchId: string) {
  await ensureVotesTable();
  const rows = await prisma.$queryRaw<Array<{ choice: VoteChoice; count: bigint }>>`
    SELECT "choice", COUNT(*)::bigint AS "count"
    FROM "MatchVote"
    WHERE "matchId" = ${matchId}
    GROUP BY "choice"
  `;
  const result = emptyCounts();
  for (const row of rows) {
    if (choices.includes(row.choice)) {
      const value = Number(row.count || 0);
      result[row.choice] = value;
      result.total += value;
    }
  }
  return result;
}

async function currentChoice(matchId: string, key: string) {
  await ensureVotesTable();
  const rows = await prisma.$queryRaw<Array<{ choice: VoteChoice }>>`
    SELECT "choice"
    FROM "MatchVote"
    WHERE "matchId" = ${matchId} AND "voterKey" = ${key}
    LIMIT 1
  `;
  return rows[0]?.choice || null;
}

export async function GET(req: Request, { params }: { params: Promise<{ matchId: string }> | { matchId: string } }) {
  const { matchId } = await params;
  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
  const [totals, myVote] = await Promise.all([counts(matchId), currentChoice(matchId, voterKey(req))]);
  return NextResponse.json({ ok: true, matchId, totals, myVote }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

export async function POST(req: Request, { params }: { params: Promise<{ matchId: string }> | { matchId: string } }) {
  const { matchId } = await params;
  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const choice = String(body?.choice || '').toLowerCase() as VoteChoice;
  if (!choices.includes(choice)) return NextResponse.json({ ok: false, error: 'choice must be home, draw, or away' }, { status: 400 });

  await ensureVotesTable();
  const key = voterKey(req);
  await prisma.$executeRaw`
    INSERT INTO "MatchVote" ("id", "matchId", "voterKey", "choice", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${matchId}, ${key}, ${choice}, NOW(), NOW())
    ON CONFLICT ("matchId", "voterKey")
    DO UPDATE SET "choice" = EXCLUDED."choice", "updatedAt" = NOW()
  `;
  const totals = await counts(matchId);
  return NextResponse.json({ ok: true, matchId, myVote: choice, totals }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
