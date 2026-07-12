import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureMatchArticleTables } from '@/lib/match-analysis/verified-article-engine';
import MatchArticleEditor from './MatchArticleEditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchArticleEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/login');
  await ensureMatchArticleTables();
  const { id } = await params;
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchArticle" WHERE "id"=$1 LIMIT 1`, id);
  if (!rows[0]) notFound();
  return <MatchArticleEditor article={JSON.parse(JSON.stringify(rows[0]))} />;
}
