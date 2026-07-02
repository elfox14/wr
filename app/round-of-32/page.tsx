import HomeRoundOf32Widget from '@/components/HomeRoundOf32Widget';
import { getHomeGroupStandings } from '@/lib/homeGroupStandings';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata = {
  title: 'مسار دور الـ32 | كأس العالم 2026',
  description: 'مسار التصفيات النهائية من دور الـ32 حتى النهائي حسب النتائج الحالية وترتيب المجموعات.',
};

const R32 = ['round_of_32', 'last_32', 'r32', 'round 32', 'round of 32', 'last 32', 'دور الـ32', 'دور ال32', 'دور 32'];
const R16 = ['round_of_16', 'last_16', 'r16', 'round 16', 'round of 16', 'last 16', 'دور الـ16', 'دور ال16', 'دور 16'];
const QF = ['quarter_finals', 'quarter_final', 'quarter-finals', 'quarter-final', 'quarterfinals', 'quarterfinal', 'ربع النهائي'];
const SF = ['semi_finals', 'semi_final', 'semi-finals', 'semi-final', 'semifinals', 'semifinal', 'نصف النهائي'];
const FINAL = ['final', 'third_place', 'third-place', 'third place', 'match_for_third_place', 'المباراة النهائية', 'النهائي', 'المركز الثالث'];

function stageConditions(aliases: string[], contains: string[] = []) {
  return [
    ...aliases.flatMap((alias) => [
      { stage: { equals: alias, mode: 'insensitive' as const } },
      { groupPhase: { equals: alias, mode: 'insensitive' as const } },
    ]),
    ...contains.flatMap((term) => [
      { stage: { contains: term, mode: 'insensitive' as const } },
      { groupPhase: { contains: term, mode: 'insensitive' as const } },
    ]),
  ];
}

async function getKnockoutMatches() {
  return prisma.match.findMany({
    where: {
      OR: [
        ...stageConditions(R32, ['round of 32', 'last 32', 'r32', 'دور الـ32', 'دور ال32']),
        ...stageConditions(R16, ['round of 16', 'last 16', 'r16', 'دور الـ16', 'دور ال16']),
        ...stageConditions(QF, ['quarter']),
        ...stageConditions(SF, ['semi']),
        ...stageConditions(FINAL),
      ],
    },
    orderBy: [{ matchDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      externalId: true,
      animationMatchId: true,
      externalIds: true,
      matchDate: true,
      status: true,
      homeScore: true,
      awayScore: true,
      groupPhase: true,
      stage: true,
      syncSource: true,
      lastSyncedAt: true,
      homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
      awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
    },
  });
}

export default async function RoundOf32Page() {
  const [groups, knockoutMatches] = await Promise.all([
    getHomeGroupStandings().catch(() => []),
    getKnockoutMatches().catch(() => []),
  ]);

  return (
    <main dir="rtl" className="mx-auto max-w-7xl px-3 pb-8 pt-4 sm:px-4 sm:py-6 lg:px-6">
      <div className="mb-4 rounded-3xl border border-white/10 bg-black/25 p-4 text-white shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
        <div className="inline-flex rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">
          WORLD CUP 2026 KNOCKOUT PATH
        </div>
        <h1 className="mt-3 text-2xl font-black md:text-3xl">مسار دور الـ32 حتى النهائي</h1>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-400">
          صفحة مستقلة لعرض طريق البطولة من دور الـ32 إلى النهائي حسب النتائج المحفوظة من مزامنة البيانات داخل قاعدة البيانات. أي مباراة غير مؤكدة تظهر كمسار تأهل فقط.
        </p>
      </div>

      <HomeRoundOf32Widget groups={JSON.parse(JSON.stringify(groups))} knockoutMatches={JSON.parse(JSON.stringify(knockoutMatches))} />
    </main>
  );
}
