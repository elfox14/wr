import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ArrowLeft, FileText } from 'lucide-react';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import ContentStudioManager from '@/components/admin/ContentStudioManager';

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
function serializable<T>(items: T[]): T[] {
  return JSON.parse(JSON.stringify(items));
}

export default async function ContentStudioPage() {
  const session = await getServerSession(authOptions as any);
  if (!getUser(session)) redirect('/login');
  if (!isAdmin(session)) redirect('/');
  await ensureTables();
  const [dailyDigests, matchDigests, pressNews] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "DailyDigest" ORDER BY "updatedAt" DESC LIMIT 30'),
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "MatchDigest" ORDER BY "updatedAt" DESC LIMIT 30'),
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "PressNews" ORDER BY "publishedAt" DESC LIMIT 30'),
  ]);
  return <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl"><section className="mx-auto max-w-7xl space-y-6"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-white"><ArrowLeft size={16} /> لوحة الإدارة</Link><div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-card"><p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]"><FileText size={14} /> Content Studio</p><h1 className="text-3xl font-black">استوديو المحتوى</h1><p className="mt-2 text-sm font-bold leading-7 text-gray-400">مراجعة، تعديل، حذف، وفتح الأخبار وملخصات اليوم وملخصات المباريات المحفوظة من مكان واحد.</p></div><ContentStudioManager dailyDigests={serializable(dailyDigests)} matchDigests={serializable(matchDigests)} pressNews={serializable(pressNews)} /></section></main>;
}
