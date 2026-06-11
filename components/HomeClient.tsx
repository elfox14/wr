'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import {
  ArrowLeft,
  Calendar,
  Globe,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

type AcademyArticle = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  readingTime?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  imageUrl?: string;
  date?: string;
};

export default function HomeClient({
  initialAssets,
  upcomingMatches = [],
  assetsCount = 0,
  playersCount = 0,
  teamsCount = 0,
  upcomingMatchesCount = 0,
  academyArticles = [],
}: {
  initialAssets: any[];
  usersCount?: number;
  tradeVolume?: number;
  executedTrades?: number;
  upcomingMatches?: any[];
  assetsCount?: number;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  recentTransactions?: any[];
  mostTradedAssets?: any[];
  topDemandAssets?: any[];
  topMomentumAssets?: any[];
  undervaluedAssets?: any[];
  academyArticles?: AcademyArticle[];
}) {
  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });
  }, [initialAssets]);

  const safeAssets = Array.isArray(initialAssets) ? initialAssets : [];
  const nextMatch = upcomingMatches[0] || null;

  const findTeamAsset = (team: any) => {
    const teamName = team?.name || team?.teamName || '';
    const teamId = team?.id || team?.teamId;
    return safeAssets.find((asset) => {
      if (asset.type !== 'TEAM') return false;
      if (teamId && (asset.id === teamId || asset.externalId === teamId)) return true;
      return teamName && String(asset.name || '').toLowerCase() === String(teamName).toLowerCase();
    });
  };

  const renderMatchTeamLogo = (team: any) => {
    const matchedAsset = findTeamAsset(team);
    return (
      <AssetImage
        image={team?.image || team?.logo || team?.badge || team?.flag || matchedAsset?.image}
        name={team?.name || team?.teamName || matchedAsset?.name || 'Team'}
        type="TEAM"
        width={54}
        height={54}
        className="h-14 w-14 rounded-full border border-white/10 bg-black/40 object-cover shadow-[0_0_18px_rgba(15,240,252,0.12)]"
      />
    );
  };

  const quickStats = [
    { label: 'منتخب', value: teamsCount || 48, icon: Globe, tone: 'text-emerald-300' },
    { label: 'لاعب', value: playersCount || 1244, icon: Users, tone: 'text-[#0FF0FC]' },
    { label: 'أصل', value: assetsCount || safeAssets.length, icon: Wallet, tone: 'text-[#FFD700]' },
    { label: 'مباراة', value: upcomingMatchesCount, icon: Calendar, tone: 'text-rose-300' },
  ];

  const gatewayCards = [
    {
      title: 'المنتخبات',
      text: 'صفحات مختصرة لكل منتخب: بطاقة، مجموعة، نجوم، نقاط قوة وضعف.',
      href: '/market?type=TEAM',
      action: 'استكشف المنتخبات',
      tone: 'border-emerald-400/20 bg-emerald-400/[0.045] text-emerald-300',
    },
    {
      title: 'اللاعبون',
      text: 'تقييمات وأسعار افتراضية ومقارنة سريعة بين أبرز الأسماء.',
      href: '/market?type=PLAYER',
      action: 'تقييمات اللاعبين',
      tone: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.045] text-[#0FF0FC]',
    },
    {
      title: 'التحليل الكروي',
      text: 'أداء، أسلوب لعب، زخم، مؤشرات فنية وملخصات قابلة للتحويل لإنفوجرافيك.',
      href: '/team-intelligence',
      action: 'افتح التحليل',
      tone: 'border-violet-400/20 bg-violet-400/[0.045] text-violet-300',
    },
    {
      title: 'البورصة الافتراضية',
      text: 'سوق تعليمي افتراضي بالكامل مبني على الأداء والطلب داخل المنصة.',
      href: '/market',
      action: 'راقب السوق',
      tone: 'border-[#FFD700]/20 bg-[#FFD700]/[0.045] text-[#FFD700]',
    },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-16 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">
              بورصة إم سي للمونديال
            </p>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">
              منصة تحليلات وإحصائيات رياضية مع تجربة تداول افتراضية للمونديال
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
              تابع بيانات المنتخبات واللاعبين، اقرأ التحليلات الكروية، وجرّب سوق بورصة المونديال بأرصدة افتراضية فقط لفهم حركة الأسعار والزخم بدون أي معاملات مالية حقيقية.
            </p>
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-400">Next Impact</p>
                <h2 className="text-xl font-black text-white">المباراة القادمة</h2>
              </div>
              <Calendar className="text-[#0FF0FC]" size={22} />
            </div>

            {nextMatch ? (
              <Link href="/matches" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-[#0FF0FC]/35">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {renderMatchTeamLogo(nextMatch.homeTeam)}
                    <p className="max-w-[8rem] truncate text-xs font-black text-white">{nextMatch.homeTeam?.name || '—'}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-sm font-black text-[#FFD700]">×</div>
                  <div className="flex flex-col items-center gap-2">
                    {renderMatchTeamLogo(nextMatch.awayTeam)}
                    <p className="max-w-[8rem] truncate text-xs font-black text-white">{nextMatch.awayTeam?.name || '—'}</p>
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-gray-400">{nextMatch.matchDate ? new Date(nextMatch.matchDate).toLocaleString('ar-EG') : 'موعد غير محدد'}</p>
                <p className="mx-auto mt-3 flex w-fit rounded-full bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-bold text-[#0FF0FC]">تؤثر على الزخم والسعر</p>
              </Link>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-gray-400">لا توجد مباريات مجدولة حاليًا. افتح صفحة المباريات عند تحديث الجدول.</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Icon size={16} className={stat.tone} />
                      <span className="text-[10px] font-bold text-gray-500">{stat.label}</span>
                    </div>
                    <p className="font-mono text-xl font-black text-white">{Number(stat.value || 0).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative mt-5 rounded-[1.6rem] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm leading-7 text-emerald-100 md:flex md:items-center md:justify-between md:gap-4">
          <h2 className="mb-1 shrink-0 font-black text-white md:mb-0">تنبيه مهم</h2>
          <p className="md:text-left">كل الأرصدة Virtual Credits فقط. لا توجد مراهنات، كريبتو، سحب أرباح، أو معاملات مالية حقيقية.</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {gatewayCards.map((card) => (
          <Link key={card.title} href={card.href} className={`group rounded-2xl border px-4 py-3 shadow-card transition hover:-translate-y-0.5 hover:border-white/25 ${card.tone}`}>
            <h2 className="text-lg font-black text-white">{card.title}</h2>
            <p className="mt-2 min-h-[48px] text-xs leading-6 text-gray-300">{card.text}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-white group-hover:text-[#0FF0FC]">
              {card.action} <ArrowLeft size={13} />
            </p>
          </Link>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-gray-400">Academy Articles</p>
            <h2 className="text-2xl font-black text-white">من الأكاديمية</h2>
          </div>
          <Link href="/articles" className="rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">عرض كل المقالات</Link>
        </div>

        {academyArticles.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-gray-400">سيتم عرض مقالات الأكاديمية هنا عند إضافتها.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {academyArticles.map((article) => (
              <Link key={article.id} href={`/article/${article.id}`} className="group flex min-h-[170px] flex-col rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-[#0FF0FC]/35 hover:bg-[#0FF0FC]/5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">{article.category}</span>
                  {article.readingTime && <span className="text-[10px] font-bold text-gray-500">{article.readingTime}</span>}
                </div>
                <h3 className="line-clamp-2 text-base font-black leading-7 text-white group-hover:text-[#0FF0FC]">{article.title}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-6 text-gray-400">{article.excerpt}</p>
                <p className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-black text-white group-hover:text-[#0FF0FC]">
                  اقرأ المقال <ArrowLeft size={13} />
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-red-500/20 bg-red-500/10 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 shrink-0 text-red-200" size={22} />
            <div>
              <h2 className="font-black text-white">تنبيه الثقة والامتثال</h2>
              <p className="mt-1 text-sm leading-7 text-red-100">
                WorldCup Exchange لعبة تحليل وبورصة رياضية افتراضية. كل الأرصدة Virtual Credits فقط، ولا يوجد ربط بأموال حقيقية أو مراهنات أو سحب أو كريبتو.
              </p>
            </div>
          </div>
          <Link href="/methodology" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15">
            اقرأ المنهجية <ArrowLeft size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
