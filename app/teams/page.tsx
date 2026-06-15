import Link from 'next/link';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type TeamsSearchParams = Promise<{
  q?: string | string[];
  group?: string | string[];
  continent?: string | string[];
}>;

type Props = {
  searchParams?: TeamsSearchParams;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanParam(value?: string) {
  return String(value || '').trim();
}

function toSearchable(value?: string | null) {
  return String(value || '').toLowerCase();
}

export default async function TeamsPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = cleanParam(firstParam(resolvedSearchParams.q));
  const selectedGroup = cleanParam(firstParam(resolvedSearchParams.group));
  const selectedContinent = cleanParam(firstParam(resolvedSearchParams.continent));

  const allTeams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      group: true,
      continent: true,
      image: true,
      fifaRank: true,
      coach: true,
    },
  });

  const groups = Array.from(
    new Set(allTeams.map((team) => team.group).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const continents = Array.from(
    new Set(allTeams.map((team) => team.continent).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const normalizedQuery = query.toLowerCase();
  const teams = allTeams.filter((team) => {
    const matchesQuery =
      !normalizedQuery ||
      [team.name, team.code, team.group, team.continent, team.coach].some((value) =>
        toSearchable(value).includes(normalizedQuery),
      );

    const matchesGroup = !selectedGroup || team.group === selectedGroup;
    const matchesContinent = !selectedContinent || team.continent === selectedContinent;

    return matchesQuery && matchesGroup && matchesContinent;
  });

  const hasActiveFilters = Boolean(query || selectedGroup || selectedContinent);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0FF0FC]">World Cup Teams</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black md:text-5xl">دليل المنتخبات</h1>
            <p className="mt-4 max-w-3xl leading-8 text-gray-300">
              تصفح منتخبات كأس العالم من مكان واحد، واستخدم الفلاتر للوصول السريع حسب المجموعة أو القارة أو اسم المنتخب.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-gray-300">
            <span className="text-2xl font-black text-white">{teams.length}</span> منتخب ظاهر
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.6fr)_minmax(160px,0.6fr)_auto]" method="GET">
          <label className="flex flex-col gap-2 text-sm font-bold text-gray-300">
            بحث
            <input
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-[#0FF0FC]"
              defaultValue={query}
              name="q"
              placeholder="اسم المنتخب، الكود، المدرب..."
              type="search"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-bold text-gray-300">
            المجموعة
            <select
              className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-[#0FF0FC]"
              defaultValue={selectedGroup}
              name="group"
            >
              <option value="">كل المجموعات</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-bold text-gray-300">
            القارة
            <select
              className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-[#0FF0FC]"
              defaultValue={selectedContinent}
              name="continent"
            >
              <option value="">كل القارات</option>
              {continents.map((continent) => (
                <option key={continent} value={continent}>
                  {continent}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button className="h-12 rounded-2xl bg-[#0FF0FC] px-5 text-sm font-black text-black transition hover:scale-[1.02]" type="submit">
              تطبيق
            </button>
            {hasActiveFilters ? (
              <Link className="flex h-12 items-center rounded-2xl border border-white/10 px-5 text-sm font-black text-white hover:bg-white/10" href="/teams">
                مسح
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      {teams.length ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              className="group block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-1 hover:border-[#0FF0FC]/60 hover:bg-white/[0.06]"
              href={`/teams/${team.id}`}
            >
              <div className="flex items-center gap-3">
                {team.image ? (
                  <img src={team.image} alt={team.name} className="h-12 w-12 rounded-full border border-white/10 object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-black text-gray-300">
                    {team.code || team.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-black text-white group-hover:text-[#0FF0FC]">{team.name}</h2>
                  <p className="mt-1 text-xs font-bold text-gray-400">
                    {team.code || 'N/A'} · {team.group || 'Group N/A'}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-gray-400">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-gray-500">القارة</p>
                  <p className="mt-1 truncate text-white">{team.continent || 'غير متوفر'}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-gray-500">تصنيف FIFA</p>
                  <p className="mt-1 text-white">{team.fifaRank ?? 'غير متوفر'}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-black text-[#0FF0FC]">
                <span>افتح صفحة المنتخب</span>
                <span aria-hidden="true" className="transition group-hover:translate-x-[-4px]">
                  ←
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center">
          <h2 className="text-2xl font-black">لا توجد نتائج مطابقة</h2>
          <p className="mt-3 text-gray-400">جرّب تغيير اسم البحث أو مسح فلاتر المجموعة والقارة.</p>
          <Link className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black" href="/teams">
            عرض كل المنتخبات
          </Link>
        </section>
      )}
    </main>
  );
}
