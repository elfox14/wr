'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore, Asset } from '@/lib/store';
import { Navbar } from '@/components/ui/Navbar';
import { TrendingUp, TrendingDown, ArrowRight, Search, Filter, LayoutGrid, List, ChevronRight, Globe, Users, Target, Activity, Zap, Info } from 'lucide-react';
import { TeamRosterDrawer } from '@/components/ui/TeamRosterDrawer';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, Area, AreaChart } from 'recharts';
import { AssetImage } from '@/components/ui/AssetImage';
import { StockCard } from '@/components/ui/StockCard';
import { PageHeader } from '@/components/ui/PageHeader';

export default function MarketClient() {
  const { assets, fetchAssets } = useStore();
  const [filterType, setFilterType] = useState<'ALL' | 'TEAM' | 'PLAYER'>('TEAM');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [isProMode, setIsProMode] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Asset | null>(null);
  useEffect(() => {
    fetchAssets();
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Navbar />
      
      {/* Drawer */}
      <TeamRosterDrawer team={selectedTeam} onClose={() => setSelectedTeam(null)} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <PageHeader 
          title="سوق كأس العالم 2026"
          description="استكشف 48 منتخبًا مشاركًا وقوائمهم النهائية، وقارن بين قوة المنتخبات وجودة اللاعبين وحركة السوق في مكان واحد."
          icon={<Globe size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        {/* Live Top Info Bar (Ticker style) */}
        <div className="bg-surface border border-white/5 rounded-xl p-4 mb-8 flex flex-wrap gap-4 justify-between items-center text-sm shadow-card">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span className="text-gray-400">متداول نشط:</span>
            <span className="font-bold text-white tabular-nums">15,234</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <Activity size={16} className="text-primary" />
            <span className="text-gray-400">حجم التداول اليوم:</span>
            <span className="font-bold text-white tabular-nums">2.5M ¢</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <TrendingUp size={16} className="text-success" />
            <span className="text-gray-400">أكثر صعوداً:</span>
            <span className="font-bold text-success">{topPlayers[0]?.name || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <TrendingDown size={16} className="text-danger" />
            <span className="text-gray-400">أكثر هبوطاً:</span>
            <span className="font-bold text-danger">البرازيل</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4 bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
            <span className="text-gray-400">المباراة القادمة:</span>
            <span className="font-bold text-accent tabular-nums">12d : 14h : 22m</span>
          </div>
        </div>

        {/* Market Overview Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-surface border border-white/5 p-6 rounded-2xl flex flex-col justify-center shadow-card">
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              <Globe size={20} className="text-primary" /> 
              <span>إجمالي المنتخبات</span>
            </div>
            <div className="text-4xl font-bold text-white tabular-nums">48</div>
            <div className="text-sm text-gray-500 mt-2">مشارك في مونديال 2026</div>
          </div>
          
          <div className="bg-surface border border-white/5 p-6 rounded-2xl flex flex-col justify-center shadow-card">
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              <Users size={20} className="text-accent" /> 
              <span>اللاعبين المتاحين</span>
            </div>
            <div className="text-4xl font-bold text-white tabular-nums">{players.length}</div>
            <div className="text-sm text-gray-500 mt-2">حتى 1,248 لاعباً متاحاً</div>
          </div>

          <div className="bg-surface border border-white/5 p-6 rounded-2xl col-span-1 md:col-span-2 flex items-center justify-between shadow-card">
            <div className="w-1/2 pr-4 border-r border-white/10 hidden md:block">
              <div className="text-sm text-gray-400 mb-3 flex items-center gap-2"><Target size={16} className="text-success" /> أعلى المنتخبات تقييماً</div>
              <div className="flex flex-col gap-2">
                {topTeams.map(t => (
                  <div key={t.id} className="flex justify-between text-sm font-bold">
                    <span className="flex items-center gap-1"><AssetImage image={t.image} name={t.name} className="w-5 h-5" width={20} height={20} /> {t.name}</span>
                    <span className="text-accent tabular-nums">{t.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-1/2 md:pl-4">
              <div className="text-sm text-gray-400 mb-3 flex items-center gap-2"><Activity size={16} className="text-primary" /> أغلى النجوم في السوق</div>
              <div className="flex flex-col gap-2">
                {topPlayers.map(p => (
                  <div key={p.id} className="flex justify-between text-sm font-bold">
                    <span className="truncate max-w-[150px]">{p.name}</span>
                    <span className="tabular-nums text-white">{p.current_price}¢</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-md py-4 mb-8 border-b border-white/5 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-grow lg:flex-grow-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="text" 
                placeholder="ابحث عن لاعب أو منتخب..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full lg:w-64 bg-surface/50 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            
            <div className="flex bg-surface/50 border border-white/10 rounded-xl p-1">
              <button onClick={() => setFilterType('TEAM')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'TEAM' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>المنتخبات</button>
              <button onClick={() => setFilterType('PLAYER')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'PLAYER' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>اللاعبين</button>
              <button onClick={() => setFilterType('ALL')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === 'ALL' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>الكل</button>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex gap-2">
              {/* Smart Chips (Mocked functionality for UI) */}
              <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface border border-white/5 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors text-success">
                فرص صاعدة
              </button>
              <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface border border-white/5 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors text-accent">
                نجوم الصف الأول
              </button>
            </div>

            <div className="flex bg-surface/50 border border-white/10 rounded-xl p-1 items-center">
              <button onClick={() => setIsProMode(false)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${!isProMode ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}>
                بسيط
              </button>
              <button onClick={() => setIsProMode(true)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${isProMode ? 'bg-primary text-white shadow-[0_0_10px_rgba(15,240,252,0.5)]' : 'text-gray-400 hover:text-white'}`}>
                المحترفين (Pro)
              </button>
            </div>
            
            <div className="flex bg-surface/50 border border-white/10 rounded-xl p-1">
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
            {filteredAssets.map(asset => {
              // Determine variant based on change
              let variant: 'default' | 'hot' | 'cold' = 'default';
              if (asset.change >= 5) variant = 'hot';
              else if (asset.change <= -5) variant = 'cold';

              return (
                <div key={asset.id} className="flex justify-center">
                  <StockCard 
                    type={asset.type as 'TEAM' | 'PLAYER'}
                    name={asset.name}
                    code={asset.code}
                    image={asset.image}
                    score={asset.score || 0}
                    price={asset.current_price}
                    change={asset.change}
                    volume={asset.volume}
                    marketCap={asset.marketCap}
                    priceHistory={asset.priceHistory?.map((h: any) => h.price) || [asset.current_price, asset.current_price]}
                    position={asset.position || undefined}
                    fifaRank={asset.fifaRank || undefined}
                    onClick={() => {
                      if (asset.type === 'TEAM') {
                        setSelectedTeam(asset);
                      } else {
                        window.location.href = `/asset/${asset.id}`;
                      }
                    }}
                    variant={variant}
                    isProMode={isProMode}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface border border-white/10 rounded-2xl overflow-x-auto shadow-card">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-background/60 border-b border-white/10 text-gray-400 text-sm tracking-wider">
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
                      <AssetImage image={asset.image} name={asset.name} className="w-12 h-12 bg-background/40 flex items-center justify-center rounded-xl overflow-hidden" width={48} height={48} />
                      <div>
                         {/* Here we use primary on hover */}
                        <p className="font-bold text-white text-lg group-hover:text-primary transition-colors">{asset.name}</p>
                        <p className="text-xs text-gray-500">{asset.code}</p>
                      </div>
                    </td>
                    
                    {filterType === 'TEAM' && (
                      <td className="p-4 text-center text-gray-300 tabular-nums font-bold">
                        {asset.type === 'TEAM' ? `#${asset.fifaRank || '-'}` : '-'}
                      </td>
                    )}
                    {filterType === 'TEAM' && (
                      <td className="p-4 text-center text-gray-400 tabular-nums">
                        {asset.riskIndex ? `${(asset.riskIndex * 10).toFixed(1)}/10` : '-'}
                      </td>
                    )}
                    {filterType === 'TEAM' && (
                      <td className="p-4 text-center text-gray-400 tabular-nums">
                        {asset.ownersCount ? asset.ownersCount.toLocaleString() : '0'}
                      </td>
                    )}
                    
                    {filterType === 'PLAYER' && (
                      <td className="p-4 text-center">
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300 font-bold">{asset.position || '-'}</span>
                      </td>
                    )}
                    {filterType === 'PLAYER' && (
                      <td className="p-4 text-center text-gray-300 tabular-nums">
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
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300 font-bold">
                          {asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}
                        </span>
                      </td>
                    )}

                    <td className="p-4 text-center font-bold text-accent tabular-nums">
                      {asset.score || 'N/A'}
                    </td>
                    
                    <td className="p-4 text-center font-bold text-white tabular-nums">
                      {asset.current_price} ¢
                    </td>
                    
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center gap-1 font-bold tabular-nums ${asset.change >= 0 ? 'text-success' : 'text-danger'}`}>
                        {asset.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {Math.abs(asset.change)}%
                      </span>
                    </td>
                    
                    <td className="p-4 text-left">
                      {asset.type === 'TEAM' ? (
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => setSelectedTeam(asset)}
                            className="inline-flex items-center gap-2 bg-surface hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 px-3 py-2 rounded-lg font-bold transition-all text-xs"
                          >
                            التشكيلة
                          </button>
                          <Link 
                            href={`/asset/${asset.id}`}
                            className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 px-3 py-2 rounded-lg font-bold transition-all text-xs"
                          >
                            تداول
                          </Link>
                        </div>
                      ) : (
                        <Link 
                          href={`/asset/${asset.id}`}
                          className="inline-flex items-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/50 px-4 py-2 rounded-lg font-bold transition-all"
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
