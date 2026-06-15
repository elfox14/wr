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

export default function HomeGroupStandingsWidget() {
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
          // Set default selected group to the first group in the list if available
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

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-card backdrop-blur text-white flex flex-col h-full min-h-[30rem]">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD700]">Tournament Tables</p>
        <h2 className="mt-1 text-base font-black text-white md:text-lg">ترتيب المجموعات</h2>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0FF0FC] border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-xs font-bold text-gray-500">
          جدول الترتيب غير متوفر حالياً.
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          {/* Horizontal Groups Tab Selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 scrollbar-none">
            {groups.map((group) => (
              <button
                key={group.key}
                onClick={() => setSelectedGroupKey(group.key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  selectedGroupKey === group.key
                    ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/10'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {group.arName}
              </button>
            ))}
          </div>

          {/* Standings Table with Animation */}
          <div className="flex-1 overflow-x-auto">
            <AnimatePresence mode="wait">
              {selectedGroup && (
                <motion.table 
                  key={selectedGroupKey}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="w-full text-right text-xs"
                >
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 font-bold">
                      <th className="py-2.5 px-2 text-center w-8">#</th>
                      <th className="py-2.5 px-2">المنتخب</th>
                      <th className="py-2.5 px-2 text-center w-8">لعب</th>
                      <th className="py-2.5 px-2 text-center w-8">فارق</th>
                      <th className="py-2.5 px-2 text-center w-10">النقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.standings.map((row, index) => {
                      const flagUrl = getTeamFlagUrl({ code: row.code, name: row.team }, 40);
                      const teamId = `team-${row.code.toLowerCase()}`;
                      
                      // Highlight top 2 positions (World Cup qualification)
                      const isQualifying = index < 2;

                      return (
                        <tr 
                          key={row.code} 
                          className={`border-b border-white/5 transition hover:bg-white/[0.02]`}
                        >
                          <td className="py-3 px-2 text-center">
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black ${
                              isQualifying 
                                ? 'bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20' 
                                : 'bg-white/5 text-gray-400'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-2 font-bold text-white">
                            <Link 
                              href={`/teams/${teamId}`}
                              className="inline-flex items-center gap-2 hover:text-[#0FF0FC] transition"
                            >
                              <img src={flagUrl || undefined} alt="" className="h-4 w-5 rounded-sm object-cover" />
                              <span className="truncate max-w-[7rem] md:max-w-[10rem]">{row.team}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-center text-gray-300 font-medium">{row.played}</td>
                          <td className="py-3 px-2 text-center text-gray-300 font-medium font-mono">
                            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </td>
                          <td className="py-3 px-2 text-center text-[#FFD700] font-black">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </motion.table>
              )}
            </AnimatePresence>
          </div>
          
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500 font-bold">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#00FF88]" />
              <span>يتأهل المتصدر والوصيف</span>
            </div>
            <Link href="/groups" className="text-[#0FF0FC] hover:underline">
              عرض التفاصيل الكاملة ←
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
