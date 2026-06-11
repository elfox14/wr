'use client';

import { useEffect, useState } from 'react';
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
  level?: string;
  imageUrl?: string;
  date?: string;
};

function normalizeGroupKey(value?: string | null): string {
  if (!value) return 'غير محددة';
  return value
    .replace('Group', '')
    .replace('المجموعة', '')
    .trim()
    .toUpperCase();
}

function groupHref(value?: string | null): string {
  const key = normalizeGroupKey(value);
  return `/groups#group-${encodeURIComponent(key)}`;
}

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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });
  }, [initialAssets]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  const getTeamHref = (team: any) => {
    const matchedAsset = findTeamAsset(team);
    return matchedAsset?.id ? `/asset/${matchedAsset.id}` : '/market?type=TEAM';
  };

  const renderMatchTeamLogo = (team: any) => {
    const matchedAsset = findTeamAsset(team);
    return (
      <Link href={getTeamHref(team)} className="rounded-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/40" title={`صفحة ${team?.name || matchedAsset?.name || 'المنتخب'}`}>
        <AssetImage
          image={team?.image || team?.logo || team?.badge || team?.flag || matchedAsset?.image}
          name={team?.name || team?.teamName || matchedAsset?.name || 'Team'}
          type="TEAM"
          width={54}
          height={54}
          className="h-14 w-14 rounded-full border border-white/10 bg-black/40 object-cover shadow-[0_0_18px_rgba(15,240,252,0.12)] hover:border-[#0FF0FC]/50"
        />
      </Link>
    );
  };

  const getCountdown = () => {
    if (!nextMatch?.matchDate) return null;
    const diff = new Date(nextMatch.matchDate).getTime() - now;
    if (diff <= 0) return null;

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      { label: 'يوم', value: days },
      { label: 'ساعة', value: hours },
      { label: 'دقيقة', value: minutes },
      { label: 'ثانية', value: seconds },
    ];
  };

  const countdown = getCountdown();
  const matchGroup = normalizeGroupKey(nextMatch?.groupPhase || nextMatch?.group || nextMatch?.homeTeam?.group || nextMatch?.awayTeam?.group);

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
                <p className="text-xs font-black text-gray-500">المباراة القادمة</p>
                <h2 className="mt-1 text-xl font-black text-white">{nextMatch ? 'مباراة قادمة' : 'جدول المباريات'}</h2>
              </div>
              <ShieldCheck className="text-[#0FF0FC]" size={30} />
            </div>
            {nextMatch ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="flex flex-col items-center gap-2 text-center">
                    {renderMatchTeamLogo(nextMatch.homeTeam)}
                    <Link href={getTeamHref(nextMatch.homeTeam)} className="text-xs font-black text-white transition hover:text-[#0FF0FC]">
                      {nextMatch.homeTeam?.name || 'الفريق الأول'}
                    </Link>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Link href={groupHref(matchGroup)} className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/20 hover:text-white" title={`اذهب إلى المجموعة ${matchGroup}`}>
                      المجموعة {matchGroup}
                    </Link>
                    <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-black text-[#FFD700]">VS</div>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    {renderMatchTeamLogo(nextMatch.awayTeam)}
                    <Link href={getTeamHref(nextMatch.awayTeam)} className="text-xs font-black text-white transition hover:text-[#0FF0FC]">
                      {nextMatch.awayTeam?.name || 'الفريق الثاني'}
                    </Link>
                  </div>
                </div>
                <div className="text-center text-xs font-bold text-gray-400">{new Date(nextMatch.matchDate).toLocaleString('ar-EG')}</div>
                {countdown ? (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {countdown.map((item) => (
                      <div key={item.label} className="rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.06] px-2 py-2 text-center">
                        <div className="font-mono text-lg font-black leading-none text-white tabular-nums">{String(item.value).padStart(2, '0')}</div>
                        <div className="mt-1 text-[10px] font-bold text-[#0FF0FC]">{item.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center text-xs font-black text-emerald-200">بدأت أو اقتربت المباراة</div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-gray-400">سيظهر هنا أقرب لقاء بعد مزامنة جدول المباريات.</div>
            )}

            <div className="mt-3 grid grid-cols-4 gap-2">
              {quickStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/30 px-2 py-2 text-center">
                  <div className="text-lg font-black leading-none text-white tabular-nums">{stat.value}</div>
                  <div className="mt-1 text-[10px] font-bold text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {gatewayCards.map((card) => (
          <Link key={card.href} href={card.href} className={`group rounded-3xl border p-5 transition hover:-translate-y-1 ${card.tone}`}>
            <h3 className="text-xl font-black text-white">{card.title}</h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-gray-400">{card.text}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-black">
              {card.action} <ArrowLeft size={16} className="transition group-hover:-translate-x-1" />
            </div>
          </Link>
        ))}
      </section>

      {academyArticles.length > 0 && (
        <section className="rounded-[2rem] border border-white/10 bg-surface p-5 shadow-card md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#0FF0FC]">MC PRIME ACADEMY</p>
              <h2 className="mt-1 text-2xl font-black text-white">أكاديمية بورصة المونديال</h2>
            </div>
            <Link href="/articles" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">كل المقالات</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {academyArticles.map((article) => (
              <Link key={article.id} href={`/article/${article.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-[#0FF0FC]/40 hover:bg-white/[0.06]">
                <div className="mb-3 text-[11px] font-black text-[#FFD700]">{article.category}</div>
                <h3 className="line-clamp-2 font-black text-white">{article.title}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-400">{article.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
