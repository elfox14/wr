'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, Asset } from '@/lib/store';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle, ShoppingCart, Globe, Shield, Zap, Target } from 'lucide-react';
import Link from 'next/link';
import { AssetImage } from '@/components/ui/AssetImage';

export default function AssetClient() {
  const params = useParams();
  const id = params.id as string;
  const { assets, buyAsset, sellAsset, fetchPortfolio, holdings, fetchAssets } = useStore();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolio();
    if (assets.length === 0) fetchAssets();
  }, [fetchPortfolio, fetchAssets, assets.length]);

  useEffect(() => {
    fetch(`/api/assets/${id}`)
      .then(res => res.json())
      .then(data => {
        setAsset(data);
        setLoading(false);
      });
  }, [id]);

  if (loading || !asset) return <div className="min-h-screen bg-[#121212] text-white p-10 flex items-center justify-center">جاري تحميل منصة التداول...</div>;

  const isUp = asset.change >= 0;
  
  // Dummy high-resolution history for the chart
  const historyData = asset.priceHistory && asset.priceHistory.length > 0
    ? asset.priceHistory.map((h: any) => ({
        price: h.price, 
        time: new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
      }))
    : Array.from({length: 24}).map((_, i) => ({
        price: asset.current_price * (1 + (Math.random() * 0.1 - 0.05)),
        time: `${i}:00`
      }));

  const holding = holdings.find(h => h.assetId === asset.id);
  const allTeams = assets.filter(a => a.type === 'TEAM').sort((a,b) => (b.score || 0) - (a.score || 0));

  const handleTrade = async (type: 'BUY' | 'SELL') => {
    if (type === 'BUY') await buyAsset(asset.id, quantity);
    else await sellAsset(asset.id, quantity);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#0FF0FC]/30 flex flex-col">
            
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto p-4 gap-4">
        
        {/* LEFT COLUMN: Market Navigator (قائمة المنتخبات/الأصول) */}
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
                <span className="text-xs font-mono text-gray-500">{t.current_price}¢</span>
              </Link>
            ))}
          </div>
        </div>

        {/* CENTER COLUMN: Chart & Pricing & Indicators */}
        <div className="flex-1 flex flex-col gap-4">
          
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
                <p className="text-5xl font-mono font-black text-[#0FF0FC]">{(asset.marketPrice || asset.current_price)} ¢</p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm text-gray-400 font-mono">القيمة العادلة: {asset.fairValue || '-'} ¢</p>
                {asset.fairValue && (() => {
                  const mv = asset.marketPrice || asset.current_price;
                  const diff = mv - asset.fairValue;
                  const pct = (diff / asset.fairValue) * 100;
                  const isPremium = diff > 0;
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPremium ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                      {isPremium ? 'علاوة ' : 'خصم '}
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

          {/* Strength Bar */}
          <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-300 flex items-center gap-2"><Zap className="text-[#FFD700]" size={18} /> مؤشر القوة الشامل</h3>
              <span className="font-mono text-2xl font-black text-white">{asset.score || 0}<span className="text-gray-500 text-lg">/100</span></span>
            </div>
            <div className="w-full bg-black/50 rounded-full h-4 overflow-hidden border border-white/10">
              <div 
                className="h-full bg-gradient-to-r from-yellow-600 via-[#FFD700] to-yellow-300 transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, asset.score || 0))}%` }}
              ></div>
            </div>
            
            {/* Meta tags for pricing context */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
              <div>
                <p className="text-xs text-gray-500">مؤشر المخاطرة</p>
                <p className="font-mono font-bold text-white">{asset.riskIndex ? `${(asset.riskIndex * 10).toFixed(1)}/10` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">حجم المتداولين</p>
                <p className="font-mono font-bold text-white">{asset.ownersCount?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">مؤشر الانسجام</p>
                <p className="font-mono font-bold text-green-400">{asset.harmony ? `${(asset.harmony * 100).toFixed(0)}%` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{asset.type === 'TEAM' ? 'المدرب' : 'النادي'}</p>
                <p className="font-bold text-white truncate">{asset.coach || asset.club || '-'}</p>
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
              <span className="font-mono text-2xl font-bold text-white">{asset.current_price * quantity} ¢</span>
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
              <AlertCircle className="text-yellow-400" size={18} /> شريط الأخبار
            </h3>
            <div className="space-y-4">
              <div className="bg-black/40 border border-white/5 p-3 rounded-lg border-r-2 border-r-green-500">
                <p className="text-sm text-gray-200 font-bold mb-1">تحديث القيمة الفنية</p>
                <p className="text-xs text-gray-400 leading-relaxed">تحسن ملحوظ في مؤشر الجاهزية البدنية للاعبين الأساسيين. توقعات بزيادة الطلب.</p>
                <div className="text-[10px] text-gray-500 mt-2 font-mono">منذ 15 دقيقة</div>
              </div>
              <div className="bg-black/40 border border-white/5 p-3 rounded-lg border-r-2 border-r-gray-500">
                <p className="text-sm text-gray-200 font-bold mb-1">استقرار تكتيكي</p>
                <p className="text-xs text-gray-400 leading-relaxed">ثبات في التشكيلة المتوقعة للمباراة القادمة دون غيابات مؤثرة حتى الآن.</p>
                <div className="text-[10px] text-gray-500 mt-2 font-mono">منذ ساعتين</div>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Roster Section (Full width at bottom if it's a team) */}
      {asset.type === 'TEAM' && asset.players && asset.players.length > 0 && (
        <div className="max-w-[1600px] w-full mx-auto p-4 mb-12">
          <div className="bg-[#121212] border border-white/5 rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
              <Shield className="text-[#0FF0FC]" /> الأصول المرتبطة (قائمة اللاعبين)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {asset.players.map((p: any) => (
                <Link href={`/asset/${p.id}`} key={p.id} className="bg-black/50 border border-white/5 rounded-xl p-4 hover:border-[#0FF0FC]/50 hover:bg-[#0FF0FC]/5 transition-colors group">
                  <div className="flex justify-between items-start mb-3">
                    <AssetImage image={p.image} name={p.name} className="text-3xl w-16 h-16" width={64} height={64} />
                    <span className="bg-white/10 text-gray-400 text-[10px] px-2 py-1 rounded font-bold">{p.position}</span>
                  </div>
                  <div className="font-bold text-white text-sm group-hover:text-[#0FF0FC] transition-colors truncate">{p.name}</div>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-[#FFD700] text-xs font-bold">Score: {p.score}</span>
                    <span className="font-mono text-gray-300 text-sm font-bold">{p.current_price}¢</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
