'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CalendarDays, Play, Clock, CheckCircle2, TrendingUp, Activity, BarChart3, ChevronLeft, Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('all'); // all, today, live, upcoming, finished, groups, knockout
  const [sortBy, setSortBy] = useState('date'); // date, demand, momentum, volume, closest

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/matches');
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // Summary Metrics
  const todayMatchesCount = matches.filter(m => new Date(m.matchDate).toDateString() === new Date().toDateString()).length;
  const liveMatchesCount = matches.filter(m => m.status === 'IN_PLAY').length;
  const upcomingMatchesCount = matches.filter(m => m.status === 'SCHEDULED').length;
  const finishedMatchesCount = matches.filter(m => m.status === 'FINISHED').length;

  // Most traded match logic (mock logic using demand + momentum)
  let mostTradedMatch: any = null;
  let highestMetric = -Infinity;
  matches.forEach(m => {
    const combinedDemand = (m.homeTeam.marketDemand || 0) + (m.awayTeam.marketDemand || 0);
    const combinedMomentum = (m.homeTeam.momentum || 0) + (m.awayTeam.momentum || 0);
    const metric = combinedDemand + combinedMomentum;
    if (metric > highestMetric) {
      highestMetric = metric;
      mostTradedMatch = m;
    }
  });

  // Next match
  const upcomingOnly = matches.filter(m => m.status === 'SCHEDULED').sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const nextMatch = upcomingOnly.length > 0 ? upcomingOnly[0] : null;

  // Filter logic
  let filteredMatches = [...matches];
  if (activeTab === 'today') {
    filteredMatches = filteredMatches.filter(m => new Date(m.matchDate).toDateString() === new Date().toDateString());
  } else if (activeTab === 'live') {
    filteredMatches = filteredMatches.filter(m => m.status === 'IN_PLAY');
  } else if (activeTab === 'upcoming') {
    filteredMatches = filteredMatches.filter(m => m.status === 'SCHEDULED');
  } else if (activeTab === 'finished') {
    filteredMatches = filteredMatches.filter(m => m.status === 'FINISHED');
  } else if (activeTab === 'groups') {
    filteredMatches = filteredMatches.filter(m => m.stage === 'group');
  } else if (activeTab === 'knockout') {
    filteredMatches = filteredMatches.filter(m => m.stage !== 'group');
  }

  // Sort logic
  filteredMatches.sort((a, b) => {
    if (sortBy === 'date') return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
    if (sortBy === 'closest') return Math.abs(new Date(a.matchDate).getTime() - new Date().getTime()) - Math.abs(new Date(b.matchDate).getTime() - new Date().getTime());
    
    const aDemand = (a.homeTeam.marketDemand || 0) + (a.awayTeam.marketDemand || 0);
    const bDemand = (b.homeTeam.marketDemand || 0) + (b.awayTeam.marketDemand || 0);
    if (sortBy === 'demand') return bDemand - aDemand;

    const aMomentum = (a.homeTeam.momentum || 0) + (a.awayTeam.momentum || 0);
    const bMomentum = (b.homeTeam.momentum || 0) + (b.awayTeam.momentum || 0);
    if (sortBy === 'momentum') return bMomentum - aMomentum;

    return 0; // volume mock is same as demand for now
  });

  const getStatusDisplay = (status: string) => {
    if (status === 'IN_PLAY') return <span className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded text-xs font-bold animate-pulse"><Play size={12} className="fill-current" /> مباشرة</span>;
    if (status === 'FINISHED') return <span className="flex items-center gap-1 text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded text-xs font-bold"><CheckCircle2 size={12} /> انتهت</span>;
    return <span className="flex items-center gap-1 text-[#0FF0FC] bg-[#0FF0FC]/10 px-2 py-1 rounded text-xs font-bold"><Clock size={12} /> قادمة</span>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Responsive Header */}
        <div className="text-center mb-10 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-[0_0_15px_rgba(15,240,252,0.3)]">
            مركز أسواق المباريات
          </h1>
          <p className="text-gray-400 text-lg md:text-xl">
            حلّل المباريات، توقع النتائج، وتداول الأسهم بناءً على تأثير الفوز والخسارة في السوق المالي.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <CalendarDays className="text-gray-400 mb-2" size={20} />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">مباريات اليوم</p>
            <p className="text-2xl font-black text-white">{todayMatchesCount}</p>
          </div>
          <div className="bg-surface border border-red-500/20 shadow-card rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full blur-xl"></div>
            <Play className="text-red-500 mb-2 animate-pulse" size={20} />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">مباشرة الآن</p>
            <p className="text-2xl font-black text-red-500">{liveMatchesCount}</p>
          </div>
          <div className="bg-surface border border-primary/20 shadow-card rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <Clock className="text-primary mb-2" size={20} />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">قادمة</p>
            <p className="text-2xl font-black text-primary">{upcomingMatchesCount}</p>
          </div>
          <div className="bg-surface border border-[#FFD700]/20 shadow-card rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="text-[#FFD700] mb-2" size={20} />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">انتهت</p>
            <p className="text-2xl font-black text-[#FFD700]">{finishedMatchesCount}</p>
          </div>
          <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1 lg:col-span-1">
            <Activity className="text-orange-500 mb-2" size={20} />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">الأكثر تداولاً</p>
            <p className="text-sm font-bold text-white whitespace-nowrap">
              {mostTradedMatch ? `${mostTradedMatch.homeTeam.code} ضد ${mostTradedMatch.awayTeam.code}` : '-'}
            </p>
          </div>
          <div className="bg-surface border border-white/5 shadow-card rounded-2xl p-4 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1 lg:col-span-1">
            <Clock className="text-gray-400 mb-2" size={20} />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">المباراة القادمة</p>
            <p className="text-sm font-mono font-bold text-gray-300">
              {nextMatch ? new Date(nextMatch.matchDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}
            </p>
          </div>
        </div>

        {/* Controls: Tabs & Sort */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex overflow-x-auto no-scrollbar gap-2 w-full md:w-auto">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'live', label: 'مباشرة' },
              { id: 'upcoming', label: 'قادمة' },
              { id: 'finished', label: 'انتهت' },
              { id: 'groups', label: 'المجموعات' },
              { id: 'knockout', label: 'التصفيات' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-primary text-black' : 'bg-surface border border-white/5 text-gray-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={16} className="text-gray-500" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-surface border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary transition-colors"
            >
              <option value="date">تاريخ المباراة</option>
              <option value="closest">الأقرب</option>
              <option value="demand">حجم الطلب في السوق</option>
              <option value="momentum">الزخم (Momentum)</option>
            </select>
          </div>
        </div>

        {/* Match Cards List */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-white/5 rounded-3xl shadow-card">
            <Search size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-xl font-bold text-gray-400">لا توجد مباريات تطابق الفلتر الحالي.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMatches.map(match => {
              const hTeam = match.homeTeam;
              const aTeam = match.awayTeam;

              const hPrice = Math.round(hTeam.marketPrice ?? hTeam.current_price);
              const aPrice = Math.round(aTeam.marketPrice ?? aTeam.current_price);

              return (
                <div key={match.id} className="bg-surface border border-white/5 rounded-3xl shadow-card hover:border-primary/30 transition-all flex flex-col overflow-hidden">
                  
                  {/* Match Header */}
                  <div className="bg-black/40 p-4 border-b border-white/5 flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-bold bg-white/5 px-2 py-1 rounded">
                      {match.groupPhase || 'دور المجموعات'}
                    </span>
                    <div className="flex items-center gap-4">
                      {getStatusDisplay(match.status)}
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(match.matchDate).toLocaleDateString()} - {new Date(match.matchDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>

                  {/* Teams Row */}
                  <div className="p-6 flex justify-between items-center relative">
                    {/* Home */}
                    <div className="flex flex-col items-center w-1/3 text-center">
                      <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10 mb-3 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                        {hTeam.image.startsWith('http') ? <img src={hTeam.image} className="w-full h-full object-cover" /> : <span className="text-4xl">{hTeam.image}</span>}
                      </div>
                      <h3 className="font-bold text-white text-lg leading-tight">{hTeam.name}</h3>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">السعر المالي</p>
                      <p className="font-mono font-black text-primary text-xl">{hPrice} ¢</p>
                    </div>

                    {/* VS / Score */}
                    <div className="flex flex-col items-center justify-center w-1/3">
                      {match.status === 'SCHEDULED' ? (
                        <div className="text-3xl font-black text-gray-600 italic">VS</div>
                      ) : (
                        <div className="bg-black/60 border border-white/10 rounded-xl px-6 py-3 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                          <span className="text-3xl font-black text-white">{match.homeScore}</span>
                          <span className="text-xl font-black text-gray-500 mx-2">-</span>
                          <span className="text-3xl font-black text-white">{match.awayScore}</span>
                        </div>
                      )}
                    </div>

                    {/* Away */}
                    <div className="flex flex-col items-center w-1/3 text-center">
                      <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10 mb-3 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                        {aTeam.image.startsWith('http') ? <img src={aTeam.image} className="w-full h-full object-cover" /> : <span className="text-4xl">{aTeam.image}</span>}
                      </div>
                      <h3 className="font-bold text-white text-lg leading-tight">{aTeam.name}</h3>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">السعر المالي</p>
                      <p className="font-mono font-black text-primary text-xl">{aPrice} ¢</p>
                    </div>
                  </div>

                  {/* Impact Preview */}
                  {match.status === 'SCHEDULED' && (
                    <div className="px-6 pb-6">
                      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs text-gray-400 font-bold flex items-center gap-1"><TrendingUp size={14} /> التأثير المتوقع للفوز</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                            <p className="text-[10px] text-gray-400 uppercase mb-1">تأثير الزخم</p>
                            <p className="text-sm font-mono font-bold text-green-400">+20</p>
                          </div>
                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                            <p className="text-[10px] text-gray-400 uppercase mb-1">الطلب بالسوق</p>
                            <p className="text-sm font-mono font-bold text-green-400">+15</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto p-4 border-t border-white/5 grid grid-cols-3 gap-2 bg-black/20">
                    <button 
                      onClick={() => router.push(`/asset/${hTeam.id}`)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-2 rounded-lg text-xs transition-colors flex flex-col items-center justify-center gap-1"
                    >
                      تداول {hTeam.code}
                    </button>
                    <button 
                      onClick={() => router.push(`/matches/${match.id}`)}
                      className="bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary hover:text-white font-bold py-2 rounded-lg text-xs transition-colors flex flex-col items-center justify-center gap-1 shadow-[0_0_15px_rgba(15,240,252,0.1)]"
                    >
                      تحليل المباراة <BarChart3 size={14} />
                    </button>
                    <button 
                      onClick={() => router.push(`/asset/${aTeam.id}`)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-2 rounded-lg text-xs transition-colors flex flex-col items-center justify-center gap-1"
                    >
                      تداول {aTeam.code}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
