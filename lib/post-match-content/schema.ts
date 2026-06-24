import prisma from '@/lib/prisma';

let ensured = false;

export async function ensurePostMatchContentTables() {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MatchArticle" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "metaTitle" TEXT NOT NULL,
      "metaDescription" TEXT NOT NULL,
      "excerpt" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "sections" JSONB,
      "statsSummary" JSONB,
      "status" TEXT NOT NULL DEFAULT 'DRAFT_READY',
      "language" TEXT NOT NULL DEFAULT 'ar',
      "seoScore" INTEGER NOT NULL DEFAULT 0,
      "sourceSnapshotId" TEXT,
      "heroImageUrl" TEXT,
      "infographicImageUrl" TEXT,
      "publishedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MatchArticle_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MatchArticle_matchId_language_key" ON "MatchArticle" ("matchId", "language")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MatchArticle_status_publishedAt_idx" ON "MatchArticle" ("status", "publishedAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MatchArticle_slug_idx" ON "MatchArticle" ("slug")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MatchInfographic" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT NOT NULL,
      "articleId" TEXT,
      "type" TEXT NOT NULL DEFAULT 'MATCH_STATS',
      "title" TEXT NOT NULL,
      "imageUrl" TEXT NOT NULL,
      "data" JSONB,
      "sourceSnapshotId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'READY',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MatchInfographic_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE,
      CONSTRAINT "MatchInfographic_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "MatchArticle"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MatchInfographic_matchId_type_idx" ON "MatchInfographic" ("matchId", "type")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MatchInfographic_status_idx" ON "MatchInfographic" ("status")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MediaAsset" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT,
      "articleId" TEXT,
      "assetType" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "width" INTEGER,
      "height" INTEGER,
      "altText" TEXT,
      "caption" TEXT,
      "credit" TEXT,
      "source" TEXT NOT NULL DEFAULT 'generated-template',
      "licenseStatus" TEXT NOT NULL DEFAULT 'safe-generated',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MediaAsset_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE,
      CONSTRAINT "MediaAsset_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "MatchArticle"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MediaAsset_matchId_assetType_idx" ON "MediaAsset" ("matchId", "assetType")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MediaAsset_articleId_idx" ON "MediaAsset" ("articleId")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ArticleGenerationJob" (
      "id" TEXT PRIMARY KEY,
      "matchId" TEXT NOT NULL,
      "articleId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'STARTED',
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" TIMESTAMP(3),
      "errorMessage" TEXT,
      "sourceSnapshotId" TEXT,
      "createdBy" TEXT NOT NULL DEFAULT 'post-match-content-engine',
      CONSTRAINT "ArticleGenerationJob_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE,
      CONSTRAINT "ArticleGenerationJob_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "MatchArticle"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ArticleGenerationJob_matchId_startedAt_idx" ON "ArticleGenerationJob" ("matchId", "startedAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ArticleGenerationJob_status_idx" ON "ArticleGenerationJob" ("status")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EditorialReview" (
      "id" TEXT PRIMARY KEY,
      "articleId" TEXT NOT NULL,
      "reviewer" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "notes" TEXT,
      "reviewedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EditorialReview_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "MatchArticle"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EditorialReview_articleId_status_idx" ON "EditorialReview" ("articleId", "status")`);

  ensured = true;
}
