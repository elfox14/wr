'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import { ArrowLeft, Calendar, Clock, Globe, Radio, ShieldCheck, Users, Wallet } from 'lucide-react';

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
  return value.replace('Group', '').replace('المجموعة', '').trim().toUpperCase();
}

function groupHref(value?: string | null): string {
  return `/groups#group-${encodeURIComponent(normalizeGroupKey(value))}`;
}

function getAnimationMatchId(match: any) {
  return match?.animationMatchId || '';
}

function getAnimationHref(match: any) {
  const id = getAnimationMatchId(match);
  return id ? `/animation-live?matchId=${encodeURIComponent(String(id))}&lang=en&statsPanel=simple&teamPanel=1` : '/matches';
}

function isLiveStatus(match: any) {
  return ['IN_PLAY', 'LIVE'].includes(String(match?.status || '').toUpperCase());
}

function hasScore(match: any) {
  return Number(match?.homeScore || 0) > 0 || Number(match?.awayScore || 0) > 0;
}

function isCurrentMatchWindow(match: any, now: number) {
  if (!match?.matchDate) return false;
  const start = new Date(match.matchDate).getTime();
  if (!Number.isFinite(start)) return false;
  const diff = now - start;
  return diff >= 0 && diff <= 4 * 60 * 60 * 1000 && ['SCHEDULED', 'IN_PLAY', 'LIVE'].includes(String(match?.status || '').toUpperCase());
}

function shouldShowScore(match: any, now: number) {
  return Boolean(match) && (isLiveStatus(match) || isCurrentMatchWindow(match, now) || hasScore(match));
}

function scoreLabel(match: any) {
  return `${Number(match?.homeScore || 0)} - ${Number(match?.awayScore || 0)}`;
}

function formatMatchDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
}

function formatMatchTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'غير محدد';
}

function sortMatches(matches: any[]) {
  return [...matches].sort((a, b) => new Date(a?.matchDate || 0).getTime() - new Date(b?.matchDate || 0).getTime());
}

