import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import MatchContentActionsManager from '@/components/admin/MatchContentActionsManager';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'أدوات مقال المباراة | لوحة الأدمن',
  robots: { index: false, follow: false },
};

type SessionLike = { user?: { role?: string | null } } | null;

async function getRows() {
  await ensurePostMatchContentTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      m."id",
      m."matchDate",
      m."status",
      m."homeScore",
      m."awayScore",
      home."name" AS "homeTeamName",
      away."name" AS "awayTeamName",
      latest."id" AS "snapshotId",
      latest."provider" AS "snapshotProvider",
      article."slug" AS "articleSlug",
      article."status" AS "articleStatus",
      infographic."imageUrl" AS "infographicUrl",
      infographic."status" AS "infographicStatus"
    FROM "Match" m
    JOIN "Asset" home ON home."id" = m."homeTeamId"
    JOIN "Asset" away ON away."id" = m."awayTeamId"
    LEFT JOIN LATERAL (
      SELECT s."id", s."provider", s."capturedAt"
      FROM "MatchStatsSnapshot" s
      WHERE s."matchId" = m."id"
      ORDER BY s."capturedAt" DESC
      LIMIT 1
    ) latest ON TRUE
    LEFT JOIN "MatchArticle" article ON article."matchId" = m."id" AND article."language" = 'ar'
    LEFT JOIN LATERAL (
      SELECT i."imageUrl", i."status", i."updatedAt"
      FROM "MatchInfographic" i
      WHERE i."matchId" = m."id" AND i."type" = 'MATCH_STATS'
      ORDER BY i."updatedAt" DESC
      LIMIT 1
    ) infographic ON TRUE
    ORDER BY m."matchDate" DESC
    LIMIT 40
  `);

  return rows.map((row) => ({
    id: row.id,
    matchDate: new Date(row.matchDate).toISOString(),
    status: row.status,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    snapshotId: row.snapshotId,
    snapshotProvider: row.snapshotProvider,
    articleSlug: row.articleSlug,
    articleStatus: row.articleStatus,
    infographicUrl: row.infographicUrl,
    infographicStatus: row.infographicStatus,
  }));
}

export default async function AdminMatchContentToolsPage() {
  const session = await getServerSession(authOptions as any) as SessionLike;
  if (!session?.user) redirect('/login?callbackUrl=/admin/match-content-tools');
  if (session.user.role !== 'ADMIN') redirect('/');

  const rows = await getRows();

  return (
    <AdminShell
      title="أدوات مقال المباراة والإنفوغرافيك"
      subtitle="اختر مباراة من القائمة، ثم أنشئ مقال SEO أو جهّز إنفوغرافيك من آخر Snapshot محفوظة. هذه الصفحة للأدمن فقط ولا تعرض مفاتيح API في المتصفح."
      badge="Post-match Content Admin"
    >
      <MatchContentActionsManager matches={rows} />
    </AdminShell>
  );
}
