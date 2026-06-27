import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';
import { generateArticleForMatch } from '@/lib/post-match-content/generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Action = 'article' | 'infographic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function normalizeAction(value: unknown): Action {
  const text = String(value || '').trim().toLowerCase();
  return text === 'infographic' ? 'infographic' : 'article';
}

function metricValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metricRows(match: any) {
  return [
    { key: 'possession', label: 'الاستحواذ', home: match.homePossession, away: match.awayPossession, suffix: '%' },
    { key: 'shots', label: 'التسديدات', home: match.homeShots, away: match.awayShots },
    { key: 'shots_on_target', label: 'على المرمى', home: match.homeShotsOnTarget, away: match.awayShotsOnTarget },
    { key: 'corners', label: 'الركنيات', home: match.homeCorners, away: match.awayCorners },
    { key: 'yellow_cards', label: 'بطاقات صفراء', home: match.homeYellowCards, away: match.awayYellowCards },
    { key: 'red_cards', label: 'بطاقات حمراء', home: match.homeRedCards, away: match.awayRedCards },
    { key: 'attacks', label: 'الهجمات', home: match.homeAttacks, away: match.awayAttacks },
    { key: 'dangerous_attacks', label: 'هجمات خطيرة', home: match.homeDangerousAttacks, away: match.awayDangerousAttacks },
  ].filter((metric) => metric.home !== null || metric.away !== null);
}

async function findMatchForContent(matchId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      m."id",
      m."status",
      m."matchDate",
      m."homeScore",
      m."awayScore",
      m."groupPhase",
      m."stage",
      m."homeTeamId",
      m."awayTeamId",
      home."name" AS "homeTeamName",
      away."name" AS "awayTeamName",
      home."code" AS "homeTeamCode",
      away."code" AS "awayTeamCode",
      latest."id" AS "snapshotId",
      latest."provider" AS "provider",
      latest."capturedAt" AS "capturedAt",
      latest."homePossession" AS "homePossession",
      latest."awayPossession" AS "awayPossession",
      latest."homeShots" AS "homeShots",
      latest."awayShots" AS "awayShots",
      latest."homeShotsOnTarget" AS "homeShotsOnTarget",
      latest."awayShotsOnTarget" AS "awayShotsOnTarget",
      latest."homeCorners" AS "homeCorners",
      latest."awayCorners" AS "awayCorners",
      latest."homeYellowCards" AS "homeYellowCards",
      latest."awayYellowCards" AS "awayYellowCards",
      latest."homeRedCards" AS "homeRedCards",
      latest."awayRedCards" AS "awayRedCards",
      latest."homeAttacks" AS "homeAttacks",
      latest."awayAttacks" AS "awayAttacks",
      latest."homeDangerousAttacks" AS "homeDangerousAttacks",
      latest."awayDangerousAttacks" AS "awayDangerousAttacks"
    FROM "Match" m
    JOIN "Asset" home ON home."id" = m."homeTeamId"
    JOIN "Asset" away ON away."id" = m."awayTeamId"
    LEFT JOIN LATERAL (
      SELECT * FROM "MatchStatsSnapshot" s
      WHERE s."matchId" = m."id"
      ORDER BY s."capturedAt" DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE m."id" = $1
    LIMIT 1
  `, matchId);
  return rows[0] || null;
}

async function existingArticle(matchId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "id", "matchId", "title", "slug", "status", "infographicImageUrl", "updatedAt"
    FROM "MatchArticle"
    WHERE "matchId" = $1 AND "language" = 'ar'
    LIMIT 1
  `, matchId);
  return rows[0] || null;
}

