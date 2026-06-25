import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { withTeamDisplay } from '@/lib/teamDisplay';

export const dynamic = 'force-dynamic';

type TeamsSearchParams = Promise<{
  q?: string | string[];
  group?: string | string[];
  continent?: string | string[];
}>;

type Props = {
  searchParams?: TeamsSearchParams;
};

type GoalLeader = {
  team: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    group?: string | null;
    arabicName?: string | null;
    flagUrl?: string | null;
  } | null;
  goalsFor: number;
  goalsAgainst: number;
  played: number;
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

function formatCount(value?: number | null, fallback = '٠') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ar-EG') : fallback;
}

function compactTeam(team: any) {
  if (!team) return null;
  return withTeamDisplay({ id: team.id, name: team.name, code: team.code, image: team.image, group: team.group });
}

function flagNode(team: GoalLeader['team']) {
  const flagUrl = team ? getTeamFlagUrl({ code: team.code, name: team.name, image: team.flagUrl || team.image }, 80) : null;
  return flagUrl ? (
    <img src={flagUrl} alt={`علم ${team?.name || 'منتخب'}`} className="h-full w-full object-cover" loading="lazy" />
  ) : (
    <span className="text-sm font-black text-[#FFD700]">{team?.code || '---'}</span>
  );
}

