'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AlertCircle, ArrowLeft, Briefcase, Loader2, PieChart, ShoppingCart, TrendingUp, Trophy, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PortfolioCharts } from '@/components/portfolio/PortfolioCharts';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { AchievementsList } from '@/components/portfolio/AchievementsList';
import { PitchPortfolio } from '@/components/portfolio/PitchPortfolio';
import { PortfolioAnalyticsDashboard } from '@/components/portfolio/PortfolioAnalyticsDashboard';
import { AIPortfolioInsights } from '@/features/analysis/components/AIPortfolioInsights';

function formatCoins(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString()}¢`;
}

export default function PortfolioPage() {
  const { holdings, userStats, captainId, achievements, fetchPortfolio, setCaptain } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPortfolio() {
      setIsLoading(true);
      setLoadError(null);
      try {
        await fetchPortfolio();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'تعذر تحميل المحفظة.';
        if (mounted) setLoadError(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPortfolio();
    return () => {
      mounted = false;
    };
  }, [fetchPortfolio]);

  const mobileSummary = useMemo(() => {
    const balance = Number(userStats?.balance || 0);
    const holdingsValue = Number(userStats?.total_holdings_value || 0);
    const netWorth = Number(userStats?.net_worth || balance + holdingsValue);
    const profit = Number(userStats?.total_profit || 0);
    const holdingsCount = holdings.length;
    const profitPercent = holdingsValue > 0 ? (profit / holdingsValue) * 100 : 0;
    return { balance, holdingsValue, netWorth, profit, profitPercent, holdingsCount };
  }, [userStats, holdings.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-white p-10 flex flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="animate-spin text-primary" size={34} />
        <p className="font-black">جاري تحميل المحفظة...</p>
      </div>
    );
  }

  if (!userStats) {
    return (
      <div className="min-h-screen bg-background text-white p-6 flex items-center justify-center">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-surface p-6 text-center shadow-card">
          <AlertCircle className="mx-auto mb-4 text-yellow-400" size={42} />
          <h1 className="text-2xl font-black">تعذر عرض المحفظة</h1>
          <p className="mt-3 text-sm leading-7 text-gray-400">
            {loadError || 'قد تحتاج إلى تسجيل الدخول أولًا، أو أن جلسة الدخول انتهت.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/login" className="rounded-2xl bg-primary px-6 py-3 text-sm font-black text-black hover:bg-primary/90">
              تسجيل الدخول
            </Link>
            <Link href="/market" className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-black text-white hover:bg-white/10">
              العودة للسوق
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
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

        <section className="mb-6 lg:hidden rounded-[1.7rem] border border-primary/20 bg-gradient-to-br from-primary/12 via-white/[0.04] to-accent/10 p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-primary">MOBILE PORTFOLIO SNAPSHOT</p>
              <h2 className="mt-1 text-2xl font-black text-white">ملخص المحفظة</h2>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Wallet size={22} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] text-gray-400">صافي الثروة</p>
              <p className="mt-1 text-xl font-black text-white tabular-nums">{formatCoins(mobileSummary.netWorth)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] text-gray-400">الرصيد المتاح</p>
              <p className="mt-1 text-xl font-black text-accent tabular-nums">{formatCoins(mobileSummary.balance)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] text-gray-400">قيمة الأصول</p>
              <p className="mt-1 text-xl font-black text-primary tabular-nums">{formatCoins(mobileSummary.holdingsValue)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] text-gray-400">الربح/الخسارة</p>
              <p className={`mt-1 text-xl font-black tabular-nums ${mobileSummary.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                {mobileSummary.profit >= 0 ? '+' : ''}{formatCoins(mobileSummary.profit)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/market" className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black active:scale-[0.98]"><ShoppingCart size={17} /> السوق</Link>
            <Link href="/leaderboard" className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white active:scale-[0.98]"><TrendingUp size={17} /> الترتيب</Link>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><PieChart size={14} /> عدد الأصول</span>
            <span className="font-black text-white">{mobileSummary.holdingsCount}</span>
          </div>
        </section>

        <AIPortfolioInsights holdings={holdings} userStats={userStats} />

        <PortfolioAnalyticsDashboard />

        <div className="mt-8 mb-8 lg:mt-12 lg:mb-12">
          <PortfolioCharts holdings={holdings} />
        </div>

        <div className="mb-8 lg:mb-12">
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
