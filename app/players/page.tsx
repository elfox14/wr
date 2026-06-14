import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  const players = await prisma.asset.findMany({
    where: { type: 'PLAYER' },
    orderBy: { name: 'asc' },
    take: 300,
    select: { id: true, name: true, code: true, image: true },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-black text-[#0FF0FC]">World Cup Players</p>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">دليل اللاعبين</h1>
        <p className="mt-4 max-w-3xl leading-8 text-gray-300">
          قائمة عامة باللاعبين المسجلين على المنصة. تم إيقاف صفحات التفاصيل الفردية مؤقتًا لحين تحديث المحتوى الرياضي النهائي.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {players.map((player) => (
          <article key={player.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center gap-3">
              {player.image ? <img src={player.image} alt="" className="h-12 w-12 rounded-full border border-white/10 object-cover" /> : <div className="h-12 w-12 rounded-full border border-white/10 bg-white/10" />}
              <div className="min-w-0">
                <h2 className="truncate font-black">{player.name}</h2>
                <p className="mt-1 text-xs font-bold text-gray-400">{player.code || 'N/A'}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
