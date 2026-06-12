import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowLeft, CalendarDays, ExternalLink, Newspaper, Radio, ShieldCheck, TrendingUp } from 'lucide-react';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'الأخبار والرصد الصحفي | MC PRIME Exchange',
  description: 'صفحة أخبار بورصة المونديال: رصد صحفي، أخبار المباريات، وتحركات السوق الافتراضي.',
};

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function categoryFromEvent(eventType?: string | null) {
  const value = String(eventType || '').toLowerCase();
  if (value.includes('goal') || value.includes('match') || value.includes('fixture')) return 'مباريات';
  if (value.includes('price') || value.includes('market') || value.includes('trade')) return 'السوق';
  return 'المنصة';
}

const pressDigest = [
  {
    id: 'athletic-opening-red-cards',
    label: 'The Athletic FC',
    category: 'رصد صحفي',
    title: 'افتتاحية عنيفة: ثلاث بطاقات حمراء في Mexico 2-0 South Africa',
    body: 'النشرة وصفت مباراة الافتتاح بأنها مرشحة لتكون أكثر افتتاحية خشونة في تاريخ كأس العالم، مع ثلاث بطاقات حمراء، وفوز المكسيك 2-0 على جنوب أفريقيا.',
    source: 'World Cup\'s dirtiest-ever opening game',
    href: '/news#athletic-opening-red-cards',
  },
  {
    id: 'athletic-jimenez-return',
    label: 'The Athletic FC',
    category: 'لاعبون',
    title: 'راؤول خيمينيز: هدف مهم بعد رحلة العودة من إصابة خطيرة',
    body: 'النشرة أبرزت قصة خيمينيز بعد كسر الجمجمة في 2020، وذكرت هدفه في الدقيقة 67 ضد جنوب أفريقيا ضمن فوز المكسيك.',
    source: 'The Athletic FC newsletter',
    href: '/news#athletic-jimenez-return',
  },
  {
    id: 'athletic-korea-czechia',
    label: 'The Athletic FC',
    category: 'مباريات',
    title: 'South Korea 2-1 Czech Republic: مقاعد فارغة، كرات ثابتة، ولمسة Hwang In-beom',
    body: 'النشرة أشارت إلى ثلاثة محاور من مباراة كوريا والتشيك: مقاعد فارغة في المدرجات، خطورة الكرات الثابتة للتشيك، ودور Hwang In-beom في عودة كوريا.',
    source: 'The Athletic FC newsletter',
    href: '/news#athletic-korea-czechia',
  },
  {
    id: 'athletic-injuries-roundup',
    label: 'The Athletic FC',
    category: 'إصابات',
    title: 'أخبار إصابات: Alphonso Davies وWataru Endo',
    body: 'الرصد الصحفي ذكر غياب ألفونسو ديفيز عن افتتاح كندا ضد البوسنة، وغياب واتارو إندو عن البطولة بالكامل مع إعلان اعتزاله الدولي.',
    source: 'The Athletic FC newsletter',
    href: '/news#athletic-injuries-roundup',
  },
];

async function getMarketNews() {
  try {
    const rows = await prisma.marketNews.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 18,
      include: {
        asset: { select: { id: true, name: true, code: true, image: true, marketPrice: true, current_price: true } },
      },
    });
    return rows.map((item) => {
      const rendered = renderMarketNews(item, 'ar');
      return {
        id: item.id,
        title: rendered.title,
        body: rendered.body,
        eventType: item.eventType,
        severity: item.severity,
        changePercent: Number(item.changePercent || 0),
        publishedAt: item.publishedAt,
        asset: item.asset,
        category: categoryFromEvent(item.eventType),
      };
    });
  } catch (error) {
    console.error('news page market news error:', error);
    return [];
  }
}

