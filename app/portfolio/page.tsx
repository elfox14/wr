'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AlertCircle, ArrowLeft, Briefcase, Loader2, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PortfolioCharts } from '@/components/portfolio/PortfolioCharts';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { AchievementsList } from '@/components/portfolio/AchievementsList';
import { PitchPortfolio } from '@/components/portfolio/PitchPortfolio';
import { PortfolioAnalyticsDashboard } from '@/components/portfolio/PortfolioAnalyticsDashboard';

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
      } catch (error: any) {
        if (mounted) setLoadError(error?.message || 'تعذر تحميل المحفظة.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPortfolio();
    return () => {
      mounted = false;
    };
  }, [fetchPortfolio]);

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

        <PortfolioAnalyticsDashboard />

        <div className="mt-12 mb-12">
          <PortfolioCharts holdings={holdings} />
        </div>

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