async function existingInfographic(matchId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "id", "matchId", "articleId", "title", "imageUrl", "status", "updatedAt"
    FROM "MatchInfographic"
    WHERE "matchId" = $1 AND "type" = 'MATCH_STATS'
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `, matchId);
  return rows[0] || null;
}

async function publishArticle(articleId: string) {
  await prisma.$executeRawUnsafe(`
    UPDATE "MatchArticle"
    SET "status" = 'PUBLISHED', "publishedAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = $1
  `, articleId);
}

async function createOrRefreshInfographic(match: any, article: any | null) {
  const current = await existingInfographic(match.id);
  const data = {
    scoreLine: `${match.homeTeamName} ${metricValue(match.homeScore) ?? 0} - ${metricValue(match.awayScore) ?? 0} ${match.awayTeamName}`,
    provider: match.provider,
    capturedAt: match.capturedAt,
    homeTeam: { id: match.homeTeamId, name: match.homeTeamName, code: match.homeTeamCode },
    awayTeam: { id: match.awayTeamId, name: match.awayTeamName, code: match.awayTeamCode },
    metrics: metricRows(match),
  };
  const id = current?.id || randomUUID();
  const imageUrl = current?.imageUrl || article?.infographicImageUrl || `/match-infographic/${id}`;
  const title = `إنفوجرافيك إحصائيات ${match.homeTeamName} ضد ${match.awayTeamName}`;

  if (current) {
    await prisma.$executeRawUnsafe(`
      UPDATE "MatchInfographic"
      SET "articleId" = COALESCE($1, "articleId"), "title" = $2, "imageUrl" = $3, "data" = $4::jsonb, "sourceSnapshotId" = $5, "status" = 'READY', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $6
    `, article?.id || null, title, imageUrl, JSON.stringify(data), match.snapshotId, id);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "MatchInfographic" ("id", "matchId", "articleId", "type", "title", "imageUrl", "data", "sourceSnapshotId", "status", "updatedAt")
      VALUES ($1, $2, $3, 'MATCH_STATS', $4, $5, $6::jsonb, $7, 'READY', CURRENT_TIMESTAMP)
    `, id, match.id, article?.id || null, title, imageUrl, JSON.stringify(data), match.snapshotId);
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO "MediaAsset" ("id", "matchId", "articleId", "assetType", "url", "width", "height", "altText", "caption", "credit", "source", "licenseStatus", "updatedAt")
    VALUES ($1, $2, $3, 'INFOGRAPHIC', $4, 1200, 675, $5, $6, 'MC PRIME generated template', 'generated-template', 'safe-generated', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING
  `, randomUUID(), match.id, article?.id || null, imageUrl, `إنفوجرافيك إحصائيات ${match.homeTeamName} و${match.awayTeamName}`, 'إنفوجرافيك مبني على الإحصائيات النهائية المحفوظة');

  return { id, title, imageUrl, data };
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  await ensurePostMatchContentTables();

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const matchId = String(body.matchId || '').trim();
  const action = normalizeAction(body.action);
  const autoPublish = body.autoPublish !== false;

  if (!matchId) return json({ ok: false, error: 'matchId is required.' }, 400);

  const match = await findMatchForContent(matchId);
  if (!match) return json({ ok: false, error: 'Match not found.' }, 404);
  if (!match.snapshotId) return json({ ok: false, error: 'No stats snapshot found for this match. Run final stats sync first.' }, 409);

  let article = await existingArticle(matchId);

  if (action === 'article') {
    if (!article) {
      const generated = await generateArticleForMatch(match as any, { autoPublish });
      article = await existingArticle(matchId);
      if (article && autoPublish) await publishArticle(article.id);
      const infographic = await existingInfographic(matchId);
      return json({ ok: true, action, generated, article, infographic, articleUrl: article?.slug ? `/articles/${article.slug}` : null });
    }

    if (autoPublish && article.status !== 'PUBLISHED') {
      await publishArticle(article.id);
      article = await existingArticle(matchId);
    }

    return json({ ok: true, action, article, articleUrl: article?.slug ? `/articles/${article.slug}` : null, note: 'Article already existed.' });
  }

  if (!article) {
    await generateArticleForMatch(match as any, { autoPublish: false });
    article = await existingArticle(matchId);
  }

  const infographic = await createOrRefreshInfographic(match, article);
  return json({ ok: true, action, article, infographic, infographicUrl: infographic.imageUrl });
}
