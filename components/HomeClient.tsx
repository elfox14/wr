'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import { IsportsBottomStatsEmbed } from '@/components/ui/IsportsBottomStatsEmbed';
import { ArrowLeft, Calendar, Clock, Globe, Radio, ShieldCheck, Users, Wallet } from 'lucide-react';

type AcademyArticle = { id: string; title: string; excerpt: string; category: string; readingTime?: string; level?: string; imageUrl?: string; date?: string };

function normalizeGroupKey(value?: string | null): string {
  if (!value) return 'غير محددة';
  return value.replace('Group', '').replace('المجموعة', '').trim().toUpperCase();
}
function groupHref(value?: string | null): string { return `/groups#group-${encodeURIComponent(normalizeGroupKey(value))}`; }
function getAnimationMatchId(match: any) { return match?.animationMatchId || ''; }
function getAnimationHref(match: any) { const id = getAnimationMatchId(match); return id ? `/animation-live/player?matchId=${encodeURIComponent(String(id))}&lang=en&statsPanel=simple&teamPanel=1` : '/animation-live'; }
function formatMatchDate(value?: string | null) { return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد'; }
function formatMatchTime(value?: string | null) { return value ? new Date(value).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'غير محدد'; }
function sortMatches(matches: any[]) { return [...matches].sort((a, b) => new Date(a?.matchDate || 0).getTime() - new Date(b?.matchDate || 0).getTime()); }
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
  const live = sorted.filter((m) => isMatchLive(m, now));
  const upcoming = sorted.filter((m) => !isMatchLive(m, now) && m.status === 'SCHEDULED' && new Date(m.matchDate).getTime() > now);
  const others = sorted.filter((m) => !live.includes(m) && !upcoming.includes(m));
  return [...live, ...upcoming, ...others].slice(0, 2);
}
function getCountdownArray(matchDate: string | null | undefined, now: number) {
  if (!matchDate) return null;
  const diff = new Date(matchDate).getTime() - now;
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return [
    { label: 'يوم', value: Math.floor(totalSeconds / 86400) },
    { label: 'ساعة', value: Math.floor((totalSeconds % 86400) / 3600) },
    { label: 'دقيقة', value: Math.floor((totalSeconds % 3600) / 60) },
    { label: 'ثانية', value: totalSeconds % 60 },
  ];
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

export default function HomeClient({ initialAssets, upcomingMatches = [], assetsCount = 0, playersCount = 0, teamsCount = 0, upcomingMatchesCount = 0, academyArticles = [] }: { initialAssets: any[]; usersCount?: number; tradeVolume?: number; executedTrades?: number; upcomingMatches?: any[]; assetsCount?: number; playersCount?: number; teamsCount?: number; upcomingMatchesCount?: number; recentTransactions?: any[]; mostTradedAssets?: any[]; topDemandAssets?: any[]; topMomentumAssets?: any[]; undervaluedAssets?: any[]; academyArticles?: AcademyArticle[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [liveMatches, setLiveMatches] = useState<any[]>(() => Array.isArray(upcomingMatches) ? upcomingMatches : []);

  useEffect(() => { useStore.setState({ assets: initialAssets, loading: false }); }, [initialAssets]);
  useEffect(() => { setLiveMatches(Array.isArray(upcomingMatches) ? upcomingMatches : []); }, [upcomingMatches]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
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
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const safeAssets = Array.isArray(initialAssets) ? initialAssets : [];
  const safeMatches = Array.isArray(liveMatches) && liveMatches.length > 0 ? liveMatches : (Array.isArray(upcomingMatches) ? upcomingMatches : []);
  const topMatches = pickTopMatches(safeMatches, now);
  const hasLiveMatch = topMatches.some((match) => isMatchLive(match, now));

  const findTeamAsset = (team: any) => {
    const teamName = team?.name || team?.teamName || '';
    const teamId = team?.id || team?.teamId;
    return safeAssets.find((asset) => asset.type === 'TEAM' && ((teamId && (asset.id === teamId || asset.externalId === teamId)) || (teamName && String(asset.name || '').toLowerCase() === String(teamName).toLowerCase())));
  };
  const getTeamHref = (team: any) => findTeamAsset(team)?.id ? `/asset/${findTeamAsset(team)?.id}` : '/market?type=TEAM';
  const renderMatchTeamLogo = (team: any) => {
    const matchedAsset = findTeamAsset(team);
    return <Link href={getTeamHref(team)} className="rounded-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/40" title={`صفحة ${team?.name || matchedAsset?.name || 'المنتخب'}`}><AssetImage image={team?.image || team?.logo || team?.badge || team?.flag || matchedAsset?.image} name={team?.name || team?.teamName || matchedAsset?.name || 'Team'} type="TEAM" width={54} height={54} className="h-14 w-14 rounded-full border border-white/10 bg-black/40 object-cover shadow-[0_0_18px_rgba(15,240,252,0.12)] hover:border-[#0FF0FC]/50" /></Link>;
  };

  const quickStats = [{ label: 'منتخب', value: teamsCount || 0, icon: Globe }, { label: 'لاعب', value: playersCount || 0, icon: Users }, { label: 'أصل', value: assetsCount || 0, icon: Wallet }, { label: 'مباراة', value: upcomingMatchesCount || 0, icon: Calendar }];
  const gatewayCards = [
    { title: 'المنتخبات', text: 'صفحات مختصرة لكل منتخب: بطاقة، مجموعة، نجوم، نقاط قوة وضعف.', href: '/market?type=TEAM', action: 'استكشف المنتخبات', tone: 'border-emerald-400/20 bg-emerald-400/[0.045] text-emerald-300' },
    { title: 'اللاعبون', text: 'تقييمات وأسعار افتراضية ومقارنة سريعة بين أبرز الأسماء.', href: '/market?type=PLAYER', action: 'تقييمات اللاعبين', tone: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.045] text-[#0FF0FC]' },
    { title: 'التحليل الكروي', text: 'أداء، أسلوب لعب، زخم، مؤشرات فنية وملخصات قابلة للتحويل لإنفوجرافيك.', href: '/team-intelligence', action: 'افتح التحليل', tone: 'border-violet-400/20 bg-violet-400/[0.045] text-violet-300' },
    { title: 'البورصة الافتراضية', text: 'سوق تعليمي افتراضي بالكامل مبني على الأداء والطلب داخل المنصة.', href: '/market', action: 'راقب السوق', tone: 'border-[#FFD700]/20 bg-[#FFD700]/[0.045] text-[#FFD700]' },
  ];

  return <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
      <div className="pointer-events-none absolute inset-0 opacity-16 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative grid gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch"><div className="flex flex-col justify-center"><p className="mb-4 inline-flex w-fit rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">بورصة إم سي للمونديال</p><h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">منصة تحليلات وإحصائيات رياضية مع تجربة تداول افتراضية للمونديال</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">تابع بيانات المنتخبات واللاعبين، اقرأ التحليلات الكروية، وجرّب سوق بورصة المونديال بأرصدة افتراضية فقط لفهم حركة الأسعار والزخم بدون أي معاملات مالية حقيقية.</p></div>
        <div className="rounded-[1.6rem] border border-white/10 bg-black/40 p-5 backdrop-blur-xl"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-black text-gray-500">{hasLiveMatch ? 'مباشر الآن' : 'المباريات القادمة'}</p><h2 className="mt-1 text-xl font-black text-white">{hasLiveMatch ? 'مباراة جارية الآن' : (topMatches.length > 0 ? 'المباريات القادمة' : 'جدول المباريات')}</h2></div><ShieldCheck className={hasLiveMatch ? 'text-red-400' : 'text-[#0FF0FC]'} size={30} /></div>
          {topMatches.length > 0 ? <div className="flex flex-col gap-4">{topMatches.map(match => {
            const matchGroup = normalizeGroupKey(match?.groupPhase || match?.group || match?.homeTeam?.group || match?.awayTeam?.group);
            const isLive = isMatchLive(match, now) || match.status === 'FINISHED';
            const isCurrentlyLive = isMatchLive(match, now);
            const animationHref = getAnimationHref(match);
            const hasAnimation = Boolean(getAnimationMatchId(match));
            const countdown = getCountdownArray(match.matchDate, now);
            return <div key={match.id || Math.random()} className={`rounded-2xl border p-4 ${isCurrentlyLive ? 'border-red-500/25 bg-red-500/[0.06]' : 'border-white/10 bg-white/[0.045]'}`}><div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="flex flex-col items-center gap-2 text-center">{renderMatchTeamLogo(match.homeTeam)}<Link href={getTeamHref(match.homeTeam)} className="text-xs font-black text-white transition hover:text-[#0FF0FC]">{match.homeTeam?.name || 'الفريق الأول'}</Link></div><div className="flex flex-col items-center gap-2"><Link href={groupHref(matchGroup)} className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/20 hover:text-white">المجموعة {matchGroup}</Link>{isLive ? <div className="rounded-2xl border border-white/10 bg-black/60 px-5 py-3 text-2xl font-black text-white shadow-inner tabular-nums">{match.homeScore ?? 0} - {match.awayScore ?? 0}</div> : <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-black text-[#FFD700]">VS</div>}</div><div className="flex flex-col items-center gap-2 text-center">{renderMatchTeamLogo(match.awayTeam)}<Link href={getTeamHref(match.awayTeam)} className="text-xs font-black text-white transition hover:text-[#0FF0FC]">{match.awayTeam?.name || 'الفريق الثاني'}</Link></div></div>{isLive ? <div className="flex items-center justify-center gap-2 text-center text-xs font-bold text-red-400"><div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />{match.status === 'FINISHED' ? 'انتهت المباراة' : liveMinuteLabel(match, now)}</div> : <><div className="flex items-center justify-center gap-2 text-center text-xs font-bold text-gray-400"><Clock size={13} /> {formatMatchDate(match.matchDate)}</div>{countdown ? <div className="mt-3 grid grid-cols-4 gap-2">{countdown.map((item) => <div key={item.label} className="rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.06] px-2 py-2 text-center"><div className="font-mono text-lg font-black leading-none text-white tabular-nums">{String(item.value).padStart(2, '0')}</div><div className="mt-1 text-[10px] font-bold text-[#0FF0FC]">{item.label}</div></div>)}</div> : <div className="mt-3 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-center text-xs font-black text-[#FFD700]">موعد المباراة: {formatMatchTime(match.matchDate)}</div>}</>}{isCurrentlyLive && hasAnimation ? <IsportsBottomStatsEmbed matchId={getAnimationMatchId(match)} compact className="mt-3" title="إحصائيات البث" /> : null}<Link href={animationHref} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${hasAnimation ? 'border border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700] hover:text-black' : 'border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black'}`}><Radio size={14} />{hasAnimation ? 'مشاهدة البث التفاعلي' : 'فتح مركز البث'}</Link></div>})}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">لم يتم تحميل مباريات بعد.</div>}
        </div></div>
    </section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">{quickStats.map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><Icon className="mb-3 text-[#0FF0FC]" size={22} /><div className="text-2xl font-black text-white">{stat.value}</div><div className="text-xs font-bold text-gray-500">{stat.label}</div></div>; })}</section>
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{gatewayCards.map((card) => <Link key={card.title} href={card.href} className={`rounded-[1.4rem] border p-5 transition hover:-translate-y-1 hover:bg-white/[0.06] ${card.tone}`}><h3 className="text-lg font-black text-white">{card.title}</h3><p className="mt-3 min-h-16 text-sm leading-7 text-gray-400">{card.text}</p><div className="mt-4 inline-flex items-center gap-2 text-sm font-black">{card.action}<ArrowLeft size={15} /></div></Link>)}</section>
    {academyArticles.length > 0 && <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black text-white">أكاديمية المونديال</h2><Link href="/articles" className="text-sm font-black text-[#0FF0FC]">كل المقالات</Link></div><div className="grid gap-4 md:grid-cols-3">{academyArticles.slice(0, 3).map((article) => <Link key={article.id} href={`/article/${article.id}`} className="rounded-2xl border border-white/8 bg-black/30 p-4 transition hover:border-[#0FF0FC]/25"><div className="mb-2 text-[11px] font-black text-[#FFD700]">{article.category}</div><h3 className="line-clamp-2 font-black text-white">{article.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-400">{article.excerpt}</p></Link>)}</div></section>}
  </main>;
}
