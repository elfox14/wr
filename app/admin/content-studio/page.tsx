import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ArrowLeft, CalendarDays, FileText, Newspaper, Video } from 'lucide-react';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getUser(session: unknown) {
  if (!session || typeof session !== 'object') return null;
  return (session as { user?: { email?: string | null; role?: string | null } }).user || null;
}

function isAdmin(session: unknown) {
  const user = getUser(session);
  const email = user?.email || '';
  return user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function ensureTables() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DailyDigest" ("id" TEXT PRIMARY KEY,"digestDate" TEXT NOT NULL UNIQUE,"headline" TEXT NOT NULL,"summary" TEXT NOT NULL,"videoScript" TEXT NOT NULL,"facebookPost" TEXT,"youtubeTitle" TEXT,"youtubeDescription" TEXT,"infographicPoints" JSONB,"status" TEXT NOT NULL DEFAULT 'published',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchDigest" ("id" TEXT PRIMARY KEY,"matchId" TEXT NOT NULL UNIQUE,"matchTitle" TEXT NOT NULL,"scoreLine" TEXT NOT NULL,"statusLabel" TEXT NOT NULL,"summary" TEXT NOT NULL,"turningPoint" TEXT,"videoScript" TEXT NOT NULL,"facebookPost" TEXT,"infographicPoints" JSONB,"status" TEXT NOT NULL DEFAULT 'published',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PressNews" ("id" TEXT PRIMARY KEY,"title" TEXT NOT NULL,"body" TEXT NOT NULL,"category" TEXT NOT NULL DEFAULT 'رصد صحفي',"sourceName" TEXT NOT NULL,"sourceUrl" TEXT,"sourceType" TEXT NOT NULL DEFAULT 'newsletter',"language" TEXT NOT NULL DEFAULT 'ar',"status" TEXT NOT NULL DEFAULT 'published',"importance" INTEGER NOT NULL DEFAULT 50,"tags" JSONB,"publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}

export default async function ContentStudioPage() {
  const session = await getServerSession(authOptions as any);
  if (!getUser(session)) redirect('/login');
  if (!isAdmin(session)) redirect('/');
  await ensureTables();
  const [dailyDigests, matchDigests, pressNews] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "DailyDigest" ORDER BY "updatedAt" DESC LIMIT 12'),
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "MatchDigest" ORDER BY "updatedAt" DESC LIMIT 12'),
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "PressNews" ORDER BY "publishedAt" DESC LIMIT 12'),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-white"><ArrowLeft size={16} /> لوحة الإدارة</Link>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-card">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]"><FileText size={14} /> Content Studio</p>
          <h1 className="text-3xl font-black">استوديو المحتوى</h1>
          <p className="mt-2 text-sm font-bold leading-7 text-gray-400">مكان واحد لمراجعة الأخبار، ملخصات اليوم، وملخصات المباريات المحفوظة.</p>
        </div>
        <section className="grid gap-6 lg:grid-cols-3">
          <Column title="ملخصات اليوم" icon={<CalendarDays className="text-[#FFD700]" />} items={dailyDigests} render={(item) => ({ title: item.headline, body: item.summary, href: `/daily-summary/${item.digestDate}`, meta: item.digestDate })} empty="لا توجد ملخصات يومية محفوظة." />
          <Column title="ملخصات المباريات" icon={<Video className="text-[#0FF0FC]" />} items={matchDigests} render={(item) => ({ title: item.matchTitle, body: item.summary, href: `/match-center/${item.matchId}`, meta: item.scoreLine })} empty="لا توجد ملخصات مباريات محفوظة." />
          <Column title="الأخبار" icon={<Newspaper className="text-emerald-300" />} items={pressNews} render={(item) => ({ title: item.title, body: item.body, href: '/news', meta: item.category })} empty="لا توجد أخبار محفوظة." />
        </section>
      </section>
    </main>
  );
}

function Column({ title, icon, items, render, empty }: { title: string; icon: React.ReactNode; items: any[]; render: (item: any) => { title: string; body: string; href: string; meta: string }; empty: string }) {
  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><h2 className="mb-4 flex items-center gap-2 text-xl font-black">{icon}{title}</h2>{items.length ? <div className="space-y-3">{items.map((item) => { const data = render(item); return <Link key={item.id} href={data.href} className="block rounded-2xl border border-white/8 bg-black/25 p-4 transition hover:border-[#0FF0FC]/25"><div className="mb-2 text-[11px] font-black text-gray-500">{data.meta}</div><h3 className="line-clamp-2 font-black leading-6 text-white">{data.title}</h3><p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-500">{data.body}</p></Link>; })}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold text-gray-500">{empty}</div>}</section>;
}
