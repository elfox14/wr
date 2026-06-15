import Link from 'next/link';
import prisma from '@/lib/prisma';
import { dedupePlayers, hasUsablePlayerImage } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';

type PlayersSearchParams = Promise<{
  q?: string | string[];
  team?: string | string[];
  position?: string | string[];
}>;

type Props = {
  searchParams?: PlayersSearchParams;
};

type PlayerCardProps = {
  player: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    position: string | null;
    age: number | null;
    club: string | null;
    teamId: string | null;
    team: {
      id: string;
      name: string;
      code: string | null;
      image: string | null;
      group: string | null;
    } | null;
  };
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

function PlayerCard({ player }: PlayerCardProps) {
  const initials = player.code || player.name.slice(0, 2);
  const content = (
    <>
      <div className="flex items-center gap-3">
        {hasUsablePlayerImage(player.image) ? (
          <img src={player.image as string} alt={player.name} className="h-14 w-14 rounded-full border border-white/10 object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-black text-gray-300">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-black text-white group-hover:text-[#0FF0FC]">{player.name}</h2>
          <p className="mt-1 text-xs font-bold text-gray-400">
            {player.position || 'مركز غير متوفر'} · {player.code || 'N/A'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-gray-400">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-gray-500">المنتخب</p>
          <p className="mt-1 truncate text-white">{player.team?.name || 'غير متوفر'}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-gray-500">العمر</p>
          <p className="mt-1 text-white">{player.age ?? 'غير متوفر'}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white/[0.04] p-3 text-xs font-bold text-gray-400">
        <p className="text-gray-500">النادي</p>
        <p className="mt-1 truncate text-white">{player.club || 'غير متوفر'}</p>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-black text-[#0FF0FC]">
        <span>{player.teamId ? 'افتح داخل صفحة المنتخب' : 'غير مرتبط بمنتخب'}</span>
        {player.teamId ? (
          <span aria-hidden="true" className="transition group-hover:translate-x-[-4px]">
            ←
          </span>
        ) : null}
      </div>
    </>
  );

  if (!player.teamId) {
    return <article className="rounded-2xl border border-white/10 bg-black/25 p-4 opacity-90">{content}</article>;
  }

  return (
    <Link
      className="group block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-1 hover:border-[#0FF0FC]/60 hover:bg-white/[0.06]"
      href={`/teams/${player.teamId}?player=${player.id}`}
    >
      {content}
    </Link>
  );
}

export default async function PlayersPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = cleanParam(firstParam(resolvedSearchParams.q));
  const selectedTeam = cleanParam(firstParam(resolvedSearchParams.team));
  const selectedPosition = cleanParam(firstParam(resolvedSearchParams.position));

  const rawPlayers = await prisma.asset.findMany({
    where: { type: 'PLAYER' },
    orderBy: [{ team: { name: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
    take: 500,
    select: {
      id: true,
      name: true,
      code: true,
      image: true,
      position: true,
      age: true,
      club: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          code: true,
          image: true,
          group: true,
        },
      },
    },
  });

  const allPlayers = dedupePlayers(rawPlayers);
  const hiddenDuplicates = Math.max(0, rawPlayers.length - allPlayers.length);

  const teams = Array.from(
    new Map(
      allPlayers
        .filter((player) => player.team)
        .map((player) => [player.team!.id, { id: player.team!.id, name: player.team!.name, code: player.team!.code }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const positions = Array.from(
    new Set(allPlayers.map((player) => player.position).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const normalizedQuery = query.toLowerCase();
  const players = allPlayers.filter((player) => {
    const matchesQuery =
      !normalizedQuery ||
      [player.name, player.code, player.position, player.club, player.team?.name, player.team?.code].some((value) =>
        toSearchable(value).includes(normalizedQuery),
      );

    const matchesTeam = !selectedTeam || player.teamId === selectedTeam;
    const matchesPosition = !selectedPosition || player.position === selectedPosition;

    return matchesQuery && matchesTeam && matchesPosition;
  });

  const hasActiveFilters = Boolean(query || selectedTeam || selectedPosition);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0FF0FC]">World Cup Players</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black md:text-5xl">دليل اللاعبين</h1>
            <p className="mt-4 max-w-3xl leading-8 text-gray-300">
              تصفح اللاعبين المسجلين على المنصة، وابحث حسب الاسم أو المنتخب أو المركز للوصول السريع لملف اللاعب داخل صفحة منتخب بلاده.
            </p>
            {hiddenDuplicates > 0 ? (
              <p className="mt-3 text-sm font-bold text-cyan-100">
                تم دمج {hiddenDuplicates} نسخة مكررة في العرض حتى لا يظهر اللاعب أكثر من مرة.
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-gray-300">
            <span className="text-2xl font-black text-white">{players.length}</span> لاعب ظاهر
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.7fr)_minmax(160px,0.6fr)_auto]" method="GET">
          <label className="flex flex-col gap-2 text-sm font-bold text-gray-300">
            بحث
            <input
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-[#0FF0FC]"
              defaultValue={query}
              name="q"
              placeholder="اسم اللاعب، المنتخب، النادي..."
              type="search"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-bold text-gray-300">
            المنتخب
            <select
              className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-[#0FF0FC]"
              defaultValue={selectedTeam}
              name="team"
            >
              <option value="">كل المنتخبات</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}{team.code ? ` · ${team.code}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-bold text-gray-300">
            المركز
            <select
              className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-[#0FF0FC]"
              defaultValue={selectedPosition}
              name="position"
            >
              <option value="">كل المراكز</option>
              {positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button className="h-12 rounded-2xl bg-[#0FF0FC] px-5 text-sm font-black text-black transition hover:scale-[1.02]" type="submit">
              تطبيق
            </button>
            {hasActiveFilters ? (
              <Link className="flex h-12 items-center rounded-2xl border border-white/10 px-5 text-sm font-black text-white hover:bg-white/10" href="/players">
                مسح
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      {players.length ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center">
          <h2 className="text-2xl font-black">لا توجد نتائج مطابقة</h2>
          <p className="mt-3 text-gray-400">جرّب تغيير اسم البحث أو مسح فلاتر المنتخب والمركز.</p>
          <Link className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black" href="/players">
            عرض كل اللاعبين
          </Link>
        </section>
      )}
    </main>
  );
}