function PressCard({ item, featured = false }: { item: any; featured?: boolean }) {
  return (
    <article id={item.id} className={`rounded-[1.5rem] border p-5 shadow-card ${featured ? 'border-[#FFD700]/25 bg-[#FFD700]/[0.055]' : 'border-white/8 bg-white/[0.04]'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-black">
        <span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-[#0FF0FC]">{item.category}</span>
        <span className="text-gray-500">{item.label}</span>
      </div>
      <h3 className={`${featured ? 'text-2xl md:text-3xl' : 'text-lg'} font-black leading-tight text-white`}>{item.title}</h3>
      <p className="mt-3 text-sm font-bold leading-7 text-gray-400">{item.body}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-3 text-[11px] font-bold text-gray-500">
        <span>المصدر: {item.source}</span>
        <Link href={item.href} className="inline-flex items-center gap-1 text-[#FFD700]">تفاصيل <ArrowLeft size={13} /></Link>
      </div>
    </article>
  );
}

function MarketNewsCard({ item }: { item: any }) {
  const positive = Number(item.changePercent || 0) >= 0;
  return (
    <article className="rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 transition hover:border-[#0FF0FC]/25 hover:bg-white/[0.055]">
      <div className="mb-3 flex items-center justify-between gap-3 text-[11px]">
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 font-black text-gray-300">{item.category}</span>
        <span className="text-gray-500">{formatDate(item.publishedAt)}</span>
      </div>
      <h3 className="line-clamp-2 text-base font-black leading-6 text-white">{item.title}</h3>
      {item.body && <p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-500">{item.body}</p>}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-gray-300">{item.asset?.name || 'بورصة المونديال'}</p>
          {item.asset?.code && <p className="mt-1 text-[10px] font-mono text-gray-600">{item.asset.code}</p>}
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${positive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`} dir="ltr">
          {positive ? '+' : ''}{item.changePercent.toFixed(1)}%
        </span>
      </div>
    </article>
  );
}

export default async function NewsPage() {
  const marketNews = await getMarketNews();
  const featured = pressDigest[0];
  const restPress = pressDigest.slice(1);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]"><Newspaper size={14} /> غرفة أخبار المونديال</p>
              <h1 className="text-3xl font-black leading-tight md:text-5xl">الأخبار والرصد الصحفي</h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-gray-400">صفحة تجمع أخبار السوق الافتراضي، أخبار المباريات، والرصد الصحفي من النشرات الخارجية مثل The Athletic FC مع فصل واضح بين الخبر والتحليل والتداول.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><div className="text-2xl text-[#FFD700]">{pressDigest.length}</div><div className="text-gray-500">رصد صحفي</div></div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><div className="text-2xl text-[#0FF0FC]">{marketNews.length}</div><div className="text-gray-500">أخبار سوق</div></div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><div className="text-2xl text-emerald-300">Live</div><div className="text-gray-500">تحديث</div></div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <PressCard item={featured} featured />
          <aside className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-200"><ShieldCheck size={17} /> قواعد النشر داخل المنصة</div>
            <ul className="space-y-3 text-sm font-bold leading-7 text-emerald-50/85">
              <li>• الأخبار الصحفية لا تتحول تلقائيًا إلى توصية شراء أو بيع.</li>
              <li>• أي معلومة من مصدر خارجي تظهر كمصدر صحفي لا كمعلومة رسمية نهائية.</li>
              <li>• التحليل الكروي منفصل عن حركة الأسعار الافتراضية.</li>
            </ul>
          </aside>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-2xl font-black"><Radio className="text-[#FFD700]" /> رصد صحفي</h2>
            <span className="text-xs font-bold text-gray-500">مستوحى من النشرات التي تصل إلى بريد المنصة</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {restPress.map((item) => <PressCard key={item.id} item={item} />)}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-2xl font-black"><TrendingUp className="text-[#0FF0FC]" /> أخبار السوق الافتراضي</h2>
            <Link href="/market" className="inline-flex items-center gap-1 text-sm font-black text-[#0FF0FC]">فتح السوق <ExternalLink size={14} /></Link>
          </div>
          {marketNews.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {marketNews.map((item) => <MarketNewsCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
              <Activity className="mx-auto mb-3 text-gray-500" size={42} />
              <h3 className="text-xl font-black text-white">لا توجد أخبار سوق بعد</h3>
              <p className="mt-2 text-sm font-bold text-gray-500">ستظهر هنا أخبار الأهداف، التحركات السعرية، وأحداث السوق فور توليدها.</p>
            </div>
          )}
        </section>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold leading-6 text-gray-500">
          <CalendarDays size={14} className="mb-1 inline text-[#0FF0FC]" /> آخر تحديث: {formatDate(new Date())}. الأخبار الصحفية المعروضة هنا مختصرة ومحررة للمنصة وليست نقلًا كاملًا للنشرات الأصلية.
        </div>
      </section>
    </main>
  );
}
