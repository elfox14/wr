'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import { ArrowLeft, BarChart3, Calendar, Clock, FileText, Globe, LineChart, Newspaper, Radio, Share2, ShieldCheck, Sparkles, Trophy, Users, Wallet } from 'lucide-react';

type AcademyArticle = { id: string; title: string; excerpt: string; category: string; readingTime?: string };
type Props = { initialAssets: any[]; upcomingMatches?: any[]; assetsCount?: number; playersCount?: number; teamsCount?: number; upcomingMatchesCount?: number; academyArticles?: AcademyArticle[] };

const arNumber = new Intl.NumberFormat('ar-EG');

function safeDate(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDate(value?: string | null) {
  const date = safeDate(value);
  return date ? date.toLocaleString('ar-EG') : 'غير محدد';
}

function normalizeGroup(value?: string | null) {
  return value ? value.replace('Group', '').replace('المجموعة', '').trim().toUpperCase() : 'غير محددة';
}

function groupHref(value?: string | null) {
  return `/groups#group-${encodeURIComponent(normalizeGroup(value))}`;
}

function animationId(match: any) {
  return match?.animationMatchId || '';
}

function animationHref(match: any) {
  const id = animationId(match);
  return id ? `/animation-live/player?matchId=${encodeURIComponent(String(id))}&lang=en&statsPanel=simple&teamPanel=1` : '/animation-live';
}

function sortMatches(matches: any[]) {
  return [...matches].sort((a, b) => new Date(a?.matchDate || 0).getTime() - new Date(b?.matchDate || 0).getTime());
}

function isLive(match: any, now: number) {
  if (match?.isLiveNow) return true;
  const status = String(match?.displayStatus || match?.status || '').toUpperCase();
  if (['IN_PLAY', 'LIVE', 'HT'].includes(status)) return true;
  const date = safeDate(match?.matchDate);
  if (status === 'SCHEDULED' && date) {
    const diffMinutes = Math.floor((now - date.getTime()) / 60000);
    return diffMinutes >= 0 && diffMinutes <= 135;
  }
  return false;
}

function isUpcoming(match: any, now: number) {
  const date = safeDate(match?.matchDate);
  return !isLive(match, now) && String(match?.status || match?.displayStatus || '').toUpperCase() === 'SCHEDULED' && !!date && date.getTime() > now;
}

function isFinishedMatch(match: any) {
  return String(match?.status || match?.displayStatus || '').toUpperCase() === 'FINISHED';
}

function pickTop(matches: any[], now: number) {
  const sorted = sortMatches(matches);
  const live = sorted.filter((m) => isLive(m, now));
  const upcoming = sorted.filter((m) => isUpcoming(m, now));
  const others = sorted.filter((m) => !live.includes(m) && !upcoming.includes(m));
  return [...live, ...upcoming, ...others].slice(0, 4);
}

function pickNext(matches: any[], current: any, now: number) {
  return sortMatches(matches).find((m) => m !== current && isUpcoming(m, now)) || null;
}

function statusLabel(match: any, now: number) {
  if (isFinishedMatch(match)) return 'انتهت';
  if (!isLive(match, now)) return formatDate(match?.matchDate);
  if (match?.liveLabel) return match.liveLabel;
  if (match?.minute) return `الدقيقة ${match.minute}`;
  const date = safeDate(match?.matchDate);
  if (!date) return 'جارية الآن';
  const minute = Math.floor((now - date.getTime()) / 60000) + 1;
  if (minute >= 46 && minute <= 65) return 'استراحة بين الشوطين';
  if (minute > 65 && minute <= 135) return 'الشوط الثاني جارٍ';
  if (minute >= 1 && minute <= 45) return `الدقيقة ${minute}`;
  return 'جارية الآن';
}

function countdown(match: any, now: number) {
  const date = safeDate(match?.matchDate);
  if (!date) return 'غير محدد';
  const diff = date.getTime() - now;
  if (diff <= 0) return 'تبدأ الآن';
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return days > 0 ? `${days} يوم ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function price(asset: any) {
  const value = Number(asset?.marketPrice ?? asset?.currentPrice ?? asset?.price ?? asset?.fairValue ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function change(asset: any) {
  const value = Number(asset?.priceChange24h ?? asset?.change24h ?? asset?.priceChange ?? asset?.momentum ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function changeText(value: number) {
  if (value > 0) return `▲ ${value.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`;
  if (value < 0) return `▼ ${Math.abs(value).toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`;
  return 'مستقر';
}

function shuffleTeams(teams: any[]) {
  return [...teams].sort(() => Math.random() - 0.5).slice(0, 4);
}

function isDebutTeam(team: any) {
  return Boolean(team?.isWorldCupDebut || team?.worldCupDebut || team?.firstWorldCup || team?.debutWorldCup || team?.firstAppearance);
}

function footballSummary(team: any) {
  const group = team?.group ? `المجموعة ${team.group}` : 'المجموعة غير محددة';
  const rankValue = Number(team?.fifaRank);
  const rank = Number.isFinite(rankValue) && rankValue > 0 ? `تصنيف FIFA: ${rankValue}.` : 'تصنيف FIFA غير متوفر.';
  let read = 'قراءة كروية أولية تحتاج متابعة القائمة وطريقة اللعب قبل المباراة.';
  if (Number.isFinite(rankValue) && rankValue > 0) {
    if (rankValue <= 10) read = 'منتخب من الصف الأول عالميًا، وغالبًا يملك جودة فردية عالية وخيارات هجومية متعددة.';
    else if (rankValue <= 25) read = 'منتخب قوي تنافسيًا، وتقييمه الكروي يرتبط بالتحولات والصلابة أمام المنتخبات الكبرى.';
    else if (rankValue <= 50) read = 'منتخب متوسط إلى جيد، وفرصه ترتبط بالانضباط واستغلال الكرات الثابتة.';
    else read = 'منتخب يحتاج مباراة منظمة وتقليل الأخطاء للبقاء داخل المنافسة.';
  }
  return `${group}. ${rank} ${read}`;
}

export default function HomeClientSportsNext({ initialAssets, upcomingMatches = [], assetsCount = 0, playersCount = 0, teamsCount = 0, upcomingMatchesCount = 0, academyArticles = [] }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [matches, setMatches] = useState<any[]>(() => (Array.isArray(upcomingMatches) ? upcomingMatches : []));
  const [spotlightTeams, setSpotlightTeams] = useState<any[]>([]);

  useEffect(() => {
    useStore.setState({ assets: initialAssets, loading: false });
  }, [initialAssets]);

  useEffect(() => {
    setMatches(Array.isArray(upcomingMatches) ? upcomingMatches : []);
  }, [upcomingMatches]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/matches/live-card', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.matches)) setMatches(data.matches);
      } catch {}
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const assets = Array.isArray(initialAssets) ? initialAssets : [];
  const teams = assets.filter((asset) => asset.type === 'TEAM');
  const players = assets.filter((asset) => asset.type === 'PLAYER');
  const debutTeams = teams.filter(isDebutTeam).slice(0, 4);
  const safeMatches = matches.length ? matches : upcomingMatches;
  const topMatches = pickTop(safeMatches, now);
  const currentMatch = topMatches[0] || null;
  const currentIsLive = currentMatch ? isLive(currentMatch, now) : false;
  const hasLive = topMatches.some((match) => isLive(match, now));
  const secondMatch = currentMatch ? (currentIsLive ? pickNext(safeMatches, currentMatch, now) : topMatches.find((match) => match !== currentMatch) || pickNext(safeMatches, currentMatch, now)) : null;
  const stripMatch = secondMatch || (!currentIsLive ? currentMatch : null);
  const marketMovers = [...assets].sort((a, b) => Math.abs(change(b)) - Math.abs(change(a))).slice(0, 3);

  useEffect(() => {
    setSpotlightTeams(shuffleTeams(teams));
  }, [initialAssets]);

  const heroStatus = currentMatch
    ? currentIsLive
      ? { label: 'مباشر الآن', dot: 'bg-emerald-400 animate-pulse', cls: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' }
      : isFinishedMatch(currentMatch)
        ? { label: 'انتهت', dot: 'bg-gray-400', cls: 'border-gray-400/20 bg-gray-400/10 text-gray-300' }
        : { label: 'قريبًا', dot: 'bg-orange-400', cls: 'border-orange-400/25 bg-orange-400/10 text-orange-300' }
    : { label: 'لا توجد مباراة', dot: 'bg-gray-500', cls: 'border-gray-500/20 bg-gray-500/10 text-gray-400' };

  const findTeamAsset = (team: any) => {
    const name = team?.name || team?.teamName || '';
    const id = team?.id || team?.teamId;
    return assets.find((asset) => asset.type === 'TEAM' && ((id && (asset.id === id || asset.externalId === id)) || (name && String(asset.name || '').toLowerCase() === String(name).toLowerCase())));
  };

  const teamHref = (team: any) => {
    const asset = findTeamAsset(team);
    return asset?.id ? `/asset/${asset.id}` : '/market?type=TEAM';
  };

  const teamLogo = (team: any, compact = false) => {
    const asset = findTeamAsset(team);
    return (
      <Link href={teamHref(team)} className="rounded-full transition hover:scale-105">
        <AssetImage
          image={team?.image || team?.logo || team?.badge || team?.flag || asset?.image}
          name={team?.name || team?.teamName || asset?.name || 'Team'}
          type="TEAM"
          width={compact ? 44 : 54}
          height={compact ? 44 : 54}
          className={`${compact ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-12 w-12 sm:h-14 sm:w-14'} rounded-full border border-white/10 bg-black/40 object-cover shadow-[0_0_18px_rgba(15,240,252,0.12)]`}
        />
      </Link>
    );
  };

  const shareAssetOpinion = async (asset: any) => {
    const text = `رأيي في ${asset?.name || 'هذا المنتخب'} على بورصة المونديال: هل تتوقع أداءً قويًا في كأس العالم؟`;
    const url = `${window.location.origin}${asset?.id ? `/asset/${asset.id}` : '/market'}`;
    try {
      if (navigator.share) await navigator.share({ title: 'بورصة المونديال', text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {}
  };

  const matchCard = (match: any, options?: { title?: string; compact?: boolean; countdown?: boolean }) => {
    const live = isLive(match, now);
    const finished = isFinishedMatch(match);
    const showScore = live || finished;
    const group = match?.groupPhase || match?.group || match?.homeTeam?.group || match?.awayTeam?.group;
    return (
      <div className={`rounded-2xl border p-4 ${live ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : finished ? 'border-gray-500/20 bg-gray-500/[0.04]' : 'border-orange-400/20 bg-orange-400/[0.04]'}`}>
        {options?.title ? <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black text-[#0FF0FC]">{options.title}</p><Calendar className="text-[#0FF0FC]" size={18} /></div> : null}
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center gap-2 text-center">{teamLogo(match.homeTeam)}<Link href={teamHref(match.homeTeam)} className="line-clamp-1 text-[11px] font-black text-white hover:text-[#0FF0FC] sm:text-xs">{match.homeTeam?.name || 'الفريق الأول'}</Link></div>
          <div className="flex flex-col items-center gap-2">
            <Link href={groupHref(group)} className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]">المجموعة {normalizeGroup(group)}</Link>
            {showScore ? <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xl font-black text-white shadow-inner tabular-nums sm:px-5 sm:text-2xl">{match.homeScore ?? 0} - {match.awayScore ?? 0}</div> : <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-black text-[#FFD700]">VS</div>}
          </div>
          <div className="flex flex-col items-center gap-2 text-center">{teamLogo(match.awayTeam)}<Link href={teamHref(match.awayTeam)} className="line-clamp-1 text-[11px] font-black text-white hover:text-[#0FF0FC] sm:text-xs">{match.awayTeam?.name || 'الفريق الثاني'}</Link></div>
        </div>
        <div className="flex items-center justify-center gap-2 text-center text-xs font-bold text-gray-300"><Clock size={13} />{options?.countdown ? `تبدأ بعد ${countdown(match, now)}` : statusLabel(match, now)}</div>
        {options?.countdown ? <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-center"><div className="text-[10px] font-bold text-gray-500">موعد البداية</div><div className="mt-1 text-xs font-black text-white">{formatDate(match.matchDate)}</div></div> : null}
        {options?.compact ? null : <Link href={animationHref(match)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black"><Radio size={14} />{animationId(match) ? 'مشاهدة البث التفاعلي' : 'فتح مركز البث'}</Link>}
      </div>
    );
  };

  const matchStripCard = (match: any, title: string) => {
    const live = isLive(match, now);
    const finished = isFinishedMatch(match);
    const showScore = live || finished;
    const group = match?.groupPhase || match?.group || match?.homeTeam?.group || match?.awayTeam?.group;
    const statusText = isUpcoming(match, now) ? `تبدأ بعد ${countdown(match, now)}` : statusLabel(match, now);

    return (
      <div className={`rounded-2xl border p-3 ${live ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : finished ? 'border-gray-500/20 bg-gray-500/[0.04]' : 'border-orange-400/20 bg-orange-400/[0.04]'}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]">
            {live ? <Radio size={12} /> : <Calendar size={12} />}{title}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-300"><Clock size={12} />{statusText}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            {teamLogo(match.homeTeam, true)}
            <Link href={teamHref(match.homeTeam)} className="line-clamp-1 text-[11px] font-black text-white hover:text-[#0FF0FC]">{match.homeTeam?.name || 'الفريق الأول'}</Link>
          </div>
          <div className="flex min-w-[92px] flex-col items-center gap-2">
            <Link href={groupHref(group)} className="max-w-[116px] truncate rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]">المجموعة {normalizeGroup(group)}</Link>
            {showScore ? <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-lg font-black text-white shadow-inner tabular-nums">{match.homeScore ?? 0} - {match.awayScore ?? 0}</div> : <div className="rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm font-black text-[#FFD700]">VS</div>}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            {teamLogo(match.awayTeam, true)}
            <Link href={teamHref(match.awayTeam)} className="line-clamp-1 text-[11px] font-black text-white hover:text-[#0FF0FC]">{match.awayTeam?.name || 'الفريق الثاني'}</Link>
          </div>
        </div>
        <Link href={live || animationId(match) ? animationHref(match) : '/matches'} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black">
          <Radio size={14} />{live || animationId(match) ? 'متابعة المباشر' : 'عرض تفاصيل المباراة'}
        </Link>
      </div>
    );
  };

  const assetCard = (asset: any, label: string) => (
    <Link key={asset.id || asset.name} href={asset?.id ? `/asset/${asset.id}` : '/market'} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition hover:border-[#0FF0FC]/25 hover:bg-white/[0.055]">
      <AssetImage image={asset?.image} name={asset?.name || label} type={asset?.type || 'TEAM'} width={42} height={42} className="h-11 w-11 rounded-full border border-white/10 bg-black/40 object-cover" />
      <div className="min-w-0"><div className="truncate text-sm font-black text-white">{asset?.name || label}</div><div className="mt-1 text-[11px] font-bold text-gray-500">{label}</div></div>
    </Link>
  );

  const heroStats = [
    { label: 'منتخب', value: teamsCount || 48, icon: Globe },
    { label: 'لاعب', value: playersCount || 1249, icon: Users },
    { label: 'أصل افتراضي', value: assetsCount || 1297, icon: Wallet },
    { label: 'مباراة', value: upcomingMatchesCount || 71, icon: Calendar },
  ];

  const mobileLinks = [
    { title: 'المباريات', subtitle: 'نتائج ومواعيد', href: '/matches', icon: Radio, tone: 'border-red-400/25 bg-red-500/10 text-red-300' },
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
    { title: 'مسار البطولة', text: 'انتقل من المباراة إلى المجموعة ثم إلى صفحة المنتخب.', href: '/matches' },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 sm:py-5 lg:space-y-5 lg:px-8">
      <section className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${hasLive ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
            <span className={`h-2 w-2 rounded-full ${hasLive ? 'animate-pulse bg-emerald-400' : 'bg-[#0FF0FC]'}`} />
            {hasLive ? 'مباشر الآن' : 'مباريات اليوم'}
          </span>
          <Link href="/matches" className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1.5 text-xs font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC] hover:text-black">
            عرض صفحة المباريات <ArrowLeft size={13} />
          </Link>
        </div>
        {currentMatch ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {matchStripCard(currentMatch, currentIsLive ? 'المباراة المباشرة الآن' : 'المباراة الأولى اليوم')}
            {stripMatch && stripMatch !== currentMatch ? matchStripCard(stripMatch, currentIsLive ? 'المباراة القادمة' : 'المباراة الثانية اليوم') : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-center text-sm leading-7 text-gray-500">
                لا توجد مباراة ثانية محملة حاليًا.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm leading-7 text-gray-500">
            تابع المباريات والأخبار والتحليلات من مكان واحد.
          </div>
        )}
      </section>

      <section className="lg:hidden -mx-4 overflow-hidden border-y border-white/10 bg-black/45 backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {mobileLinks.map((item) => {
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

      <section className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-3 shadow-anti-gravity sm:p-4 md:p-5">
        <div className="pointer-events-none absolute inset-0 opacity-16 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid gap-4 lg:grid-cols-[0.96fr_1.04fr] lg:items-start">
          <div className="flex flex-col justify-start pt-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Sparkles size={13} /> كأس العالم مع MC PRIME</p>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black ${heroStatus.cls}`}><span className={`h-2 w-2 rounded-full ${heroStatus.dot}`} />{heroStatus.label}</span>
            </div>
            <h1 className="max-w-3xl text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl">كل ما يحدث في كأس العالم… مباشر، موثق، وتحليلي</h1>
            <p className="mt-2 max-w-2xl text-[11px] leading-5 text-gray-300 sm:text-xs md:text-sm">ابدأ من المباراة والنتيجة والخبر، ثم انتقل للتحليل الكروي وصفحات المنتخبات. البورصة طبقة ترفيهية افتراضية في النهاية.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {heroStats.map((stat) => {
                const Icon = stat.icon;
                return <div key={stat.label} className="rounded-xl border border-[#FFD700]/20 bg-black/30 p-2.5"><Icon className="mb-1.5 text-[#FFD700]" size={16} /><div className="text-lg font-black text-white sm:text-xl">{arNumber.format(stat.value)}</div><div className="text-[10px] font-bold text-gray-400">{stat.label}</div></div>;
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Link href="/matches" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0FF0FC] px-3 py-2 text-xs font-black text-black transition hover:bg-[#70f7ff]"><Radio size={16} /> مركز المباريات</Link>
              <Link href="/articles" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"><Newspaper size={16} /> الأخبار والتحليل</Link>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-black/40 p-3 backdrop-blur-xl sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="text-[11px] font-black text-gray-500">{hasLive ? 'مباراة جارية الآن' : 'مباراتان من اليوم'}</p><h2 className="mt-1 text-base font-black text-white sm:text-lg">مباريات اليوم</h2></div>
              <ShieldCheck className={hasLive ? 'text-emerald-300' : 'text-[#0FF0FC]'} size={26} />
            </div>
            {currentMatch ? (
              <div>
                {matchCard(currentMatch)}
                {secondMatch ? (
                  <div className="mt-3">
                    {matchCard(secondMatch, { title: currentIsLive ? 'المباراة التالية' : 'المباراة الثانية اليوم', compact: true, countdown: isUpcoming(secondMatch, now) })}
                    <Link href="/matches" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0FF0FC] px-3 py-2 text-xs font-black text-black transition hover:bg-[#70f7ff]">عرض صفحة المباريات <ArrowLeft size={14} /></Link>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-[#0FF0FC]/18 bg-black/35 p-3"><p className="text-[10px] font-black text-[#0FF0FC]">المباراة الثانية</p><h3 className="mt-1 text-sm font-black text-white">لا توجد مباراة ثانية محملة حاليًا</h3><Link href="/matches" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0FF0FC] px-3 py-2 text-xs font-black text-black">عرض صفحة المباريات <ArrowLeft size={14} /></Link></div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لم يتم تحميل مباريات بعد.<Link href="/matches" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-2 text-xs font-black text-[#0FF0FC]">فتح صفحة المباريات <ArrowLeft size={14} /></Link></div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div id="news" className="scroll-mt-24 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black text-[#FFD700]">News Room</p><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">آخر الأخبار والتحليلات</h2></div><Newspaper className="text-[#FFD700]" size={26} /></div>
          {academyArticles.length ? (
            <div className="space-y-3">
              {academyArticles.slice(0, 3).map((article) => <Link key={article.id} href={`/article/${article.id}`} className="block rounded-2xl border border-white/8 bg-black/25 p-4 transition hover:border-[#FFD700]/25 hover:bg-white/[0.055]"><div className="mb-2 flex items-center justify-between gap-3"><span className="rounded-full bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black text-[#FFD700]">{article.category}</span>{article.readingTime ? <span className="text-[10px] font-bold text-gray-500">{article.readingTime}</span> : null}</div><h3 className="line-clamp-2 font-black text-white">{article.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">{article.excerpt}</p></Link>)}
            </div>
          ) : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm leading-7 text-gray-500">لا توجد أخبار موثقة منشورة بعد. عند إضافة مقالات أو تقارير ستظهر هنا تلقائيًا.</div>}
        </div>
        <div id="analysis" className="scroll-mt-24 rounded-[1.6rem] border border-[#0FF0FC]/20 bg-[linear-gradient(135deg,rgba(15,240,252,0.10),rgba(255,255,255,0.025))] p-4 shadow-[0_0_35px_rgba(15,240,252,0.06)] sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black text-[#0FF0FC]">Analysis Desk</p><h2 className="mt-1 flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><LineChart size={22} className="text-[#0FF0FC]" /> مركز التحليل</h2></div><span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]">رأي تحليلي منفصل عن الخبر</span></div>
          <div className="grid gap-3 md:grid-cols-3">
            {analysisCards.map((card) => {
              const Icon = card.icon;
              return <Link key={card.title} href={card.href} className="rounded-2xl border border-[#0FF0FC]/12 bg-black/25 p-4 transition hover:border-[#0FF0FC]/35 hover:bg-[#0FF0FC]/[0.06]"><Icon className="mb-3 text-[#0FF0FC]" size={23} /><h3 className="font-black text-white">{card.title}</h3><p className="mt-2 text-xs leading-6 text-gray-400">{card.text}</p></Link>;
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[11px] font-black text-[#0FF0FC]">Football Spotlight</p><h3 className="text-sm font-black text-white">تحليل كروي مختصر لمنتخبات مختارة عشوائيًا</h3></div><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-gray-400">يتغير مع تحديث الصفحة</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(spotlightTeams.length ? spotlightTeams : teams).slice(0, 4).map((team) => <Link key={team.id || team.name} href={team?.id ? `/asset/${team.id}` : '/market?type=TEAM'} className="flex gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition hover:border-[#0FF0FC]/25 hover:bg-white/[0.055]"><AssetImage image={team?.image} name={team?.name || 'منتخب'} type="TEAM" width={42} height={42} className="h-11 w-11 shrink-0 rounded-full border border-white/10 bg-black/40 object-cover" /><div className="min-w-0"><div className="truncate text-sm font-black text-white">{team?.name || 'منتخب'}</div><p className="mt-1 text-[11px] leading-5 text-gray-400">{footballSummary(team)}</p></div></Link>)}
            </div>
          </div>
        </div>
      </section>

      {debutTeams.length > 0 ? (
        <section className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/[0.045] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black text-emerald-300">Discovery</p><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">منتخبات تشارك لأول مرة</h2></div><Trophy className="text-emerald-300" size={26} /></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {debutTeams.map((team) => <Link key={team.id || team.name} href={team?.id ? `/asset/${team.id}` : '/market?type=TEAM'} className="rounded-2xl border border-white/8 bg-black/25 p-4 transition hover:border-emerald-300/35 hover:bg-emerald-300/[0.06]"><AssetImage image={team?.image} name={team?.name || 'منتخب'} type="TEAM" width={46} height={46} className="mb-3 h-12 w-12 rounded-full border border-white/10 bg-black/40 object-cover" /><h3 className="font-black text-white">{team?.name || 'منتخب'}</h3><p className="mt-2 text-xs leading-6 text-gray-400">ظهور أول موثق داخل بيانات المنصة. غير ذلك لا يتم عرض هذا القسم.</p></Link>)}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {groupCards.map((card) => <Link key={card.title} href={card.href} className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-1 hover:border-[#0FF0FC]/25 hover:bg-white/[0.06]"><h3 className="text-lg font-black text-white">{card.title}</h3><p className="mt-3 min-h-12 text-sm leading-7 text-gray-400">{card.text}</p><div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#0FF0FC]">افتح القسم <ArrowLeft size={15} /></div></Link>)}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div id="teams" className="scroll-mt-24 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black text-emerald-300">Team Hub</p><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">المنتخبات واللاعبون</h2></div><Trophy className="text-emerald-300" size={26} /></div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3"><div className="text-xs font-black text-gray-500">منتخبات</div>{teams.length ? teams.slice(0, 4).map((asset) => assetCard(asset, 'منتخب')) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">لا توجد منتخبات محملة.</div>}</div>
            <div className="space-y-3"><div className="text-xs font-black text-gray-500">لاعبون</div>{players.length ? players.slice(0, 4).map((asset) => assetCard(asset, 'لاعب')) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">لا توجد بيانات لاعبين محملة.</div>}</div>
          </div>
        </div>
        <div id="fan-exchange" className="scroll-mt-24 rounded-[1.6rem] border border-[#FFD700]/20 bg-[#FFD700]/[0.045] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black text-[#FFD700]">Virtual Fan Exchange</p><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">بورصة المونديال الترفيهية</h2></div><BarChart3 className="text-[#FFD700]" size={28} /></div>
          <p className="text-sm leading-7 text-gray-300">أسعار ومؤشرات افتراضية تعكس الأداء والزخم والتفاعل داخل المنصة. الهدف ترفيهي وتعليمي.</p>
          <div className="mt-4 space-y-3">
            {marketMovers.length ? marketMovers.map((asset) => {
              const value = change(asset);
              return (
                <div key={asset.id || asset.name} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition hover:border-[#FFD700]/30 hover:bg-white/[0.055]">
                  <Link href={asset?.id ? `/asset/${asset.id}` : '/market'} className="flex min-w-0 flex-1 items-center gap-3"><AssetImage image={asset?.image} name={asset?.name || 'أصل افتراضي'} type={asset?.type || 'TEAM'} width={42} height={42} className="h-11 w-11 rounded-full border border-white/10 bg-black/40 object-cover" /><div className="min-w-0"><div className="truncate text-sm font-black text-white">{asset?.name || 'أصل افتراضي'}</div><div className="mt-1 text-[11px] font-bold text-gray-500">السعر الافتراضي: {price(asset) ? price(asset).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) : 'غير متوفر'}</div></div></Link>
                  <div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${value > 0 ? 'bg-emerald-400/10 text-emerald-300' : value < 0 ? 'bg-red-500/10 text-red-300' : 'bg-white/10 text-gray-300'}`}>{changeText(value)}</span><button type="button" onClick={() => shareAssetOpinion(asset)} className="inline-flex items-center gap-1 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[11px] font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black"><Share2 size={13} /> شارك رأيك</button></div>
                </div>
              );
            }) : <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-500">لا توجد مؤشرات سوق كافية بعد.</div>}
          </div>
          <Link href="/market" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-5 py-3 text-sm font-black text-black transition hover:bg-[#ffe766]">ادخل البورصة الافتراضية <ArrowLeft size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
