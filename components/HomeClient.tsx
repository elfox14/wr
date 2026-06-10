'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Brain,
  Calendar,
  Coins,
  Flame,
  Gauge,
  Globe,
  LineChart,
  Medal,
  PieChart,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
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
  recentTransactions = [],
  mostTradedAssets = [],
  topDemandAssets = [],
  topMomentumAssets = [],
  undervaluedAssets = [],
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
  const [topUsers, setTopUsers] = useState<any[]>([]);

  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => setTopUsers((data.leaderboard || []).slice(0, 3)))
      .catch(() => setTopUsers([]));
  }, [initialAssets]);

  const safeAssets = Array.isArray(initialAssets) ? initialAssets : [];
  const featuredTeams = safeAssets.filter((asset) => asset.type === 'TEAM').slice(0, 4);
  const featuredPlayers = safeAssets.filter((asset) => asset.type === 'PLAYER').slice(0, 4);
  const liveMarketAssets = [...topMomentumAssets, ...topDemandAssets, ...mostTradedAssets]
    .filter(Boolean)
    .filter((asset, index, arr) => arr.findIndex((item) => item.id === asset.id) === index)
    .slice(0, 6);
  const leadMomentum = topMomentumAssets[0] || liveMarketAssets[0] || null;
  const leadDemand = topDemandAssets[0] || liveMarketAssets[1] || null;
  const leadValue = undervaluedAssets[0] || liveMarketAssets[2] || null;
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

  const stats = [
    { label: 'منتخب مستهدف', value: teamsCount || 48, icon: Globe, tone: 'text-emerald-300' },
    { label: 'لاعب مستهدف', value: playersCount || 1244, icon: Users, tone: 'text-[#0FF0FC]' },
    { label: 'أصل داخل السوق', value: assetsCount || safeAssets.length, icon: PieChart, tone: 'text-[#FFD700]' },
    { label: 'مباراة مؤثرة', value: upcomingMatchesCount, icon: Calendar, tone: 'text-rose-300' },
    { label: 'متداول', value: usersCount, icon: Wallet, tone: 'text-violet-300' },
    { label: 'صفقة افتراضية', value: executedTrades, icon: Activity, tone: 'text-orange-300' },
  ];

  const sportsFactors = [
    { title: 'Team Score', text: 'تقييم قوة المنتخب من جودة التشكيلة، النتائج، التاريخ، والزخم.', icon: Trophy },
    { title: 'Player Rating', text: 'تقييم اللاعب حسب المركز، الدقائق، الأهداف، الأسيست، والكروت.', icon: Medal },
    { title: 'Momentum', text: 'زخم يتغير بعد كل حدث: هدف، أسيست، إصابة، كارت، أو أداء استثنائي.', icon: Flame },
    { title: 'Match Impact', text: 'كل مباراة قد تغيّر السعر الافتراضي للاعب أو المنتخب داخل السوق.', icon: Target },
  ];

  const economyFactors = [
    { title: 'Virtual Credits', text: 'كل الرصيد داخل اللعبة افتراضي فقط ولا يمثل مالًا حقيقيًا.', icon: Coins },
    { title: 'Market Demand', text: 'الطلب داخل المنصة يؤثر على السعر بجانب الأداء الرياضي.', icon: TrendingUp },
    { title: 'Portfolio', text: 'ابنِ محفظتك من منتخبات ولاعبين وتابع نموها خلال البطولة.', icon: Wallet },
    { title: 'Rewards', text: 'اكسب أرصدة افتراضية من الإنجازات، الإحالات، والمكافآت.', icon: Zap },
  ];

  const intelligenceCards = [
    {
      title: 'أقوى زخم الآن',
      asset: leadMomentum,
      metric: leadMomentum ? `Momentum ${Math.round(leadMomentum.momentum || scoreOf(leadMomentum))}/100` : 'بانتظار البيانات',
      href: leadMomentum ? `/asset/${leadMomentum.id}` : '/market',
      icon: Flame,
      tone: 'text-[#0FF0FC] border-[#0FF0FC]/20 bg-[#0FF0FC]/10',
    },
    {
      title: 'طلب جماهيري مرتفع',
      asset: leadDemand,
      metric: leadDemand ? `Demand ${Math.round(leadDemand.marketDemand || scoreOf(leadDemand))}/100` : 'بانتظار البيانات',
      href: leadDemand ? `/asset/${leadDemand.id}` : '/market',
      icon: TrendingUp,
      tone: 'text-[#FFD700] border-[#FFD700]/20 bg-[#FFD700]/10',
    },
    {
      title: 'فرصة أقل من القيمة',
      asset: leadValue,
      metric: leadValue ? `${priceOf(leadValue).toLocaleString()}¢` : 'بانتظار البيانات',
      href: leadValue ? `/asset/${leadValue.id}` : '/market',
      icon: Target,
      tone: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10',
    },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-6 shadow-anti-gravity md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div>
            <div className="mb-6">
              <Image src="/brand/logo-horizontal.png" alt="MC PRIME Exchange" width={230} height={58} className="h-9 w-auto" priority />
            </div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">
              <Sparkles size={15} /> Football Intelligence Exchange
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
              غرفة تحليل المونديال قبل أي قرار في السوق
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-8 text-gray-300 md:text-lg">
              حلّل المنتخبات واللاعبين، افهم الزخم والقيمة العادلة وتأثير المباريات، ثم استخدم السوق الافتراضي كتطبيق عملي للتحليل — بأرصدة لعب فقط.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl bg-[#0FF0FC] px-6 py-3 text-sm font-black text-black transition hover:bg-[#70f7ff]">
                <Brain size={18} /> ابدأ من التحليل
              </Link>
              <Link href="/market" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15">
                <TrendingUp size={18} /> راقب السوق
              </Link>
              <Link href="/matches" className="inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-6 py-3 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700]/15">
                مباريات مؤثرة <ArrowLeft size={16} />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400">Intelligence Snapshot</p>
                <h2 className="text-xl font-black text-white">حالة المنصة الآن</h2>
              </div>
              <div className="rounded-2xl bg-[#0FF0FC]/10 p-3 text-[#0FF0FC]"><Gauge size={22} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <Icon size={18} className={stat.tone} />
                    <p className="mt-3 text-2xl font-black text-white">{Number(stat.value || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs leading-6 text-emerald-100">
              كل الأرصدة Virtual Credits فقط. لا يوجد تداول بأموال حقيقية، لا سحب أرباح، لا مراهنات، ولا كريبتو.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {intelligenceCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className={`rounded-[1.7rem] border p-5 shadow-card transition hover:-translate-y-1 hover:border-[#0FF0FC]/40 ${card.tone}`}>
              <div className="mb-4 flex items-center justify-between">
                <Icon size={24} />
                <span className="text-[11px] font-black uppercase tracking-wide">LIVE SIGNAL</span>
              </div>
              <p className="text-sm font-bold opacity-80">{card.title}</p>
              <h2 className="mt-1 truncate text-2xl font-black text-white">{card.asset?.name || 'غير متاح'}</h2>
              <p className="mt-2 text-sm font-black">{card.metric}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400">Analysis Flow</p>
              <h2 className="text-2xl font-black text-white">طريقة استخدام المنصة</h2>
            </div>
            <ShieldCheck className="text-emerald-300" size={28} />
          </div>
          <div className="space-y-3">
            {[
              ['01', 'اقرأ التقرير الفني', 'ابدأ من مركز التحليل لفهم قوة المنتخب أو اللاعب.'],
              ['02', 'قارن السعر بالقيمة', 'راجع القيمة العادلة، الزخم، الطلب، والمخاطرة.'],
              ['03', 'اتخذ قرارًا افتراضيًا', 'استخدم السوق والمحفظة كتجربة تعليمية وتحليلية فقط.'],
            ].map(([step, title, text]) => (
              <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0FF0FC]/10 text-sm font-black text-[#0FF0FC]">{step}</div>
                <div>
                  <p className="font-black text-white">{title}</p>
                  <p className="mt-1 text-xs leading-6 text-gray-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400">Live Market Board</p>
              <h2 className="text-2xl font-black text-white">نماذج من السوق</h2>
            </div>
            <Link href="/market" className="rounded-2xl bg-[#0FF0FC] px-4 py-2 text-xs font-black text-black hover:bg-[#70f7ff]">فتح السوق</Link>
          </div>

          {liveMarketAssets.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
              <AlertCircle className="mx-auto mb-3 text-gray-600" size={34} />
              <p className="text-sm font-bold text-gray-400">لا توجد بيانات سوق كافية بعد. بعد جلب المنتخبات واللاعبين ستظهر الأمثلة هنا.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {liveMarketAssets.map((asset) => (
                <Link key={asset.id} href={`/asset/${asset.id}`} className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-[#0FF0FC]/35 hover:bg-[#0FF0FC]/5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {renderAvatar(asset, 38)}
                      <div className="min-w-0">
                        <p className="truncate font-black text-white">{asset.name}</p>
                        <p className="text-xs text-gray-400">{asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-gray-300">{scoreOf(asset)}/100</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-white/5 p-2"><p className="text-gray-500">السعر</p><p className="font-black text-white">{priceOf(asset).toLocaleString()}¢</p></div>
                    <div className="rounded-xl bg-white/5 p-2"><p className="text-gray-500">زخم</p><p className="font-black text-[#0FF0FC]">{Math.round(asset.momentum || 0)}</p></div>
                    <div className="rounded-xl bg-white/5 p-2"><p className="text-gray-500">طلب</p><p className="font-black text-[#FFD700]">{Math.round(asset.marketDemand || 0)}</p></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.045] p-6 shadow-2xl md:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Brain size={14} /> Sports Intelligence</p>
              <h2 className="text-2xl font-black text-white md:text-3xl">القسم الرياضي التحليلي</h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">نحوّل أداء المنتخبات واللاعبين إلى مؤشرات رقمية قابلة للفهم والمقارنة.</p>
            </div>
            <LineChart className="text-[#0FF0FC]" size={34} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sportsFactors.map((factor) => {
              const Icon = factor.icon;
              return (
                <div key={factor.title} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <Icon className="mb-3 text-[#0FF0FC]" size={21} />
                  <h3 className="font-black text-white">{factor.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-gray-400">{factor.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#FFD700]/15 bg-[#FFD700]/[0.045] p-6 shadow-2xl md:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]"><Coins size={14} /> Virtual Economy</p>
              <h2 className="text-2xl font-black text-white md:text-3xl">قسم الاقتصاد والبورصة الرياضية</h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">تجربة سوق افتراضي تستفيد من التحليل الرياضي بدون أي تعامل مالي حقيقي.</p>
            </div>
            <Gauge className="text-[#FFD700]" size={34} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {economyFactors.map((factor) => {
              const Icon = factor.icon;
              return (
                <div key={factor.title} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <Icon className="mb-3 text-[#FFD700]" size={21} />
                  <h3 className="font-black text-white">{factor.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-gray-400">{factor.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">منتخبات ولاعبون تحت المتابعة</h2>
            <Link href="/market" className="text-sm font-black text-[#0FF0FC] hover:text-white">عرض الكل</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[...featuredTeams, ...featuredPlayers].slice(0, 8).map((asset) => (
              <Link key={asset.id} href={`/asset/${asset.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 transition hover:border-white/20">
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
            {safeAssets.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-gray-400 md:col-span-2">سيظهر هذا القسم بعد جلب بيانات البطولة.</p>}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="mb-5 text-2xl font-black text-white">المباريات المؤثرة</h2>
          <div className="space-y-3">
            {upcomingMatches.slice(0, 4).map((match: any) => (
              <Link key={match.id} href="/matches" className="block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-[#0FF0FC]/35">
                <p className="text-sm font-black text-white">{match.homeTeam?.name || '—'} × {match.awayTeam?.name || '—'}</p>
                <p className="mt-1 text-xs text-gray-400">{match.matchDate ? new Date(match.matchDate).toLocaleString('ar-EG') : 'موعد غير محدد'}</p>
                <p className="mt-2 inline-flex rounded-full bg-[#0FF0FC]/10 px-2 py-1 text-[10px] font-bold text-[#0FF0FC]">قد تؤثر على الزخم والسعر</p>
              </Link>
            ))}
            {upcomingMatches.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-gray-400">لا توجد مباريات مجدولة حاليًا.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="mb-4 text-xl font-black text-white">أعلى المتداولين</h2>
          <div className="space-y-3">
            {topUsers.map((user, index) => (
              <div key={user.id || index} className="flex items-center justify-between rounded-2xl bg-black/30 p-3">
                <div className="flex items-center gap-3"><span className="font-black text-[#FFD700]">#{index + 1}</span><span className="font-bold text-white">{user.name || user.username || 'متداول'}</span></div>
                <span className="text-xs text-gray-400">{formatCoins(user.portfolioValue || user.balance || 0)}</span>
              </div>
            ))}
            {topUsers.length === 0 && <p className="text-sm text-gray-400">سيظهر المتصدرون بعد نشاط المستخدمين.</p>}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="mb-4 text-xl font-black text-white">نشاط السوق</h2>
          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">حجم افتراضي</p><p className="mt-1 text-xl font-black text-white">{formatCoins(tradeVolume)}</p></div>
            <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">صفقات</p><p className="mt-1 text-xl font-black text-white">{executedTrades.toLocaleString()}</p></div>
            <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">تحركات حديثة</p><p className="mt-1 text-xl font-black text-white">{recentTransactions.length}</p></div>
            <div className="rounded-2xl bg-black/30 p-4"><p className="text-gray-500">مباراة قادمة</p><p className="mt-1 truncate text-sm font-black text-white">{nextMatch ? `${nextMatch.homeTeam?.name || '—'} × ${nextMatch.awayTeam?.name || '—'}` : '—'}</p></div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-red-500/20 bg-red-500/10 p-6">
          <h2 className="mb-3 text-xl font-black text-white">تنبيه الثقة والامتثال</h2>
          <p className="text-sm leading-7 text-red-100">
            WorldCup Exchange لعبة تحليل وبورصة رياضية افتراضية. كل الأرصدة Virtual Credits فقط، ولا يوجد ربط بأموال حقيقية أو مراهنات أو سحب أو كريبتو.
          </p>
        </div>
      </section>
    </main>
  );
}
