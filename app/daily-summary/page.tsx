import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowLeft, CalendarDays, CheckCircle2, Clock, FileText, Newspaper, Radio, Sparkles, TrendingUp, Video } from 'lucide-react';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';
import DailySummaryContentTools from '@/components/ui/DailySummaryContentTools';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'ملخص اليوم | MC PRIME Exchange',
  description: 'ملخص يومي للمباريات والأخبار والرصد الصحفي وأخبار السوق الافتراضي.',
};

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function endOfToday() {
  const now = startOfToday();
  now.setDate(now.getDate() + 1);
  return now;
}

function endOfTomorrow() {
  const now = startOfToday();
  now.setDate(now.getDate() + 2);
  return now;
}

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function matchLabel(match: any) {
  return `${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'}`;
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
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getDailyData() {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const tomorrowEnd = endOfTomorrow();

  await ensurePressNewsTable();

  const [todayMatches, nextMatches] = await Promise.all([
    prisma.match.findMany({
      where: { matchDate: { gte: todayStart, lt: todayEnd } },
      orderBy: { matchDate: 'asc' },
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.match.findMany({
      where: { matchDate: { gte: todayEnd, lt: tomorrowEnd }, status: 'SCHEDULED' },
      orderBy: { matchDate: 'asc' },
      take: 8,
      include: { homeTeam: true, awayTeam: true },
    }),
    ]);

  return {
    todayMatches,
    nextMatches,
    pressNews: [],
    marketNews: [],
  };
}

function statusText(status: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'FINISHED') return 'انتهت';
  if (normalized === 'IN_PLAY' || normalized === 'LIVE' || normalized === 'HT') return 'مباشرة';
  return 'قادمة';
}

function MatchRow({ match }: { match: any }) {
  const live = ['IN_PLAY', 'LIVE', 'HT'].includes(String(match.status).toUpperCase());
  const finished = String(match.status).toUpperCase() === 'FINISHED';
  return (
    <article className="rounded-2xl border border-white/8 bg-black/25 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-black text-gray-500">
        <span>{formatDate(match.matchDate)}</span>
        <span className={`${live ? 'text-red-300' : finished ? 'text-[#FFD700]' : 'text-[#0FF0FC]'}`}>{statusText(match.status)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <Link href={`/asset/${match.homeTeam?.id}`} className="font-black text-white hover:text-[#0FF0FC]">{match.homeTeam?.name}</Link>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-lg font-black text-white">
          {finished || live ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : 'VS'}
        </div>
        <Link href={`/asset/${match.awayTeam?.id}`} className="font-black text-white hover:text-[#0FF0FC]">{match.awayTeam?.name}</Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/match-center/${match.id}`} className="inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-2 text-xs font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black">مركز المباراة</Link>
        {match.animationMatchId && <Link href={`/animation-live/player?matchId=${match.animationMatchId}&lang=en&statsPanel=simple&teamPanel=1`} className="inline-flex items-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black"><Radio size={13} /> بث أنيميشن</Link>}
      </div>
    </article>
  );
}

function NewsMiniCard({ item }: { item: any }) {
  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black text-gray-500">
        <span>{item.category || 'رصد صحفي'}</span>
        <span>{item.sourceName || item.asset?.name || 'بورصة المونديال'}</span>
      </div>
      <h3 className="line-clamp-2 font-black leading-6 text-white">{item.title}</h3>
      {item.body && <p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-500">{item.body}</p>}
    </article>
  );
}

function buildVideoScript(data: Awaited<ReturnType<typeof getDailyData>>) {
  const resultMatches = data.todayMatches.filter((m: any) => String(m.status).toUpperCase() === 'FINISHED');
  const liveMatches = data.todayMatches.filter((m: any) => ['IN_PLAY', 'LIVE', 'HT'].includes(String(m.status).toUpperCase()));
  const headline = data.pressNews[0]?.title || data.marketNews[0]?.title || 'أبرز أخبار اليوم في كأس العالم';
  const firstResult = resultMatches[0];
  const next = data.nextMatches[0];

  return [
    'يا أهلاً بكم في ملخص بورصة المونديال.',
    `عنوان اليوم: ${headline}.`,
    firstResult ? `أبرز نتيجة اليوم: ${matchLabel(firstResult)} انتهت ${firstResult.homeScore}-${firstResult.awayScore}.` : 'حتى الآن لا توجد نتيجة نهائية مؤكدة ضمن مباريات اليوم في قاعدة البيانات.',
    liveMatches.length ? `المباريات المباشرة الآن: ${liveMatches.map(matchLabel).join('، ')}.` : 'لا توجد مباراة مباشرة مسجلة حاليًا في المنصة.',
    next ? `مباراة الغد المنتظرة: ${matchLabel(next)} في ${formatDate(next.matchDate)}.` : 'لا توجد مباراة قادمة مسجلة للغد حاليًا.',
    'تنبيه مهم: هذا ملخص كروي ورصد صحفي، وليس توصية تداول داخل السوق الافتراضي.',
  ].join('\n');
}

function buildSummaryLine(data: Awaited<ReturnType<typeof getDailyData>>) {
  const finished = data.todayMatches.filter((m: any) => String(m.status).toUpperCase() === 'FINISHED');
  const live = data.todayMatches.filter((m: any) => ['IN_PLAY', 'LIVE', 'HT'].includes(String(m.status).toUpperCase()));
  const headline = data.pressNews[0]?.title || data.marketNews[0]?.title || 'أبرز أخبار اليوم في كأس العالم';
  const resultText = finished[0] ? `أبرز نتيجة: ${matchLabel(finished[0])} ${finished[0].homeScore}-${finished[0].awayScore}.` : 'لا توجد نتيجة نهائية مؤكدة حتى الآن.';
  const liveText = live.length ? `مباشر الآن: ${live.map(matchLabel).join('، ')}.` : 'لا توجد مباراة مباشرة مسجلة حاليًا.';
  return `${headline}. ${resultText} ${liveText}`;
}

export default async function DailySummaryPage() {
  const data = await getDailyData();
  const finishedCount = data.todayMatches.filter((m) => String(m.status).toUpperCase() === 'FINISHED').length;
  const liveCount = data.todayMatches.filter((m) => ['IN_PLAY', 'LIVE', 'HT'].includes(String(m.status).toUpperCase())).length;
  const script = buildVideoScript(data);
  const headline = data.pressNews[0]?.title || data.marketNews[0]?.title || 'ملخص اليوم من بورصة المونديال';
  const summaryLine = buildSummaryLine(data);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]"><Sparkles size={14} /> ملخص قابل للنشر</p>
              <h1 className="text-3xl font-black leading-tight md:text-5xl">ملخص اليوم</h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-gray-400">لقطة يومية تجمع النتائج، المباريات القادمة، الأخبار الصحفية، وأخبار السوق الافتراضي مع باقة محتوى قابلة للنسخ.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><div className="text-2xl text-[#FFD700]">{finishedCount}</div><div className="text-gray-500">نتائج</div></div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><div className="text-2xl text-red-300">{liveCount}</div><div className="text-gray-500">مباشر</div></div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><div className="text-2xl text-[#0FF0FC]">{data.nextMatches.length}</div><div className="text-gray-500">قادمة</div></div>
            </div>
          </div>
        </div>

        <DailySummaryContentTools script={script} headline={headline} summaryLine={summaryLine} />

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-2xl font-black"><CalendarDays className="text-[#FFD700]" /> مباريات اليوم</h2>
              <Link href="/matches" className="inline-flex items-center gap-1 text-sm font-black text-[#0FF0FC]">كل المباريات <ArrowLeft size={14} /></Link>
            </div>
            {data.todayMatches.length ? <div className="space-y-3">{data.todayMatches.map((match) => <MatchRow key={match.id} match={match} />)}</div> : <EmptyBox icon={<Clock />} title="لا توجد مباريات اليوم" text="لا توجد مباريات مسجلة بتاريخ اليوم في قاعدة البيانات." />}
          </section>

          <section className="rounded-[2rem] border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.035] p-5 md:p-6">
            <div className="mb-4 flex items-center gap-2 text-2xl font-black"><Video className="text-[#0FF0FC]" /> سكربت فيديو سريع</div>
            <pre className="min-h-72 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/35 p-4 text-sm font-bold leading-7 text-gray-300">{script}</pre>
          </section>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-2xl font-black"><Newspaper className="text-[#FFD700]" /> أهم الرصد الصحفي</h2>
            <Link href="/news" className="inline-flex items-center gap-1 text-sm font-black text-[#0FF0FC]">غرفة الأخبار <ArrowLeft size={14} /></Link>
          </div>
          {data.pressNews.length ? <div className="grid gap-4 md:grid-cols-3">{data.pressNews.slice(0, 6).map((item) => <NewsMiniCard key={item.id} item={item} />)}</div> : <EmptyBox icon={<Newspaper />} title="لا يوجد رصد صحفي بعد" text="أضف أخبارًا من لوحة الإدارة لتظهر هنا." />}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-2xl font-black"><TrendingUp className="text-[#0FF0FC]" /> أخبار السوق الافتراضي</h2>
            <Link href="/market" className="inline-flex items-center gap-1 text-sm font-black text-[#0FF0FC]">فتح السوق <ArrowLeft size={14} /></Link>
          </div>
          {data.marketNews.length ? <div className="grid gap-4 md:grid-cols-3">{data.marketNews.map((item: any) => <NewsMiniCard key={item.id} item={item} />)}</div> : <EmptyBox icon={<Activity />} title="لا توجد أخبار سوق" text="ستظهر هنا أخبار السوق عند توليدها." />}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2 text-2xl font-black"><CheckCircle2 className="text-emerald-300" /> مباريات الغد</div>
          {data.nextMatches.length ? <div className="grid gap-3 md:grid-cols-2">{data.nextMatches.map((match) => <MatchRow key={match.id} match={match} />)}</div> : <EmptyBox icon={<Clock />} title="لا توجد مباريات غدًا" text="لا توجد مباريات قادمة للغد في قاعدة البيانات." />}
        </section>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold leading-6 text-gray-500">
          <FileText size={14} className="mb-1 inline text-[#0FF0FC]" /> هذا الملخص يعتمد فقط على البيانات الموجودة في قاعدة المنصة، ولا يجلب أي بيانات خارجية جديدة.
        </div>
      </section>
    </main>
  );
}

function EmptyBox({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-gray-500">{icon}</div>
      <h3 className="text-lg font-black text-white">{title}</h3>
      <p className="mt-2 text-sm font-bold text-gray-500">{text}</p>
    </div>
  );
}
