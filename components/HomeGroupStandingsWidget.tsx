'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { getArabicTeamName } from '@/lib/teamDisplay';

type TableRow = {
  team: string;
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type GroupData = { key: string; arName: string; standings: TableRow[] };
type ThirdPlaceRow = TableRow & { groupKey: string; groupNumber: number };
type Props = { compact?: boolean };

function formatCount(value?: number | null, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
}
function formatGoalDifference(value: number) { return value > 0 ? `+${formatCount(value)}` : formatCount(value); }
function teamName(row: Pick<TableRow, 'code' | 'team'>) { return getArabicTeamName(row.code, row.team); }
function teamFlag(row: Pick<TableRow, 'code' | 'team'>, width = 40) { const name = teamName(row); return getTeamFlagUrl({ code: row.code, name, image: null }, width); }
function rankThirdPlaced(groups: GroupData[]) {
  return groups
    .map<ThirdPlaceRow | null>((group, index) => {
      const row = group.standings[2];
      return row ? { ...row, groupKey: group.key, groupNumber: index + 1 } : null;
    })
    .filter((row): row is ThirdPlaceRow => Boolean(row))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return teamName(a).localeCompare(teamName(b), 'ar');
    })
    .slice(0, 8);
}

function ThirdPlacedCard({ rows, compact }: { rows: ThirdPlaceRow[]; compact: boolean }) {
  return (
    <section className={`rounded-[1.2rem] border border-[#FFD700]/15 bg-black/25 ${compact ? 'p-2.5' : 'p-3'} shadow-[0_14px_38px_rgba(0,0,0,0.16)]`}>
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[11px] font-black text-white">أفضل ٨ ثوالث</h3><span className="rounded-full border border-[#00FF88]/20 bg-[#00FF88]/10 px-2 py-0.5 text-[9px] font-black text-[#00FF88]">يتأهلون</span></div>
      {rows.length ? <div className="space-y-1.5"><div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem_2rem] items-center gap-1.5 px-1.5 text-[8px] font-black text-gray-500"><span>المنتخب</span><span className="text-center">نقاط</span><span className="text-center">فارق</span><span className="text-center">أهداف</span></div><div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{rows.map((row) => { const flagUrl = teamFlag(row, 40); const name = teamName(row); const teamId = `team-${row.code.toLowerCase()}`; return <Link key={`${row.groupKey}-${row.code}`} href={`/teams/${teamId}`} className="mobile-tap grid min-w-0 grid-cols-[auto_minmax(0,1fr)_2rem_2rem_2rem] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-1.5 transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]" title={`${name} - المجموعة ${formatCount(row.groupNumber)}`}><img src={flagUrl || undefined} alt={`علم ${name}`} className="h-3.5 w-5 shrink-0 rounded-[3px] object-cover" /><span className="min-w-0"><span className="team-name-full block text-[10px] font-black text-white">{name}</span><span className="mt-0.5 block text-[8px] font-black text-gray-500">م{formatCount(row.groupNumber)}</span></span><span className="rounded-md bg-[#FFD700]/10 px-1 py-0.5 text-center text-[9px] font-black text-[#FFD700]">{formatCount(row.points)}</span><span className="rounded-md bg-white/[0.06] px-1 py-0.5 text-center text-[9px] font-bold text-gray-300">{formatGoalDifference(row.goalDifference)}</span><span className="rounded-md bg-white/[0.06] px-1 py-0.5 text-center text-[9px] font-bold text-gray-300">{formatCount(row.goalsFor)}</span></Link>; })}</div></div> : <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-center text-[10px] font-bold text-gray-500">بيانات الثوالث غير متوفرة حالياً.</div>}
      <div className="mt-2 text-[9px] font-bold text-gray-500">نقاط • فارق • أهداف</div>
    </section>
  );
}

export default function HomeGroupStandingsWidget({ compact = false }: Props = {}) {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('A');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStandings() {
      try {
        const res = await fetch('/api/groups/standings');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && Array.isArray(data.groups)) {
          setGroups(data.groups);
          if (data.groups.length > 0) setSelectedGroupKey(data.groups[0].key);
        }
      } catch (err) {
        console.error('Failed to load standings', err);
      } finally {
        setLoading(false);
      }
    }
    loadStandings();
  }, []);

  const selectedGroup = groups.find((g) => g.key === selectedGroupKey);
  const thirdPlacedRows = useMemo(() => rankThirdPlaced(groups), [groups]);
  const sectionPadding = compact ? 'p-2.5' : 'p-3 sm:p-4';
  const groupButtonClass = (active: boolean) => `mobile-tap flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg ${compact ? 'px-1 text-[10px]' : 'px-2 text-[11px]'} font-black transition-all ${active ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/10' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`;
  const cellPadding = compact ? 'px-1 py-1.5' : 'px-1.5 py-2.5 sm:px-2';

  return <div className="flex h-auto flex-col gap-2"><section className={`flex h-auto flex-col rounded-[1.45rem] border border-white/10 bg-white/[0.04] ${sectionPadding} text-white shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:rounded-3xl`}>{loading ? <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-white/10 bg-black/20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0FF0FC] border-t-transparent" /></div> : groups.length === 0 ? <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">جدول الترتيب غير متوفر حالياً.</div> : <div className="flex flex-col"><div className={`-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none ${compact ? 'mb-2 pb-1' : 'mb-3 pb-2'}`}>{groups.map((group, index) => <button key={group.key} onClick={() => setSelectedGroupKey(group.key)} className={groupButtonClass(selectedGroupKey === group.key)} title={group.arName} aria-label={group.arName}>{formatCount(index + 1)}</button>)}</div><div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">{selectedGroup ? <table className={`w-full text-right ${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}><thead><tr className="border-b border-white/10 font-bold text-gray-400"><th className="w-7 px-1 py-1.5 text-center sm:w-8">#</th><th className="px-1 py-1.5">المنتخب</th><th className="w-7 px-1 py-1.5 text-center">لعب</th><th className="w-8 px-1 py-1.5 text-center">فارق</th><th className="w-8 px-1 py-1.5 text-center">ن</th></tr></thead><tbody>{selectedGroup.standings.map((row, index) => { const name = teamName(row); const flagUrl = teamFlag(row, 40); const teamId = `team-${row.code.toLowerCase()}`; const isQualifying = index < 2; return <tr key={row.code} className="border-b border-white/5 transition last:border-b-0 hover:bg-white/[0.02]"><td className={`${cellPadding} text-center`}><span className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black ${isQualifying ? 'border border-[#00FF88]/20 bg-[#00FF88]/10 text-[#00FF88]' : index === 2 ? 'border border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'bg-white/5 text-gray-400'}`}>{formatCount(index + 1)}</span></td><td className={`min-w-0 font-bold text-white ${cellPadding}`}><Link href={`/teams/${teamId}`} className="inline-flex min-w-0 max-w-full items-center gap-2 transition hover:text-[#0FF0FC]"><img src={flagUrl || undefined} alt={`علم ${name}`} className="h-4 w-5 shrink-0 rounded-sm object-cover" /><span className="team-name-full">{name}</span></Link></td><td className={`${cellPadding} text-center font-medium text-gray-300`}>{formatCount(row.played)}</td><td className={`${cellPadding} text-center font-mono font-medium text-gray-300`}>{formatGoalDifference(row.goalDifference)}</td><td className={`${cellPadding} text-center font-black text-[#FFD700]`}>{formatCount(row.points)}</td></tr>; })}</tbody></table> : null}</div></div>}</section>{!loading && groups.length ? <ThirdPlacedCard rows={thirdPlacedRows} compact={compact} /> : null}</div>;
}
