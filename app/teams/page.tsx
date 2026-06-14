import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, code: true, group: true, image: true },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-black text-[#0FF0FC]">World Cup Teams</p>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">دليل المنتخبات</h1>
        <p className="mt-4 max-w-3xl leading-8 text-gray-300">
          قائمة عامة بالمنتخبات المسجلة على المنصة. تم إيقاف صفحات التفاصيل الفردية مؤقتًا لحين تحديث المحتوى الرياضي النهائي.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teams.map((team) => (
          <article key={team.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center gap-3">
              {team.image ? <img src={team.image} alt="" className="h-12 w-12 rounded-full border border-white/10 object-cover" /> : <div className="h-12 w-12 rounded-full border border-white/10 bg-white/10" />}
              <div className="min-w-0">
                <h2 className="truncate font-black">{team.name}</h2>
                <p className="mt-1 text-xs font-bold text-gray-400">{team.code || 'N/A'} · {team.group || 'Group N/A'}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