function pickFeaturedMatch(matches: any[], now: number) {
  const sortedMatches = sortMatches(matches);
  const liveMatch = sortedMatches.find((match) => isLiveStatus(match) || isCurrentMatchWindow(match, now));
  const futureMatch = sortedMatches.find((match) => match?.matchDate && new Date(match.matchDate).getTime() > now);
  const featuredMatch = liveMatch || futureMatch || sortedMatches[0] || null;
  const featuredTime = featuredMatch?.matchDate ? new Date(featuredMatch.matchDate).getTime() : 0;
  const followingMatch = featuredMatch
    ? sortedMatches.find((match) => match?.id !== featuredMatch.id && match?.matchDate && new Date(match.matchDate).getTime() > Math.max(now, featuredTime))
    : null;

  return { featuredMatch, followingMatch };
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
  const safeMatches = Array.isArray(upcomingMatches) ? upcomingMatches : [];
  const { featuredMatch: nextMatch, followingMatch } = pickFeaturedMatch(safeMatches, now);
  const hasAnimation = Boolean(getAnimationMatchId(nextMatch));
  const showScore = shouldShowScore(nextMatch, now);
  const isLiveNow = Boolean(nextMatch) && (isLiveStatus(nextMatch) || isCurrentMatchWindow(nextMatch, now));

  const findTeamAsset = (team: any) => {
    const teamName = team?.name || team?.teamName || '';
    const teamId = team?.id || team?.teamId;
    return safeAssets.find((asset) => asset.type === 'TEAM' && ((teamId && (asset.id === teamId || asset.externalId === teamId)) || (teamName && String(asset.name || '').toLowerCase() === String(teamName).toLowerCase())));
  };

  const getTeamHref = (team: any) => findTeamAsset(team)?.id ? `/asset/${findTeamAsset(team)?.id}` : '/market?type=TEAM';

  const renderMatchTeamLogo = (team: any) => {
    const matchedAsset = findTeamAsset(team);
    return (
      <Link href={getTeamHref(team)} className="rounded-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/40" title={`صفحة ${team?.name || matchedAsset?.name || 'المنتخب'}`}>
        <AssetImage image={team?.image || team?.logo || team?.badge || team?.flag || matchedAsset?.image} name={team?.name || team?.teamName || matchedAsset?.name || 'Team'} type="TEAM" width={54} height={54} className="h-14 w-14 rounded-full border border-white/10 bg-black/40 object-cover shadow-[0_0_18px_rgba(15,240,252,0.12)] hover:border-[#0FF0FC]/50" />
      </Link>
    );
  };

  const getCountdown = () => {
    if (!nextMatch?.matchDate || showScore) return null;
    const diff = new Date(nextMatch.matchDate).getTime() - now;
    if (diff <= 0) return null;
    const totalSeconds = Math.floor(diff / 1000);
    return [
      { label: 'يوم', value: Math.floor(totalSeconds / 86400) },
      { label: 'ساعة', value: Math.floor((totalSeconds % 86400) / 3600) },
      { label: 'دقيقة', value: Math.floor((totalSeconds % 3600) / 60) },
      { label: 'ثانية', value: totalSeconds % 60 },
    ];
  };

  const countdown = getCountdown();
  const matchGroup = normalizeGroupKey(nextMatch?.groupPhase || nextMatch?.group || nextMatch?.homeTeam?.group || nextMatch?.awayTeam?.group);
  const animationHref = getAnimationHref(nextMatch);
  const quickStats = [
    { label: 'منتخب', value: teamsCount || 0, icon: Globe },
    { label: 'لاعب', value: playersCount || 0, icon: Users },
    { label: 'أصل', value: assetsCount || 0, icon: Wallet },
    { label: 'مباراة', value: upcomingMatchesCount || 0, icon: Calendar },
  ];
  const gatewayCards = [
    { title: 'المنتخبات', text: 'صفحات مختصرة لكل منتخب: بطاقة، مجموعة، نجوم، نقاط قوة وضعف.', href: '/market?type=TEAM', action: 'استكشف المنتخبات', tone: 'border-emerald-400/20 bg-emerald-400/[0.045] text-emerald-300' },
    { title: 'اللاعبون', text: 'تقييمات وأسعار افتراضية ومقارنة سريعة بين أبرز الأسماء.', href: '/market?type=PLAYER', action: 'تقييمات اللاعبين', tone: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.045] text-[#0FF0FC]' },
    { title: 'التحليل الكروي', text: 'أداء، أسلوب لعب، زخم، مؤشرات فنية وملخصات قابلة للتحويل لإنفوجرافيك.', href: '/team-intelligence', action: 'افتح التحليل', tone: 'border-violet-400/20 bg-violet-400/[0.045] text-violet-300' },
    { title: 'البورصة الافتراضية', text: 'سوق تعليمي افتراضي بالكامل مبني على الأداء والطلب داخل المنصة.', href: '/market', action: 'راقب السوق', tone: 'border-[#FFD700]/20 bg-[#FFD700]/[0.045] text-[#FFD700]' },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-16 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">بورصة إم سي للمونديال</p>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">منصة تحليلات وإحصائيات رياضية مع تجربة تداول افتراضية للمونديال</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">تابع بيانات المنتخبات واللاعبين، اقرأ التحليلات الكروية، وجرّب سوق بورصة المونديال بأرصدة افتراضية فقط لفهم حركة الأسعار والزخم بدون أي معاملات مالية حقيقية.</p>
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-gray-500">{isLiveNow ? 'المباراة المباشرة' : 'المباراة القادمة'}</p>
                <h2 className="mt-1 text-xl font-black text-white">{nextMatch ? (showScore ? 'النتيجة الآن' : 'مباراة قادمة') : 'جدول المباريات'}</h2>
              </div>
              <ShieldCheck className="text-[#0FF0FC]" size={30} />
            </div>

            {nextMatch ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                {isLiveNow && <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-[11px] font-black text-red-200"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> مباشر الآن</div>}

                <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="flex flex-col items-center gap-2 text-center">
                    {renderMatchTeamLogo(nextMatch.homeTeam)}
                    <Link href={getTeamHref(nextMatch.homeTeam)} className="text-xs font-black text-white transition hover:text-[#0FF0FC]">{nextMatch.homeTeam?.name || 'الفريق الأول'}</Link>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Link href={groupHref(matchGroup)} className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/20 hover:text-white">المجموعة {matchGroup}</Link>
                    <div className={`${showScore ? 'rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-2xl font-black text-emerald-100' : 'rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-black text-[#FFD700]'}`}>{showScore ? scoreLabel(nextMatch) : 'VS'}</div>
                  </div>

                  <div className="flex flex-col items-center gap-2 text-center">
                    {renderMatchTeamLogo(nextMatch.awayTeam)}
                    <Link href={getTeamHref(nextMatch.awayTeam)} className="text-xs font-black text-white transition hover:text-[#0FF0FC]">{nextMatch.awayTeam?.name || 'الفريق الثاني'}</Link>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-center text-xs font-bold text-gray-400"><Clock size={13} /> {formatMatchDate(nextMatch.matchDate)}</div>

                {showScore ? (
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center text-xs font-black text-emerald-200">النتيجة الحالية: {scoreLabel(nextMatch)}</div>
                ) : countdown ? (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {countdown.map((item) => (
                      <div key={item.label} className="rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.06] px-2 py-2 text-center">
                        <div className="font-mono text-lg font-black leading-none text-white tabular-nums">{String(item.value).padStart(2, '0')}</div>
                        <div className="mt-1 text-[10px] font-bold text-[#0FF0FC]">{item.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-center text-xs font-black text-[#FFD700]">موعد المباراة: {formatMatchTime(nextMatch.matchDate)}</div>
                )}

                <Link href={animationHref} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${hasAnimation ? 'border border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700] hover:text-black' : 'border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black'}`}>
                  <Radio size={15} /> {hasAnimation ? (isLiveNow ? 'بث الأنيميشن مباشر' : 'شاهد بث الأنيميشن') : `موعد المباراة: ${formatMatchTime(nextMatch.matchDate)}`}
                </Link>

                {showScore && followingMatch && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="mb-2 text-[11px] font-black text-[#0FF0FC]">المباراة القادمة بعدها</div>
                    <div className="flex items-center justify-between gap-3 text-xs font-black text-white">
                      <span className="line-clamp-1">{followingMatch.homeTeam?.name || 'الفريق الأول'}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-[#FFD700]">VS</span>
                      <span className="line-clamp-1">{followingMatch.awayTeam?.name || 'الفريق الثاني'}</span>
                    </div>
                    <div className="mt-2 text-center text-[11px] font-bold text-gray-400">{formatMatchDate(followingMatch.matchDate)}</div>
                  </div>
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
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-black">{card.action} <ArrowLeft size={16} className="transition group-hover:-translate-x-1" /></div>
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
