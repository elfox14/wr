'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, X, Search, ChevronLeft, Shield } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { getRealWorldCupData } from '@/lib/realWorldCupData';

type TeamInfo = { id: string; name: string; image?: string | null; code?: string | null };

type H2HProps = {
  currentTeam: TeamInfo;
};

export default function TeamHeadToHeadModal({ currentTeam }: H2HProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<TeamInfo[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<TeamInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [opponentStats, setOpponentStats] = useState<any>(null); // Simplified

  // Dummy fetch for search results (In real app, call an API)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=TEAM`);
        if (res.ok) {
          const data = await res.json();
          // Filter out the current team
          setResults((data.results || []).filter((t: any) => t.id !== currentTeam.id));
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentTeam.id]);

  // Fetch stats when opponent selected
  useEffect(() => {
    if (!selectedOpponent) {
      setOpponentStats(null);
      return;
    }
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/team-stats/${selectedOpponent.id}`);
        if (res.ok) {
          setOpponentStats(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [selectedOpponent]);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-4 border border-primary/20 transition-all hover:border-primary/50 hover:shadow-[0_0_20px_rgba(15,240,252,0.15)]"
        >
          <div className="absolute inset-0 bg-primary/10 translate-y-full transition-transform group-hover:translate-y-0" />
          <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 shadow-[0_0_15px_rgba(15,240,252,0.4)]">
            <Swords size={20} className="text-primary" />
          </div>
          <div className="relative z-10 text-right">
            <div className="text-sm font-black text-white">المقارنة المباشرة (Head-to-Head)</div>
            <div className="text-xs text-primary/70">قارن أرقام {currentTeam.name} مع خصم آخر</div>
          </div>
          <ChevronLeft size={20} className="relative z-10 mr-auto text-primary/50 transition-transform group-hover:-translate-x-1" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0A0C10] shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <Swords size={24} className="text-primary" />
                  <h2 className="text-xl font-black text-white">ساحة المقارنة</h2>
                </div>
                <button onClick={() => setIsOpen(false)} className="rounded-full bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Comparison Arena */}
          <div className="flex items-center justify-between p-6 md:p-10 relative">
            
            {/* Current Team */}
            <div className="flex flex-col items-center gap-3 w-[40%]">
              <AssetImage image={currentTeam.image || ''} type="TEAM" name={currentTeam.name} width={96} height={96} className="h-20 w-20 md:h-24 md:w-24 rounded-full border-4 border-primary/20 bg-black/50 object-cover shadow-[0_0_30px_rgba(15,240,252,0.2)]" />
              <h3 className="text-center text-lg md:text-2xl font-black text-white">{currentTeam.name}</h3>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <motion.div 
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="text-3xl md:text-5xl font-black italic text-white/10"
              >
                VS
              </motion.div>
            </div>

            {/* Opponent Selection or display */}
            <div className="flex flex-col items-center gap-3 w-[40%]">
              <AnimatePresence mode="wait">
                {!selectedOpponent ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex flex-col items-center justify-center h-20 md:h-24 w-20 md:w-24 rounded-full border-4 border-dashed border-white/20 bg-white/5"
                  >
                    <Shield size={32} className="text-white/20" />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="selected"
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: "spring", damping: 20, stiffness: 200 }}
                    className="flex flex-col items-center gap-3 w-full"
                  >
                    <AssetImage image={selectedOpponent.image || ''} type="TEAM" name={selectedOpponent.name} width={96} height={96} className="h-20 w-20 md:h-24 md:w-24 rounded-full border-4 border-rose-500/20 bg-black/50 object-cover shadow-[0_0_30px_rgba(244,63,94,0.2)]" />
                    <h3 className="text-center text-lg md:text-2xl font-black text-white">{selectedOpponent.name}</h3>
                    <button onClick={() => setSelectedOpponent(null)} className="text-[10px] text-slate-500 underline hover:text-white">تغيير الخصم</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Search or Stats */}
          <div className="border-t border-white/5 bg-black/30 p-6 flex-1">
            {!selectedOpponent ? (
              <div className="mx-auto max-w-md">
                <h4 className="mb-4 text-center text-sm font-bold text-slate-300">ابحث عن منتخب للمقارنة معه</h4>
                <div className="relative mb-6">
                  <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="اكتب اسم المنتخب (مثل: فرنسا، الأرجنتين...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                
                {results.length > 0 && (
                  <motion.div 
                    initial="hidden"
                    animate="show"
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                    className="space-y-2"
                  >
                    {results.slice(0, 5).map((team) => (
                      <motion.button
                        key={team.id}
                        variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedOpponent(team)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-right transition hover:border-white/20 hover:bg-white/10"
                      >
                        <AssetImage image={team.image || ''} type="TEAM" name={team.name} width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
                        <span className="font-bold text-white">{team.name}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="mx-auto max-w-2xl text-center">
                {isLoading ? (
                  <div className="py-10 text-primary animate-pulse">جاري جلب أرقام الخصم...</div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const myData = getRealWorldCupData(currentTeam.name);
                      const opData = getRealWorldCupData(selectedOpponent.name);

                      if (myData && opData) {
                        return (
                          <>
                            <p className="text-sm text-slate-400">مقارنة السجل التاريخي الشامل في بطولة كأس العالم بين المنتخبين.</p>
                            <motion.div 
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                              className="grid gap-2"
                            >
                              {[
                                { label: 'إجمالي الانتصارات', myScore: myData.wins, opScore: opData.wins, myBetter: myData.wins > opData.wins },
                                { label: 'الأهداف المسجلة', myScore: myData.goalsFor || 0, opScore: opData.goalsFor || 0, myBetter: (myData.goalsFor || 0) > (opData.goalsFor || 0) },
                                { label: 'المشاركات السابقة', myScore: myData.appearances, opScore: opData.appearances, myBetter: myData.appearances > opData.appearances },
                              ].map((stat, i) => (
                                <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                                  <div className={`w-12 text-center text-lg font-black ${stat.myBetter ? 'text-primary' : 'text-slate-500'}`}>{stat.myScore}</div>
                                  <div className="flex-1 text-center text-xs font-bold text-slate-400">{stat.label}</div>
                                  <div className={`w-12 text-center text-lg font-black ${!stat.myBetter && stat.myScore !== stat.opScore ? 'text-rose-400' : 'text-slate-500'}`}>{stat.opScore}</div>
                                </div>
                              ))}
                              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                                <div className="flex-1 text-right text-xs font-black text-primary">{myData.bestFinish}</div>
                                <div className="w-24 text-center text-[10px] font-bold text-slate-500">أفضل إنجاز</div>
                                <div className="flex-1 text-left text-xs font-black text-rose-400">{opData.bestFinish}</div>
                              </div>
                            </motion.div>
                          </>
                        );
                      }

                      return (
                        <>
                          <p className="text-sm text-slate-400">هنا سيتم عرض جدول المقارنة المباشرة بمجرد توفر البيانات التفصيلية لكلا المنتخبين.</p>
                          {/* Dummy UI for Stats comparison */}
                          <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="grid gap-2"
                          >
                            {[
                              { label: 'الأهداف المسجلة', myScore: '12', opScore: '8', myBetter: true },
                              { label: 'الشباك النظيفة', myScore: '3', opScore: '4', myBetter: false },
                              { label: 'نسبة الاستحواذ', myScore: '58%', opScore: '54%', myBetter: true },
                            ].map((stat, i) => (
                              <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                                <div className={`w-12 text-center text-lg font-black ${stat.myBetter ? 'text-primary' : 'text-slate-500'}`}>{stat.myScore}</div>
                                <div className="flex-1 text-center text-xs font-bold text-slate-400">{stat.label}</div>
                                <div className={`w-12 text-center text-lg font-black ${!stat.myBetter ? 'text-rose-400' : 'text-slate-500'}`}>{stat.opScore}</div>
                              </div>
                            ))}
                          </motion.div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
