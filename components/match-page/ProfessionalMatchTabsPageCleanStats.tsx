'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerStatItem, MatchStatMetric } from '@/lib/match-page/types';

type TabId = 'overview' | 'events' | 'stats' | 'lineups' | 'analysis' | 'group' | 'articles';
type EventFilter = 'all' | 'goals' | 'cards' | 'subs' | 'home' | 'away' | 'critical';
type TeamLite = MatchPageData['homeTeam'];
type PlayerRow = MatchPlayerStatItem & { teamLabel?: string | null };

const ar = new Intl.NumberFormat('ar-EG');
const statPriority = ['possession', 'xg', 'npxg', 'bigChances', 'shots', 'shotsOnTarget', 'shotsOffTarget', 'blockedShots', 'shotsInsideBox', 'shotsOutsideBox', 'corners', 'fouls', 'offsides', 'yellowCards', 'redCards', 'passes', 'accuratePasses', 'tackles', 'interceptions', 'clearances', 'ballRecoveries', 'saves', 'attacks', 'dangerousAttacks'];
const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'events', label: 'الأحداث' },
  { id: 'stats', label: 'كل الإحصائيات' },
  { id: 'lineups', label: 'التشكيلات وأداء اللاعبين' },
  { id: 'analysis', label: 'التحليل' },
  { id: 'group', label: 'المجموعة' },
  { id: 'articles', label: 'المقالات' },
];