function GoalLeaderCard({ title, leader, valueLabel, value }: { title: string; leader?: GoalLeader | null; valueLabel: string; value?: number | null }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FFD700]">{title}</p>
      {leader?.team ? (
        <Link href={`/teams/${leader.team.id}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.07]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {flagNode(leader.team)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="team-name-full block text-base font-black text-white">{leader.team.name}</span>
            <span className="mt-1 block text-xs font-bold text-gray-500">{leader.team.code || 'N/A'} · {leader.team.group || 'Group N/A'}</span>
          </span>
          <span className="text-left">
            <span className="block text-2xl font-black text-[#0FF0FC]">{formatCount(value)}</span>
            <span className="text-[10px] font-bold text-gray-500">{valueLabel}</span>
          </span>
        </Link>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-gray-500">غير متوفر حاليًا</div>
      )}
    </div>
  );
}

export default async function TeamsPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = cleanParam(firstParam(resolvedSearchParams.q));
  const selectedGroup = cleanParam(firstParam(resolvedSearchParams.group));
  const selectedContinent = cleanParam(firstParam(resolvedSearchParams.continent));

  const [rawTeams, scoredMatches] = await Promise.all([
    prisma.asset.findMany({
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
    }),
    prisma.match.findMany({
      where: { status: { in: ['FINISHED', 'FT', 'AET', 'PEN', 'IN_PLAY', 'LIVE', 'HT'] } },
      select: {
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
      },
    }),
  ]);

  const allTeams = rawTeams.map((team) => withTeamDisplay(team));
  const goalLeaders = new Map<string, GoalLeader>();
  const addTeamScore = (team: any, goalsFor: number, goalsAgainst: number) => {
    if (!team?.id) return;
    const current = goalLeaders.get(team.id) || { team: compactTeam(team), goalsFor: 0, goalsAgainst: 0, played: 0 };
    current.goalsFor += Number(goalsFor || 0);
    current.goalsAgainst += Number(goalsAgainst || 0);
    current.played += 1;
    goalLeaders.set(team.id, current);
  };

  for (const match of scoredMatches) {
    addTeamScore(match.homeTeam, match.homeScore, match.awayScore);
    addTeamScore(match.awayTeam, match.awayScore, match.homeScore);
  }

  const leaders = Array.from(goalLeaders.values());
  const topAttack = leaders.sort((a, b) => b.goalsFor - a.goalsFor || b.played - a.played)[0] || null;
  const bestDefense = [...leaders].sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.played - a.played)[0] || null;
  const mostPlayed = [...leaders].sort((a, b) => b.played - a.played || b.goalsFor - a.goalsFor)[0] || null;

  const groups = Array.from(new Set(allTeams.map((team) => team.group).filter(Boolean))).sort();
  const continents = Array.from(new Set(allTeams.map((team) => team.continent).filter(Boolean))).sort();

  const filteredTeams = allTeams.filter((team) => {
    const matchesQuery = !query || toSearchable(team.name).includes(toSearchable(query)) || toSearchable(team.originalName).includes(toSearchable(query)) || toSearchable(team.code).includes(toSearchable(query));
    const matchesGroup = !selectedGroup || team.group === selectedGroup;
    const matchesContinent = !selectedContinent || team.continent === selectedContinent;
    return matchesQuery && matchesGroup && matchesContinent;
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-6 shadow-card sm:p-8">
          <span className="inline-flex rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">دليل المنتخبات</span>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black leading-tight sm:text-5xl">منتخبات كأس العالم 2026</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 sm:text-base">تصفح المنتخبات، المجموعات، والمدربين، مع مؤشرات سريعة مبنية على نتائج المباريات المحفوظة داخل المنصة.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-2xl font-black text-[#FFD700]">{formatCount(allTeams.length)}</p><p className="text-[11px] font-bold text-gray-500">منتخب</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-2xl font-black text-[#FFD700]">{formatCount(groups.length)}</p><p className="text-[11px] font-bold text-gray-500">مجموعة</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-2xl font-black text-[#FFD700]">{formatCount(continents.length)}</p><p className="text-[11px] font-bold text-gray-500">قارة</p></div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <GoalLeaderCard title="أقوى هجوم" leader={topAttack} valueLabel="أهداف" value={topAttack?.goalsFor} />
          <GoalLeaderCard title="أفضل دفاع" leader={bestDefense} valueLabel="استقبل" value={bestDefense?.goalsAgainst} />
          <GoalLeaderCard title="الأكثر ظهورًا" leader={mostPlayed} valueLabel="مباريات" value={mostPlayed?.played} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <form className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]" action="/teams">
            <input name="q" defaultValue={query} placeholder="ابحث باسم المنتخب أو الكود..." className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none transition placeholder:text-gray-600 focus:border-[#0FF0FC]/50" />
            <select name="group" defaultValue={selectedGroup} className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50">
              <option value="">كل المجموعات</option>
              {groups.map((group) => <option key={group || 'group'} value={group || ''}>{group}</option>)}
            </select>
            <select name="continent" defaultValue={selectedContinent} className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50">
              <option value="">كل القارات</option>
              {continents.map((continent) => <option key={continent || 'continent'} value={continent || ''}>{continent}</option>)}
            </select>
            <button className="min-h-12 rounded-2xl bg-[#0FF0FC] px-6 text-sm font-black text-black transition hover:bg-[#4AFAFF]">تصفية</button>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTeams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-4 transition hover:-translate-y-1 hover:border-[#0FF0FC]/40 hover:bg-white/[0.06] hover:shadow-[0_18px_45px_rgba(15,240,252,0.08)]">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                  {flagNode(team)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="team-name-full block text-lg font-black text-white">{team.name}</span>
                  <span className="mt-1 block text-xs font-bold text-gray-500">{team.code || 'N/A'} · {team.group || 'Group N/A'}</span>
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-gray-400">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="block text-[10px] text-gray-600">القارة</span>{team.continent || 'غير متوفر'}</div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="block text-[10px] text-gray-600">المدرب</span>{team.coach || 'غير متوفر'}</div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="block text-[10px] text-gray-600">تصنيف FIFA</span>{team.fifaRank ? formatCount(team.fifaRank) : 'غير متوفر'}</div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="block text-[10px] text-gray-600">المجموعة</span>{team.group || 'غير متوفر'}</div>
              </div>
            </Link>
          ))}
        </section>

        {!filteredTeams.length ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-gray-500">لا توجد منتخبات مطابقة للفلاتر الحالية.</div>
        ) : null}
      </section>
    </main>
  );
}
