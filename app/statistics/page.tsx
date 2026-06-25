import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';

export const revalidate = 600;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const LIVE = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'PEN_LIVE'];

function n(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ar-EG').format(value) : '—';
}

function avg(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value) : '—';
}

function kind(status?: string | null) {
  const raw = String(status || '').toUpperCase();
  if (FINISHED.includes(raw)) return 'finished';
  if (LIVE.includes(raw)) return 'live';
  return 'scheduled';
}

type TeamRow = { id: string; name: string; code: string | null; image: string | null; forGoals: number; againstGoals: number; clean: number };

function BasicCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-black text-slate-400">{title}</p><b className="mt-3 block text-3xl font-black text-white">{value}</b>{note ? <p className="mt-2 text-xs font-bold text-slate-500">{note}</p> : null}</article>;
}

function TeamCard({ title, team, note }: { title: string; team?: TeamRow | null; note: string }) {
  const name = team ? getArabicTeamName(team.code, team.name) : '—';
  const flag = team ? getTeamFlagUrl({ code: team.code, name, image: null }, 80) || team.image : null;
  return <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-black text-slate-400">{title}</p><div className="mt-3 flex items-center gap-3">{flag ? <img src={flag} alt={`علم ${name}`} className="h-9 w-12 rounded-lg border border-white/10 object-cover" loading="lazy" /> : null}<b className="team-name-full text-xl font-black text-white">{name}</b></div><p className="mt-2 text-xs font-bold text-slate-500">{note}</p></article>;
}

async function loadData() {
  const [matches, teamsCount, playersCount, snapshotsCount, eventsCount] = await Promise.all([
    prisma.match.findMany({
      select: {
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { id: true, name: true, code: true, image: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true } },
      },
    }),
    prisma.asset.count({ where: { type: 'TEAM' } }),
    prisma.asset.count({ where: { type: 'PLAYER' } }),
    prisma.matchStatsSnapshot.count(),
    prisma.matchEvent.count(),
  ]);

  const finished = matches.filter((m) => kind(m.status) === 'finished');
  const live = matches.filter((m) => kind(m.status) === 'live');
  const scheduled = matches.filter((m) => kind(m.status) === 'scheduled');
  const goals = finished.reduce((sum, m) => sum + Number(m.homeScore || 0) + Number(m.awayScore || 0), 0);
  const byTeam = new Map<string, TeamRow>();

  function row(team: any) {
    if (!byTeam.has(team.id)) byTeam.set(team.id, { id: team.id, name: team.name, code: team.code, image: team.image, forGoals: 0, againstGoals: 0, clean: 0 });
    return byTeam.get(team.id)!;
  }

  for (const match of finished) {
    const home = row(match.homeTeam);
    const away = row(match.awayTeam);
    const homeGoals = Number(match.homeScore || 0);
    const awayGoals = Number(match.awayScore || 0);
    home.forGoals += homeGoals;
    home.againstGoals += awayGoals;
    away.forGoals += awayGoals;
    away.againstGoals += homeGoals;
    if (awayGoals === 0) home.clean += 1;
    if (homeGoals === 0) away.clean += 1;
  }

  const table = [...byTeam.values()];
  const topAttack = [...table].sort((a, b) => b.forGoals - a.forGoals)[0] || null;
  const bestDefense = [...table].sort((a, b) => a.againstGoals - b.againstGoals)[0] || null;
  const cleanSheets = table.reduce((sum, item) => sum + item.clean, 0);

  return { total: matches.length, finished: finished.length, live: live.length, scheduled: scheduled.length, goals, averageGoals: finished.length ? goals / finished.length : null, teamsCount, playersCount, snapshotsCount, eventsCount, topAttack, bestDefense, cleanSheets };
}

export default async function StatisticsPage() {
  const data = await loadData();
  return <main dir="rtl" className="mx-auto max-w-6xl space-y-5 px-3 py-6 text-white sm:px-4 lg:px-6"><section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="inline-flex rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">DATA CENTER</p><h1 className="mt-3 text-2xl font-black sm:text-3xl">إحصائيات البطولة</h1><p className="mt-2 text-sm font-bold text-slate-400">لوحة مختصرة للأرقام العامة من قاعدة البيانات فقط.</p></div><Link href="/" className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-gray-200">الصفحة الرئيسية</Link></div></section><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><BasicCard title="المباريات" value={`${n(data.finished)} / ${n(data.total)}`} note={`${n(data.live)} مباشر · ${n(data.scheduled)} قادمة`} /><BasicCard title="إجمالي الأهداف" value={n(data.goals)} note={`${n(data.finished)} مباراة منتهية`} /><BasicCard title="متوسط الأهداف" value={avg(data.averageGoals)} note="لكل مباراة منتهية" /><BasicCard title="الشباك النظيفة" value={n(data.cleanSheets)} /></section><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><BasicCard title="عدد المنتخبات" value={n(data.teamsCount)} /><BasicCard title="عدد اللاعبين" value={n(data.playersCount)} /><TeamCard title="أقوى هجوم" team={data.topAttack} note={data.topAttack ? `${n(data.topAttack.forGoals)} هدف` : '—'} /><TeamCard title="أفضل دفاع" team={data.bestDefense} note={data.bestDefense ? `${n(data.bestDefense.againstGoals)} هدف مستقبَل` : '—'} /></section><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><BasicCard title="لقطات الإحصائيات" value={n(data.snapshotsCount)} note="Snapshots محفوظة" /><BasicCard title="أحداث المباريات" value={n(data.eventsCount)} note="Timeline events محفوظة" /></section></main>;
}
