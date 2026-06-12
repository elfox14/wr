import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, FileText } from 'lucide-react';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'أرشيف ملخص اليوم | MC PRIME Exchange',
  description: 'أرشيف الملخصات اليومية المنشورة داخل بورصة المونديال.',
};

async function ensureDailyDigestTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyDigest" (
      "id" TEXT PRIMARY KEY,
      "digestDate" TEXT NOT NULL UNIQUE,
      "headline" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "videoScript" TEXT NOT NULL,
      "facebookPost" TEXT,
      "youtubeTitle" TEXT,
      "youtubeDescription" TEXT,
      "infographicPoints" JSONB,
      "status" TEXT NOT NULL DEFAULT 'published',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export default async function DailyDigestArchivePage() {
  await ensureDailyDigestTable();
  const items = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "DailyDigest"
    WHERE "status" = 'published'
    ORDER BY "digestDate" DESC
    LIMIT 90
  `);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link href="/daily-summary" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-white"><ArrowLeft size={16} /> العودة إلى ملخص اليوم</Link>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-card">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><CalendarDays size={14} /> أرشيف المحتوى اليومي</p>
          <h1 className="text-3xl font-black">أرشيف ملخص اليوم</h1>
          <p className="mt-2 text-sm font-bold leading-7 text-gray-400">كل ملخص يتم حفظه من صفحة ملخص اليوم يظهر هنا للرجوع إليه أو إعادة استخدامه في النشر.</p>
        </div>
        {items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black text-gray-500"><span>{item.digestDate}</span><FileText size={14} /></div><h2 className="font-black leading-7 text-white">{item.headline}</h2><p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-gray-500">{item.summary}</p><Link href={`/daily-summary/${item.digestDate}`} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#FFD700]">فتح الملخص <ArrowLeft size={12} /></Link></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-gray-500">لا توجد ملخصات محفوظة بعد.</div>}
      </section>
    </main>
  );
}
