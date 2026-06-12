'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Clock,
  FileText,
  Globe,
  LineChart,
  Newspaper,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
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

type HomeClientProps = {
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
};

function normalizeGroupKey(value?: string | null): string {
  if (!value) return 'غير محددة';
  return value.replace('Group', '').replace('المجموعة', '').trim().toUpperCase();
}

function groupHref(value?: string | null) {
  return `/groups#group-${encodeURIComponent(normalizeGroupKey(value))}`;
}

function getAnimationMatchId(match: any) {
  return match?.animationMatchId || '';
}

function getAnimationHref(match: any) {
  const id = getAnimationMatchId(match);
  return id ? `/animation-live/player?matchId=${encodeURIComponent(String(id))}&lang=en&statsPanel=simple&teamPanel=1` : '/animation-live';
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMatchDate(value?: string | null) {
  const date = safeDate(value);
  return date ? date.toLocaleString('ar-EG') : 'غير محدد';
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('ar-EG').format(Number(value || 0));
}

function sortMatches(matches: any[]) {
  return [...matches].sort((a, b) => new Date(a?.matchDate || 0).getTime() - new Date(b?.matchDate || 0).getTime());
}

function isMatchLive(match: any, now?: number) {
  if (match?.isLiveNow) return true;
  const status = String(match?.displayStatus || match?.status || '').toUpperCase();
  if (status === 'IN_PLAY' || status === 'LIVE' || status === 'HT') return true;

  if (now && status === 'SCHEDULED' && match?.matchDate) {
    const diffMinutes = Math.floor((now - new Date(match.matchDate).getTime()) / 60000);
    return diffMinutes >= 0 && diffMinutes <= 135;
  }

  return false;
}

function pickTopMatches(matches: any[], now: number) {
  const sorted = sortMatches(matches);
  const live = sorted.filter((match) => isMatchLive(match, now));
  const upcoming = sorted.filter((match) => !isMatchLive(match, now) && match.status === 'SCHEDULED' && new Date(match.matchDate).getTime() > now);
  const others = sorted.filter((match) => !live.includes(match) && !upcoming.includes(match));
  return [...live, ...upcoming, ...others].slice(0, 4);
}

function liveMinuteLabel(match: any, now: number) {
  if (match?.liveLabel) return match.liveLabel;
  if (match?.minute) return `الدقيقة ${match.minute}`;

  if (match?.matchDate) {
    const minute = Math.floor((now - new Date(match.matchDate).getTime()) / 60000) + 1;
    if (minute >= 46 && minute <= 65) return 'استراحة بين الشوطين';
    if (minute > 65 && minute <= 135) return 'الشوط الثاني جارٍ';
    if (minute >= 1 && minute <= 45) return `الدقيقة ${minute}`;
  }

  return 'جارية الآن';
}

function statusLabel(match: any, now: number) {
  const status = String(match?.displayStatus || match?.status || '').toUpperCase();
  if (status === 'FINISHED') return 'انتهت';
  if (isMatchLive(match, now)) return liveMinuteLabel(match, now);
  return formatMatchDate(match?.matchDate);
}

function getAssetPrice(asset: any) {
  const raw = asset?.marketPrice ?? asset?.currentPrice ?? asset?.current_price ?? asset?.price ?? asset?.fairValue ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getAssetChange(asset: any) {
  const raw = asset?.priceChange24h ?? asset?.change24h ?? asset?.priceChange ?? asset?.momentumChange ?? asset?.momentum ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function formatAssetPrice(asset: any) {
  const value = getAssetPrice(asset);
  return value ? value.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) : 'غير متوفر';
}

function changeBadge(change: number) {
  if (change > 0) return `▲ ${change.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`;
  if (change < 0) return `▼ ${Math.abs(change).toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`;
  return 'مستقر';
}

function shuffleTeams(teams: any[]) {
  return [...teams].sort(() => Math.random() - 0.5).slice(0, 4);
}

function teamQuickSummary(team: any) {
  const group = team?.group ? `المجموعة ${team.group}` : 'المجموعة غير محددة';
  const momentum = Number(team?.momentum ?? 0);
  const demand = Number(team?.marketDemand ?? 0);
  const risk = Number(team?.volatilityScore ?? 0);
  const rank = team?.fifaRank ? `تصنيف FIFA: ${team.fifaRank}.` : 'تصنيف FIFA غير متوفر.';
  const momentumText = momentum >= 70 ? 'زخم افتراضي مرتفع داخل المنصة' : momentum >= 45 ? 'زخم افتراضي متوسط يحتاج متابعة' : 'زخم افتراضي هادئ حاليًا';
  const demandText = demand >= 70 ? 'طلب جماهيري قوي' : demand >= 45 ? 'طلب جماهيري متوسط' : 'طلب جماهيري محدود';
  const riskText = risk >= 70 ? 'مخاطرة مرتفعة' : risk >= 45 ? 'مخاطرة متوسطة' : 'مخاطرة منخفضة';
  return `${group}. ${rank} ${momentumText}، ${demandText}، و${riskText}.`;
}

export default function HomeClient({
  initialAssets,
  upcomingMatches = [],
  assetsCount = 0,
  playersCount = 0,
  teamsCount = 0,
  upcomingMatchesCount = 0,
  academyArticles = [],
}: HomeClientProps) {
  const [now, setNow] = useState(() => Date.now());
  const [liveMatches, setLiveMatches] = useState<any[]>(() => (Array.isArray(upcomingMatches) ? upcomingMatches : []));
  const [spotlightTeams, setSpotlightTeams] = useState<any[]>([]);

  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });
  }, [initialAssets]);

  useEffect(() => {
    setLiveMatches(Array.isArray(upcomingMatches) ? upcomingMatches : []);
  }, [upcomingMatches]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshLiveCard = async () => {
      try {
        const response = await fetch('/api/matches/live-card', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data?.matches)) setLiveMatches(data.matches);
      } catch {}
    };

    refreshLiveCard();
    const timer = window.setInterval(refreshLiveCard, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const safeAssets = Array.isArray(initialAssets) ? initialAssets : [];
  const safeMatches = Array.isArray(liveMatches) && liveMatches.length > 0 ? liveMatches : Array.isArray(upcomingMatches) ? upcomingMatches : [];
  const topMatches = pickTopMatches(safeMatches, now);
  const tickerMatch = topMatches[0] || null;
  const hasLiveMatch = topMatches.some((match) => isMatchLive(match, now));
  const allTeams = safeAssets.filter((asset) => asset.type === 'TEAM');
  const featuredTeams = allTeams.slice(0, 4);
  const featuredPlayers = safeAssets.filter((asset) => asset.type === 'PLAYER').slice(0, 4);
  const marketMovers = [...safeAssets].sort((a, b) => Math.abs(getAssetChange(b)) - Math.abs(getAssetChange(a))).slice(0, 3);

  useEffect(() => {
    setSpotlightTeams(shuffleTeams(allTeams));
  }, [initialAssets]);

  const findTeamAsset = (team: any) => {
    const teamName = team?.name || team?.teamName || '';
    const teamId = team?.id || team?.teamId;
    return safeAssets.find(
      (asset) =>
        asset.type === 'TEAM' &&
        ((teamId && (asset.id === teamId || asset.externalId === teamId)) ||
          (teamName && String(asset.name || '').toLowerCase() === String(teamName).toLowerCase()))
    );
  };

  const getTeamHref = (team: any) => {
    const asset = findTeamAsset(team);
    return asset?.id ? `/asset/${asset.id}` : '/market?type=TEAM';
  };

  const renderMatchTeamLogo = (team: any) => {
    const matchedAsset = findTeamAsset(team);
    return (
      <Link href={getTeamHref(team)} className="rounded-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/40" title={`صفحة ${team?.name || matchedAsset?.name || 'المنتخب'}`}>
        <AssetImage image={team?.image || team?.logo || team?.badge || team?.flag || matchedAsset?.image} name={team?.name || team?.teamName || matchedAsset?.name || 'Team'} type="TEAM" width={54} height={54} className="h-12 w-12 rounded-full border border-white/10 bg-black/40 object-cover shadow-[0_0_18px_rgba(15,240,252,0.12)] hover:border-[#0FF0FC]/50 sm:h-14 sm:w-14" />
      </Link>
    );
  };

  const renderAssetCard = (asset: any, label: string) => (
    <Link key={asset.id || asset.name} href={asset?.id ? `/asset/${asset.id}` : '/market'} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition active:scale-[0.98] hover:border-[#0FF0FC]/25 hover:bg-white/[0.055]">
      <AssetImage image={asset?.image} name={asset?.name || label} type={asset?.type || 'TEAM'} width={42} height={42} className="h-11 w-11 rounded-full border border-white/10 bg-black/40 object-cover" />
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-white">{asset?.name || label}</div>
        <div className="mt-1 text-[11px] font-bold text-gray-500">{label}</div>
      </div>
    </Link>
  );

  const heroStats = [
    { label: 'منتخب', value: 48, icon: Globe },
    { label: 'لاعب', value: 1249, icon: Users },
    { label: 'أصل افتراضي', value: 1297, icon: Wallet },
    { label: 'مباراة', value: 71, icon: Calendar },
  ];

  const commandLinks = [
    { title: 'مباشر', href: '/animation-live', icon: Radio },
    { title: 'أخبار وتحليل', href: '/articles', icon: Newspaper },
    { title: 'المنتخبات', href: '/market?type=TEAM', icon: Trophy },
    { title: 'البورصة', href: '/market', icon: BarChart3 },
  ];

  const mobileQuickActions = [
    { title: 'المباريات', subtitle: 'نتائج ومواعيد', href: '/animation-live', icon: Radio, tone: 'border-red-400/25 bg-red-500/10 text-red-300' },
    { title: 'الأخبار', subtitle: 'موثق وسريع', href: '#news', icon: Newspaper, tone: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' },
    { title: 'التحليل', subtitle: 'قبل وبعد', href: '#analysis', icon: LineChart, tone: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]' },
    { title: 'المنتخبات', subtitle: 'بطاقات وقوائم', href: '#teams', icon: Trophy, tone: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' },
    { title: 'البورصة', subtitle: 'ترفيه افتراضي', href: '#fan-exchange', icon: BarChart3, tone: 'border-violet-400/25 bg-violet-400/10 text-violet-300' },
  ];

  const analysisCards = [
    { title: 'قبل المباراة', text: 'قراءة مبسطة لنقاط القوة والضعف، مع فصل واضح بين المعلومة الموثقة والرأي التحليلي.', href: '/team-intelligence', icon: FileText },
    { title: 'أثناء المباراة', text: 'مركز مباشر للنتيجة والحالة والدقيقة، مع رابط للبث التفاعلي عند توفره.', href: '/animation-live', icon: Radio },
    { title: 'بعد المباراة', text: 'تحليل قابل للنشر داخل صفحات المنتخب بدون أرقام غير موثقة أو توقعات تسويقية.', href: '/team-intelligence', icon: LineChart },
  ];

  const groupCards = [
    { title: 'ترتيب المجموعات', text: 'مدخل سريع لفهم موقف كل منتخب داخل مجموعته.', href: '/groups' },
    { title: 'صفحات المنتخبات', text: 'بطاقة المنتخب، القائمة، التحليل، والمصادر المتاحة.', href: '/market?type=TEAM' },
    { title: 'مسار البطولة', text: 'انتقل من المباراة إلى المجموعة ثم إلى صفحة المنتخب.', href: '/animation-live' },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:space-y-7 lg:px-8">
      <section className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/40">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${hasLiveMatch ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
              <span className={`h-2 w-2 rounded-full ${hasLiveMatch ? 'animate-pulse bg-red-500' : 'bg-[#0FF0FC]'}`} />
              {hasLiveMatch ? 'LIVE الآن' : 'مركز كأس العالم'}
            </span>
            <div className="text-sm font-bold text-gray-300">
              {tickerMatch ? (
                <>
                  <span className="text-white">{tickerMatch.homeTeam?.name || 'الفريق الأول'}</span>
                  <span className="mx-2 text-gray-500">×</span>
                  <span className="text-white">{tickerMatch.awayTeam?.name || 'الفريق الثاني'}</span>
                  <span className="mx-2 text-gray-500">—</span>
                  <span className="text-[#FFD700]">{statusLabel(tickerMatch, now)}</span>
                </>
              ) : (
                'تابع المباريات والأخبار والتحليلات من مكان واحد'
              )}
            </div>
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            {commandLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-black text-gray-300 transition active:scale-95 hover:border-[#0FF0FC]/30 hover:text-[#0FF0FC]">
                  <Icon size={13} />
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lg:hidden -mx-4 overflow-hidden border-y border-white/10 bg-black/45 backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {mobileQuickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`min-w-[132px] rounded-2xl border p-3 transition active:scale-95 ${item.tone}`}>
                <Icon size={20} />
                <div className="mt-3 text-sm font-black text-white">{item.title}</div>
                <div className="mt-1 text-[11px] font-bold opacity-80">{item.subtitle}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-4 shadow-anti-gravity sm:p-5 md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-16 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-[11px] font-black text-[#0FF0FC] sm:text-xs">
              <Sparkles size={15} /> كأس العالم مع MC PRIME
            </p>
            <h1 className="max-w-4xl text-2xl font-black leading-tight text-white sm:text-3xl md:text-4xl">
              كل ما يحدث في كأس العالم… مباشر، موثق، وتحليلي — مع بورصة افتراضية للتفاعل الجماهيري
            </h1>
            <p className="mt-3 max-w-3xl text-xs leading-6 text-gray-300 sm:text-sm md:text-[15px]">
              ابدأ من المباراة والنتيجة والخبر، ثم انتقل للتحليل الكروي وصفحات المنتخبات. البورصة هنا طبقة ترفيهية افتراضية في النهاية، وليست توصية مالية أو مراهنة.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {heroStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-[#FFD700]/20 bg-black/30 p-3">
                    <Icon className="mb-2 text-[#FFD700]" size={18} />
                    <div className="text-xl font-black text-white sm:text-2xl">{formatNumber(stat.value)}</div>
                    <div className="text-[11px] font-bold text-gray-400">{stat.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <Link href="/animation-live" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-4 py-3 text-xs font-black text-black transition active:scale-95 hover:bg-[#70f7ff] sm:px-5 sm:text-sm">
                <Radio size={18} /> مركز المباريات
              </Link>
              <Link href="/articles" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black text-white transition active:scale-95 hover:bg-white/15 sm:px-5 sm:text-sm">
                <Newspaper size={18} /> الأخبار والتحليل
              </Link>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:rounded-[1.6rem] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-gray-500">{hasLiveMatch ? 'مباراة جارية الآن' : 'مباريات اليوم'}</p>
                <h2 className="mt-1 text-lg font-black text-white sm:text-xl">مباريات اليوم</h2>
              </div>
              <ShieldCheck className={hasLiveMatch ? 'text-red-400' : 'text-[#0FF0FC]'} size={30} />
            </div>

            {tickerMatch ? (
              <div className={`rounded-2xl border p-4 ${isMatchLive(tickerMatch, now) ? 'border-red-500/25 bg-red-500/[0.06]' : 'border-white/10 bg-white/[0.045]'}`}>
                <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                  <div className="flex flex-col items-center gap-2 text-center">
                    {renderMatchTeamLogo(tickerMatch.homeTeam)}
                    <Link href={getTeamHref(tickerMatch.homeTeam)} className="line-clamp-1 text-[11px] font-black text-white transition hover:text-[#0FF0FC] sm:text-xs">
                      {tickerMatch.homeTeam?.name || 'الفريق الأول'}
                    </Link>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Link href={groupHref(tickerMatch?.groupPhase || tickerMatch?.group || tickerMatch?.homeTeam?.group || tickerMatch?.awayTeam?.group)} className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/20 hover:text-white">
                      المجموعة {normalizeGroupKey(tickerMatch?.groupPhase || tickerMatch?.group || tickerMatch?.homeTeam?.group || tickerMatch?.awayTeam?.group)}
                    </Link>
                    {isMatchLive(tickerMatch, now) || String(tickerMatch.status).toUpperCase() === 'FINISHED' ? (
                      <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xl font-black text-white shadow-inner tabular-nums sm:px-5 sm:text-2xl">
                        {tickerMatch.homeScore ?? 0} - {tickerMatch.awayScore ?? 0}
                      </div>
                    ) : (
                      <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-black text-[#FFD700]">VS</div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    {renderMatchTeamLogo(tickerMatch.awayTeam)}
                    <Link href={getTeamHref(tickerMatch.awayTeam)} className="line-clamp-1 text-[11px] font-black text-white transition hover:text-[#0FF0FC] sm:text-xs">
                      {tickerMatch.awayTeam?.name || 'الفريق الثاني'}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-center text-xs font-bold text-gray-300">
                  <Clock size={13} />
                  {statusLabel(tickerMatch, now)}
                </div>
                <Link href={getAnimationHref(tickerMatch)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] transition active:scale-95 hover:bg-[#FFD700] hover:text-black">
                  <Radio size={14} />
                  {getAnimationMatchId(tickerMatch) ? 'مشاهدة البث التفاعلي' : 'فتح مركز البث'}
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لم يتم تحميل مباريات بعد.</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div id="news" className="scroll-mt-24 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-[#FFD700]">News Room</p>
              <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">آخر الأخبار والتحليلات</h2>
            </div>
            <Newspaper className="text-[#FFD700]" size={26} />
          </div>
          {academyArticles.length > 0 ? (
            <div className="space-y-3">
              {academyArticles.slice(0, 3).map((article) => (
                <Link key={article.id} href={`/article/${article.id}`} className="block rounded-2xl border border-white/8 bg-black/25 p-4 transition active:scale-[0.98] hover:border-[#FFD700]/25 hover:bg-white/[0.055]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">{article.category}</span>
                    {article.readingTime ? <span className="text-[10px] font-bold text-gray-500">{article.readingTime}</span> : null}
                  </div>
                  <h3 className="line-clamp-2 font-black text-white">{article.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">{article.excerpt}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm leading-7 text-gray-500">لا توجد أخبار موثقة منشورة بعد. عند إضافة مقالات أو تقارير ستظهر هنا تلقائيًا.</div>
          )}
        </div>

        <div id="analysis" className="scroll-mt-24 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-[#0FF0FC]">Analysis Desk</p>
              <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">مركز التحليل</h2>
            </div>
            <LineChart className="text-[#0FF0FC]" size={26} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {analysisCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href} className="rounded-2xl border border-white/8 bg-black/25 p-4 transition active:scale-[0.98] hover:border-[#0FF0FC]/25 hover:bg-white/[0.055]">
                  <Icon className="mb-3 text-[#0FF0FC]" size={23} />
                  <h3 className="font-black text-white">{card.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-gray-400">{card.text}</p>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-[#0FF0FC]">Team Spotlight</p>
                <h3 className="text-sm font-black text-white">تحليل مختصر لمنتخبات مختارة عشوائيًا</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-gray-400">يتغير مع تحديث الصفحة</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(spotlightTeams.length > 0 ? spotlightTeams : featuredTeams).slice(0, 4).map((team) => (
                <Link key={team.id || team.name} href={team?.id ? `/asset/${team.id}` : '/market?type=TEAM'} className="flex gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition active:scale-[0.98] hover:border-[#0FF0FC]/25 hover:bg-white/[0.055]">
                  <AssetImage image={team?.image} name={team?.name || 'منتخب'} type="TEAM" width={42} height={42} className="h-11 w-11 shrink-0 rounded-full border border-white/10 bg-black/40 object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{team?.name || 'منتخب'}</div>
                    <p className="mt-1 text-[11px] leading-5 text-gray-400">{teamQuickSummary(team)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {groupCards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5 transition active:scale-[0.98] hover:-translate-y-1 hover:border-[#0FF0FC]/25 hover:bg-white/[0.06]">
            <h3 className="text-lg font-black text-white">{card.title}</h3>
            <p className="mt-3 min-h-12 text-sm leading-7 text-gray-400">{card.text}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#0FF0FC]">
              افتح القسم <ArrowLeft size={15} />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div id="teams" className="scroll-mt-24 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-emerald-300">Team Hub</p>
              <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">المنتخبات واللاعبون</h2>
            </div>
            <Trophy className="text-emerald-300" size={26} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div className="text-xs font-black text-gray-500">منتخبات</div>
              {featuredTeams.length > 0 ? featuredTeams.map((asset) => renderAssetCard(asset, 'منتخب')) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">لا توجد منتخبات محملة.</div>}
            </div>
            <div className="space-y-3">
              <div className="text-xs font-black text-gray-500">لاعبون</div>
              {featuredPlayers.length > 0 ? featuredPlayers.map((asset) => renderAssetCard(asset, 'لاعب')) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">لا توجد بيانات لاعبين محملة.</div>}
            </div>
          </div>
        </div>

        <div id="fan-exchange" className="scroll-mt-24 rounded-[1.6rem] border border-[#FFD700]/20 bg-[#FFD700]/[0.045] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-[#FFD700]">Virtual Fan Exchange</p>
              <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">بورصة المونديال الترفيهية</h2>
            </div>
            <BarChart3 className="text-[#FFD700]" size={28} />
          </div>
          <p className="text-sm leading-7 text-gray-300">
            أسعار ومؤشرات افتراضية تعكس الأداء والزخم والتفاعل داخل المنصة. الهدف ترفيهي وتعليمي، بدون أموال حقيقية وبدون مراهنات.
          </p>
          <div className="mt-4 space-y-3">
            {marketMovers.length > 0 ? (
              marketMovers.map((asset) => {
                const change = getAssetChange(asset);
                return (
                  <Link key={asset.id || asset.name} href={asset?.id ? `/asset/${asset.id}` : '/market'} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition active:scale-[0.98] hover:border-[#FFD700]/30 hover:bg-white/[0.055]">
                    <div className="flex min-w-0 items-center gap-3">
                      <AssetImage image={asset?.image} name={asset?.name || 'أصل افتراضي'} type={asset?.type || 'TEAM'} width={42} height={42} className="h-11 w-11 rounded-full border border-white/10 bg-black/40 object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">{asset?.name || 'أصل افتراضي'}</div>
                        <div className="mt-1 text-[11px] font-bold text-gray-500">السعر الافتراضي: {formatAssetPrice(asset)}</div>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${change > 0 ? 'bg-emerald-400/10 text-emerald-300' : change < 0 ? 'bg-red-500/10 text-red-300' : 'bg-white/10 text-gray-300'}`}>
                      {changeBadge(change)}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-500">لا توجد مؤشرات سوق كافية بعد.</div>
            )}
          </div>
          <Link href="/market" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-5 py-3 text-sm font-black text-black transition active:scale-95 hover:bg-[#ffe766]">
            ادخل البورصة الافتراضية <ArrowLeft size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
