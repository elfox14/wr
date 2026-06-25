'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Team = { id: string; name: string; code: string | null; image: string | null; group: string | null; fifaRank?: number | null; score?: number | null };
type Standing = { teamId: string; name: string; code: string | null; image: string | null; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number };
type GroupMatch = { id: string; href: string; liveHref: string; matchDate: string; statusLabel: string; isFinished: boolean; isLive: boolean; homeScore: number | null; awayScore: number | null; homeTeam: Team; awayTeam: Team; hasLiveAnimation: boolean; hasStats: boolean };
type GroupItem = { key: string; name: string; teams: Team[]; standings: Standing[]; results: GroupMatch[]; upcoming: GroupMatch[]; stats: { teams: number; matches: number; finished: number; live: number; upcoming: number; goals: number } };
type ApiResponse = { ok: boolean; groups: GroupItem[]; thirdPlace: Array<Standing & { groupKey: string }> };

const ar = new Intl.NumberFormat('ar-EG');

function fmt(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return ar.format(Number(value));
}

function gd(value: number) {
  return value > 0 ? `+${ar.format(value)}` : ar.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(value));
}

function Flag({ team, small = false }: { team: Pick<Team, 'name' | 'code' | 'image'>; small?: boolean }) {
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-6 w-8 rounded-lg' : 'h-10 w-12 rounded-xl'}`}>{team.image ? <img src={team.image} alt={team.name} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-[10px] text-[#F8C846]">{team.code || team.name.slice(0, 3)}</b>}</span>;
}

