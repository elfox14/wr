import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { BookOpen, Clock, ExternalLink, Filter, Newspaper, Sparkles } from 'lucide-react';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import AdSenseBanner from '@/components/ads/AdSenseBanner';
import NewsStatusButton from '@/components/news/NewsStatusButton';
import { MATCH_CENTER_ANALYSIS_CATEGORY } from '@/lib/press-news/constants';
import { ensureWorldCup2026OpeningNews, getPressNewsMeta } from '@/lib/press-news/world-cup-2026-opening-news';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'غرفة الأخبار والتحليلات | بورصة المونديال',
  description: 'متابعة حية وشاملة لآخر أخبار مباريات كأس العالم، تحليلات المنتخبات واللاعبين، وتقارير موثقة قابلة للمشاركة.',
  keywords: ['أخبار كأس العالم', 'تحليل مباريات المونديال', 'كأس العالم 2026', 'ميسي', 'هالاند', 'مبابي', 'بورصة المونديال'],
};

const CATEGORIES = [
  { key: 'all', label: 'كل الأخبار' },
  { key: 'رصد صحفي', label: 'رصد صحفي' },
  { key: 'مباريات', label: 'مباريات' },
  { key: MATCH_CENTER_ANALYSIS_CATEGORY, label: 'تحليل صفحة المباراة' },
  { key: 'إحصائيات', label: 'إحصائيات' },
  { key: 'لاعبون', label: 'لاعبون' },
  { key: 'إصابات', label: 'إصابات' },
  { key: 'منتخبات', label: 'منتخبات' },
  { key: 'السوق', label: 'تحليل السوق' },
];

const STATUS_FILTERS = [
  { key: 'published', label: 'المنشور' },
  { key: 'draft', label: 'المسودات' },
  { key: 'archived', label: 'الأرشيف' },
  { key: 'all', label: 'الكل' },
];

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function ensurePressNewsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PressNews" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'رصد صحفي',
      "sourceName" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "sourceType" TEXT NOT NULL DEFAULT 'newsletter',
      "language" TEXT NOT NULL DEFAULT 'ar',
      "status" TEXT NOT NULL DEFAULT 'published',
      "importance" INTEGER NOT NULL DEFAULT 50,
      "tags" JSONB,
      "relatedTeamId" TEXT,
      "relatedPlayerId" TEXT,
      "relatedMatchId" TEXT,
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedTeamId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedPlayerId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedMatchId" TEXT');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_status_publishedAt_idx" ON "PressNews" ("status", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_category_publishedAt_idx" ON "PressNews" ("category", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_relatedMatchId_idx" ON "PressNews" ("relatedMatchId")');
}

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function matchCenterUrl(item: any) {
  const relatedMatchId = String(item?.relatedMatchId || '').trim();
  if (relatedMatchId) return `/match-center/${relatedMatchId}`;
  const sourceUrl = String(item?.sourceUrl || '').trim();
  if (sourceUrl.startsWith('/match-center/')) return sourceUrl;
  return '';
}

function statusHref(category: string, status: string) {
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (status !== 'published') params.set('status', status);
  const query = params.toString();
  return query ? `/news?${query}` : '/news';
}

function categoryHref(category: string, status: string, isAdminView: boolean) {
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (isAdminView && status !== 'published') params.set('status', status);
  const query = params.toString();
  return query ? `/news?${query}` : '/news';
}

function statusLabel(status: string) {
  if (status === 'draft') return 'مسودة';
  if (status === 'archived') return 'مؤرشف';
  return 'منشور';
}

function newsTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(',').map((tag) => tag.trim()).filter(Boolean);
    }
  }
  return [];
}

