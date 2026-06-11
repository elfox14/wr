'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Activity, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, Clock, Filter, Play, Radio, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function normalizeGroupKey(value?: string | null) {
  if (!value) return 'غير محددة';
  return value.replace('Group', '').replace('المجموعة', '').trim().toUpperCase();
}
function groupHref(value?: string | null) { return `/groups#group-${encodeURIComponent(normalizeGroupKey(value))}`; }
function getMatchGroup(match: any) { return normalizeGroupKey(match.groupPhase || match.group || match.homeTeam?.group || match.awayTeam?.group); }
function getTeamHref(team: any) { return team?.id ? `/asset/${team.id}` : '/market?type=TEAM'; }
function hasAnimation(match: any) { return Boolean(match?.animationMatchId); }
function getAnimationHref(match: any) { return hasAnimation(match) ? `/animation-live?matchId=${encodeURIComponent(String(match.animationMatchId))}&lang=en&statsPanel=simple&teamPanel=1` : '/matches'; }

function TeamLogoLink({ team }: { team: any }) {
  return <Link href={getTeamHref(team)} onClick={(event) => event.stopPropagation()} className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/50 shadow-lg transition-transform hover:border-primary/50 group-hover:scale-105 md:h-24 md:w-24">{team?.image?.startsWith?.('http') ? <img src={team.image} alt={team.name} className="h-full w-full object-cover" /> : <span className="text-5xl">{team?.image || '⚽'}</span>}</Link>;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/matches').then((res) => (res.ok ? res.json() : [])).then((data) => setMatches(Array.isArray(data) ? data : [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const todayMatchesCount = matches.filter((m) => new Date(m.matchDate).toDateString() === new Date().toDateString()).length;
  const liveMatchesCount = matches.filter((m) => m.status === 'IN_PLAY' || m.status === 'LIVE').length;
  const upcomingMatchesCount = matches.filter((m) => m.status === 'SCHEDULED').length;
  const finishedMatchesCount = matches.filter((m) => m.status === 'FINISHED').length;
  const nextMatch = matches.filter((m) => m.status === 'SCHEDULED').sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())[0];
  const mostTradedMatch = [...matches].sort((a, b) => ((b.homeTeam?.marketDemand || 0) + (b.awayTeam?.marketDemand || 0) + (b.homeTeam?.momentum || 0) + (b.awayTeam?.momentum || 0)) - ((a.homeTeam?.marketDemand || 0) + (a.awayTeam?.marketDemand || 0) + (a.homeTeam?.momentum || 0) + (a.awayTeam?.momentum || 0)))[0];

  let filteredMatches = [...matches];
  if (activeTab === 'today') filteredMatches = filteredMatches.filter((m) => new Date(m.matchDate).toDateString() === new Date().toDateString());
  if (activeTab === 'live') filteredMatches = filteredMatches.filter((m) => m.status === 'IN_PLAY' || m.status === 'LIVE');
  if (activeTab === 'animation') filteredMatches = filteredMatches.filter((m) => hasAnimation(m));
  if (activeTab === 'upcoming') filteredMatches = filteredMatches.filter((m) => m.status === 'SCHEDULED');
  if (activeTab === 'finished') filteredMatches = filteredMatches.filter((m) => m.status === 'FINISHED');
  if (activeTab === 'groups') filteredMatches = filteredMatches.filter((m) => m.stage === 'group');
  if (activeTab === 'knockout') filteredMatches = filteredMatches.filter((m) => m.stage !== 'group');

  filteredMatches.sort((a, b) => {
    const rank = (m: any) => (m.status === 'IN_PLAY' || m.status === 'LIVE' ? 0 : hasAnimation(m) ? 1 : m.status === 'SCHEDULED' ? 2 : 3);
    if (sortBy === 'date') return rank(a) - rank(b) || new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
    if (sortBy === 'closest') return Math.abs(new Date(a.matchDate).getTime() - Date.now()) - Math.abs(new Date(b.matchDate).getTime() - Date.now());
    if (sortBy === 'demand') return ((b.homeTeam?.marketDemand || 0) + (b.awayTeam?.marketDemand || 0)) - ((a.homeTeam?.marketDemand || 0) + (a.awayTeam?.marketDemand || 0));
    if (sortBy === 'momentum') return ((b.homeTeam?.momentum || 0) + (b.awayTeam?.momentum || 0)) - ((a.homeTeam?.momentum || 0) + (a.awayTeam?.momentum || 0));
    return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
  });

  const statusDisplay = (status: string) => status === 'IN_PLAY' || status === 'LIVE' ? <span className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs font-bold text-red-500"><Play size={12} className="fill-current" /> مباشرة</span> : status === 'FINISHED' ? <span className="flex items-center gap-1 rounded bg-[#FFD700]/10 px-2 py-1 text-xs font-bold text-[#FFD700]"><CheckCircle2 size={12} /> انتهت</span> : <span className="flex items-center gap-1 rounded bg-[#0FF0FC]/10 px-2 py-1 text-xs font-bold text-[#0FF0FC]"><Clock size={12} /> قادمة</span>;

  return <div className="min-h-screen bg-background pb-20 text-foreground selection:bg-primary/30"><main className="mx-auto max-w-7xl px-4 py-6"><PageHeader title="مركز أسواق المباريات" description="حلّل المباريات، توقع النتائج، وتابع تأثير الفوز والخسارة على سوق الأصول الافتراضية." icon={<CalendarDays size={22} />} />
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"><SummaryCard icon={<CalendarDays size={20} />} label="مباريات اليوم" value={todayMatchesCount} /><SummaryCard icon={<Play size={20} />} label="مباشرة الآن" value={liveMatchesCount} accent="text-red-500" /><SummaryCard icon={<Clock size={20} />} label="قادمة" value={upcomingMatchesCount} accent="text-primary" /><SummaryCard icon={<CheckCircle2 size={20} />} label="انتهت" value={finishedMatchesCount} accent="text-[#FFD700]" /><SummaryCard icon={<Activity size={20} />} label="الأكثر تداولاً" value={mostTradedMatch ? `${mostTradedMatch.homeTeam?.code} ضد ${mostTradedMatch.awayTeam?.code}` : '-'} small /><SummaryCard icon={<Clock size={20} />} label="المباراة القادمة" value={nextMatch ? new Date(nextMatch.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} small /></div>
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex w-full gap-2 overflow-x-auto md:w-auto">{[{ id: 'all', label: 'الكل' }, { id: 'today', label: 'اليوم' }, { id: 'live', label: 'بث مباشر' }, { id: 'animation', label: 'بث أنيميشن فقط' }, { id: 'upcoming', label: 'قادمة' }, { id: 'finished', label: 'انتهت' }, { id: 'groups', label: 'المجموعات' }, { id: 'knockout', label: 'التصفيات' }].map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors ${activeTab === tab.id ? 'bg-primary text-black' : 'border border-white/5 bg-surface text-gray-400 hover:text-white'}`}>{tab.label}</button>)}</div><div className="flex w-full items-center gap-2 md:w-auto"><Filter size={16} className="text-gray-500" /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"><option value="date">الأهم أولًا</option><option value="closest">الأقرب موعداً</option><option value="demand">الأعلى طلباً</option><option value="momentum">الأعلى زخماً</option></select></div></div>
    {filteredMatches.length === 0 ? <EmptyMatches /> : <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{filteredMatches.map((match) => <MatchCard key={match.id} match={match} statusDisplay={statusDisplay} onOpen={() => router.push(`/matches/${match.id}`)} />)}</div>}
  </main></div>;
}

function SummaryCard({ icon, label, value, accent = 'text-gray-400', small = false }: { icon: React.ReactNode; label: string; value: number | string; accent?: string; small?: boolean }) { return <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-surface p-4 text-center shadow-card"><div className={`mb-2 ${accent}`}>{icon}</div><p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">{label}</p><p className={`${small ? 'text-sm' : 'text-2xl'} font-black text-white`}>{value}</p></div>; }
function EmptyMatches() { return <div className="rounded-3xl border border-white/5 bg-surface p-12 text-center shadow-card"><CalendarDays size={64} className="mx-auto mb-6 text-gray-500" /><h2 className="mb-2 text-2xl font-bold text-white">لا توجد مباريات</h2><p className="mx-auto max-w-md text-gray-400">لا توجد مباريات تطابق الفلتر الحالي.</p></div>; }

function MatchCard({ match, statusDisplay, onOpen }: { match: any; statusDisplay: (status: string) => React.ReactNode; onOpen: () => void }) {
  const groupKey = getMatchGroup(match);
  const animationAvailable = hasAnimation(match);
  return <div onClick={onOpen} className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/5 bg-surface p-6 shadow-card transition-all hover:border-primary/50">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2">{statusDisplay(match.status)}<span className="rounded bg-black/30 px-2 py-1 text-xs text-gray-500">{match.stage === 'group' ? 'دور المجموعات' : 'التصفيات'}</span><span className={`rounded px-2 py-1 text-xs font-black ${animationAvailable ? 'border border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' : 'border border-white/10 bg-white/5 text-gray-500'}`}>{animationAvailable ? 'بث أنيميشن متاح' : 'البث غير متاح بعد'}</span></div><div className="flex items-center gap-1 font-mono text-xs text-gray-400"><Clock size={12} />{new Date(match.matchDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} · {new Date(match.matchDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div></div>
    <div className="mb-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4"><TeamBlock team={match.homeTeam} /><div className="flex flex-col items-center justify-center gap-2"><Link href={groupHref(groupKey)} onClick={(event) => event.stopPropagation()} className="rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/20 hover:text-white">المجموعة {groupKey}</Link>{match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'FINISHED' ? <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-4xl font-black tracking-widest text-white shadow-inner md:text-5xl">{match.homeScore} - {match.awayScore}</div> : <div className="flex flex-col items-center gap-2"><div className="text-2xl font-black text-gray-600">VS</div><div className="h-10 w-px bg-white/10" /></div>}</div><TeamBlock team={match.awayTeam} /></div>
    <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-4"><Metric icon={<TrendingUp size={16} className="mx-auto mb-1 text-primary" />} label="زخم مشترك" value={((match.homeTeam?.momentum || 50) + (match.awayTeam?.momentum || 50)).toFixed(0)} /><Metric icon={<Activity size={16} className="mx-auto mb-1 text-orange-500" />} label="طلب السوق" value={((match.homeTeam?.marketDemand || 50) + (match.awayTeam?.marketDemand || 50)).toFixed(0)} /><Metric icon={<BarChart3 size={16} className="mx-auto mb-1 text-[#FFD700]" />} label="تأثير السعر" value="مرتفع" gold /></div>
    <div className="mt-4 flex flex-wrap justify-between gap-2">{animationAvailable ? <Link href={getAnimationHref(match)} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black"><Radio size={14} /> شاهد بث الأنيميشن</Link> : <span className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-gray-500"><Radio size={14} /> البث غير متاح بعد</span>}<span className="flex items-center gap-1 text-sm font-bold text-primary transition-transform group-hover:translate-x-[-4px]">تحليل المباراة <ChevronLeft size={16} /></span></div>
  </div>;
}
function TeamBlock({ team }: { team: any }) { return <div className="flex flex-col items-center gap-3 text-center"><TeamLogoLink team={team} /><div><Link href={getTeamHref(team)} onClick={(event) => event.stopPropagation()} className="text-lg font-black text-white transition-colors hover:text-primary md:text-xl">{team?.name}</Link><p className="mt-1 text-xs text-gray-500">#{team?.fifaRank || '?'} · {team?.marketPrice?.toLocaleString()}¢</p></div></div>; }
function Metric({ icon, label, value, gold = false }: { icon: React.ReactNode; label: string; value: string; gold?: boolean }) { return <div className="rounded-xl bg-black/20 p-3 text-center">{icon}<p className="mb-1 text-[10px] text-gray-500">{label}</p><p className={`font-mono font-bold ${gold ? 'text-[#FFD700]' : 'text-white'}`}>{value}</p></div>; }
