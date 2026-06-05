'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore, Asset } from '@/lib/store';
import { Navbar } from '@/components/ui/Navbar';
import { TrendingUp, TrendingDown, ArrowRight, Search, Filter, LayoutGrid, List, ChevronRight, Globe, Users, Target, Activity, Zap, Info } from 'lucide-react';
import { TeamRosterDrawer } from '@/components/ui/TeamRosterDrawer';

export default function MarketPage() {
  const { assets, fetchAssets } = useStore();
  const [filterType, setFilterType] = useState<'ALL' | 'TEAM' | 'PLAYER'>('TEAM');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [selectedTeam, setSelectedTeam] = useState<Asset | null>(null);
  const [marketNews, setMarketNews] = useState<any[]>([]);

  useEffect(() => {
    fetchAssets();
    // Fetch Market News
    fetch('/api/market-news?limit=5')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMarketNews(data);
      })
      .catch(console.error);
  }, [fetchAssets]);

  // Derived Stats for Overview
  const teams = assets.filter(a => a.type === 'TEAM');
  const players = assets.filter(a => a.type === 'PLAYER');
  
  const topTeams = [...teams].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
  const topPlayers = [...players].sort((a, b) => b.current_price - a.current_price).slice(0, 3);

  // Filtering Logic
  const filteredAssets = assets.filter(asset => {
    if (filterType !== 'ALL' && asset.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!asset.name.toLowerCase().includes(q) && !asset.code.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (a.type === 'TEAM' && b.type === 'TEAM') {
      return (a.fifaRank || 999) - (b.fifaRank || 999);
    }
    return (b.score || 0) - (a.score || 0);
  });

  return (
    <div className="min-h-screen bg-[#121212] text-white selection:bg-[#0FF0FC]/30">
      <Navbar />
      
      {/* Drawer */}
      <TeamRosterDrawer team={selectedTeam} onClose={() => setSelectedTeam(null)} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            سوق كأس العالم <span className="text-[#0FF0FC]">2026</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mb-8">
            استكشف 48 منتخبًا مشاركًا وقوائمهم النهائية، وقارن بين قوة المنتخبات وجودة اللاعبين وحركة السوق في مكان واحد.
          </p>
          
          {/* Market News Ticker */}
          {marketNews.length > 0 && (
            <div className="bg-[#1A1A1A] border border-[#0FF0FC]/20 rounded-xl overflow-hidden flex shadow-[0_0_15px_rgba(15,240,252,0.1)]">
              <div className="bg-[#0FF0FC]/10 text-[#0FF0FC] px-4 py-3 font-bold flex items-center gap-2 whitespace-nowrap shrink-0 border-l border-[#0FF0FC]/20">
                <Zap size={18} className="animate-pulse" />
                أخبار السوق
              </div>
              <div className="flex-1 overflow-hidden relative flex items-center">
                <div className="animate-marquee whitespace-nowrap flex gap-10 px-4">
                  {marketNews.map(news => (
                    <div key={news.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xl">{news.asset.image}</span>
                      <span className="font-bold text-white">{news.title || news.titleAr}</span>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${news.changePercent >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {news.changePercent >= 0 ? '+' : ''}{news.changePercent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Top Info Bar (Ticker style) */}
        <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 mb-8 flex flex-wrap gap-4 justify-between items-center text-sm shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-gray-400">متداول نشط:</span>
            <span className="font-bold text-white font-mono">15,234</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <Activity size={16} className="text-[#0FF0FC]" />
            <span className="text-gray-400">حجم التداول اليوم:</span>
            <span className="font-bold text-white font-mono">2.5M ¢</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <TrendingUp size={16} className="text-green-500" />
            <span className="text-gray-400">أكثر صعوداً:</span>
            <span className="font-bold text-green-500">{topPlayers[0]?.name || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <TrendingDown size={16} className="text-red-500" />
            <span className="text-gray-400">أكثر هبوطاً:</span>
            <span className="font-bold text-red-500">البرازيل</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4 bg-[#FFD700]/10 px-3 py-1 rounded-lg border border-[#FFD700]/20">
            <span className="text-gray-400">المباراة القادمة:</span>
            <span className="font-bold text-[#FFD700] font-mono">12d : 14h : 22m</span>
          </div>
        </div>

        {/* Market Overview Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              <Globe size={20} className="text-[#0FF0FC]" /> 
              <span>إجمالي المنتخبات</span>
            </div>
            <div className="text-4xl font-mono font-bold text-white">48</div>
            <div className="text-sm text-gray-500 mt-2">مشارك في مونديال 2026</div>
          </div>
          
          <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              <Users size={20} className="text-[#FFD700]" /> 
              <span>اللاعبين المتاحين</span>
            </div>
            <div className="text-4xl font-mono font-bold text-white">{players.length}</div>
            <div className="text-sm text-gray-500 mt-2">حتى 1,248 لاعباً متاحاً</div>
          </div>

          <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl col-span-1 md:col-span-2 flex items-center justify-between">
            <div className="w-1/2 pr-4 border-r border-white/10 hidden md:block">
              <div className="text-sm text-gray-400 mb-3 flex items-center gap-2"><Target size={16} className="text-green-400" /> أعلى المنتخبات تقييماً</div>
              <div className="flex flex-col gap-2">
                {topTeams.map(t => (
                  <div key={t.id} className="flex justify-between text-sm font-bold">
                    <span>{t.image} {t.name}</span>
                    <span className="text-[#FFD700]">{t.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-1/2 md:pl-4">
              <div className="text-sm text-gray-400 mb-3 flex items-center gap-2"><Activity size={16} className="text-[#0FF0FC]" /> أغلى النجوم في السوق</div>
              <div className="flex flex-col gap-2">
                {topPlayers.map(p => (
                  <div key={p.id} className="flex justify-between text-sm font-bold">
                    <span className="truncate max-w-[150px]">{p.name}</span>
                    <span className="font-mono">{p.current_price}¢</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="sticky top-20 z-40 bg-[#121212]/90 backdrop-blur-md py-4 mb-8 border-b border-white/5 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-grow lg:flex-grow-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="text" 
                placeholder="ابحث عن لاعب أو منتخب..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full lg:w-64 bg-black/50 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-[#0FF0FC] transition-colors"
              />
            </div>
            
            <div className="flex bg-black/50 border border-white/10 rounded-xl p-1">
              <button onClick={() => setFilterType('TEAM')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'TEAM' ? 'bg-[#0FF0FC] text-black' : 'text-gray-400 hover:text-white'}`}>المنتخبات</button>
              <button onClick={() => setFilterType('PLAYER')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'PLAYER' ? 'bg-[#0FF0FC] text-black' : 'text-gray-400 hover:text-white'}`}>اللاعبين</button>
              <button onClick={() => setFilterType('ALL')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'ALL' ? 'bg-[#0FF0FC] text-black' : 'text-gray-400 hover:text-white'}`}>الكل</button>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex gap-2">
              {/* Smart Chips (Mocked functionality for UI) */}
              <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors text-green-400">
                فرص صاعدة
              </button>
              <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors text-[#FFD700]">
                نجوم الصف الأول
              </button>
            </div>

            <div className="flex bg-black/50 border border-white/10 rounded-xl p-1">
              <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-colors ${viewMode === 'GRID' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                <LayoutGrid size={18} />
              </button>
              <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-lg transition-colors ${viewMode === 'TABLE' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {filteredAssets.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <Search size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl">لا توجد نتائج مطابقة لبحثك</p>
          </div>
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredAssets.map(asset => (
              <div key={asset.id} className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden group hover:border-[#0FF0FC]/50 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(15,240,252,0.1)] flex flex-col">
                <div className="p-6 relative flex-grow">
                  <div className="absolute top-4 left-4 font-mono font-bold text-gray-500 text-sm">{asset.code}</div>
                  
                  <div className="text-5xl mb-4">{asset.image}</div>
                  <h3 className="text-xl font-bold text-white mb-1">{asset.name}</h3>
                  <div className="flex gap-2 text-xs mb-4">
                    {asset.type === 'TEAM' && <span className="bg-white/10 px-2 py-1 rounded text-gray-300">FIFA Rank: #{asset.fifaRank || '-'}</span>}
                    {asset.type === 'PLAYER' && <span className="bg-white/10 px-2 py-1 rounded text-gray-300">{asset.position || 'Unknown'}</span>}
                    <span className="bg-[#FFD700]/10 text-[#FFD700] px-2 py-1 rounded">Score: {asset.score || 'N/A'}</span>
                  </div>

                  <div className="flex justify-between items-end mt-6">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">السعر الحالي</div>
                      <div className="text-2xl font-mono font-bold text-white">{asset.current_price}¢</div>
                    </div>
                    <div className={`flex items-center gap-1 font-bold text-sm ${asset.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {asset.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {Math.abs(asset.change)}%
                    </div>
                  </div>
                </div>

                {asset.type === 'TEAM' ? (
                  <button 
                    onClick={() => setSelectedTeam(asset)}
                    className="w-full p-4 bg-black/40 border-t border-white/5 text-gray-300 font-bold flex items-center justify-center gap-2 group-hover:bg-[#0FF0FC]/10 group-hover:text-[#0FF0FC] transition-colors"
                  >
                    عرض القائمة <ChevronRight size={18} className="group-hover:translate-x-reverse group-hover:-translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <Link 
                    href={`/asset/${asset.id}`}
                    className="w-full p-4 bg-black/40 border-t border-white/5 text-gray-300 font-bold flex items-center justify-center gap-2 group-hover:bg-[#FFD700]/10 group-hover:text-[#FFD700] transition-colors"
                  >
                    تداول اللاعب <ArrowRight size={18} className="group-hover:translate-x-reverse group-hover:-translate-x-1 transition-transform" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl overflow-x-auto shadow-2xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-black/60 border-b border-white/10 text-gray-400 text-sm tracking-wider">
                  <th className="p-4 font-bold text-right">الأصل (Asset)</th>
                  {filterType === 'TEAM' && <th className="p-4 font-bold text-center">FIFA Rank</th>}
                  {filterType === 'TEAM' && <th className="p-4 font-bold text-center">المخاطرة</th>}
                  {filterType === 'TEAM' && <th className="p-4 font-bold text-center">المُلاّك</th>}
                  
                  {filterType === 'PLAYER' && <th className="p-4 font-bold text-center">المركز</th>}
                  {filterType === 'PLAYER' && <th className="p-4 font-bold text-center">العمر</th>}
                  {filterType === 'PLAYER' && <th className="p-4 font-bold text-center">النادي</th>}
                  
                  {filterType === 'ALL' && <th className="p-4 font-bold text-center">النوع</th>}

                  <th className="p-4 font-bold text-center">التقييم (Score)</th>
                  <th className="p-4 font-bold text-center">السعر الحالي</th>
                  <th className="p-4 font-bold text-center">التغير (24h)</th>
                  <th className="p-4 font-bold text-left">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => (
                  <tr key={asset.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="p-4 flex items-center gap-4">
                      <span className="text-3xl bg-black/40 w-12 h-12 flex items-center justify-center rounded-lg">{asset.image}</span>
                      <div>
                        <p className="font-bold text-white text-lg group-hover:text-[#0FF0FC] transition-colors">{asset.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{asset.code}</p>
                      </div>
                    </td>
                    
                    {filterType === 'TEAM' && (
                      <td className="p-4 text-center text-gray-300">
                        {asset.type === 'TEAM' ? `#${asset.fifaRank || '-'}` : '-'}
                      </td>
                    )}
                    {filterType === 'TEAM' && (
                      <td className="p-4 text-center text-gray-400">
                        {asset.riskIndex ? `${(asset.riskIndex * 10).toFixed(1)}/10` : '-'}
                      </td>
                    )}
                    {filterType === 'TEAM' && (
                      <td className="p-4 text-center text-gray-400 font-mono">
                        {asset.ownersCount ? asset.ownersCount.toLocaleString() : '0'}
                      </td>
                    )}
                    
                    {filterType === 'PLAYER' && (
                      <td className="p-4 text-center">
                        <span className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300">{asset.position || '-'}</span>
                      </td>
                    )}
                    {filterType === 'PLAYER' && (
                      <td className="p-4 text-center text-gray-300">
                        {asset.age || '-'}
                      </td>
                    )}
                    {filterType === 'PLAYER' && (
                      <td className="p-4 text-center text-gray-400 text-sm truncate max-w-[120px]">
                        {asset.club || '-'}
                      </td>
                    )}

                    {filterType === 'ALL' && (
                      <td className="p-4 text-center">
                        <span className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300">
                          {asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}
                        </span>
                      </td>
                    )}

                    <td className="p-4 text-center font-bold text-[#FFD700]">
                      {asset.score || 'N/A'}
                    </td>
                    
                    <td className="p-4 text-center font-mono font-bold text-white">
                      {asset.current_price} ¢
                    </td>
                    
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center gap-1 font-bold ${asset.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {asset.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {Math.abs(asset.change)}%
                      </span>
                    </td>
                    
                    <td className="p-4 text-left">
                      {asset.type === 'TEAM' ? (
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => setSelectedTeam(asset)}
                            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/20 text-gray-300 hover:text-white px-3 py-2 rounded-lg font-bold transition-all text-xs"
                          >
                            التشكيلة
                          </button>
                          <Link 
                            href={`/asset/${asset.id}`}
                            className="inline-flex items-center gap-2 bg-[#0FF0FC]/10 hover:bg-[#0FF0FC]/20 text-[#0FF0FC] border border-[#0FF0FC]/50 px-3 py-2 rounded-lg font-bold transition-all text-xs"
                          >
                            تداول
                          </Link>
                        </div>
                      ) : (
                        <Link 
                          href={`/asset/${asset.id}`}
                          className="inline-flex items-center gap-2 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50 px-4 py-2 rounded-lg font-bold transition-all"
                        >
                          تداول <ArrowRight size={16} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