function fmt(value: number | string | boolean | null | undefined, suffix = '') {
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${Number.isInteger(n) ? ar.format(n) : n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}

function normalize(value?: string | number | null) {
  return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function teamName(team: { code?: string | null; name?: string | null }) {
  return getArabicTeamName(team.code, team.name);
}

function flagUrl(team: TeamLite, width = 160) {
  return getTeamFlagUrl({ code: team.code, name: teamName(team), image: team.image }, width) || team.image || null;
}

function sortedMetrics(metrics: MatchStatMetric[]) {
  return [...metrics].sort((a, b) => {
    const ai = statPriority.indexOf(a.key);
    const bi = statPriority.indexOf(b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.label.localeCompare(b.label, 'ar');
  });
}

function availableMetrics(data: MatchPageData) {
  return sortedMetrics(data.stats.filter((metric) => metric.available && (metric.home !== null || metric.away !== null)));
}

function eventKind(event: MatchEventView) {
  const text = normalize(`${event.type || ''} ${event.detail || ''}`);
  if (text.includes('goal') || text.includes('هدف')) return 'goal';
  if (text.includes('red') || text.includes('حمراء') || text.includes('طرد')) return 'red';
  if (text.includes('yellow') || text.includes('صفراء')) return 'yellow';
  if (text.includes('sub') || text.includes('تبديل')) return 'sub';
  if (text.includes('penalty') || text.includes('جزاء')) return 'penalty';
  if (text.includes('var')) return 'var';
  if (text.includes('corner') || text.includes('ركنية')) return 'corner';
  if (text.includes('shot') || text.includes('تسديد')) return 'shot';
  return 'event';
}

function eventMeta(event: MatchEventView) {
  const kind = eventKind(event);
  if (kind === 'goal') return { label: 'هدف', icon: '⚽', tone: 'border-[#F8C846]/35 bg-[#F8C846]/10', critical: true };
  if (kind === 'red') return { label: 'بطاقة حمراء', icon: '🟥', tone: 'border-red-400/35 bg-red-500/10', critical: true };
  if (kind === 'yellow') return { label: 'بطاقة صفراء', icon: '🟨', tone: 'border-[#F8C846]/30 bg-[#F8C846]/10', critical: false };
  if (kind === 'sub') return { label: 'تبديل', icon: '🔁', tone: 'border-sky-300/30 bg-sky-400/10', critical: false };
  if (kind === 'penalty') return { label: 'ركلة جزاء', icon: '🥅', tone: 'border-[#18E58F]/35 bg-[#18E58F]/10', critical: true };
  if (kind === 'var') return { label: 'VAR', icon: '📺', tone: 'border-purple-300/30 bg-purple-400/10', critical: true };
  if (kind === 'corner') return { label: 'ركنية', icon: '🚩', tone: 'border-cyan-300/30 bg-cyan-400/10', critical: false };
  if (kind === 'shot') return { label: 'تسديدة', icon: '🎯', tone: 'border-white/15 bg-white/10', critical: false };
  return { label: event.type || 'حدث', icon: event.icon || '●', tone: 'border-white/10 bg-black/25', critical: false };
}

function eventSide(event: MatchEventView, data: MatchPageData): 'home' | 'away' | 'neutral' {
  if (event.teamId === data.homeTeam.id || event.teamId === data.homeTeam.code) return 'home';
  if (event.teamId === data.awayTeam.id || event.teamId === data.awayTeam.code) return 'away';
  const text = normalize(`${event.playerName || ''} ${event.detail || ''}`);
  const home = normalize(teamName(data.homeTeam));
  const away = normalize(teamName(data.awayTeam));
  if (home && text.includes(home)) return 'home';
  if (away && text.includes(away)) return 'away';
  return 'neutral';
}

function eventTeam(event: MatchEventView, data: MatchPageData) {
  const side = eventSide(event, data);
  if (side === 'home') return teamName(data.homeTeam);
  if (side === 'away') return teamName(data.awayTeam);
  return 'المباراة';
}

function filterEvents(events: MatchEventView[], filter: EventFilter, data: MatchPageData) {
  return events.filter((event) => {
    const kind = eventKind(event);
    const side = eventSide(event, data);
    if (filter === 'goals') return kind === 'goal' || kind === 'penalty';
    if (filter === 'cards') return kind === 'yellow' || kind === 'red';
    if (filter === 'subs') return kind === 'sub';
    if (filter === 'home') return side === 'home';
    if (filter === 'away') return side === 'away';
    if (filter === 'critical') return eventMeta(event).critical;
    return true;
  });
}

function statusTone(kind: MatchPageData['status']['kind']) {
  if (kind === 'live') return 'border-[#18E58F]/35 bg-[#18E58F]/10 text-[#18E58F]';
  if (kind === 'halftime') return 'border-[#F8C846]/35 bg-[#F8C846]/10 text-[#F8C846]';
  if (kind === 'finished') return 'border-sky-300/30 bg-sky-300/10 text-sky-100';
  return 'border-white/10 bg-white/10 text-slate-200';
}

function Flag({ team, small = false }: { team: TeamLite; small?: boolean }) {
  const src = flagUrl(team, small ? 80 : 160);
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-6 w-8 rounded-lg' : 'h-14 w-16 rounded-2xl sm:h-20 sm:w-24'}`}>{src ? <img src={src} alt={teamName(team)} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || '—'}</b>}</span>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>;
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:p-5"><div className="mb-4"><h2 className="text-lg font-black text-white sm:text-xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{hint}</p> : null}</div>{children}</section>;
}

function MatchHeader({ data }: { data: MatchPageData }) {
  return <header className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_24px_70px_rgba(0,0,0,.24)] sm:p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(data.status.kind)}`}>{data.status.shortLabel || data.status.label}{data.status.minute ? ` · د${ar.format(data.status.minute)}` : ''}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-black text-slate-300">{data.groupLabel || data.stageLabel}</span></div><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold text-slate-400">آخر تحديث: {data.lastUpdatedAt ? fullDate(data.lastUpdatedAt) : 'غير متوفر'}</span></div><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5"><div className="flex min-w-0 items-center gap-3 text-right"><Flag team={data.homeTeam} /><div className="min-w-0"><h1 className="truncate text-base font-black text-white sm:text-2xl">{teamName(data.homeTeam)}</h1><p className="mt-1 text-[11px] font-bold text-slate-400">{data.homeTeam.code || '—'}</p></div></div><div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-center sm:px-6 sm:py-3"><div className="flex items-center justify-center gap-2 tabular-nums sm:gap-4"><b className="text-4xl font-black text-[#F8C846] sm:text-6xl">{fmt(data.score.home)}</b><span className="text-2xl font-black text-white/60 sm:text-5xl">-</span><b className="text-4xl font-black text-white sm:text-6xl">{fmt(data.score.away)}</b></div><p className="mt-1 text-[11px] font-bold text-slate-400">{data.status.isScheduled ? fullDate(data.matchDate) : data.status.label}</p></div><div className="flex min-w-0 items-center justify-end gap-3 text-left sm:flex-row-reverse sm:text-right"><Flag team={data.awayTeam} /><div className="min-w-0"><h1 className="truncate text-base font-black text-white sm:text-2xl">{teamName(data.awayTeam)}</h1><p className="mt-1 text-[11px] font-bold text-slate-400">{data.awayTeam.code || '—'}</p></div></div></div><div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-300 sm:grid-cols-3"><span><b className="text-[#18E58F]">الموعد:</b> {fullDate(data.matchDate)}</span><span><b className="text-[#18E58F]">الملعب:</b> {data.venue || 'غير متوفر'}</span><span><b className="text-[#18E58F]">الحكم:</b> {data.referee || 'غير متوفر'}</span></div></header>;
}

function StatCard({ metric, compact = false }: { metric: MatchStatMetric; compact?: boolean }) {
  const home = Number(metric.home ?? 0);
  const away = Number(metric.away ?? 0);
  const total = Math.abs(home) + Math.abs(away);
  const homeWidth = total ? Math.max(8, Math.round((Math.abs(home) / total) * 100)) : 50;
  return <article className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center justify-between gap-3"><b className={`${compact ? 'text-sm' : 'text-lg'} text-[#F8C846] tabular-nums`}>{fmt(metric.home, metric.suffix)}</b><div className="min-w-0 text-center"><p className="truncate text-xs font-black text-white">{metric.label}</p></div><b className={`${compact ? 'text-sm' : 'text-lg'} text-[#18E58F] tabular-nums`}>{fmt(metric.away, metric.suffix)}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#18E58F]/35"><div className="h-full rounded-full bg-[#F8C846]" style={{ width: `${homeWidth}%` }} /></div></article>;
}

function QuickStats({ data }: { data: MatchPageData }) {
  const metrics = availableMetrics(data).slice(0, 5);
  if (!metrics.length) return null;
  return <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{metrics.map((metric) => <StatCard key={metric.key} metric={metric} compact />)}</section>;
}

function participatedPlayers(data: MatchPageData): PlayerRow[] {
  const rows = (data.advanced.playerStats || []) as PlayerRow[];
  const participants = rows.filter((player) => {
    const minutes = Number(player.minutes || 0);
    return player.started === true || minutes > 0 || Boolean(player.playerSubbedOn) || Boolean(player.playerSubbedOff);
  });
  const source = participants.length ? participants : rows.filter((player) => player.rating !== null && player.rating !== undefined);
  return [...source].sort((a, b) => {
    const teamOrder = String(a.teamId || a.teamName || '').localeCompare(String(b.teamId || b.teamName || ''));
    if (teamOrder !== 0) return teamOrder;
    const aStarted = a.started === true ? 0 : 1;
    const bStarted = b.started === true ? 0 : 1;
    if (aStarted !== bStarted) return aStarted - bStarted;
    return Number(b.minutes || 0) - Number(a.minutes || 0);
  });
}

function playerParticipationLabel(player: PlayerRow) {
  if (player.started === true && player.playerSubbedOff) return 'أساسي · خرج مستبدلًا';
  if (player.started === true) return 'أساسي';
  if (player.playerSubbedOn) return 'بديل · دخل المباراة';
  if (Number(player.minutes || 0) > 0) return 'شارك في المباراة';
  return 'تقييم نهائي محفوظ';
}

function Tabs({ active, setActive, data, events }: { active: TabId; setActive: (id: TabId) => void; data: MatchPageData; events: MatchEventView[] }) {
  const counts: Partial<Record<TabId, number>> = { events: events.length, stats: availableMetrics(data).length, lineups: participatedPlayers(data).length, articles: data.relatedArticles.length };
  return <nav className="sticky top-0 z-30 rounded-2xl border border-white/10 bg-[#07110D]/95 p-2 shadow-xl backdrop-blur"><div className="flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActive(tab.id)} aria-pressed={active === tab.id} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${active === tab.id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><span>{tab.label}</span>{counts[tab.id] ? <b className={`rounded-full px-1.5 py-0.5 text-[10px] ${active === tab.id ? 'bg-black/15 text-black' : 'bg-white/10 text-slate-300'}`}>{ar.format(counts[tab.id] || 0)}</b> : null}</button>)}</div></nav>;
}

function OverviewPanel({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const metrics = availableMetrics(data);
  const criticalEvents = events.filter((event) => eventMeta(event).critical).slice(-4);
  return <Panel title="نظرة عامة" hint="ملخص سريع لأرقام المباراة النهائية المتاحة."><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4"><div className="rounded-2xl border border-[#18E58F]/20 bg-[#18E58F]/[0.055] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black text-[#18E58F]">إحصائيات المباراة</h3><span className="rounded-full border border-[#18E58F]/25 bg-black/20 px-3 py-1 text-[11px] font-black text-[#18E58F]">{ar.format(metrics.length)} رقم متاح</span></div><p className="mt-1 text-xs font-bold leading-6 text-slate-400">كل الأرقام المتاحة تظهر هنا بدون اختصار.</p></div>{metrics.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <StatCard key={metric.key} metric={metric} compact />)}</div> : <Empty title="لا توجد إحصائيات متاحة" body="ستظهر الإحصائيات عند اعتماد أرقام المباراة." />}</div><aside className="rounded-2xl border border-white/10 bg-black/25 p-3"><h3 className="mb-3 text-sm font-black text-[#F8C846]">لحظات مؤثرة</h3>{criticalEvents.length ? <div className="space-y-2">{criticalEvents.map((event) => <MiniEvent key={event.id} event={event} data={data} />)}</div> : <p className="text-xs font-bold leading-6 text-slate-400">لم يتم تسجيل لحظات حاسمة بعد.</p>}</aside></div></Panel>;
}

function MiniEvent({ event, data }: { event: MatchEventView; data: MatchPageData }) {
  const meta = eventMeta(event);
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2"><div className="flex items-center gap-2"><span className="w-10 rounded-lg bg-black/30 px-2 py-1 text-center text-[11px] font-black text-[#F8C846]">{event.minuteLabel || '—'}</span><span className="text-lg">{meta.icon}</span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{event.playerName || event.detail || meta.label}</b><p className="truncate text-[10px] font-bold text-slate-500">{eventTeam(event, data)}</p></div></div></div>;
}

function EventFilterBar({ active, setActive, data, events }: { active: EventFilter; setActive: (f: EventFilter) => void; data: MatchPageData; events: MatchEventView[] }) {
  const filters: Array<{ id: EventFilter; label: string }> = [
    { id: 'all', label: 'الكل' },
    { id: 'goals', label: 'الأهداف' },
    { id: 'cards', label: 'البطاقات' },
    { id: 'subs', label: 'التبديلات' },
    { id: 'home', label: teamName(data.homeTeam) },
    { id: 'away', label: teamName(data.awayTeam) },
    { id: 'critical', label: 'حاسمة' },
  ];
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-2"><div className="flex gap-2 overflow-x-auto pb-1">{filters.map((filter) => <button key={filter.id} onClick={() => setActive(filter.id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black ${active === filter.id ? 'border-[#F8C846]/45 bg-[#F8C846] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><span>{filter.label}</span><b className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{ar.format(filterEvents(events, filter.id, data).length)}</b></button>)}</div></div>;
}

function EventRow({ event, data }: { event: MatchEventView; data: MatchPageData }) {
  const meta = eventMeta(event);
  return <article className={`grid grid-cols-[46px_38px_minmax(0,1fr)] gap-3 rounded-2xl border p-3 ${meta.tone}`}><span className="text-left"><b className="inline-flex min-w-11 justify-center rounded-lg bg-black/35 px-2 py-1 text-xs text-[#F8C846]">{event.minuteLabel || '—'}</b></span><span className="text-xl">{meta.icon}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-white">{meta.label}</b>{meta.critical ? <span className="rounded-full border border-[#F8C846]/30 bg-[#F8C846]/10 px-2 py-0.5 text-[10px] font-black text-[#F8C846]">لحظة حاسمة</span> : null}<span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold text-slate-300">{eventTeam(event, data)}</span></div><p className="mt-1 truncate text-sm font-black text-white">{event.playerName || event.detail || meta.label}</p>{event.detail && event.detail !== event.playerName ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{event.detail}</p> : null}</div></article>;
}

function EventsPanel({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const rows = useMemo(() => filterEvents(events, filter, data), [events, filter, data]);
  return <Panel title="أحداث المباراة"><div className="space-y-3"><EventFilterBar active={filter} setActive={setFilter} data={data} events={events} />{rows.length ? <div className="space-y-2">{rows.map((event) => <EventRow key={event.id} event={event} data={data} />)}</div> : <Empty title="لا توجد أحداث مطابقة" body="جرّب فلترًا آخر." />}</div></Panel>;
}

function StatsPanel({ data }: { data: MatchPageData }) {
  const metrics = availableMetrics(data);
  return <Panel title="كل الإحصائيات" hint="جميع أرقام المباراة المتاحة في مكان واحد.">{metrics.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <StatCard key={metric.key} metric={metric} compact />)}</div> : <Empty title="لا توجد إحصائيات متاحة" body="ستظهر الإحصائيات عند اعتماد أرقام المباراة." />}</Panel>;
}

function PlayersPanel({ data }: { data: MatchPageData }) {
  const players = participatedPlayers(data);
  return <Panel title="التشكيلات وأداء اللاعبين" hint="اللاعبون الذين شاركوا في المباراة مع التقييم عند توفره.">{players.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{players.map((player, index) => <article key={`${player.playerId || player.playerName}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{player.playerName}</b><p className="mt-1 text-[11px] font-bold text-slate-500">{player.teamName || (player.teamId === data.homeTeam.id ? teamName(data.homeTeam) : player.teamId === data.awayTeam.id ? teamName(data.awayTeam) : '—')}</p></div><span className="rounded-xl border border-[#18E58F]/20 bg-[#18E58F]/10 px-2 py-1 text-xs font-black text-[#18E58F]">{fmt(player.rating)}</span></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-slate-300">{playerParticipationLabel(player)}</span>{player.position ? <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-slate-400">{player.position}</span> : null}</div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-slate-400"><span className="rounded-xl bg-white/[0.04] p-2"><b className="block text-white">{fmt(player.minutes)}</b>دقائق</span><span className="rounded-xl bg-white/[0.04] p-2"><b className="block text-white">{fmt(player.goals)}</b>أهداف</span><span className="rounded-xl bg-white/[0.04] p-2"><b className="block text-white">{fmt(player.assists)}</b>أسيست</span></div></article>)}</div> : <Empty title="لا توجد تقييمات للمشاركين" body="ستظهر التقييمات عند اعتماد بيانات اللاعبين." />}</Panel>;
}

function AnalysisPanel({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const critical = events.filter((event) => eventMeta(event).critical).slice(-5);
  return <Panel title="التحليل"><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2">{data.tacticalKeys.map((item, index) => <p key={index} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm font-bold leading-7 text-slate-300">{item}</p>)}</div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><h3 className="mb-3 text-sm font-black text-[#F8C846]">اللحظات المؤثرة</h3>{critical.length ? <div className="space-y-2">{critical.map((event) => <MiniEvent key={event.id} event={event} data={data} />)}</div> : <p className="text-xs font-bold text-slate-400">لا توجد لحظات حاسمة.</p>}</div></div></Panel>;
}

function GroupPanel({ data }: { data: MatchPageData }) {
  const rows = data.groupStandings;
  return <Panel title="المجموعة">{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-right text-xs"><thead className="text-slate-500"><tr><th className="p-2">#</th><th className="p-2">المنتخب</th><th className="p-2">لعب</th><th className="p-2">ف</th><th className="p-2">ت</th><th className="p-2">خ</th><th className="p-2">+/-</th><th className="p-2">نقاط</th></tr></thead><tbody className="divide-y divide-white/10">{rows.map((row) => <tr key={row.teamId}><td className="p-2 font-black">{ar.format(row.rank)}</td><td className="p-2 font-black text-white">{teamName({ code: row.code, name: row.teamName })}</td><td className="p-2">{ar.format(row.played)}</td><td className="p-2">{ar.format(row.won)}</td><td className="p-2">{ar.format(row.drawn)}</td><td className="p-2">{ar.format(row.lost)}</td><td className="p-2">{row.goalDifference > 0 ? '+' : ''}{ar.format(row.goalDifference)}</td><td className="p-2 font-black text-[#F8C846]">{ar.format(row.points)}</td></tr>)}</tbody></table></div> : <Empty title="لا يوجد ترتيب متاح" body="سيظهر جدول المجموعة عند توفره." />}</Panel>;
}

function ArticlesPanel({ data }: { data: MatchPageData }) {
  return <Panel title="المقالات"><div className="grid gap-3 md:grid-cols-2">{data.relatedArticles.length ? data.relatedArticles.map((article) => <a key={article.id} href={article.href} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-[#18E58F]/30"><span className="mb-2 inline-flex rounded-full border border-[#18E58F]/20 px-3 py-1 text-[11px] font-black text-[#18E58F]">{article.label}</span><h3 className="font-black text-white">{article.title}</h3><p className="mt-2 text-xs font-bold leading-6 text-slate-400">{article.summary}</p></a>) : <Empty title="لا توجد مقالات مرتبطة" body="سيظهر التحليل بعد اعتماده." />}</div></Panel>;
}

function SideSummary({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const goals = events.filter((event) => ['goal', 'penalty'].includes(eventKind(event)));
  const cards = events.filter((event) => ['yellow', 'red'].includes(eventKind(event)));
  const best = [...participatedPlayers(data)].filter((p) => p.rating !== null && p.rating !== undefined).sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))[0];
  return <aside className="hidden lg:block"><div className="sticky top-[72px] space-y-3"><section className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4"><h3 className="mb-3 text-sm font-black text-white">ملخص المباراة</h3><div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-slate-400">النتيجة</p><b className="mt-1 block text-3xl font-black"><span className="text-[#F8C846]">{fmt(data.score.home)}</span> - <span>{fmt(data.score.away)}</span></b></div><div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded-2xl bg-black/25 p-3"><b className="block text-xl text-[#F8C846]">{ar.format(goals.length)}</b><span className="text-[11px] text-slate-400">أهداف</span></div><div className="rounded-2xl bg-black/25 p-3"><b className="block text-xl text-red-200">{ar.format(cards.length)}</b><span className="text-[11px] text-slate-400">بطاقات</span></div></div></section><section className="rounded-[1.35rem] border border-[#18E58F]/15 bg-[#18E58F]/[0.045] p-4"><h3 className="mb-2 text-sm font-black text-[#18E58F]">أفضل تقييم</h3>{best ? <p className="text-sm font-bold text-slate-300"><b className="text-white">{best.playerName}</b> · <span className="text-[#18E58F]">{fmt(best.rating)}</span></p> : <p className="text-xs font-bold text-slate-400">سيظهر عند توفر تقييمات اللاعبين.</p>}</section></div></aside>;
}

function defaultTab(data: MatchPageData): TabId {
  if (data.status.isLive) return 'events';
  return 'overview';
}

export default function ProfessionalMatchTabsPageCleanStats({ data }: { data: MatchPageData }) {
  const [active, setActive] = useState<TabId>(() => defaultTab(data));
  const events = useMemo(() => data.events || [], [data.events]);
  return <main className="min-h-screen bg-[#07110D] px-3 py-3 text-white lg:px-6" dir="rtl"><MatchAutoRefresh intervalMs={data.status.isLive ? 25000 : 90000} /><div className="mx-auto max-w-7xl space-y-4"><MatchHeader data={data} /><QuickStats data={data} /><Tabs active={active} setActive={setActive} data={data} events={events} /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><section className="min-w-0">{active === 'overview' ? <OverviewPanel data={data} events={events} /> : null}{active === 'events' ? <EventsPanel data={data} events={events} /> : null}{active === 'stats' ? <StatsPanel data={data} /> : null}{active === 'lineups' ? <PlayersPanel data={data} /> : null}{active === 'analysis' ? <AnalysisPanel data={data} events={events} /> : null}{active === 'group' ? <GroupPanel data={data} /> : null}{active === 'articles' ? <ArticlesPanel data={data} /> : null}</section><SideSummary data={data} events={events} /></div></div></main>;
}
