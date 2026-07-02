import HomeRoundOf32Widget from '@/components/HomeRoundOf32Widget';
import { getHomeGroupStandings } from '@/lib/homeGroupStandings';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'مسار دور الـ32 | كأس العالم 2026',
  description: 'مسار التصفيات النهائية من دور الـ32 حتى النهائي حسب النتائج الحالية وترتيب المجموعات.',
};

export default async function RoundOf32Page() {
  const groups = await getHomeGroupStandings().catch(() => []);
  const matches = await prisma.match.findMany({
    where: { stage: { notIn: ['group_stage'] } },
    select: { externalId: true, homeScore: true, awayScore: true, status: true, homeTeamId: true, awayTeamId: true },
  }).catch(() => []);

  return (
    <main dir="rtl" className="mx-auto max-w-7xl px-3 pb-8 pt-4 sm:px-4 sm:py-6 lg:px-6">
      <div className="mb-4 rounded-3xl border border-white/10 bg-black/25 p-4 text-white shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
        <div className="inline-flex rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">
          WORLD CUP 2026 KNOCKOUT PATH
        </div>
        <h1 className="mt-3 text-2xl font-black md:text-3xl">مسار دور الـ32 حتى النهائي</h1>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-400">
          صفحة مستقلة لعرض طريق البطولة من دور الـ32 إلى النهائي حسب النتائج الحالية وترتيب المجموعات. التأهل يعتمد على أول وثاني كل مجموعة مع أفضل ٨ ثوالث.
        </p>
      </div>

      <HomeRoundOf32Widget groups={JSON.parse(JSON.stringify(groups))} matches={matches as any} />
    </main>
  );
}
