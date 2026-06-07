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
import { PortfolioAnalyticsDashboard } from '@/components/portfolio/PortfolioAnalyticsDashboard';

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

        {/* The new professional analytics dashboard */}
        <PortfolioAnalyticsDashboard />

        <div className="mt-12 mb-12">
          <PortfolioCharts holdings={holdings} />
        </div>

        {/* The 4-Slot Pitch */}
        <div className="mb-12">
          <PitchPortfolio 
            playerHoldings={holdings.filter(h => h.asset?.type === 'PLAYER')}
            captainId={captainId}
            setCaptain={setCaptain}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TransactionHistory />
          <AchievementsList achievements={achievements} />
        </div>
      </main>
    </div>
  );
}