type NewsPageProps = {
  searchParams: Promise<{ category?: string; status?: string }>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentCategory = resolvedSearchParams.category || 'all';
  const session = await getServerSession(authOptions as any) as AdminSession;
  const canViewAdminStatus = isAdmin(session);
  const requestedStatus = String(resolvedSearchParams.status || 'published');
  const currentStatus = canViewAdminStatus && ['published', 'draft', 'archived', 'all'].includes(requestedStatus) ? requestedStatus : 'published';

  await ensurePressNewsTable();
  try {
    await ensureWorldCup2026OpeningNews(prisma);
  } catch (error) {
    console.error('Error seeding World Cup opening news:', error);
  }

  let newsItems: any[] = [];
  try {
    if (currentCategory === 'all' && currentStatus === 'all') {
      newsItems = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "PressNews"
        ORDER BY "updatedAt" DESC, "publishedAt" DESC, "importance" DESC
      `);
    } else if (currentCategory === 'all') {
      newsItems = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "PressNews"
        WHERE "status" = $1
        ORDER BY "updatedAt" DESC, "publishedAt" DESC, "importance" DESC
      `, currentStatus);
    } else if (currentStatus === 'all') {
      newsItems = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "PressNews"
        WHERE "category" = $1
        ORDER BY "updatedAt" DESC, "publishedAt" DESC, "importance" DESC
      `, currentCategory);
    } else {
      newsItems = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "PressNews"
        WHERE "status" = $1 AND "category" = $2
        ORDER BY "updatedAt" DESC, "publishedAt" DESC, "importance" DESC
      `, currentStatus, currentCategory);
    }
  } catch (err) {
    console.error('Error fetching news items:', err);
  }

  const heroItem = newsItems[0];
  const heroMeta = heroItem ? getPressNewsMeta(heroItem.tags, heroItem.title) : null;
  const heroTags = newsTags(heroItem?.tags);
  const heroMatchUrl = heroItem ? matchCenterUrl(heroItem) : '';
  const listItems = newsItems.slice(1);
  const isMatchCenterCategory = currentCategory === MATCH_CENTER_ANALYSIS_CATEGORY;
  const isDraftView = canViewAdminStatus && currentStatus === 'draft';
  const isArchiveView = canViewAdminStatus && currentStatus === 'archived';
  const isAdminAllStatusView = canViewAdminStatus && currentStatus === 'all';

  return (
    <main className="min-h-screen bg-[#050505] text-white px-4 py-8 sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.1),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-6 shadow-anti-gravity md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3.5 py-1.5 text-xs font-black text-[#0FF0FC]">
                <Sparkles size={13} /> متابعة حية وموثوقة
              </p>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3 md:text-5xl">
                <Newspaper size={36} className="text-[#FFD700]" /> غرفة الأخبار والتحليلات
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-gray-400">
                أخبار وتحليلات كأس العالم 2026 بصياغة عربية موثقة، مع تصنيف مؤقت لتحليلات صفحة المباراة المبنية على الإحصائيات والأحداث والزخم.
              </p>
            </div>
          </div>
        </section>

        <nav className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-5">
          <span className="text-xs font-black text-gray-500 ml-2 flex items-center gap-1">
            <Filter size={12} /> تصفية حسب:
          </span>
          {CATEGORIES.map((cat) => {
            const isActive = currentCategory === cat.key;
            return (
              <Link
                key={cat.key}
                href={categoryHref(cat.key, currentStatus, canViewAdminStatus)}
                className={`rounded-2xl px-4 py-2 text-xs font-black transition-all ${
                  isActive
                    ? 'bg-[#0FF0FC] text-black shadow-[0_0_15px_rgba(15,240,252,0.3)]'
                    : cat.key === MATCH_CENTER_ANALYSIS_CATEGORY
                      ? 'border border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/15 hover:text-white'
                      : 'border border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </nav>

        {canViewAdminStatus && (
          <section className="rounded-2xl border border-[#FFD700]/15 bg-[#FFD700]/5 p-4">
            <div className="mb-3 text-xs font-black text-[#FFD700]">فلتر إداري لحالة النشر</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((status) => {
                const isActive = currentStatus === status.key;
                return (
                  <Link
                    key={status.key}
                    href={statusHref(currentCategory, status.key)}
                    className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                      isActive
                        ? 'bg-[#FFD700] text-black'
                        : 'border border-[#FFD700]/20 bg-black/20 text-[#FFD700] hover:bg-[#FFD700]/10'
                    }`}
                  >
                    {status.label}
                  </Link>
                );
              })}
            </div>
            {(isDraftView || isArchiveView || isAdminAllStatusView) && (
              <p className="mt-3 text-xs font-bold leading-6 text-gray-400">
                هذا الفلتر يظهر للأدمن فقط. المسودات والأرشيف لا يظهران للزوار ولا لمحركات البحث حتى يتم نشر المقال.
              </p>
            )}
          </section>
        )}

        {isMatchCenterCategory && (
          <section className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/5 p-4">
            <h2 className="mb-2 text-lg font-black text-[#FFD700] flex items-center gap-2"><BookOpen size={18} /> تحليلات صفحة المباراة</h2>
            <p className="text-sm leading-7 text-gray-300">
              هذه المقالات مبنية على بيانات صفحة المباراة: الإحصائيات، الأحداث، الزخم، ترتيب المجموعة، وأفضل الثوالث. يتم نشرها بعد مراجعة المصادر.
            </p>
          </section>
        )}

        {heroItem && (
          <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <Link href={`/news/${heroItem.id}`} className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.06]">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-black">
                <span className="rounded-full bg-[#FFD700]/15 px-3 py-1.5 text-[#FFD700]">{heroItem.category}</span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 text-gray-400"><Clock size={12} className="inline" /> {formatDate(heroItem.publishedAt)}</span>
                {heroItem.status !== 'published' && <span className="rounded-full border border-[#FFD700]/20 px-3 py-1.5 text-[#FFD700]">{statusLabel(heroItem.status)}</span>}
              </div>
              <h2 className="text-3xl font-black leading-tight text-white transition group-hover:text-[#0FF0FC] md:text-4xl">{heroItem.title}</h2>
              <p className="mt-4 line-clamp-4 text-sm leading-7 text-gray-400">{heroItem.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {heroTags.slice(0, 5).map((tag: string) => <span key={tag} className="rounded-xl bg-black/30 px-3 py-1.5 text-xs font-bold text-gray-400">#{tag}</span>)}
              </div>
            </Link>

            <aside className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
              <h3 className="mb-4 text-xl font-black text-white">روابط سريعة</h3>
              <div className="space-y-3">
                {heroMatchUrl && <Link href={heroMatchUrl} className="flex items-center justify-between rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC]">فتح مركز المباراة <ExternalLink size={15} /></Link>}
                {heroItem.sourceUrl && !heroMatchUrl && <a href={heroItem.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-gray-300">المصدر الأصلي <ExternalLink size={15} /></a>}
                <Link href="/matches" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-gray-300">كل المباريات <ExternalLink size={15} /></Link>
                <Link href="/groups" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-gray-300">ترتيب المجموعات <ExternalLink size={15} /></Link>
              </div>
            </aside>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listItems.map((item) => {
            const meta = getPressNewsMeta(item.tags, item.title);
            const tags = newsTags(item.tags);
            const matchUrl = matchCenterUrl(item);
            return (
              <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/20 hover:bg-white/[0.055]">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-gray-400">{item.category}</span>
                  <span className="rounded-full bg-black/30 px-3 py-1 text-gray-500">{formatDate(item.publishedAt)}</span>
                  {item.status !== 'published' && <span className="rounded-full border border-[#FFD700]/20 px-3 py-1 text-[#FFD700]">{statusLabel(item.status)}</span>}
                </div>
                <Link href={`/news/${item.id}`} className="block">
                  <h3 className="line-clamp-2 text-xl font-black leading-7 text-white hover:text-[#0FF0FC]">{item.title}</h3>
                </Link>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-500">{item.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.slice(0, 3).map((tag: string) => <span key={tag} className="rounded-lg bg-black/25 px-2 py-1 text-[10px] font-bold text-gray-500">#{tag}</span>)}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <Link href={`/news/${item.id}`} className="text-xs font-black text-[#0FF0FC]">قراءة التفاصيل</Link>
                  <div className="flex items-center gap-2">
                    {canViewAdminStatus && <NewsStatusButton id={item.id} currentStatus={item.status || 'published'} targetStatus={item.status === 'published' ? 'archived' : 'published'} compact />}
                    {matchUrl && <Link href={matchUrl} className="rounded-xl bg-[#FFD700]/10 px-3 py-2 text-[11px] font-black text-[#FFD700]">مركز المباراة</Link>}
                    {item.sourceUrl && !matchUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white"><ExternalLink size={15} /></a>}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {!newsItems.length && (
          <section className="rounded-[2rem] border border-dashed border-white/10 bg-black/20 p-10 text-center">
            <Newspaper size={42} className="mx-auto mb-3 text-gray-600" />
            <h2 className="text-2xl font-black text-white">لا توجد أخبار في هذا التصنيف</h2>
            <p className="mt-2 text-sm text-gray-500">جرّب تصنيفًا آخر أو ارجع لاحقًا بعد تحديث غرفة الأخبار.</p>
          </section>
        )}

        <AdSenseBanner slot="news-list-bottom" format="auto" />
      </div>
    </main>
  );
}
