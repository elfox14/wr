'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock, Filter, Play, Radio } from 'lucide-react';

type Team = { id?: string; name?: string; code?: string; image?: string };
type Match = { id: string; status: string; matchDate: string; homeScore?: number; awayScore?: number; homeTeam?: Team | null; awayTeam?: Team | null; groupPhase?: string; group?: string; stage?: string; animationMatchId?: string | number | null };

function normalizeGroupKey(value?: string | null) { return value ? value.replace('Group', '').replace('المجموعة', '').trim().toUpperCase() : 'غير محددة'; }
function getMatchGroup(match: Match) { return normalizeGroupKey(match.groupPhase || match.group || match.homeTeam?.code || match.awayTeam?.code); }
function hasAnimation(match: Match) { return Boolean(match.animationMatchId); }
function isLiveStatus(status?: string) { const value = String(status || '').toUpperCase(); return value === 'IN_PLAY' || value === 'LIVE' || value === 'HT'; }
function isFinished(status?: string) { return String(status || '').toUpperCase() === 'FINISHED'; }
function startOfDay(value: Date) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function addDays(value: Date, days: number) { const date = new Date(value); date.setDate(date.getDate() + days); return date; }
function isSameDay(value: string | Date, target: Date) { return startOfDay(new Date(value)).getTime() === startOfDay(target).getTime(); }
function teamImage(team?: Team | null) { return team?.image?.startsWith?.('http') ? <img src={team.image} alt="" className="h-full w-full object-cover" /> : <span className="text-4xl">{team?.image || '⚽'}</span>; }

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');

  useEffect(() => {
    fetch('/api/matches').then((res) => (res.ok ? res.json() : [])).then((data) => setMatches(Array.isArray(data) ? data : [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const today = new Date();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const todayMatchesCount = matches.filter((m) => isSameDay(m.matchDate, today)).length;
  const liveMatchesCount = matches.filter((m) => isLiveStatus(m.status)).length;
  const upcomingMatchesCount = matches.filter((m) => String(m.status).toUpperCase() === 'SCHEDULED').length;
  const finishedMatchesCount = matches.filter((m) => isFinished(m.status)).length;
  const groupOptions = Array.from(new Set(matches.map(getMatchGroup).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  let filteredMatches = [...matches];
  if (activeTab === 'yesterday') filteredMatches = filteredMatches.filter((m) => isSameDay(m.matchDate, yesterday));
  if (activeTab === 'today') filteredMatches = filteredMatches.filter((m) => isSameDay(m.matchDate, today));
  if (activeTab === 'tomorrow') filteredMatches = filteredMatches.filter((m) => isSameDay(m.matchDate, tomorrow));
  if (activeTab === 'live') filteredMatches = filteredMatches.filter((m) => isLiveStatus(m.status));
  if (activeTab === 'animation') filteredMatches = filteredMatches.filter((m) => hasAnimation(m));
  if (activeTab === 'upcoming') filteredMatches = filteredMatches.filter((m) => String(m.status).toUpperCase() === 'SCHEDULED');
  if (activeTab === 'finished') filteredMatches = filteredMatches.filter((m) => isFinished(m.status));
  if (selectedGroup !== 'all') filteredMatches = filteredMatches.filter((m) => getMatchGroup(m) === selectedGroup);
  filteredMatches.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  const tabs = [{ id: 'all', label: 'الكل' }, { id: 'yesterday', label: 'أمس' }, { id: 'today', label: 'اليوم' }, { id: 'tomorrow', label: 'غدًا' }, { id: 'live', label: 'مباشر' }, { id: 'animation', label: 'بث تفاعلي' }, { id: 'upcoming', label: 'قادمة' }, { id: 'finished', label: 'انتهت' }];

  return <div className="min-h-screen bg-background pb-20 text-foreground"><main className="mx-auto max-w-7xl px-4 py-6"><section className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0FF0FC]">MC PRIME World Cup</p><h1 className="text-xl font-black text-white md:text-2xl">مركز المباريات</h1><p className="truncate whitespace-nowrap text-xs font-bold text-gray-400 md:text-sm">تابع المواعيد والنتائج وحالة كل مباراة.</p></section><div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4"><SummaryCard icon={<CalendarDays size={20} />} label="مباريات اليوم" value={todayMatchesCount} /><SummaryCard icon={<Play size={20} />} label="مباشرة الآن" value={liveMatchesCount} /><SummaryCard icon={<Clock size={20} />} label="قادمة" value={upcomingMatchesCount} /><SummaryCard icon={<CheckCircle2 size={20} />} label="انتهت" value={finishedMatchesCount} /></div><div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex w-full gap-2 overflow-x-auto lg:w-auto">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${activeTab === tab.id ? 'bg-primary text-black' : 'border border-white/5 bg-surface text-gray-400 hover:text-white'}`}>{tab.label}</button>)}</div><label className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-2"><Filter size={16} className="text-primary" /><span className="text-xs font-bold text-gray-500">المجموعة</span><select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)} className="bg-transparent text-sm font-bold text-white focus:outline-none"><option value="all">كل المجموعات</option>{groupOptions.map((group) => <option key={group} value={group}>المجموعة {group}</option>)}</select></label></div>{filteredMatches.length === 0 ? <EmptyMatches /> : <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{filteredMatches.map((match) => <MatchCard key={match.id} match={match} />)}</div>}</main></div>;
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) { return <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-surface p-4 text-center"><div className="mb-2 text-[#0FF0FC]">{icon}</div><p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">{label}</p><p className="text-2xl font-black text-white">{value}</p></div>; }
function EmptyMatches() { return <div className="rounded-3xl border border-white/5 bg-surface p-12 text-center"><CalendarDays size={64} className="mx-auto mb-6 text-gray-500" /><h2 className="mb-2 text-2xl font-bold text-white">لا توجد مباريات</h2><p className="mx-auto max-w-md text-gray-400">لا توجد مباريات تطابق الفلتر الحالي.</p></div>; }
function MatchCard({ match }: { match: Match }) { const live = isLiveStatus(match.status); const finished = isFinished(match.status); const scoreVisible = live || finished; return <article className="rounded-3xl border border-white/5 bg-surface p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><span className={`rounded px-2 py-1 text-xs font-bold ${live ? 'bg-emerald-400/10 text-emerald-300' : finished ? 'bg-gray-500/10 text-gray-400' : 'bg-orange-400/10 text-orange-300'}`}>{live ? 'مباشرة' : finished ? 'انتهت' : 'قريبًا'}</span><span className="text-xs text-gray-400">{new Date(match.matchDate).toLocaleString('ar-EG')}</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div><div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">{teamImage(match.homeTeam)}</div><h2 className="line-clamp-1 font-black text-white">{match.homeTeam?.name || 'الفريق الأول'}</h2></div><div className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-xl font-black text-[#FFD700]">{scoreVisible ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : 'VS'}</div><div><div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">{teamImage(match.awayTeam)}</div><h2 className="line-clamp-1 font-black text-white">{match.awayTeam?.name || 'الفريق الثاني'}</h2></div></div>{hasAnimation(match) && <Link href={`/animation-live/player?matchId=${encodeURIComponent(String(match.animationMatchId))}&dbMatchId=${encodeURIComponent(String(match.id))}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700]"><Radio size={16} /> دخول البث التفاعلي</Link>}</article>; }
