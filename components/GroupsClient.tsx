'use client';

import React, { useEffect, useState } from 'react';
import { useStore, Asset } from '@/lib/store';
import { LayoutGrid, ListOrdered, CalendarDays, Sword, TrendingUp, Trophy, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GroupsClient() {
  const { assets, fetchAssets, matches, fetchMatches } = useStore();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'groups' | 'standings' | 'matches' | 'knockout' | 'predictions'>('groups');

  useEffect(() => {
    const loadData = async () => {
      const promises = [];
      if (assets.length === 0) promises.push(fetchAssets());
      if (matches.length === 0) promises.push(fetchMatches());
      
      await Promise.all(promises);
      setLoading(false);
    };
    loadData();
  }, [assets.length, matches.length, fetchAssets, fetchMatches]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // Filter only teams
  const teams = assets.filter(a => a.type === 'TEAM');

  // Group by 'group' property
  const groupedTeams = teams.reduce((acc, team) => {
    const groupName = team.group ? (team.group.includes('Group') ? team.group : `المجموعة ${team.group}`) : 'مجموعات غير محددة';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(team);
    return acc;
  }, {} as Record<string, Asset[]>);

  // Sort groups alphabetically
  const sortedGroupKeys = Object.keys(groupedTeams).sort((a, b) => a.localeCompare(b));

  // Helper to calculate real stats from finished matches
  const getTeamStats = (team: Asset) => {
    let points = 0, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;

    const teamMatches = matches.filter(m => 
      (m.homeTeam?.id === team.id || m.awayTeam?.id === team.id) && 
      m.status === 'FINISHED'
    );
    
    teamMatches.forEach(m => {
      played++;
      const isHome = m.homeTeam?.id === team.id;
      const scored = isHome ? m.homeScore : m.awayScore;
      const conceded = isHome ? m.awayScore : m.homeScore;
      
      goalsFor += scored;
      goalsAgainst += conceded;
      
      if (scored > conceded) {
        won++;
        points += 3;
      } else if (scored === conceded) {
        drawn++;
        points += 1;
      } else {
        lost++;
      }
    });

    const goalDifference = goalsFor - goalsAgainst;
    
    // Predictions
    const score = team.score || 50;
    const qualificationChance = Math.min(99, Math.max(1, score));
    const winnerChance = Math.max(0, qualificationChance - 30);
    const eliminationRisk = 100 - qualificationChance;
    
    const marketPrice = team.marketPrice ?? team.current_price ?? 0;
    const fairValueImpactQualify = Math.round(marketPrice * 0.15);
    const fairValueImpactEliminate = Math.round(marketPrice * -0.25);

    return { points, played, won, drawn, lost, goalDifference, goalsFor, goalsAgainst, qualificationChance, winnerChance, eliminationRisk, fairValueImpactQualify, fairValueImpactEliminate };
  };

  const getStatusColor = (status: string) => {
    if (status === 'QUALIFIED_ZONE') return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (status === 'COMPETING') return 'text-[#0FF0FC] bg-[#0FF0FC]/10 border-[#0FF0FC]/20';
    if (status === 'AT_RISK') return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    if (status === 'NOT_STARTED') return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'QUALIFIED_ZONE') return 'منطقة تأهل';
    if (status === 'COMPETING') return 'ينافس';
    if (status === 'AT_RISK') return 'مهدد';
    if (status === 'NOT_STARTED') return 'لم يبدأ';
    return 'خارج';
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* NEW RESPONSIVE HEADER */}
        <div className="text-center mb-12 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-[0_0_15px_rgba(15,240,252,0.3)]">
            المجموعات والتصفيات
          </h1>
          <p className="text-gray-400 text-lg md:text-xl">
            تابع أداء المنتخبات في دور المجموعات، من سيتأهل ومن سيغادر مبكرًا؟
          </p>
        </div>

        {/* TABS */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-10 border-b border-white/10 pb-4">
          <button onClick={() => setActiveTab('groups')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'groups' ? 'bg-primary text-black shadow-[0_0_15px_rgba(15,240,252,0.4)]' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <LayoutGrid size={18} /> المجموعات
          </button>
          <button onClick={() => setActiveTab('standings')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'standings' ? 'bg-primary text-black shadow-[0_0_15px_rgba(15,240,252,0.4)]' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <ListOrdered size={18} /> جدول الترتيب
          </button>
          <button onClick={() => setActiveTab('matches')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'matches' ? 'bg-primary text-black shadow-[0_0_15px_rgba(15,240,252,0.4)]' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <CalendarDays size={18} /> مباريات المجموعات
          </button>
          <button onClick={() => setActiveTab('knockout')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'knockout' ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <Sword size={18} /> التصفيات
          </button>
          <button onClick={() => setActiveTab('predictions')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'predictions' ? 'bg-primary text-black shadow-[0_0_15px_rgba(15,240,252,0.4)]' : 'bg-surface text-gray-400 hover:text-white border border-white/5'}`}>
            <TrendingUp size={18} /> توقعات السوق
          </button>
        </div>

        {/* TAB: GROUPS */}
        {activeTab === 'groups' && (
          <div className="space-y-12 animate-fade-in">
            {sortedGroupKeys.map(groupName => {
              const groupTeams = groupedTeams[groupName]
                .map(t => ({ team: t, stats: getTeamStats(t) }))
                .sort((a, b) => {
                  if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
                  if (b.stats.goalDifference !== a.stats.goalDifference) return b.stats.goalDifference - a.stats.goalDifference;
                  if (b.stats.goalsFor !== a.stats.goalsFor) return b.stats.goalsFor - a.stats.goalsFor;
                  const aRank = a.team.fifaRank || 999;
                  const bRank = b.team.fifaRank || 999;
                  if (aRank !== bRank) return aRank - bRank;
                  return (b.team.score || 0) - (a.team.score || 0);
                });
              
              const groupHasFinishedMatches = groupTeams.some(t => t.stats.played > 0);
              
              return (
                <div key={groupName} className="bg-surface/50 rounded-3xl p-6 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 blur-xl"></div>
                  <h2 className="text-2xl font-bold mb-6 text-primary border-b border-white/10 pb-4 inline-flex items-center gap-3">
                    <Trophy size={24} className="text-[#FFD700]" /> {groupName}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {groupTeams.map(({ team, stats }, index) => {
                      const rank = index + 1;
                      let status = 'NOT_STARTED';
                      
                      if (groupHasFinishedMatches) {
                        if (rank <= 2) status = 'QUALIFIED_ZONE';
                        else if (rank === 3) status = 'COMPETING';
                        else status = 'AT_RISK';
                      }

                      const marketPrice = Math.round(team.marketPrice ?? team.current_price);
                      
                      return (
                        <div key={team.id} className="bg-black/60 border border-white/5 rounded-2xl p-5 hover:border-primary/30 transition-all flex flex-col h-full group relative overflow-hidden">
                          {/* Gradient Glow */}
                          <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none ${status === 'QUALIFIED_ZONE' ? 'bg-green-500' : status === 'AT_RISK' ? 'bg-orange-500' : 'bg-primary'}`}></div>

                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center overflow-hidden border border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                              {team.image.startsWith('http') ? <img src={team.image} alt={team.name} className="w-full h-full object-cover" /> : <span className="text-3xl">{team.image}</span>}
                            </div>
                            <div className={`px-2 py-1 rounded text-[10px] font-bold border ${getStatusColor(status)}`}>
                              {getStatusLabel(status)}
                            </div>
                          </div>

                          <div className="mb-4 flex-1 relative z-10">
                            <h3 className="font-bold text-xl text-white group-hover:text-primary transition-colors flex items-center gap-2">
                              {team.name} <span className="text-gray-500 text-xs font-mono font-normal">#{team.fifaRank || '-'}</span>
                            </h3>
                            <div className="grid grid-cols-3 gap-2 mt-4 bg-white/5 p-3 rounded-xl text-center">
                              <div>
                                <p className="text-[10px] text-gray-500">النقاط</p>
                                <p className="font-mono font-bold text-white text-lg">{stats.points}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-500">فارق أهداف</p>
                                <p className="font-mono font-bold text-white text-lg">{stats.goalDifference > 0 ? `+${stats.goalDifference}` : stats.goalDifference}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-500">السعر</p>
                                <p className="font-mono font-bold text-primary text-lg">{marketPrice}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-auto relative z-10">
                            <button 
                              onClick={() => router.push(`/asset/${team.id}`)}
                              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                            >
                              عرض المنتخب
                            </button>
                            <button 
                              onClick={() => router.push(`/asset/${team.id}`)}
                              className="bg-primary/20 hover:bg-primary border border-primary/30 hover:text-black text-primary font-bold py-2 rounded-lg text-sm transition-all"
                            >
                              تداول الآن
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: STANDINGS */}
        {activeTab === 'standings' && (
          <div className="space-y-8 animate-fade-in">
            {sortedGroupKeys.map(groupName => {
              const groupTeams = groupedTeams[groupName]
                .map(t => ({ team: t, stats: getTeamStats(t) }))
                .sort((a, b) => {
                  if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
                  if (b.stats.goalDifference !== a.stats.goalDifference) return b.stats.goalDifference - a.stats.goalDifference;
                  if (b.stats.goalsFor !== a.stats.goalsFor) return b.stats.goalsFor - a.stats.goalsFor;
                  const aRank = a.team.fifaRank || 999;
                  const bRank = b.team.fifaRank || 999;
                  if (aRank !== bRank) return aRank - bRank;
                  return (b.team.score || 0) - (a.team.score || 0);
                });
              
              const groupHasFinishedMatches = groupTeams.some(t => t.stats.played > 0);

              return (
                <div key={groupName} className="bg-surface border border-white/5 rounded-2xl shadow-card overflow-hidden">
                  <div className="bg-black/50 p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2"><LayoutGrid className="text-primary" size={18} /> {groupName}</h3>
                  </div>
                  
                  {!groupHasFinishedMatches && (
                    <div className="bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 p-4 text-sm flex items-center justify-center gap-3">
                      <AlertTriangle size={18} className="shrink-0" />
                      البطولة لم تبدأ بعد — جدول النتائج سيظهر بعد انتهاء أول مباراة في المجموعة.
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-white/5 text-gray-400">
                        <tr>
                          <th className="p-4 w-16 text-center">المركز</th>
                          <th className="p-4">المنتخب</th>
                          <th className="p-4 text-center">لعب</th>
                          <th className="p-4 text-center">فاز</th>
                          <th className="p-4 text-center">تعادل</th>
                          <th className="p-4 text-center">خسر</th>
                          <th className="p-4 text-center">له</th>
                          <th className="p-4 text-center">عليه</th>
                          <th className="p-4 text-center">فارق</th>
                          <th className="p-4 text-center text-primary font-bold">نقاط</th>
                          <th className="p-4 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupTeams.map(({ team, stats }, index) => {
                          const rank = index + 1;
                          let status = 'NOT_STARTED';
                      
                          if (groupHasFinishedMatches) {
                            if (rank <= 2) status = 'QUALIFIED_ZONE';
                            else if (rank === 3) status = 'COMPETING';
                            else status = 'AT_RISK';
                          }

                          return (
                            <tr key={team.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-4 text-center font-mono font-bold text-gray-500">{rank}</td>
                              <td className="p-4 font-bold text-white flex items-center gap-3">
                                {team.image.startsWith('http') ? <img src={team.image} className="w-6 h-6 rounded-full" /> : <span className="text-xl">{team.image}</span>}
                                {team.name}
                              </td>
                              <td className="p-4 text-center font-mono text-gray-400">{stats.played}</td>
                              <td className="p-4 text-center font-mono text-gray-400">{stats.won}</td>
                              <td className="p-4 text-center font-mono text-gray-400">{stats.drawn}</td>
                              <td className="p-4 text-center font-mono text-gray-400">{stats.lost}</td>
                              <td className="p-4 text-center font-mono text-gray-400">{stats.goalsFor}</td>
                              <td className="p-4 text-center font-mono text-gray-400">{stats.goalsAgainst}</td>
                              <td className="p-4 text-center font-mono text-white">{stats.goalDifference > 0 ? `+${stats.goalDifference}` : stats.goalDifference}</td>
                              <td className="p-4 text-center font-mono font-black text-primary text-lg">{stats.points}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getStatusColor(status)}`}>
                                  {getStatusLabel(status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: MATCHES */}
        {activeTab === 'matches' && (
          <div className="animate-fade-in space-y-6">
            {matches.length === 0 ? (
              <div className="bg-surface border border-white/5 rounded-3xl p-12 text-center shadow-card">
                <CalendarDays size={64} className="mx-auto text-gray-500 mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">لا توجد مباريات حالياً</h2>
                <p className="text-gray-400 max-w-md mx-auto">سيتم تفعيل جدول المباريات المباشرة والنتائج فور بدء بطولة كأس العالم 2026. ابق مستعداً للتداول أثناء المباريات!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {matches.map(match => (
                  <div key={match.id} className="bg-surface border border-white/5 rounded-2xl p-5 shadow-card hover:border-white/10 transition-colors">
                    <div className="text-center text-xs text-gray-400 mb-4">{match.groupPhase || 'دور المجموعات'}</div>
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col items-center gap-3 w-1/3 text-center">
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                          {match.homeTeam?.image?.startsWith('http') ? <img src={match.homeTeam.image} className="w-full h-full object-cover" /> : <span className="text-2xl">{match.homeTeam?.image || '🏠'}</span>}
                        </div>
                        <span className="font-bold text-white text-sm">{match.homeTeam?.name || 'Home Team'}</span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center w-1/3">
                        {match.status === 'SCHEDULED' && (
                          <div className="text-gray-400 text-sm flex flex-col items-center">
                            <span className="bg-white/10 px-3 py-1 rounded-full text-xs mb-2">قادمة</span>
                            <span className="text-xs font-mono">{match.matchDate ? new Date(match.matchDate).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                        )}
                        {(match.status === 'IN_PLAY' || match.status === 'LIVE') && (
                          <div className="flex flex-col items-center">
                            <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-bold animate-pulse mb-2">مباشرة</span>
                            <div className="text-3xl font-black text-white tracking-widest bg-black/50 px-4 py-2 rounded-xl border border-white/5">
                              {match.homeScore ?? 0} - {match.awayScore ?? 0}
                            </div>
                          </div>
                        )}
                        {match.status === 'FINISHED' && (
                          <div className="flex flex-col items-center">
                            <span className="text-gray-500 text-xs font-bold mb-2">انتهت</span>
                            <div className="text-3xl font-black text-white tracking-widest bg-black/50 px-4 py-2 rounded-xl border border-white/5">
                              {match.homeScore ?? 0} - {match.awayScore ?? 0}
                            </div>
                          </div>
                        )}
                        {match.status !== 'SCHEDULED' && match.status !== 'IN_PLAY' && match.status !== 'LIVE' && match.status !== 'FINISHED' && (
                           <div className="text-gray-500 text-xs">{match.status}</div>
                        )}
                        
                        {(match.status === 'SCHEDULED' || (!['IN_PLAY', 'LIVE', 'FINISHED'].includes(match.status))) && (
                          <div className="text-xl font-black text-white mt-2 tracking-widest opacity-30">
                            VS
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-3 w-1/3 text-center">
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                          {match.awayTeam?.image?.startsWith('http') ? <img src={match.awayTeam.image} className="w-full h-full object-cover" /> : <span className="text-2xl">{match.awayTeam?.image || '✈️'}</span>}
                        </div>
                        <span className="font-bold text-white text-sm">{match.awayTeam?.name || 'Away Team'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: KNOCKOUT */}
        {activeTab === 'knockout' && (
          <div className="animate-fade-in space-y-8">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-8 text-center shadow-[0_0_30px_rgba(249,115,22,0.1)]">
              <Sword size={48} className="mx-auto text-orange-500 mb-4" />
              <h2 className="text-2xl font-black text-white mb-4">الأدوار الإقصائية (Knockout Stage)</h2>
              <p className="text-orange-400 max-w-lg mx-auto bg-black/40 p-4 rounded-xl border border-orange-500/20">
                لم تبدأ التصفيات بعد. سيتم تحديد المتأهلين تلقائيًا وبناء شجرة التصفيات بعد نهاية دور المجموعات.
              </p>
            </div>

            {/* Bracket Placeholder */}
            <div className="bg-surface border border-white/5 rounded-2xl p-6 overflow-x-auto">
              <div className="min-w-[800px] flex justify-between relative">
                {/* Lines background mock */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 -z-10"></div>
                
                {['دور الـ 32', 'دور الـ 16', 'ربع النهائي', 'نصف النهائي', 'النهائي'].map((round, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-8 z-10 w-48">
                    <div className="bg-black/80 border border-white/10 px-4 py-2 rounded-lg text-sm font-bold text-gray-400 w-full text-center mb-4 shadow-lg">
                      {round}
                    </div>
                    {/* Mock Match Blocks */}
                    {Array.from({ length: idx === 4 ? 1 : 2 }).map((_, i) => (
                      <div key={i} className="w-full bg-black/50 border border-white/5 rounded-xl p-3 space-y-2 relative">
                        <div className="flex items-center justify-between text-xs text-gray-500 bg-white/5 p-2 rounded"><span>يتحدد لاحقاً</span> <span className="font-mono">-</span></div>
                        <div className="flex items-center justify-between text-xs text-gray-500 bg-white/5 p-2 rounded"><span>يتحدد لاحقاً</span> <span className="font-mono">-</span></div>
                        {idx < 4 && <div className="absolute top-1/2 -left-4 w-4 h-px bg-white/10"></div>}
                        {idx > 0 && <div className="absolute top-1/2 -right-4 w-4 h-px bg-white/10"></div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PREDICTIONS */}
        {activeTab === 'predictions' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-primary/10 border border-primary/30 p-6 rounded-2xl flex items-start gap-4">
              <Info className="text-primary shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-white text-lg mb-1">توقعات السوق (ليست نتائج حقيقية)</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  هذه التوقعات مبنية على نموذج الذكاء الاصطناعي الذي يحلل أداء المنتخب، تصنيف الفيفا، زخم السوق، والطلب. لا تمثل نتائج المباريات الفعلية بل هي أداة مساعدة يمكنك استخدامها لتوجيه قرارات التداول الخاصة بك.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 18).map((team) => {
                const stats = getTeamStats(team);
                return (
                  <div key={team.id} className="bg-surface border border-white/5 rounded-2xl p-5 shadow-card hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                        {team.image.startsWith('http') ? <img src={team.image} className="w-full h-full object-cover" /> : <span className="text-xl">{team.image}</span>}
                      </div>
                      <h3 className="font-bold text-white text-lg">{team.name}</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">فرصة التأهل المتوقعة</span>
                          <span className="font-bold text-green-400 font-mono">{stats.qualificationChance}%</span>
                        </div>
                        <div className="w-full bg-black/50 rounded-full h-1.5">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${stats.qualificationChance}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">قوة المنتخب</span>
                          <span className="font-bold text-white font-mono">{team.score || 50}/100</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">زخم السوق</span>
                          <span className="font-bold text-[#0FF0FC] font-mono">{team.momentum || 50}%</span>
                        </div>
                        <div className="w-full bg-black/50 rounded-full h-1.5">
                          <div className="bg-[#0FF0FC] h-1.5 rounded-full" style={{ width: `${team.momentum || 50}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">الطلب السوقي</span>
                          <span className="font-bold text-orange-400 font-mono">{team.marketDemand || 50}%</span>
                        </div>
                        <div className="w-full bg-black/50 rounded-full h-1.5">
                          <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${team.marketDemand || 50}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-center">
                      <div className="bg-green-500/5 rounded-lg p-2 border border-green-500/10">
                        <p className="text-[9px] text-gray-500 uppercase">تأثير السعر (تأهل)</p>
                        <p className="font-mono text-green-400 font-bold mt-1">+{stats.fairValueImpactQualify} ¢</p>
                      </div>
                      <div className="bg-red-500/5 rounded-lg p-2 border border-red-500/10">
                        <p className="text-[9px] text-gray-500 uppercase">تأثير السعر (إقصاء)</p>
                        <p className="font-mono text-red-500 font-bold mt-1">{stats.fairValueImpactEliminate} ¢</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
