'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, Asset } from '@/lib/store';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle, ShoppingCart, Globe, Shield, Zap, Target, Users, BarChart3, Star, ArrowRight, User, Info, Trophy } from 'lucide-react';
import Link from 'next/link';
import { AssetImage } from '@/components/ui/AssetImage';

export default function AssetClient() {
  const params = useParams();
  const id = params.id as string;
  const { assets, buyAsset, sellAsset, fetchPortfolio, holdings, fetchAssets } = useStore();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolio();
    if (assets.length === 0) fetchAssets();
  }, [fetchPortfolio, fetchAssets, assets.length]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/assets/${id}`)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Asset not found');
        }
        return res.json();
      })
      .then(data => {
        setAsset(data);
      })
      .catch(err => {
        console.error('Asset load error:', err);
        setError('تعذر تحميل صفحة الأصل. حاول مرة أخرى.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-black">تعذر تحميل الأصل</h1>
        <p className="text-gray-400">{error}</p>
        <Link href="/market" className="bg-primary text-black px-6 py-3 rounded-xl font-bold">
          العودة إلى السوق
        </Link>
      </div>
    );
  }

  if (loading || !asset) return <div className="min-h-screen bg-[#121212] text-white p-10 flex items-center justify-center">جاري تحميل منصة التداول...</div>;

  const tradePrice = Math.round(asset.marketPrice ?? asset.current_price);
  const isUp = asset.change >= 0;
  
  const historyData = asset.priceHistory && asset.priceHistory.length > 0
    ? asset.priceHistory.map((h: any) => ({
        price: h.price, 
        time: new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
      }))
    : Array.from({length: 24}).map((_, i) => ({
        price: tradePrice * (1 + (Math.random() * 0.1 - 0.05)),
        time: `${i}:00`
      }));

  const holding = holdings.find(h => h.assetId === asset.id);
  const allTeams = assets.filter(a => a.type === 'TEAM').sort((a,b) => (b.score || 0) - (a.score || 0));

  const handleTrade = async (type: 'BUY' | 'SELL') => {
    if (type === 'BUY') await buyAsset(asset.id, quantity);
    else await sellAsset(asset.id, quantity);
  };

  const news = asset.marketNews || asset.news || [];
  const hasNews = news.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#0FF0FC]/30 flex flex-col">
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto p-4 gap-4">
        
        {/* LEFT COLUMN: Market Navigator */}
        <div className="hidden lg:flex flex-col w-64 bg-[#121212] border border-white/5 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-white/10 bg-black/40">
            <h3 className="font-bold text-gray-300 flex items-center gap-2"><Globe size={18} className="text-[#0FF0FC]" /> تصفح السوق</h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-2 space-y-1">
            {allTeams.map(t => (
              <Link 
                href={`/asset/${t.id}`} 
                key={t.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${t.id === asset.id ? 'bg-[#0FF0FC]/10 border border-[#0FF0FC]/30' : 'hover:bg-white/5 border border-transparent'}`}
              >
                <div className="flex items-center gap-2">
                  <AssetImage image={t.image} name={t.name} className="text-xl w-6 h-6" width={24} height={24} />
                  <span className={`text-sm font-bold ${t.id === asset.id ? 'text-[#0FF0FC]' : 'text-gray-300'}`}>{t.name}</span>
                </div>
                <span className="text-xs font-mono text-gray-500">{Math.round(t.marketPrice ?? t.current_price)}¢</span>
              </Link>
            ))}
          </div>
        </div>

        {/* CENTER COLUMN: Header, Chart, Detail View */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* Header Info */}
          <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#0FF0FC]/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center gap-6 relative z-10">
              <AssetImage image={asset.image} name={asset.name} className="text-7xl drop-shadow-xl w-32 h-32" width={128} height={128} />
              <div>
                <h1 className="text-4xl font-black text-white tracking-tight">{asset.name} <span className="text-2xl text-gray-500 font-mono">({asset.code})</span></h1>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="bg-white/10 border border-white/10 px-2 py-1 rounded text-xs text-gray-300">
                    {asset.type === 'TEAM' ? 'منتخب وطني' : 'لاعب محترف'}
                  </span>
                  {asset.type === 'TEAM' && <span className="bg-white/10 border border-white/10 px-2 py-1 rounded text-xs text-gray-300">تصنيف الفيفا: #{asset.fifaRank || '-'}</span>}
                  {asset.type === 'PLAYER' && <span className="bg-white/10 border border-white/10 px-2 py-1 rounded text-xs text-gray-300">{asset.position || 'N/A'}</span>}
                  {asset.type === 'PLAYER' && asset.age && <span className="bg-white/10 border border-white/10 px-2 py-1 rounded text-xs text-gray-300">{asset.age} سنة</span>}
                </div>
              </div>
            </div>

            <div className="mt-6 md:mt-0 text-right relative z-10 flex flex-col items-end">
              <p className="text-gray-500 text-xs mb-1 uppercase tracking-widest font-bold">السعر السوقي المباشر</p>
              <div className="flex items-center gap-4">
                <p className="text-5xl font-mono font-black text-[#0FF0FC]">{tradePrice} ¢</p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm text-gray-400 font-mono">القيمة العادلة: {asset.fairValue || '-'} ¢</p>
                {asset.fairValue && (() => {
                  const diff = tradePrice - asset.fairValue;
                  const pct = (diff / asset.fairValue) * 100;
                  const isPremium = diff > 0;
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPremium ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {isPremium ? 'علاوة (Premium) ' : 'خصم (Discount) '}
                      {isPremium ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  );
                })()}
              </div>
              <div className={`mt-2 flex items-center gap-1 font-bold text-lg px-3 py-1 rounded-full ${isUp ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {isUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {Math.abs(asset.change)}% (24h)
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg flex-1 min-h-[350px] flex flex-col">
            <h3 className="font-bold text-gray-300 mb-6 flex items-center gap-2"><Activity size={18} /> الرسم البياني للأداء الافتراضي</h3>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isUp ? "#0FF0FC" : "#ff4444"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isUp ? "#0FF0FC" : "#ff4444"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <YAxis domain={['auto', 'auto']} hide />
                  <XAxis dataKey="time" stroke="#444" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: isUp ? '#0FF0FC' : '#ff4444', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke={isUp ? "#0FF0FC" : "#ff4444"} 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Type-based view rendering */}
          {asset.type === 'TEAM' ? <TeamDetailView asset={asset} /> : <PlayerDetailView asset={asset} assets={assets} />}

        </div>

        {/* RIGHT COLUMN: Execution & News */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          
          {/* Order Execution */}
          <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-300 mb-6 flex items-center gap-2 pb-4 border-b border-white/10">
              <ShoppingCart size={18} className="text-[#0FF0FC]" /> منصة التداول
            </h3>
            
            {holding && (
              <div className="bg-[#0FF0FC]/5 border border-[#0FF0FC]/20 rounded-lg p-4 mb-6 text-center">
                <p className="text-xs text-gray-400 mb-1 uppercase tracking-widest">المحفظة تمتلك</p>
                <p className="text-3xl font-mono font-black text-white">{holding.quantity}</p>
                <p className="text-xs text-gray-500 mt-1 font-mono">متوسط الشراء: {holding.avg_buy_price} ¢</p>
              </div>
            )}

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-gray-400 uppercase tracking-widest">كمية الأسهم</label>
                <span className="text-xs text-gray-500 font-mono">الحد الأقصى: 100</span>
              </div>
              <div className="flex items-center bg-black/60 border border-white/10 rounded-lg p-1">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded hover:bg-white/10 text-xl font-bold transition-colors">-</button>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  className="flex-1 bg-transparent text-center font-mono text-2xl outline-none font-bold text-white"
                  min="1"
                  max="100"
                />
                <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded hover:bg-white/10 text-xl font-bold transition-colors">+</button>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6 py-3 border-y border-white/5">
              <span className="text-sm text-gray-400">القيمة الإجمالية:</span>
              <span className="font-mono text-2xl font-bold text-white">{tradePrice * quantity} ¢</span>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleTrade('BUY')}
                className="w-full bg-[#0FF0FC] hover:bg-[#0FF0FC]/80 text-black font-black py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(15,240,252,0.3)] hover:shadow-[0_0_25px_rgba(15,240,252,0.5)] transform hover:-translate-y-1"
              >
                شراء ماركت (BUY)
              </button>
              <button 
                onClick={() => handleTrade('SELL')}
                disabled={!holding || holding.quantity < quantity}
                className="w-full bg-transparent border-2 border-red-500/50 hover:bg-red-500 hover:border-red-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-red-500/50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all"
              >
                بيع (SELL)
              </button>
            </div>
          </div>

          {/* News Feed */}
          <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg flex-1">
            <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2 pb-4 border-b border-white/10">
              <AlertCircle className="text-yellow-400" size={18} /> الأخبار المؤثرة
            </h3>
            <div className="space-y-3 relative z-10 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {hasNews ? (
                news.map((n: any, i: number) => (
                  <div key={i} className={`p-4 bg-[#111111] rounded-xl border border-white/5 hover:bg-white/5 transition-colors border-r-2 ${n.impact > 0 ? 'border-r-green-500' : n.impact < 0 ? 'border-r-red-500' : 'border-r-gray-500'}`}>
                    <p className="text-sm text-gray-200 font-bold mb-1">{n.title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{n.content}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 italic">لا توجد أخبار مؤثرة لهذا الأصل حالياً.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// -------------------------------------------------------------
// TEAM DETAIL VIEW
// -------------------------------------------------------------
function TeamDetailView({ asset }: { asset: any }) {
  const players = asset.players || [];
  
  // Squad breakdown calculations
  const groupBy = (arr: any[], key: string) => arr.reduce((acc, obj) => { const k = obj[key] || 'N/A'; acc[k] = acc[k] || []; acc[k].push(obj); return acc; }, {} as Record<string, any[]>);
  const groups = groupBy(players, 'position');
  
  const getGroupStats = (pos: string) => {
    const group = groups[pos] || [];
    const count = group.length;
    const avgScore = count ? group.reduce((a: number, b: any) => a + (b.score || 0), 0) / count : 0;
    const avgPrice = count ? group.reduce((a: number, b: any) => a + (b.marketPrice ?? b.current_price), 0) / count : 0;
    const topScore = count ? group.reduce((p: any, c: any) => (p.score || 0) > (c.score || 0) ? p : c, group[0]) : null;
    const topMomentum = count ? group.reduce((p: any, c: any) => (p.momentum || 0) > (c.momentum || 0) ? p : c, group[0]) : null;
    return { count, avgScore, avgPrice, topScore, topMomentum };
  };

  // Key Players
  const keyPlayers = players.length > 0 ? {
    highestScore: players.reduce((p: any, c: any) => (p.score || 0) > (c.score || 0) ? p : c, players[0]),
    highestPrice: players.reduce((p: any, c: any) => (p.marketPrice ?? p.current_price) > (c.marketPrice ?? c.current_price) ? p : c, players[0]),
    highestMomentum: players.reduce((p: any, c: any) => (p.momentum || 0) > (c.momentum || 0) ? p : c, players[0]),
    highestDemand: players.reduce((p: any, c: any) => (p.marketDemand || 0) > (c.marketDemand || 0) ? p : c, players[0]),
    mostUndervalued: players.reduce((p: any, c: any) => {
      const getPD = (a: any) => a.fairValue > 0 ? (((a.marketPrice ?? a.current_price) - a.fairValue) / a.fairValue) * 100 : 0;
      return getPD(c) < getPD(p) ? c : p;
    }, players[0]),
  } : null;

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Team Power Card */}
      <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
        <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><Target size={18} className="text-success" /> قوة المنتخب</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">الزخم (Momentum)</p>
            <p className="text-2xl font-bold text-white">{asset.momentum || 50}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">الطلب (Demand)</p>
            <p className="text-2xl font-bold text-white">{asset.marketDemand || 50}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">التقلب (Volatility)</p>
            <p className="text-2xl font-bold text-white">{asset.volatilityScore || 50}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">المُلاّك</p>
            <p className="text-2xl font-bold text-white">{asset.ownersCount || 0}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">الجودة (Squad Quality)</p>
            <p className="text-2xl font-bold text-white">{asset.score || 0}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">تصنيف الفيفا</p>
            <p className="text-2xl font-bold text-white">#{asset.fifaRank || '-'}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">الشعبية (Popularity)</p>
            <p className="text-2xl font-bold text-white">{asset.popularity || 50}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">إرث المونديال</p>
            <p className="text-2xl font-bold text-white">{asset.worldCupLegacy || 50}</p>
          </div>
        </div>
      </div>

      {/* Squad Breakdown */}
      <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
        <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><Users size={18} className="text-primary" /> تفصيل التشكيلة (Squad Breakdown)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {['FWD', 'MID', 'DEF', 'GK'].map(pos => {
            const stats = getGroupStats(pos);
            if (!stats.count) return null;
            return (
              <div key={pos} className="bg-black/40 border border-white/5 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                  <span className="font-bold text-white">{pos}</span>
                  <span className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">{stats.count} لاعبين</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">متوسط التقييم:</span>
                  <span className="font-bold text-accent">{stats.avgScore.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-xs mb-4">
                  <span className="text-gray-500">متوسط السعر:</span>
                  <span className="font-bold text-white">{stats.avgPrice.toFixed(0)} ¢</span>
                </div>
                <div className="text-[10px] text-gray-400 mb-1 flex justify-between">
                  <span>الأعلى تقييماً:</span> <span className="text-gray-200 truncate max-w-[80px] text-left">{stats.topScore?.name}</span>
                </div>
                <div className="text-[10px] text-gray-400 flex justify-between">
                  <span>الأعلى زخماً:</span> <span className="text-gray-200 truncate max-w-[80px] text-left">{stats.topMomentum?.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Players */}
      {keyPlayers && (
        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
          <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><Star size={18} className="text-yellow-400" /> نجوم الفريق</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { label: 'الأعلى تقييماً', player: keyPlayers.highestScore, val: keyPlayers.highestScore?.score?.toFixed(1) },
              { label: 'الأغلى سعراً', player: keyPlayers.highestPrice, val: `${Math.round(keyPlayers.highestPrice?.marketPrice ?? keyPlayers.highestPrice?.current_price ?? 0)}¢` },
              { label: 'الأعلى زخماً', player: keyPlayers.highestMomentum, val: keyPlayers.highestMomentum?.momentum },
              { label: 'الأعلى طلباً', player: keyPlayers.highestDemand, val: keyPlayers.highestDemand?.marketDemand },
              { label: 'أكثر فرصة', player: keyPlayers.mostUndervalued, val: 'فرصة (Undervalued)' }
            ].map((item, idx) => (
              <Link href={`/asset/${item.player?.id}`} key={idx} className="bg-black/40 p-3 rounded-lg border border-white/5 hover:border-primary/50 transition-colors text-center group">
                <p className="text-[10px] text-gray-500 uppercase mb-3">{item.label}</p>
                <div className="flex justify-center mb-2">
                  <AssetImage image={item.player?.image} name={item.player?.name || ''} className="w-12 h-12" width={48} height={48} />
                </div>
                <p className="text-xs font-bold text-white group-hover:text-primary truncate">{item.player?.name}</p>
                <p className="text-[10px] text-accent mt-1">{item.val}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Match Placeholder */}
      <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
         <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><Target size={18} className="text-orange-500" /> المباراة القادمة</h3>
         <div className="bg-black/40 border border-orange-500/20 p-6 rounded-lg text-center">
           <p className="text-sm text-gray-500 italic">لا توجد مباراة قادمة مرتبطة حالياً.</p>
         </div>
      </div>

      {/* Players Market Table */}
      <div className="bg-[#121212] border border-white/5 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-bold text-gray-300 flex items-center gap-2"><BarChart3 size={18} className="text-blue-400" /> سوق لاعبي المنتخب</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-black/60 text-gray-400">
              <tr>
                <th className="p-4">اللاعب</th>
                <th className="p-4 text-center">المركز</th>
                <th className="p-4 text-center">العمر</th>
                <th className="p-4 text-center">النادي</th>
                <th className="p-4 text-center">التقييم</th>
                <th className="p-4 text-center">السعر</th>
                <th className="p-4 text-center">العادلة</th>
                <th className="p-4 text-center">الخصم/العلاوة</th>
                <th className="p-4 text-center">الزخم</th>
                <th className="p-4 text-center">الطلب</th>
                <th className="p-4 text-center">التقلب</th>
                <th className="p-4 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p: any) => {
                const mp = Math.round(p.marketPrice ?? p.current_price);
                const pd = p.fairValue > 0 ? ((mp - p.fairValue) / p.fairValue) * 100 : 0;
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <AssetImage image={p.image} name={p.name} className="w-8 h-8 rounded" width={32} height={32} />
                      {p.name}
                    </td>
                    <td className="p-4 text-center text-gray-400">{p.position}</td>
                    <td className="p-4 text-center text-gray-400">{p.age || '-'}</td>
                    <td className="p-4 text-center text-gray-400 truncate max-w-[100px]">{p.club || '-'}</td>
                    <td className="p-4 text-center font-bold text-accent">{p.score?.toFixed(1)}</td>
                    <td className="p-4 text-center font-bold text-white">{mp}¢</td>
                    <td className="p-4 text-center text-gray-400">{p.fairValue?.toFixed(0)}¢</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${pd > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                        {pd > 0 ? '+' : ''}{pd.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-center text-gray-400">{p.momentum || 50}</td>
                    <td className="p-4 text-center text-gray-400">{p.marketDemand || 50}</td>
                    <td className="p-4 text-center text-gray-400">{p.volatilityScore || 50}</td>
                    <td className="p-4 text-left">
                      <Link href={`/asset/${p.id}`} className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition">تداول</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// -------------------------------------------------------------
// PLAYER DETAIL VIEW
// -------------------------------------------------------------
function PlayerDetailView({ asset, assets }: { asset: any, assets: any[] }) {
  
  const teammates = assets.filter((a: any) =>
    a.type === 'PLAYER' &&
    a.id !== asset.id &&
    a.teamId &&
    asset.teamId &&
    a.teamId === asset.teamId
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Player Profile Card & Valuation Pillars */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Profile */}
        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg h-full">
          <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><User size={18} className="text-primary" /> البطاقة الشخصية</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-4">
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">المركز</p>
              <p className="font-bold text-white mt-1">{asset.position || '-'}</p>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">العمر</p>
              <p className="font-bold text-white mt-1">{asset.age || '-'}</p>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">النادي</p>
              <p className="font-bold text-white mt-1 truncate">{asset.club || '-'}</p>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">المنتخب</p>
              <p className="font-bold text-white mt-1 truncate">
                {asset.team?.name || asset.teamName || '-'}
              </p>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">مستوى اللاعب (Tier)</p>
              <p className="font-bold text-white mt-1">{asset.playerTier ?? '-'}</p>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">إرث المونديال</p>
              <p className="font-bold text-white mt-1">{asset.worldCupLegacy || 50}</p>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">الشعبية</p>
              <p className="font-bold text-white mt-1">{asset.popularity || 50}</p>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase">التقلب (المخاطرة)</p>
              <p className="font-bold text-white mt-1">{asset.volatilityScore || 50}</p>
            </div>
          </div>
        </div>

        {/* Valuation Pillars */}
        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg h-full flex flex-col">
          <h3 className="font-bold text-gray-300 mb-6 flex items-center gap-2"><BarChart3 size={18} className="text-accent" /> أعمدة التقييم (Valuation Pillars)</h3>
          <div className="space-y-5 flex-1 flex flex-col justify-center">
            {[
              { label: 'الأداء الفني (Fundamental)', value: asset.fundamental || 0, weight: '35%' },
              { label: 'الطلب السوقي (Demand)', value: asset.marketDemand || 0, weight: '20%' },
              { label: 'الشعبية (Popularity)', value: asset.popularity || 0, weight: '20%' },
              { label: 'إرث المونديال (Legacy)', value: asset.worldCupLegacy || 0, weight: '15%' },
              { label: 'الزخم (Momentum)', value: asset.momentum || 0, weight: '10%' },
            ].map((pillar, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-end mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{pillar.label}</span>
                    <span className="text-[9px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">وزن: {pillar.weight}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-accent">{pillar.value}/100</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2.5 border border-white/5 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, pillar.value))}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Performance Impact Matrix & Position Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Performance Impact */}
        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
          <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><Zap size={18} className="text-yellow-400" /> مصفوفة تأثير الأداء (Impact Matrix)</h3>
          <div className="grid grid-cols-1 gap-2">
            {[
              { event: 'هدف (Goal)', m: '+10', d: '+5', color: 'text-green-400', border: 'border-green-400/20', bg: 'bg-green-400/5' },
              { event: 'صناعة (Assist)', m: '+6', d: '+3', color: 'text-green-400', border: 'border-green-400/20', bg: 'bg-green-400/5' },
              { event: 'رجل المباراة (MOTM)', m: '+15', d: '+8', color: 'text-yellow-400', border: 'border-yellow-400/20', bg: 'bg-yellow-400/5' },
              { event: 'بطاقة حمراء (Red Card)', m: '-12', d: '-8', color: 'text-red-400', border: 'border-red-400/20', bg: 'bg-red-400/5' },
              { event: 'إصابة (Injury)', m: '-15', d: '-10', color: 'text-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5' },
            ].map((imp, idx) => (
              <div key={idx} className={`flex justify-between items-center ${imp.bg} p-3 rounded-lg border ${imp.border}`}>
                <span className="text-sm font-bold text-white">{imp.event}</span>
                <div className="flex gap-6">
                  <span className={`text-xs font-bold font-mono ${imp.color}`}>زخم: {imp.m}</span>
                  <span className={`text-xs font-bold font-mono ${imp.color}`}>طلب: {imp.d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Position Intelligence */}
        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg flex flex-col">
          <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><Info size={18} className="text-[#0FF0FC]" /> الذكاء المالي للمركز ({asset.position})</h3>
          <div className="bg-[#0FF0FC]/5 border border-[#0FF0FC]/20 p-6 rounded-xl flex-1 flex flex-col justify-center">
            <p className="text-gray-300 leading-relaxed text-sm md:text-base font-medium">
              {asset.position === 'FWD' && 'باعتباره مهاجماً، فإن تسجيل الأهداف وصناعتها هما المحركان الأساسيان لرفع تقييمه وسعره السوقي. يتمتع المهاجمون بطلب عالي وزخم سريع التأثر.'}
              {asset.position === 'MID' && 'لاعبو الوسط يحصلون على الزخم من خلال الصناعة، دقة التمرير، والتحكم باللعب. تتأثر أسعارهم بشكل كبير بجوائز رجل المباراة.'}
              {asset.position === 'DEF' && 'المدافعون يستمدون قوتهم من الشباك النظيفة (Clean Sheets) والتدخلات الناجحة. التقلب لديهم أقل عادةً من المهاجمين، مما يجعلهم أصولاً أكثر أماناً للمحفظة.'}
              {asset.position === 'GK' && 'حراس المرمى أصول مستقرة جداً. ترتفع أسعارهم بشكل جنوني في حال التصدي لركلات الجزاء أو الحفاظ على شباك نظيفة في أدوار خروج المغلوب.'}
              {!['FWD', 'MID', 'DEF', 'GK'].includes(asset.position) && 'أداء اللاعب العام وتأثيره على نتائج فريقه يحدد مسار سعره في منصة التداول.'}
            </p>
          </div>
        </div>

      </div>

      {/* Compare With Teammates */}
      <div className="bg-[#121212] border border-white/5 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-bold text-gray-300 flex items-center gap-2"><Users size={18} className="text-gray-400" /> مقارنة مع الزملاء في المنتخب</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-black/60 text-gray-400">
              <tr>
                <th className="p-4">الزميل</th>
                <th className="p-4 text-center">المركز</th>
                <th className="p-4 text-center">التقييم</th>
                <th className="p-4 text-center">السعر</th>
                <th className="p-4 text-center">العادلة</th>
                <th className="p-4 text-center">الخصم/العلاوة</th>
                <th className="p-4 text-center">الزخم</th>
                <th className="p-4 text-center">الطلب</th>
                <th className="p-4 text-center">التقلب</th>
                <th className="p-4 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {teammates.slice(0, 10).map((p: any) => {
                const mp = Math.round(p.marketPrice ?? p.current_price);
                const pd = p.fairValue > 0 ? ((mp - p.fairValue) / p.fairValue) * 100 : 0;
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <AssetImage image={p.image} name={p.name} className="w-8 h-8 rounded" width={32} height={32} />
                      {p.name}
                    </td>
                    <td className="p-4 text-center text-gray-400">{p.position}</td>
                    <td className="p-4 text-center font-bold text-accent">{p.score?.toFixed(1)}</td>
                    <td className="p-4 text-center font-bold text-white">{mp}¢</td>
                    <td className="p-4 text-center text-gray-400">{p.fairValue?.toFixed(0)}¢</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${pd > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                        {pd > 0 ? '+' : ''}{pd.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-center text-gray-400">{p.momentum || 50}</td>
                    <td className="p-4 text-center text-gray-400">{p.marketDemand || 50}</td>
                    <td className="p-4 text-center text-gray-400">{p.volatilityScore || 50}</td>
                    <td className="p-4 text-left">
                      <Link href={`/asset/${p.id}`} className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition">عرض</Link>
                    </td>
                  </tr>
                );
              })}
              {teammates.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500 italic">لا يوجد زملاء متاحين حالياً في قاعدة البيانات.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
