'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Wallet, TrendingUp, TrendingDown, Briefcase, Activity, AlertCircle, AlertTriangle, CheckCircle, PieChart, Star, Frown, Target, Shield, ArrowRight } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import Link from 'next/link';

export function PortfolioAnalyticsDashboard() {
  const { portfolioAnalytics, fetchPortfolioAnalytics, loading } = useStore();

  useEffect(() => {
    fetchPortfolioAnalytics();
  }, [fetchPortfolioAnalytics]);

  if (!portfolioAnalytics) {
    return <div className="p-10 text-center text-gray-500">جاري تحميل بيانات المحفظة...</div>;
  }

  const {
    balance,
    holdingsValue,
    netWorth,
    totalCostBasis,
    unrealizedPnL,
    unrealizedPnLPercent,
    bestPerformer,
    worstPerformer,
    allocationByType,
    allocationByPosition,
    allocationByRisk,
    portfolioRisk,
    riskLabel,
    riskLabelAr,
    insights,
    holdings
  } = portfolioAnalytics;

  // Render Insight Messages
  const renderInsights = () => {
    if (!insights || insights.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {insights.map((msg, idx) => {
          let color = "border-blue-500/30 bg-blue-500/10 text-blue-400";
          let icon = <Activity className="text-blue-500" size={18}/>;
          
          if (msg.includes("مخاطر") || msg.includes("متراجعة")) {
            color = "border-red-500/30 bg-red-500/10 text-red-400";
            icon = <AlertCircle className="text-red-500" size={18}/>;
          } else if (msg.includes("ممتاز")) {
            color = "border-green-500/30 bg-green-500/10 text-green-400";
            icon = <CheckCircle className="text-green-500" size={18}/>;
          } else if (msg.includes("اللاعبين")) {
            color = "border-purple-500/30 bg-purple-500/10 text-purple-400";
            icon = <Activity className="text-purple-500" size={18}/>;
          }

          return (
            <div key={idx} className={`p-4 rounded-xl border flex items-center gap-3 ${color}`}>
              {icon}
              <span className="font-bold text-sm">{msg}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 30) return { color: 'text-green-500', bar: 'bg-green-500' };
    if (risk <= 60) return { color: 'text-blue-500', bar: 'bg-blue-500' };
    return { color: 'text-orange-500', bar: 'bg-orange-500' };
  };

  const riskInfo = getRiskColor(portfolioRisk);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#121212] p-5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0FF0FC]/5 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest relative z-10">إجمالي القيمة (Net Worth)</p>
          <p className="text-3xl font-black text-white tabular-nums relative z-10">{netWorth} ¢</p>
        </div>
        <div className="bg-[#121212] p-5 rounded-2xl border border-white/5 shadow-lg">
          <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest">الرصيد المتاح (Available)</p>
          <p className="text-2xl font-bold text-white tabular-nums">{balance} ¢</p>
        </div>
        <div className="bg-[#121212] p-5 rounded-2xl border border-white/5 shadow-lg">
          <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest">قيمة الأصول (Holdings)</p>
          <p className="text-2xl font-bold text-white tabular-nums">{holdingsValue} ¢</p>
        </div>
        <div className={`p-5 rounded-2xl border shadow-lg lg:col-span-2 ${unrealizedPnL >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest">الأرباح غير المحققة (Unrealized P&L)</p>
          <div className="flex justify-between items-end">
            <p className={`text-3xl font-black tabular-nums ${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL} ¢
            </p>
            <div className={`flex items-center gap-1 font-bold ${unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {unrealizedPnLPercent >= 0 ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
              {unrealizedPnLPercent >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      {renderInsights()}

      {/* Best & Worst and Risk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Best Performer */}
        <div className="bg-[#121212] p-5 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4 text-green-500">
            <Star size={20} /> <h3 className="font-bold text-sm uppercase tracking-widest">أفضل أداء</h3>
          </div>
          {bestPerformer ? (
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <AssetImage image={bestPerformer.asset?.image || ''} name={bestPerformer.asset?.name || ''} type={bestPerformer.asset?.type as 'TEAM' | 'PLAYER'} width={40} height={40} className="w-10 h-10" />
                 <div>
                   <p className="font-bold text-white">{bestPerformer.asset?.name}</p>
                   <p className="text-xs text-gray-500">{bestPerformer.asset?.code}</p>
                 </div>
               </div>
               <div className="text-right">
                 <p className="text-lg font-bold text-green-500">+{bestPerformer.pnlPercent?.toFixed(2)}%</p>
                 <p className="text-xs text-green-500/70">+{bestPerformer.pnl} ¢</p>
               </div>
             </div>
          ) : (
            <p className="text-gray-500 text-sm">لا يوجد بيانات</p>
          )}
        </div>

        {/* Worst Performer */}
        <div className="bg-[#121212] p-5 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4 text-red-500">
            <Frown size={20} /> <h3 className="font-bold text-sm uppercase tracking-widest">أسوأ أداء</h3>
          </div>
          {worstPerformer ? (
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <AssetImage image={worstPerformer.asset?.image || ''} name={worstPerformer.asset?.name || ''} type={worstPerformer.asset?.type as 'TEAM' | 'PLAYER'} width={40} height={40} className="w-10 h-10" />
                 <div>
                   <p className="font-bold text-white">{worstPerformer.asset?.name}</p>
                   <p className="text-xs text-gray-500">{worstPerformer.asset?.code}</p>
                 </div>
               </div>
               <div className="text-right">
                 <p className="text-lg font-bold text-red-500">{worstPerformer.pnlPercent?.toFixed(2)}%</p>
                 <p className="text-xs text-red-500/70">{worstPerformer.pnl} ¢</p>
               </div>
             </div>
          ) : (
            <p className="text-gray-500 text-sm">لا يوجد بيانات</p>
          )}
        </div>

        {/* Portfolio Risk */}
        <div className="bg-[#121212] p-5 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-between relative overflow-hidden">
           <div className="flex items-center gap-2 mb-4 text-gray-300">
            <Shield size={20} className={riskInfo.color} /> <h3 className="font-bold text-sm uppercase tracking-widest">مؤشر المخاطر (Risk Score)</h3>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className={`text-xl font-black ${riskInfo.color}`}>{riskLabelAr} ({riskLabel})</span>
              <span className="text-2xl font-mono text-white">{portfolioRisk}<span className="text-sm text-gray-500">/100</span></span>
            </div>
            <div className="w-full bg-black/50 rounded-full h-3 border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${riskInfo.bar}`}
                style={{ width: `${portfolioRisk}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Allocations */}
      <div className="bg-[#121212] p-6 rounded-2xl border border-white/5 shadow-lg">
        <h3 className="font-bold text-gray-300 mb-6 flex items-center gap-2 pb-4 border-b border-white/10">
          <PieChart className="text-[#0FF0FC]" size={20} /> توزيع المحفظة (Allocation)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Type Allocation */}
          <div>
            <p className="text-sm font-bold text-gray-400 mb-4 uppercase">حسب نوع الأصل</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white">منتخبات (Teams)</span><span className="font-mono text-blue-400">{allocationByType.teams}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${allocationByType.teams}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white">لاعبين (Players)</span><span className="font-mono text-purple-400">{allocationByType.players}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-purple-500 h-1.5 rounded-full" style={{width: `${allocationByType.players}%`}}></div></div>
              </div>
            </div>
          </div>
          {/* Position Allocation */}
          <div>
            <p className="text-sm font-bold text-gray-400 mb-4 uppercase">حسب المركز (لاعبين)</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">هجوم (FWD)</span><span className="font-mono text-red-400">{allocationByPosition.FWD}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-red-500 h-1.5 rounded-full" style={{width: `${allocationByPosition.FWD}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">وسط (MID)</span><span className="font-mono text-green-400">{allocationByPosition.MID}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{width: `${allocationByPosition.MID}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">دفاع (DEF)</span><span className="font-mono text-blue-400">{allocationByPosition.DEF}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${allocationByPosition.DEF}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">حارس (GK)</span><span className="font-mono text-yellow-400">{allocationByPosition.GK}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-yellow-500 h-1.5 rounded-full" style={{width: `${allocationByPosition.GK}%`}}></div></div>
              </div>
            </div>
          </div>
          {/* Risk Allocation */}
          <div>
            <p className="text-sm font-bold text-gray-400 mb-4 uppercase">حسب درجة التقلب (Risk)</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">عالي (High)</span><span className="font-mono text-orange-400">{allocationByRisk.high}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-orange-500 h-1.5 rounded-full" style={{width: `${allocationByRisk.high}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">متوسط (Med)</span><span className="font-mono text-blue-400">{allocationByRisk.medium}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${allocationByRisk.medium}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">منخفض (Low)</span><span className="font-mono text-green-400">{allocationByRisk.low}%</span></div>
                <div className="w-full bg-black/50 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{width: `${allocationByRisk.low}%`}}></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-[#121212] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
         <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
           <h3 className="font-bold text-gray-300 flex items-center gap-2">
            <Briefcase className="text-[#0FF0FC]" size={20} /> تفاصيل المراكز المفتوحة (Holdings)
           </h3>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left whitespace-nowrap">
             <thead className="text-xs text-gray-400 uppercase bg-black/60 border-b border-white/10">
               <tr>
                 <th className="px-4 py-4 font-bold text-right">الأصل (Asset)</th>
                 <th className="px-4 py-4 font-bold text-center">الكمية</th>
                 <th className="px-4 py-4 font-bold text-center">متوسط الشراء</th>
                 <th className="px-4 py-4 font-bold text-center">سعر السوق</th>
                 <th className="px-4 py-4 font-bold text-center">القيمة العادلة</th>
                 <th className="px-4 py-4 font-bold text-center">العلاوة/الخصم</th>
                 <th className="px-4 py-4 font-bold text-center">القيمة الحالية</th>
                 <th className="px-4 py-4 font-bold text-center">الربح/الخسارة</th>
                 <th className="px-4 py-4 font-bold text-center">العائد %</th>
                 <th className="px-4 py-4 font-bold text-center">الزخم</th>
                 <th className="px-4 py-4 font-bold text-center">الطلب</th>
                 <th className="px-4 py-4 font-bold text-center">التقلب</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
               {holdings.length === 0 ? (
                 <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">لا يوجد بيانات لعرضها</td></tr>
               ) : holdings.map((h) => {
                 const isProfit = (h.pnl ?? 0) >= 0;
                 const isOvervalued = (h.premiumDiscountPercent ?? 0) > 10;
                 const isUndervalued = (h.premiumDiscountPercent ?? 0) < -10;
                 
                 let valColor = "text-gray-400";
                 if (isOvervalued) valColor = "text-orange-500";
                 else if (isUndervalued) valColor = "text-[#0FF0FC]";

                 return (
                   <tr key={h.id} className="hover:bg-white/5 transition-colors">
                     <td className="px-4 py-3">
                       <Link href={`/asset/${h.assetId}`} className="flex items-center gap-3 group">
                         <AssetImage image={h.asset?.image || ''} name={h.asset?.name || ''} type={h.asset?.type as 'TEAM' | 'PLAYER'} width={32} height={32} className="w-8 h-8" />
                         <div>
                           <p className="font-bold text-white group-hover:text-[#0FF0FC] transition-colors">{h.asset?.name}</p>
                           <p className="text-[10px] text-gray-500">{h.asset?.type}</p>
                         </div>
                       </Link>
                     </td>
                     <td className="px-4 py-3 text-center font-mono text-white">{h.quantity}</td>
                     <td className="px-4 py-3 text-center font-mono text-gray-400">{h.avg_buy_price} ¢</td>
                     <td className="px-4 py-3 text-center font-mono font-bold text-white">{h.tradePrice} ¢</td>
                     <td className="px-4 py-3 text-center font-mono text-gray-400">{h.fairValue} ¢</td>
                     <td className={`px-4 py-3 text-center font-mono font-bold ${valColor}`}>
                       {(h.premiumDiscountPercent ?? 0) > 0 ? '+' : ''}{(h.premiumDiscountPercent ?? 0).toFixed(1)}%
                     </td>
                     <td className="px-4 py-3 text-center font-mono font-bold text-white">{h.currentValue} ¢</td>
                     <td className={`px-4 py-3 text-center font-mono font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                       {isProfit ? '+' : ''}{h.pnl} ¢
                     </td>
                     <td className={`px-4 py-3 text-center font-mono font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                       {isProfit ? '+' : ''}{(h.pnlPercent ?? 0).toFixed(2)}%
                     </td>
                     <td className="px-4 py-3 text-center font-mono text-blue-400">{h.momentum}</td>
                     <td className="px-4 py-3 text-center font-mono text-purple-400">{h.marketDemand}</td>
                     <td className="px-4 py-3 text-center font-mono text-orange-400">{h.volatilityScore}</td>
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
