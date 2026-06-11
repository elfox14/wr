'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import {
  ArrowLeft,
  Brain,
  Calendar,
  Coins,
  Globe,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';

export default function HomeClient({
  initialAssets,
  usersCount = 0,
  tradeVolume = 0,
  executedTrades = 0,
  upcomingMatches = [],
  assetsCount = 0,
  playersCount = 0,
  teamsCount = 0,
  upcomingMatchesCount = 0,
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
}) {
  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });
  }, [initialAssets]);

  const safeAssets = Array.isArray(initialAssets) ? initialAssets : [];
  const featuredAssets = [
    ...safeAssets.filter((asset) => asset.type === 'TEAM').slice(0, 3),
    ...safeAssets.filter((asset) => asset.type === 'PLAYER').slice(0, 3),
  ].slice(0, 6);
  const nextMatch = upcomingMatches[0] || null;

  const formatCoins = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M¢`;
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K¢`;
    return `${Number(value || 0).toLocaleString()}¢`;
  };

  const renderAvatar = (asset: any, size = 38) => (
    <AssetImage
      image={asset?.image}
      name={asset?.name || 'Asset'}
      type={asset?.type || 'TEAM'}
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-white/10 bg-black/40 object-cover"
    />
  );

  const scoreOf = (asset: any) => Math.round(asset?.score ?? asset?.fundamental ?? asset?.momentum ?? 50);
  const priceOf = (asset: any) => Math.round(asset?.marketPrice ?? asset?.current_price ?? 0);

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
      icon: Trophy,
      tone: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300',
    },
    {
      title: 'اللاعبون',
      text: 'تقييمات وأسعار افتراضية ومقارنة سريعة بين أبرز الأسماء.',
      href: '/market?type=PLAYER',
      action: 'تقييمات اللاعبين',
      icon: Users,
      tone: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.06] text-[#0FF0FC]',
    },
    {
      title: 'التحليل الكروي',
      text: 'أداء، أسلوب لعب، زخم، مؤشرات فنية وملخصات قابلة للتحويل لإنفوجرافيك.',
      href: '/team-intelligence',
      action: 'افتح التحليل',
      icon: Brain,
      tone: 'border-violet-400/20 bg-violet-400/[0.06] text-violet-300',
    },
    {
      title: 'البورصة الافتراضية',
      text: 'سوق تعليمي افتراضي بالكامل مبني على الأداء والطلب داخل المنصة.',
      href: '/market',
      action: 'راقب السوق',
      icon: TrendingUp,
      tone: 'border-[#FFD700]/20 bg-[#FFD700]/[0.06] text-[#FFD700]',
    },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-16 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">
              <Sparkles size={15} /> بوابة مونديال 2026
            </p>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">
              بورصة المونديال: تحليل سريع + سوق افتراضي واضح
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
              الصفحة الرئيسية أصبحت أقصر ومباشرة: مؤشرات حقيقية، روابط دخول سريعة، والمباراة القادمة بدل مساحة كبيرة بلا قيمة.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black transition hover:bg-[#70f7ff]">
                <Brain size={18} /> ابدأ بالتحليل
              </Link>
              <Link href="/market" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15">
                <TrendingUp size={18} /> ادخل السوق
              </Link>
              <Link href="/matches" className="inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-5 py-3 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">
                مباريات مؤثرة <ArrowLeft size={16} />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[1.6rem] border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-400">Next Impact</p>
                  <h2 className="text-xl font-black text-white">المباراة القادمة المؤثرة</h2>
                </div>
                <Calendar className="text-[#0FF0FC]" size={22} />
              </div>
              {nextMatch ? (
                <Link href="/matches" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-[#0FF0FC]/35">
                  <p className="text-base font-black text-white">{nextMatch.homeTeam?.name || '—'} × {nextMatch.awayTeam?.name || '—'}</p>
                  <p className="mt-2 text-xs text-gray-400">{nextMatch.matchDate ? new Date(nextMatch.matchDate).toLocaleString('ar-EG') : 'موعد غير محدد'}</p>
                  <p className="mt-3 inline-flex rounded-full bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-bold text-[#0FF0FC]">تؤثر على الزخم والسعر</p>
                </Link>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-gray-400">لا توجد مباريات مجدولة حاليًا. افتح صفحة المباريات عند تحديث الجدول.</p>
              )}
            </div>

            <div className="rounded-[1.6rem] border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm leading-7 text-emerald-100">
              <h2 className="mb-2 font-black text-white">تنبيه مهم</h2>
              كل الأرصدة Virtual Credits فقط. لا توجد مراهنات، كريبتو، سحب أرباح، أو معاملات مالية حقيقية.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {gatewayCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className={`group rounded-[1.7rem] border p-5 shadow-card transition hover:-translate-y-1 hover:border-white/25 ${card.tone}`}>
              <div className="mb-5 flex items-center justify-between">
                <Icon size={26} />
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/80">دخول سريع</span>
              </div>
              <h2 className="text-2xl font-black text-white">{card.title}</h2>
              <p className="mt-3 min-h-[72px] text-sm leading-7 text-gray-300">{card.text}</p>
              <p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white group-hover:text-[#0FF0FC]">
                {card.action} <ArrowLeft size={15} />
              </p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-gray-400">Featured Assets</p>
              <h2 className="text-2xl font-black text-white">منتخبات ولاعبون تحت المتابعة</h2>
            </div>
            <Link href="/market" className="rounded-2xl bg-[#0FF0FC] px-4 py-2 text-xs font-black text-black transition hover:bg-[#70f7ff]">عرض الكل</Link>
          </div>

          {featuredAssets.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-gray-400">سيظهر هذا القسم بعد جلب بيانات البطولة.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {featuredAssets.map((asset) => (
                <Link key={asset.id} href={`/asset/${asset.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 transition hover:border-[#0FF0FC]/35 hover:bg-[#0FF0FC]/5">
                  <div className="flex min-w-0 items-center gap-3">
                    {renderAvatar(asset, 36)}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{asset.name}</p>
                      <p className="text-xs text-gray-500">{asset.type === 'TEAM' ? 'منتخب' : asset.position || 'لاعب'}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-sm font-black text-white">{priceOf(asset).toLocaleString()}¢</p>
                    <p className="text-xs text-gray-500">Score {scoreOf(asset)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
            <h2 className="mb-4 text-xl font-black text-white">نشاط مختصر</h2>
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">متداولون</p><p className="mt-1 text-xl font-black text-white">{usersCount.toLocaleString()}</p></div>
              <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">حجم افتراضي</p><p className="mt-1 text-xl font-black text-white">{formatCoins(tradeVolume)}</p></div>
              <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">صفقات</p><p className="mt-1 text-xl font-black text-white">{executedTrades.toLocaleString()}</p></div>
              <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">نوع السوق</p><p className="mt-1 text-sm font-black text-white">افتراضي</p></div>
            </div>
          </div>
        </div>
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
