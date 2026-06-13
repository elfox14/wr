import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { ArrowRight, Radio, ShieldCheck } from 'lucide-react';
import InternalAnimationPlayer from './InternalAnimationPlayer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'مشغل البث الأنيميشن الداخلي | MC PRIME Exchange',
  description: 'مشغل أنيميشن داخلي من قاعدة البيانات داخل منصة بورصة المونديال بدون تشغيل iSports داخل الصفحة.',
};

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function getAutoLiveMatch() {
  const now = new Date();
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: {
      matchDate: { gte: start, lte: end },
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
    },
    orderBy: { matchDate: 'asc' },
    take: 12,
  });
  return matches.find((match) => {
    const status = String(match.status || '').toUpperCase();
    if (['IN_PLAY', 'LIVE', 'HT'].includes(status)) return true;
    const minute = Math.floor((now.getTime() - new Date(match.matchDate).getTime()) / 60_000) + 1;
    return minute >= 1 && minute <= 135;
  }) || matches[0] || null;
}

export default async function AnimationLivePlayerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const matchId = getSingleValue(params.matchId) || '';
  let dbMatchId = getSingleValue(params.dbMatchId) || getSingleValue(params.id) || '';

  if (!matchId && !dbMatchId) {
    const autoMatch = await getAutoLiveMatch();
    dbMatchId = autoMatch?.id || '';
  }

  const isLinkedMatch = Boolean(matchId || dbMatchId);

  return (
    <main className="min-h-screen bg-background px-3 py-3 text-white sm:px-5 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.13),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Radio size={13} /> Internal Football Animation</p>
              <h1 className="text-xl font-black md:text-3xl">مشغل البث الأنيميشن الداخلي</h1>
              <p className="mt-1 text-xs leading-5 text-gray-400">العرض داخل المنصة فقط من قاعدة البيانات. يتم فتح المباراة حتى لو لم تكن مربوطة بـ iSports ID.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/animation-live" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"><ArrowRight size={14} /> مباريات اليوم</Link>
            </div>
          </div>
        </div>

        {isLinkedMatch ? (
          <InternalAnimationPlayer matchId={matchId} dbMatchId={dbMatchId} />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-400">
            <Radio className="mx-auto mb-4 text-gray-500" size={48} />
            <h2 className="mb-2 text-xl font-bold text-white">البث غير متاح</h2>
            <p>لا توجد مباراة مباشرة أو قريبة يمكن فتحها الآن. يرجى اختيار مباراة من قائمة المباريات.</p>
            <Link href="/animation-live" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">
              العودة لقائمة البث
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-100"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> مهم:</span> تم إلغاء تشغيل iSports داخل صفحة البث. العرض الحالي داخلي من قاعدة البيانات، الإحصائيات تُقرأ كل 5 دقائق، والأحداث المهمة أسرع من قاعدة البيانات.</div>
      </section>
    </main>
  );
}