function StatPill({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center"><span className="block text-[10px] font-black text-slate-500">{label}</span><b className="mt-1 block text-xl font-black text-white">{ar.format(value)}</b></div>;
}

function TeamChip({ team }: { team: Team }) {
  return <Link href={`/asset/${team.id}`} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2 transition hover:border-[#18E58F]/35 hover:bg-white/[0.07]"><Flag team={team} small /><div className="min-w-0"><b className="block truncate text-sm text-white">{team.name}</b><span className="text-[10px] font-bold text-slate-500">{team.code || '—'}{team.fifaRank ? ` · ${ar.format(team.fifaRank)}` : ''}</span></div></Link>;
}

function StandingRow({ row, index }: { row: Standing; index: number }) {
  const top = index < 2;
  return <div className={`grid grid-cols-[36px_minmax(150px,1fr)_repeat(5,44px)] items-center gap-1 rounded-2xl border p-2 text-center text-xs ${top ? 'border-[#18E58F]/25 bg-[#18E58F]/8' : 'border-white/10 bg-black/20'}`}><span className="font-black text-[#F8C846]">{ar.format(index + 1)}</span><div className="flex min-w-0 items-center gap-2 text-right"><Flag team={row} small /><b className="truncate text-white">{row.name}</b></div><span>{fmt(row.played)}</span><span>{fmt(row.points)}</span><span>{fmt(row.goalsFor)}</span><span>{fmt(row.goalsAgainst)}</span><span className={row.goalDifference > 0 ? 'text-[#18E58F]' : row.goalDifference < 0 ? 'text-rose-300' : 'text-white'}>{gd(row.goalDifference)}</span></div>;
}

function MatchMini({ match }: { match: GroupMatch }) {
  return <Link href={match.href} className="block rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-[#18E58F]/35 hover:bg-white/[0.06]"><div className="mb-2 flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${match.isLive ? 'bg-[#18E58F] text-black' : match.isFinished ? 'bg-sky-300/15 text-sky-100' : 'bg-white/10 text-white'}`}>{match.statusLabel}</span><span className="text-[10px] font-bold text-slate-500">{formatDate(match.matchDate)}</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center"><div className="min-w-0 text-right"><span className="inline-flex max-w-full items-center gap-1"><Flag team={match.homeTeam} small /><b className="truncate text-xs text-white">{match.homeTeam.name}</b></span></div><b className="rounded-xl bg-black/35 px-2 py-1 text-sm font-black text-[#F8C846]">{match.isFinished || match.isLive ? `${fmt(match.homeScore)} - ${fmt(match.awayScore)}` : 'vs'}</b><div className="min-w-0 text-left"><span className="inline-flex max-w-full items-center justify-end gap-1"><b className="truncate text-xs text-white">{match.awayTeam.name}</b><Flag team={match.awayTeam} small /></span></div></div></Link>;
}

function ThirdPlacePanel({ rows }: { rows: Array<Standing & { groupKey: string }> }) {
  return <section className="rounded-[1.5rem] border border-[#F8C846]/20 bg-[#F8C846]/8 p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">أفضل الثوالث</h2><p className="mt-1 text-xs font-bold text-slate-400">ترتيب سريع حسب النقاط ثم فارق الأهداف ثم الأهداف المسجلة.</p></div><span className="rounded-full bg-[#F8C846] px-3 py-1 text-xs font-black text-black">Top 8</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{rows.length ? rows.map((row, index) => <div key={`${row.groupKey}-${row.teamId}`} className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex items-center justify-between"><span className="rounded-full bg-[#F8C846]/15 px-2 py-1 text-[10px] font-black text-[#F8C846]">#{ar.format(index + 1)}</span><span className="text-[10px] font-bold text-slate-500">Group {row.groupKey}</span></div><div className="flex items-center gap-2"><Flag team={row} small /><div className="min-w-0"><b className="block truncate text-sm text-white">{row.name}</b><span className="text-[10px] font-bold text-slate-500">نقاط {fmt(row.points)} · فارق {gd(row.goalDifference)}</span></div></div></div>) : <p className="text-sm font-bold text-slate-400">لم تتشكل قائمة الثوالث بعد.</p>}</div></section>;
}

function GroupCard({ group }: { group: GroupItem }) {
  return <section id={`group-${group.key}`} className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_48px_rgba(0,0,0,.22)]"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-2xl font-black text-[#18E58F]">{group.key}</span><div><h2 className="text-2xl font-black text-white">{group.name}</h2><p className="text-xs font-bold text-slate-500">{group.stats.teams} منتخبات · {group.stats.matches} مباريات</p></div></div><div className="grid grid-cols-3 gap-2"><StatPill label="انتهت" value={group.stats.finished} /><StatPill label="أهداف" value={group.stats.goals} /><StatPill label="مباشر" value={group.stats.live} /></div></div><div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="mb-2 grid grid-cols-[36px_minmax(150px,1fr)_repeat(5,44px)] gap-1 px-2 text-center text-[10px] font-black text-slate-500"><span>#</span><span className="text-right">المنتخب</span><span>لعب</span><span>نقاط</span><span>له</span><span>عليه</span><span>فارق</span></div><div className="space-y-2">{group.standings.map((row, index) => <StandingRow key={row.teamId} row={row} index={index} />)}</div></div><div className="grid gap-2 sm:grid-cols-2">{group.teams.map((team) => <TeamChip key={team.id} team={team} />)}</div></div><div className="space-y-4"><div className="rounded-2xl border border-sky-300/15 bg-sky-300/8 p-3"><h3 className="mb-3 font-black text-white">آخر النتائج</h3><div className="space-y-2">{group.results.length ? group.results.slice(0, 4).map((match) => <MatchMini key={match.id} match={match} />) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm font-bold text-slate-400">لا توجد نتائج بعد.</p>}</div></div><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><h3 className="mb-3 font-black text-white">المباريات القادمة</h3><div className="space-y-2">{group.upcoming.length ? group.upcoming.slice(0, 4).map((match) => <MatchMini key={match.id} match={match} />) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm font-bold text-slate-400">لا توجد مباريات قادمة.</p>}</div></div></div></div></section>;
}

export default function GroupsHubClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [active, setActive] = useState('A');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/groups-hub', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('فشل تحميل المجموعات')))
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(String(err?.message || err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const groups = data?.groups || [];
  const selected = useMemo(() => groups.find((group) => group.key === active) || groups[0], [groups, active]);

  return <main className="min-h-screen bg-[#04110D] px-3 py-5 text-white sm:px-5" dir="rtl"><div className="mx-auto max-w-7xl space-y-5"><header className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_70px_rgba(0,0,0,.30)] sm:p-6"><p className="text-xs font-black text-[#18E58F]">كأس العالم</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">المجموعات والترتيب</h1><p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-400">صفحة خفيفة تعرض ترتيب كل مجموعة، آخر النتائج، والمباريات القادمة من قاعدة البيانات فقط.</p></header><section className="sticky top-0 z-30 rounded-[1.35rem] border border-white/10 bg-[#04110D]/95 p-3 shadow-xl backdrop-blur"><div className="grid grid-cols-6 gap-2 sm:grid-cols-12">{groups.length ? groups.map((group) => <button key={group.key} onClick={() => setActive(group.key)} className={`rounded-xl border px-3 py-2 text-xs font-black ${active === group.key ? 'border-[#18E58F]/50 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.04] text-white'}`}>Group {group.key}</button>) : 'ABCDEFGHIJKL'.split('').map((key) => <button key={key} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white">{key}</button>)}</div></section>{loading ? <div className="grid min-h-[320px] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#18E58F] border-t-transparent" /></div> : null}{error ? <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm font-black text-rose-100">{error}</div> : null}{!loading && data ? <ThirdPlacePanel rows={data.thirdPlace} /> : null}{!loading && selected ? <GroupCard group={selected} /> : null}{!loading && !selected && !error ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-400">لا توجد مجموعات محفوظة.</div> : null}</div></main>;
}
