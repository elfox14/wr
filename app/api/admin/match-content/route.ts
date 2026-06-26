import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { generateArticleForMatch } from '@/lib/post-match-content/generator';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function existingArticle(matchId: string) {
  await ensurePostMatchContentTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "slug", "status", "infographicImageUrl", "heroImageUrl" FROM "MatchArticle" WHERE "matchId" = $1 AND "language" = 'ar' LIMIT 1`,
    matchId,
  );
  return rows[0] || null;
}

export async function POST(req: Request) {
  if (!hasValidAdminSecret(req)) return response({ ok: false, error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const matchId = String(body.matchId || '').trim();
  const autoPublish = ['1', 'true', 'yes', 'on'].includes(String(body.autoPublish || '').toLowerCase());
  if (!matchId) return response({ ok: false, error: 'matchId is required' }, 400);

  const existing = await existingArticle(matchId);
  if (existing) {
    return response({
      ok: true,
      mode: 'admin_match_content_existing',
      matchId,
      article: existing,
      articleUrl: `/articles/${existing.slug}`,
      infographicUrl: existing.infographicImageUrl,
    });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!match) return response({ ok: false, error: 'match not found', matchId }, 404);
  const snapshot = match.statsSnapshots[0];
  if (!snapshot) return response({ ok: false, error: 'No stats snapshot found for this match.', matchId }, 400);

  const candidate = {
    id: match.id,
    status: match.status,
    matchDate: match.matchDate,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    groupPhase: match.groupPhase,
    stage: match.stage,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeTeamName: match.homeTeam?.name || match.homeTeamId,
    awayTeamName: match.awayTeam?.name || match.awayTeamId,
    homeTeamCode: match.homeTeam?.code || null,
    awayTeamCode: match.awayTeam?.code || null,
    snapshotId: snapshot.id,
    provider: snapshot.provider,
    capturedAt: snapshot.capturedAt,
    homePossession: numberOrNull(snapshot.homePossession),
    awayPossession: numberOrNull(snapshot.awayPossession),
    homeShots: numberOrNull(snapshot.homeShots),
    awayShots: numberOrNull(snapshot.awayShots),
    homeShotsOnTarget: numberOrNull(snapshot.homeShotsOnTarget),
    awayShotsOnTarget: numberOrNull(snapshot.awayShotsOnTarget),
    homeCorners: numberOrNull(snapshot.homeCorners),
    awayCorners: numberOrNull(snapshot.awayCorners),
    homeYellowCards: numberOrNull(snapshot.homeYellowCards),
    awayYellowCards: numberOrNull(snapshot.awayYellowCards),
    homeRedCards: numberOrNull(snapshot.homeRedCards),
    awayRedCards: numberOrNull(snapshot.awayRedCards),
    homeAttacks: numberOrNull(snapshot.homeAttacks),
    awayAttacks: numberOrNull(snapshot.awayAttacks),
    homeDangerousAttacks: numberOrNull(snapshot.homeDangerousAttacks),
    awayDangerousAttacks: numberOrNull(snapshot.awayDangerousAttacks),
  };

  try {
    const generated = await generateArticleForMatch(candidate as any, { autoPublish });
    return response({
      ok: true,
      mode: 'admin_match_content_generated',
      matchId,
      generated,
      articleUrl: generated.slug ? `/articles/${generated.slug}` : null,
      requestId: randomUUID(),
    });
  } catch (error: any) {
    return response({ ok: false, error: String(error?.message || error), matchId }, 500);
  }
}

export async function GET(req: Request) {
  if (!hasValidAdminSecret(req)) return response({ ok: false, error: 'Unauthorized' }, 401);
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || '';
  const fakeReq = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ matchId, autoPublish: url.searchParams.get('autoPublish') || 'false' }),
  });
  return POST(fakeReq);
}
