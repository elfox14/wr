'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Navbar } from '@/components/ui/Navbar';
import { Wallet, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';

export default function PortfolioPage() {
  const { holdings, userStats, fetchPortfolio } = useStore();

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  if (!userStats) return <div className="min-h-screen bg-[#121212] text-white p-10">جاري التحميل...</div>;

  const totalProfitPercent = userStats.total_holdings_value > 0 
    ? (userStats.total_profit / userStats.total_holdings_value) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-[#FFD700] mb-8 flex items-center gap-3">
          <Briefcase size={28} /> محفظتك الاستثمارية
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#1A1A1A] p-6 rounded-2xl border border-white/5 shadow-lg">
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest flex items-center gap-2"><Wallet size={16}/> الرصيد النقدي</p>
            <p className="text-3xl font-mono font-bold text-white">{userStats.balance} ¢</p>
          </div>
          <div className="bg-[#1A1A1A] p-6 rounded-2xl border border-white/5 shadow-lg">
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest">إجمالي الأصول</p>
            <p className="text-3xl font-mono font-bold text-white">{userStats.total_holdings_value} ¢</p>
          </div>
          <div className={`p-6 rounded-2xl border shadow-lg ${userStats.total_profit >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest">صافي الأرباح</p>
            <div className="flex items-end gap-3">
              <p className={`text-3xl font-mono font-bold ${userStats.total_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {userStats.total_profit >= 0 ? '+' : ''}{userStats.total_profit} ¢
              </p>
              <p className={`text-lg font-bold mb-1 flex items-center ${userStats.total_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {userStats.total_profit >= 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                {Math.abs(totalProfitPercent).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">الأصول المملوكة</h2>
        <div className="bg-[#1A1A1A] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/10 text-gray-400 text-sm tracking-wider uppercase">
                  <th className="p-4 font-medium">الأصل</th>
                  <th className="p-4 font-medium text-center">الكمية</th>
                  <th className="p-4 font-medium">متوسط التكلفة</th>
                  <th className="p-4 font-medium">السعر الحالي</th>
                  <th className="p-4 font-medium">الربح/الخسارة</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const isUp = h.profitLoss && h.profitLoss >= 0;
                  return (
                    <tr key={h.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 flex items-center gap-4">
                        <span className="text-3xl">{h.asset?.image}</span>
                        <div>
                          <Link href={`/asset/${h.assetId}`} className="font-bold text-white text-lg hover:text-[#0FF0FC] transition-colors">{h.asset?.name}</Link>
                          <p className="text-xs text-gray-500 font-mono">{h.asset?.code}</p>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-xl text-center">
                        {h.quantity}
                      </td>
                      <td className="p-4 font-mono text-gray-400">
                        {h.avg_buy_price.toFixed(0)} ¢
                      </td>
                      <td className="p-4 font-mono font-bold">
                        {h.asset?.current_price} ¢
                      </td>
                      <td className="p-4">
                        <div className={`font-mono font-bold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                          <p>{isUp ? '+' : ''}{h.profitLoss?.toFixed(0)} ¢</p>
                          <p className="text-xs flex items-center gap-1">
                            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {Math.abs(h.profitLossPercent || 0).toFixed(2)}%
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {holdings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">لا تمتلك أي أصول حالياً. اذهب إلى <Link href="/market" className="text-[#0FF0FC] underline">السوق</Link> للبدء.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
