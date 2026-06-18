import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ArrowLeft, FileJson, Radio } from 'lucide-react';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';
import GenerateMatchArticleButton from './GenerateMatchArticleButton';
import DigitalMatchStatsPage from './DigitalMatchStatsPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'صفحة المباراة الرقمية | MC PRIME World Cup',
  description: 'صفحة رقمية موحّدة لنتيجة المباراة، الإحصائيات، التشكيلات، الأحداث، والقراءة الذكية.',
};

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type MatchArticleSummary = { latest: { id: string; title: string; status?: string | null; updatedAt?: Date | string | null } | null; count: number; latestUpdatedAt?: Date | string | null };

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function suppliedSecret(params: Record<string, string | string[] | undefined> | undefined) {
  return String(getParam(params, 'adminSecret') || getParam(params, 'key') || getParam(params, 'cronSecret') || '').trim();
}

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 8 },
    },
  });
}

async function getMatchArticleSummary(matchId: string): Promise<MatchArticleSummary> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT "id", "title", "status", "updatedAt" FROM "PressNews" WHERE "relatedMatchId" = $1 ORDER BY "updatedAt" DESC, "publishedAt" DESC LIMIT 1',
      matchId
    );
    const counts = await prisma.$queryRawUnsafe<any[]>(
      'SELECT COUNT(*)::int AS "count", MAX("updatedAt") AS "latestUpdatedAt" FROM "PressNews" WHERE "relatedMatchId" = $1',
      matchId
    );
    return { latest: rows[0] || null, count: Number(counts[0]?.count || 0), latestUpdatedAt: counts[0]?.latestUpdatedAt || rows[0]?.updatedAt || null };
  } catch (error) {
    return { latest: null, count: 0, latestUpdatedAt: null };
  }
}

function AdminMatchTools({ matchId, secret }: { matchId: string; secret: string }) {
  if (!secret) return null;
  const query = encodeURIComponent(secret);
  return (
    <section className="rounded-[1.45rem] border border-emerald-400/15 bg-emerald-400/[0.06] p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">Admin tools</p>
          <h2 className="mt-1 text-lg font-black text-white">أدوات تحديث بيانات هذه المباراة</h2>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-black text-emerald-200">مخفية عن الزوار</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/admin/the-stats-import-match-enrichment?adminSecret=${query}&matchId=${encodeURIComponent(matchId)}&dryRun=true`} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-300/15">Preview الإثراء</a>
        <a href={`/api/admin/the-stats-import-match-enrichment?adminSecret=${query}&matchId=${encodeURIComponent(matchId)}&dryRun=false`} target="_blank" rel="noreferrer" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/15">Import الإثراء</a>
        <a href={`/api/admin/match-infographic-data?adminSecret=${query}&matchId=${encodeURIComponent(matchId)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-2 text-xs font-black text-[#EAFBFF] hover:bg-[#0FF0FC]/15"><FileJson size={14} className="inline" /> JSON الإنفوجراف</a>
        <Link href={`/admin/match-snapshots?adminSecret=${query}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10">مراجعة Snapshots</Link>
      </div>
    </section>
  );
}

export default async function MatchCenterPage({ params, searchParams }: { params: Promise<{ id: string }> | { id: string }; searchParams?: SearchParams }) {
  const resolved = await params;
  const queryParams = (await searchParams) || {};
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const session = await getServerSession(authOptions as any) as AdminSession;
  const canGenerateArticle = isAdmin(session);
  const articleSummary = canGenerateArticle ? await getMatchArticleSummary(match.id) : { latest: null, count: 0, latestUpdatedAt: null };
  const existingArticle = articleSummary.latest;
  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';
  const adminSecret = canGenerateArticle ? suppliedSecret(queryParams) : '';

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        {canGenerateArticle && (
          <GenerateMatchArticleButton
            matchId={match.id}
            existingArticle={existingArticle ? {
              title: existingArticle.title,
              url: `/news/${existingArticle.id}`,
              status: existingArticle.status || 'published',
              updatedAt: existingArticle.updatedAt || articleSummary.latestUpdatedAt || null,
              count: articleSummary.count,
            } : {
              title: '',
              url: '',
              status: null,
              updatedAt: articleSummary.latestUpdatedAt || null,
              count: articleSummary.count,
            }}
          />
        )}
        {canGenerateArticle ? <AdminMatchTools matchId={match.id} secret={adminSecret} /> : null}
        <section id="live-broadcast" className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-3 shadow-card sm:rounded-[1.5rem] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex min-w-0 items-center gap-2 text-base font-black text-white sm:text-xl"><Radio className="text-[#FFD700]" /> البث التفاعلي</h1>
              <div className="mt-1 text-[10px] font-black text-[#FFD700]">المشغل التفاعلي المباشر</div>
            </div>
            <Link href="/matches" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 text-sm font-black text-[#EAFBFF] transition hover:border-[#0FF0FC]/45 hover:bg-[#0FF0FC]/15 hover:text-white">
              العودة إلى المباريات <ArrowLeft size={16} />
            </Link>
          </div>
          <InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} />
        </section>
        <DigitalMatchStatsPage match={match} />
      </section>
    </main>
  );
}
