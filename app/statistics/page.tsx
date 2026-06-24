import Link from 'next/link';
import prisma from '@/lib/prisma';

export const revalidate = 600;

const finishedStatuses = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const liveStatuses = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'PEN_LIVE'];

function fmt(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '?';
  return new Intl.NumberFormat('ar-EG').format(value);
}

function dec(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '?';
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

function statusKind(status?: string | null) {
  const raw = String(status || '').toUpperCase();
  if (finishedStatuses.includes(raw)) return 'finished';
  if (liveStatuses.includes(raw)) return 'live';
  return 'scheduled';
}

function Card({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black text-slate-400">{title}</p>
      <b className="mt-3 block truncate text-3xl font-black text-white">{value}</b>
      {note ? <p className="mt-2 text-xs font-bold text-slate-500">{note}</p> : null}
    </article>
  );
}

async function getStats() {
  const [matches, teams, players, snapshots, events] = await Promise.all([
    prisma.match.findMany({
      select: {
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { id: true, name: true, code: true } },
        awayTeam: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.matchStatsSnapshot.count(),
    prisma.matchEvent.count(),
  ]);

  const finished = matches.filter((m) => statusKind(m.status) === 'finished');
  const live = matches.filter((m) => statusKind(m.status) === 'live');
  const scheduled = matches.filter((m) => statusKind(m.status) === 'scheduled');
  const goals = finished.reduce((sum, m) => sum + Number(m.homeScore || 0) + Number(m.awayScore || 0), 0);

  const teamStats = new Map<string, { name: string; goalsFor: number; goalsAgainst: number; cleanSheets: number }>();

  function team(row: { id: string; name: string; code: string }) {
    if (!teamStats.has(row.id)) {
      teamStats.set(row.id, { name: row.name || row.code, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 });
    }
    return teamStats.get(row.id)!;
  }

  for (const m of finished) {
    const home = team(m.homeTeam);
    const away = team(m.awayTeam);
    const hs = Number(m.homeScore || 0);
    const as = Number(m.awayScore || 0);

    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;

    if (as === 0) home.cleanSheets += 1;
    if (hs === 0) away.cleanSheets += 1;
  }

  const table = [...teamStats.values()];
  const topAttack = [...table].sort((a, b) => b.goalsFor - a.goalsFor)[0];
  const bestDefense = [...table].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];
  const cleanSheets = table.reduce((sum, t) => sum + t.cleanSheets, 0);

  return {
    total: matches.length,
    finished: finished.length,
    live: live.length,
    scheduled: scheduled.length,
    goals,
    averageGoals: finished.length ? goals / finished.length : null,
    teams,
    players,
    snapshots,
    events,
    topAttack,
    bestDefense,
    cleanSheets,
  };
}

export default async function StatisticsPage() {
  const data = await getStats();

  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-5 px-3 py-6 text-white sm:px-4 lg:px-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">DATA CENTER</p>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">???????? ???????</h1>
            <p className="mt-2 text-sm font-bold text-slate-400">???? ????? ?????? ????? ??? ????? ???????? ???.</p>
          </div>
          <Link href="/" className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-gray-200">?????? ????????</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="?????????" value={`${fmt(data.finished)} / ${fmt(data.total)}`} note={`${fmt(data.live)} ?????? ? ${fmt(data.scheduled)} ?????`} />
        <Card title="????? ???????" value={fmt(data.goals)} note={`${fmt(data.finished)} ?????? ??????`} />
        <Card title="????? ???????" value={dec(data.averageGoals)} note="??? ??? ?????? ??????" />
        <Card title="?????? ???????" value={fmt(data.cleanSheets)} note="??? ??????? ????????" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="??? ?????????" value={fmt(data.teams)} />
        <Card title="??? ????????" value={fmt(data.players)} />
        <Card title="???? ????" value={data.topAttack?.name || '?'} note={data.topAttack ? `${fmt(data.topAttack.goalsFor)} ???` : '?'} />
        <Card title="???? ????" value={data.bestDefense?.name || '?'} note={data.bestDefense ? `${fmt(data.bestDefense.goalsAgainst)} ??? ???????` : '?'} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="????? ??????????" value={fmt(data.snapshots)} note="Snapshots ??????" />
        <Card title="????? ????????" value={fmt(data.events)} note="Timeline events ??????" />
      </section>
    </main>
  );
}
