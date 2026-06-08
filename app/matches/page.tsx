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
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        <PageHeader
          title="مركز أسواق المباريات"
          description="حلّل المباريات، توقع النتائج، وتابع تأثير الفوز والخسارة على سوق الأصول الافتراضية."
          icon={<CalendarDays size={22} />}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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
              <option value="date">حسب التاريخ</option>
              <option value="closest">الأقرب موعداً</option>
              <option value="demand">الأعلى طلباً</option>
              <option value="momentum">الأعلى زخماً</option>
            </select>
          </div>
        </div>

        {/* Matches Grid */}
        {filteredMatches.length === 0 ? (
          <div className="bg-surface border border-white/5 rounded-3xl p-12 text-center shadow-card">
            <CalendarDays size={64} className="mx-auto text-gray-500 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">لا توجد مباريات</h2>
            <p className="text-gray-400 max-w-md mx-auto">لا توجد مباريات تطابق الفلتر الحالي.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredMatches.map(match => (
              <div 
                key={match.id} 
                onClick={() => router.push(`/matches/${match.id}`)}
                className="group bg-surface border border-white/5 hover:border-primary/50 rounded-3xl p-6 shadow-card cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(15,240,252,0.05)] relative overflow-hidden"
              >
                {/* Status Glow */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full blur-3xl opacity-10 pointer-events-none ${match.status === 'IN_PLAY' ? 'bg-red-500' : match.status === 'FINISHED' ? 'bg-[#FFD700]' : 'bg-primary'}`}></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                  <div className="flex items-center gap-2">
                    {getStatusDisplay(match.status)}
                    <span className="text-xs text-gray-500 bg-black/30 px-2 py-1 rounded">{match.stage === 'group' ? 'دور المجموعات' : 'التصفيات'}</span>
                  </div>
                  <div className="text-xs text-gray-400 font-mono flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(match.matchDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} · {new Date(match.matchDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-8 relative z-10">
                  {/* Home Team */}
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-black/50 rounded-full flex items-center justify-center border border-white/10 overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                      {match.homeTeam.image.startsWith('http') ? <img src={match.homeTeam.image} alt={match.homeTeam.name} className="w-full h-full object-cover" /> : <span className="text-5xl">{match.homeTeam.image}</span>}
                    </div>
                    <div>
                      <h3 className="font-black text-white text-lg md:text-xl group-hover:text-primary transition-colors">{match.homeTeam.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">#{match.homeTeam.fifaRank || '?'} · {match.homeTeam.marketPrice?.toLocaleString()}¢</p>
                    </div>
                  </div>

                  {/* Score / VS */}
                  <div className="flex flex-col items-center justify-center">
                    {(match.status === 'IN_PLAY' || match.status === 'FINISHED') ? (
                      <div className="text-4xl md:text-5xl font-black text-white tracking-widest bg-black/40 px-4 py-3 rounded-2xl border border-white/10 shadow-inner">
                        {match.homeScore} - {match.awayScore}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-2xl font-black text-gray-600">VS</div>
                        <div className="w-px h-12 bg-white/10"></div>
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-black/50 rounded-full flex items-center justify-center border border-white/10 overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                      {match.awayTeam.image.startsWith('http') ? <img src={match.awayTeam.image} alt={match.awayTeam.name} className="w-full h-full object-cover" /> : <span className="text-5xl">{match.awayTeam.image}</span>}
                    </div>
                    <div>
                      <h3 className="font-black text-white text-lg md:text-xl group-hover:text-primary transition-colors">{match.awayTeam.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">#{match.awayTeam.fifaRank || '?'} · {match.awayTeam.marketPrice?.toLocaleString()}¢</p>
                    </div>
                  </div>
                </div>

                {/* Market Impact Metrics */}
                <div className="grid grid-cols-3 gap-3 relative z-10 border-t border-white/5 pt-4">
                  <div className="bg-black/20 rounded-xl p-3 text-center">
                    <TrendingUp size={16} className="mx-auto mb-1 text-primary" />
                    <p className="text-[10px] text-gray-500 mb-1">زخم مشترك</p>
                    <p className="font-bold text-white font-mono">{((match.homeTeam.momentum || 50) + (match.awayTeam.momentum || 50)).toFixed(0)}</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-3 text-center">
                    <Activity size={16} className="mx-auto mb-1 text-orange-500" />
                    <p className="text-[10px] text-gray-500 mb-1">طلب السوق</p>
                    <p className="font-bold text-white font-mono">{((match.homeTeam.marketDemand || 50) + (match.awayTeam.marketDemand || 50)).toFixed(0)}</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-3 text-center">
                    <BarChart3 size={16} className="mx-auto mb-1 text-[#FFD700]" />
                    <p className="text-[10px] text-gray-500 mb-1">تأثير السعر</p>
                    <p className="font-bold text-[#FFD700] font-mono">مرتفع</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <span className="flex items-center gap-1 text-primary text-sm font-bold group-hover:translate-x-[-4px] transition-transform">
                    تحليل المباراة <ChevronLeft size={16} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}