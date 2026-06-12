import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, Video } from 'lucide-react';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'أرشيف ملخصات المباريات | MC PRIME Exchange',
  description: 'أرشيف ملخصات المباريات المحفوظة من Timeline المباراة.',
};

async function ensureMatchDigestTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchDigest" ("id" TEXT PRIMARY KEY,"matchId" TEXT NOT NULL UNIQUE,"matchTitle" TEXT NOT NULL,"scoreLine" TEXT NOT NULL,"statusLabel" TEXT NOT NULL,"summary" TEXT NOT NULL,"turningPoint" TEXT,"videoScript" TEXT NOT NULL,"facebookPost" TEXT,"infographicPoints" JSONB,"status" TEXT NOT NULL DEFAULT 'published',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}

export default async function MatchDigestsArchivePage() {
  await ensureMatchDigestTable();
  const items = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchDigest" WHERE "status" = 'published' ORDER BY "updatedAt" DESC LIMIT 120`);
  return <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl"><section className="mx-auto max-w-6xl space-y-6"><Link href="/news" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-white"><ArrowLeft size={16} /> غرفة الأخبار</Link><div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-card"><p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Video size={14} /> أرشيف المباريات</p><h1 className="text-3xl font-black">أرشيف ملخصات المباريات</h1><p className="mt-2 text-sm font-bold leading-7 text-gray-400">ملخصات محفوظة من Timeline المباراة، جاهزة للرجوع إليها أو إعادة استخدامها في المحتوى.</p></div>{items.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black text-gray-500"><span>{item.scoreLine}</span><FileText size={14} /></div><h2 className="font-black leading-7 text-white">{item.matchTitle}</h2><p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-gray-500">{item.summary}</p><div className="mt-3 flex flex-wrap gap-2"><Link href={`/match-digests/${item.matchId}`} className="inline-flex items-center gap-1 text-xs font-black text-[#FFD700]">فتح الملخص <ArrowLeft size={12} /></Link><Link href={`/match-center/${item.matchId}`} className="inline-flex items-center gap-1 text-xs font-black text-[#0FF0FC]">مركز المباراة</Link></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-gray-500">لا توجد ملخصات مباريات محفوظة بعد.</div>}</section></main>;
}
