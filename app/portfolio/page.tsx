'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Navbar } from '@/components/ui/Navbar';
import { Wallet, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import { TradingCard } from '@/components/ui/TradingCard';

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
        <div className="bg-[#1A1A1A] p-6 border border-white/10 rounded-2xl shadow-2xl">
          {holdings.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-xl mb-4">لا تمتلك أي أصول حالياً.</p>
              <Link href="/market" className="bg-[#0FF0FC]/10 text-[#0FF0FC] border border-[#0FF0FC]/30 px-6 py-3 rounded-xl font-bold hover:bg-[#0FF0FC]/20 transition-all">
                اذهب إلى السوق للبدء
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {holdings.map(h => (
                <TradingCard 
                  key={h.id} 
                  asset={h.asset!} 
                  holding={{
                    quantity: h.quantity,
                    avg_buy_price: h.avg_buy_price,
                    positionType: h.positionType,
                    profitLoss: h.profitLoss,
                    profitLossPercent: h.profitLossPercent
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
