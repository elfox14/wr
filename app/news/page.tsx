import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Clock, Filter, Newspaper, Sparkles, TrendingUp } from 'lucide-react';
import prisma from '@/lib/prisma';
import AdSenseBanner from '@/components/ads/AdSenseBanner';
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
  { key: 'إحصائيات', label: 'إحصائيات' },
  { key: 'لاعبون', label: 'لاعبون' },
  { key: 'إصابات', label: 'إصابات' },
  { key: 'منتخبات', label: 'منتخبات' },
  { key: 'السوق', label: 'تحليل السوق' },
];

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
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_status_publishedAt_idx" ON "PressNews" ("status", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_category_publishedAt_idx" ON "PressNews" ("category", "publishedAt")');
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

type NewsPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentCategory = resolvedSearchParams.category || 'all';

  await ensurePressNewsTable();
  try {
    await ensureWorldCup2026OpeningNews(prisma);
  } catch (error) {
    console.error('Error seeding World Cup opening news:', error);
  }

  let newsItems: any[] = [];
  try {
    if (currentCategory === 'all') {
      newsItems = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "PressNews"
        WHERE "status" = 'published'
        ORDER BY "publishedAt" DESC, "importance" DESC
      `);
    } else {
      newsItems = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "PressNews"
        WHERE "status" = 'published' AND "category" = $1
        ORDER BY "publishedAt" DESC, "importance" DESC
      `, currentCategory);
    }
  } catch (err) {
    console.error('Error fetching news items:', err);
  }

  const heroItem = newsItems[0];
  const heroMeta = heroItem ? getPressNewsMeta(heroItem.tags, heroItem.title) : null;
  const listItems = newsItems.slice(1);

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
                أخبار وتحليلات كأس العالم 2026 بصياغة عربية موثقة، مع صور تحريرية آمنة للسيو وروابط مصادر داخل كل مقال.
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
                href={cat.key === 'all' ? '/news' : `/news?category=${encodeURIComponent(cat.key)}`}
                className={`rounded-2xl px-4 py-2 text-xs font-black transition-all ${
                  isActive
                    ? 'bg-[#0FF0FC] text-black shadow-[0_0_15px_rgba(15,240,252,0.3)]'
                    : 'border border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </nav>

        {heroItem ? (
          <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] transition-all hover:border-[#0FF0FC]/30">
            <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8 lg:gap-10">
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/25 px-3 py-1 text-[11px] font-black text-[#FFD700]">
                      {heroItem.category}
                    </span>
                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Clock size={12} /> {formatDate(heroItem.publishedAt)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black leading-tight text-white transition-colors group-hover:text-[#0FF0FC] md:text-4xl">
                    <Link href={`/news/${heroItem.id}`}>{heroItem.title}</Link>
                  </h2>
                  <p className="line-clamp-4 text-sm font-bold leading-7 text-gray-400">
                    {heroItem.body}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-bold text-gray-500">
                    المصدر: <span className="text-gray-300">{heroItem.sourceName}</span>
                  </span>
                  <Link
                    href={`/news/${heroItem.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-black text-white transition-all hover:bg-[#0FF0FC] hover:text-black"
                  >
                    <BookOpen size={14} /> قراءة التحليل بالكامل
                  </Link>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 md:min-h-full">
                {heroMeta?.image ? (
                  <img
                    src={heroMeta.image}
                    alt={heroMeta.imageAlt || heroItem.title}
                    className="h-full min-h-[240px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="eager"
                  />
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center p-6 text-center">
                    <div className="space-y-2">
                      <Newspaper size={48} className="mx-auto text-[#0FF0FC] opacity-40" />
                      <p className="text-xs font-black text-[#0FF0FC] tracking-widest">MC PRIME ANALYSIS</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-12 text-center">
            <Newspaper size={48} className="mx-auto text-gray-500 opacity-30 mb-3" />
            <h3 className="text-lg font-black text-white">لا توجد أخبار منشورة</h3>
            <p className="mt-2 text-sm font-bold text-gray-500">اختر تصنيفًا آخر أو تصفح في وقت لاحق.</p>
          </div>
        )}

        {heroItem && (
          <AdSenseBanner slot="1234567890" format="horizontal" className="my-4" />
        )}

        {listItems.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2 border-r-4 border-[#0FF0FC] pr-3">
              آخر التحليلات والمستجدات
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {listItems.map((item) => {
                const itemMeta = getPressNewsMeta(item.tags, item.title);
                return (
                  <article
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] transition-all hover:border-[#FFD700]/30 hover:bg-white/[0.04]"
                  >
                    {itemMeta.image && (
                      <Link href={`/news/${item.id}`} className="block overflow-hidden border-b border-white/5 bg-black/30">
                        <img
                          src={itemMeta.image}
                          alt={itemMeta.imageAlt || item.title}
                          className="h-44 w-full object-cover transition-transform duration-500 hover:scale-105"
                          loading="lazy"
                        />
                      </Link>
                    )}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-black text-gray-500">
                          <span className="rounded-lg bg-white/5 border border-white/10 px-2 py-0.5 text-gray-300">
                            {item.category}
                          </span>
                          <span>{formatDate(item.publishedAt)}</span>
                        </div>
                        <h3 className="line-clamp-2 font-black leading-7 text-white transition-colors hover:text-[#FFD700]">
                          <Link href={`/news/${item.id}`}>{item.title}</Link>
                        </h3>
                        <p className="line-clamp-3 text-xs font-bold leading-6 text-gray-400">
                          {item.body}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs font-bold text-gray-500">
                        <span>{item.sourceName}</span>
                        <Link href={`/news/${item.id}`} className="text-[#0FF0FC] hover:underline flex items-center gap-1">
                          التفاصيل ←
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {listItems.length > 4 && (
          <AdSenseBanner slot="0987654321" format="auto" className="mt-6" />
        )}

        <section className="rounded-3xl border border-[#FFD700]/15 bg-[radial-gradient(circle_at_bottom_right,rgba(255,215,0,0.08),transparent_40%),rgba(255,215,0,0.02)] p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-[#FFD700] flex items-center gap-2">
                <TrendingUp size={20} /> هل تؤثر هذه الأخبار على أسعار الأصول؟
              </h3>
              <p className="max-w-3xl text-sm font-bold text-gray-400 leading-7">
                اربط كل تحليل بالمباراة والمنتخب واللاعبين داخل موقعك لزيادة الوقت داخل الصفحة وتحسين الربط الداخلي أمام محركات البحث.
              </p>
            </div>
            <Link
              href="/market"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-5 py-3 text-sm font-black text-black transition hover:bg-[#0FF0FC]"
            >
              افتح لوحة التداول الرياضي
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
