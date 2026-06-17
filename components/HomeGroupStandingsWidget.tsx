'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getTeamFlagUrl } from '@/lib/teamFlags';

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

type GroupData = {
  key: string;
  arName: string;
  standings: TableRow[];
};

type Props = {
  compact?: boolean;
};

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
          if (data.groups.length > 0) {
            setSelectedGroupKey(data.groups[0].key);
          }
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
  const sectionPadding = compact ? 'p-3' : 'p-3 sm:p-4';
  const titleClass = compact ? 'mt-1 truncate text-base font-black text-white' : 'mt-1 truncate text-lg font-black text-white md:text-xl';
  const actionClass = compact
    ? 'mobile-tap shrink-0 rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.14]'
    : 'mobile-tap shrink-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-black text-white transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.14]';
  const groupButtonClass = (active: boolean) => `mobile-tap shrink-0 rounded-xl ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'} font-black transition-all ${
    active ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/10' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
  }`;

  return (
    <section className={`flex h-auto flex-col rounded-[1.45rem] border border-white/10 bg-white/[0.04] ${sectionPadding} text-white shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:rounded-3xl`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD700] sm:text-[11px]">Tournament Tables</p>
          <h2 className={titleClass}>ترتيب المجموعات</h2>
        </div>
        <Link href="/groups" className={actionClass}>
          كل المجموعات
        </Link>
      </div>

      {loading ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-white/10 bg-black/20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0FF0FC] border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">
          جدول الترتيب غير متوفر حالياً.
        </div>
      ) : (
        <div className="flex flex-col">
          <div className={`-mx-1 flex gap-1.5 overflow-x-auto px-1 scrollbar-none ${compact ? 'mb-2 pb-1.5' : 'mb-3 pb-2'}`}>
            {groups.map((group) => (
              <button
                key={group.key}
                onClick={() => setSelectedGroupKey(group.key)}
                className={groupButtonClass(selectedGroupKey === group.key)}
              >
                {group.arName}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <AnimatePresence mode="wait">
              {selectedGroup && (
                <motion.table
                  key={selectedGroupKey}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className={`w-full text-right ${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}
                >
                  <thead>
                    <tr className="border-b border-white/10 font-bold text-gray-400">
                      <th className="w-7 px-1.5 py-2 text-center sm:w-8 sm:px-2">#</th>
                      <th className="px-1.5 py-2 sm:px-2">المنتخب</th>
                      <th className="w-8 px-1.5 py-2 text-center sm:px-2">لعب</th>
                      <th className="w-8 px-1.5 py-2 text-center sm:px-2">فارق</th>
                      <th className="w-10 px-1.5 py-2 text-center sm:px-2">نقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.standings.map((row, index) => {
                      const flagUrl = getTeamFlagUrl({ code: row.code, name: row.team }, 40);
                      const teamId = `team-${row.code.toLowerCase()}`;
                      const isQualifying = index < 2;

                      return (
                        <tr key={row.code} className="border-b border-white/5 transition last:border-b-0 hover:bg-white/[0.02]">
                          <td className={`${compact ? 'px-1 py-2' : 'px-1.5 py-2.5 sm:px-2'} text-center`}>
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black ${
                              isQualifying
                                ? 'border border-[#00FF88]/20 bg-[#00FF88]/10 text-[#00FF88]'
                                : 'bg-white/5 text-gray-400'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className={`min-w-0 font-bold text-white ${compact ? 'px-1 py-2' : 'px-1.5 py-2.5 sm:px-2'}`}>
                            <Link href={`/teams/${teamId}`} className="inline-flex min-w-0 max-w-full items-center gap-2 transition hover:text-[#0FF0FC]">
                              <img src={flagUrl || undefined} alt="" className="h-4 w-5 shrink-0 rounded-sm object-cover" />
                              <span className={compact ? 'max-w-[5.4rem] truncate' : 'max-w-[6.5rem] truncate sm:max-w-[10rem]'}>{row.team}</span>
                            </Link>
                          </td>
                          <td className={`${compact ? 'px-1 py-2' : 'px-1.5 py-2.5 sm:px-2'} text-center font-medium text-gray-300`}>{row.played}</td>
                          <td className={`${compact ? 'px-1 py-2' : 'px-1.5 py-2.5 sm:px-2'} text-center font-mono font-medium text-gray-300`}>
                            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </td>
                          <td className={`${compact ? 'px-1 py-2' : 'px-1.5 py-2.5 sm:px-2'} text-center font-black text-[#FFD700]`}>{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </motion.table>
              )}
            </AnimatePresence>
          </div>

          <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 ${compact ? 'text-[9px]' : 'text-[10px]'} font-bold text-gray-500`}>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#00FF88]" />
              <span>يتأهل المتصدر والوصيف</span>
            </div>
            <Link href="/groups" className="text-[#0FF0FC] hover:underline">
              التفاصيل ←
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
