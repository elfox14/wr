import Link from 'next/link';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-white">
      <h1 className="text-3xl font-black">دليل المنتخبات</h1>
      <p className="mt-3 text-gray-400">صفحات رياضية للمنتخبات المشاركة في كأس العالم 2026.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teams.map((team) => (
          <Link key={team.id} href={`/asset/${team.id}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:border-[#0FF0FC]/30">
            <h2 className="font-black">{team.name}</h2>
            <p className="mt-2 text-sm text-gray-400">المجموعة: {team.group || 'غير متوفر'}</p>
            <p className="text-sm text-gray-400">تصنيف FIFA: {team.fifaRank || 'غير متوفر'}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
