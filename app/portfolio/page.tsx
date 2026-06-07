'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Wallet, TrendingUp, TrendingDown, Briefcase, Trophy, ArrowLeft } from 'lucide-react';
import { StockCard } from '@/components/ui/StockCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { PortfolioCharts } from '@/components/portfolio/PortfolioCharts';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { AchievementsList } from '@/components/portfolio/AchievementsList';
import { PitchPortfolio } from '@/components/portfolio/PitchPortfolio';

export default function PortfolioPage() {
  const { holdings, userStats, captainId, achievements, fetchPortfolio, setCaptain } = useStore();

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  if (!userStats) return <div className="min-h-screen bg-background text-white p-10">جاري التحميل...</div>;

  const totalProfitPercent = userStats.total_holdings_value > 0 
    ? (userStats.total_profit / userStats.total_holdings_value) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
            
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader 
          title="محفظتك الاستثمارية"
          description="راقب أداء أصولك، وحلل أرباحك، وقم بإدارة استثماراتك في كأس العالم."
          icon={<Briefcase size={48} />}
          glowColor="bg-accent/10"
          textColor="text-accent"
        >
          <Link href="/leagues" className="bg-surface border border-primary/30 hover:bg-primary/10 text-primary px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-sm w-full md:w-auto justify-center">
            <Trophy size={18} /> دوريات التحدي <ArrowLeft size={16} />
          </Link>
        </PageHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-card hover:shadow-card-hover transition-shadow">
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest flex items-center gap-2"><Wallet size={16}/> الرصيد النقدي</p>
            <p className="text-3xl font-bold text-white tabular-nums">{userStats.balance} ¢</p>
          </div>
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-card hover:shadow-card-hover transition-shadow">
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest">إجمالي الأصول</p>
            <p className="text-3xl font-bold text-white tabular-nums">{userStats.total_holdings_value} ¢</p>
          </div>
          <div className={`p-6 rounded-2xl border shadow-card hover:shadow-card-hover transition-shadow ${userStats.total_profit >= 0 ? 'bg-success/10 border-success/30' : 'bg-danger/10 border-danger/30'}`}>
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest">صافي الأرباح</p>
            <div className="flex items-end gap-3">
              <p className={`text-3xl font-bold tabular-nums ${userStats.total_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                {userStats.total_profit >= 0 ? '+' : ''}{userStats.total_profit} ¢
              </p>
              <p className={`text-lg font-bold mb-1 flex items-center tabular-nums ${userStats.total_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                {userStats.total_profit >= 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                {Math.abs(totalProfitPercent).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        <PortfolioCharts holdings={holdings} />

        {/* The 4-Slot Pitch */}
        <PitchPortfolio 
          playerHoldings={holdings.filter(h => h.asset?.type === 'PLAYER')}
          captainId={captainId}
          setCaptain={setCaptain}
        />

        <h2 className="text-xl font-bold mb-4">أسهم المنتخبات</h2>
        <div className="bg-surface p-6 border border-white/5 rounded-2xl shadow-card mb-12">
          {holdings.filter(h => h.asset?.type === 'TEAM').length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-xl mb-4">لا تمتلك أي أسهم منتخبات حالياً.</p>
              <Link href="/market" className="bg-primary/10 text-primary border border-primary/30 px-6 py-3 rounded-xl font-bold hover:bg-primary/20 transition-all">
                اذهب إلى السوق للشراء
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {holdings.filter(h => h.asset?.type === 'TEAM').map(h => (
                <div key={h.id} className="relative">
                  <StockCard 
                    type="TEAM"
                    name={h.asset!.name}
                    code={h.asset!.code}
                    image={h.asset!.image}
                    score={h.asset!.score || 0}
                    price={h.asset!.current_price}
                    change={h.asset!.change}
                    fifaRank={h.asset!.fifaRank || undefined}
                    holding={{
                      quantity: h.quantity,
                      avg_buy_price: h.avg_buy_price,
                      positionType: h.positionType,
                      profitLoss: h.profitLoss,
                      profitLossPercent: h.profitLossPercent
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TransactionHistory />
          <AchievementsList achievements={achievements} />
        </div>
      </main>
    </div>
  );
}
