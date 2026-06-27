'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, Layers, List, MapPin, Pause, Play, Radio, RefreshCw, Share2, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchPlayerStatItem, MatchStatMetric, StandingRow } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');

type TabId = 'overview' | 'events' | 'lineups' | 'interactive' | 'analysis' | 'group' | 'articles';
type EventFilter = 'all' | 'goals' | 'cards' | 'subs' | 'home' | 'away' | 'critical';
type EventKindKey = 'goal' | 'red' | 'yellow' | 'substitution' | 'var' | 'penalty' | 'corner' | 'shot' | 'foul' | 'event';
type TeamLite = MatchPageData['homeTeam'];
type AnyPlayer = Record<string, any>;
type PlayerStat = MatchPlayerStatItem & Record<string, any>;
type EventPoint = MatchEventView & { index: number; side: 'home' | 'away' | 'neutral'; xPos: number; yPos: number; playerImage?: string | null; playerNumber?: string | null; teamName: string; hasExactCoordinates: boolean };

const TABS: Array<{ id: TabId; label: string; short: string; icon: any }> = [
  { id: 'overview', label: 'نظرة عامة', short: 'نظرة', icon: Layers },
  { id: 'events', label: 'الأحداث', short: 'أحداث', icon: Radio },
  { id: 'lineups', label: 'التشكيلات واللاعبون', short: 'تشكيل', icon: Users },
  { id: 'interactive', label: 'الملعب التفاعلي', short: 'ملعب', icon: MapPin },
  { id: 'analysis', label: 'تحليل تكتيكي', short: 'تحليل', icon: FileText },
  { id: 'group', label: 'المجموعة', short: 'مجموعة', icon: Trophy },
  { id: 'articles', label: 'المقالات', short: 'مقالات', icon: List },
];

const PLAYER_STAT_DEFS: Array<[string, string]> = [
  ['rating', 'تقييم'], ['minutes', 'دقائق'], ['goals', 'أهداف'], ['assists', 'أسيست'],
  ['shots', 'تسديد'], ['shotsOnTarget', 'على المرمى'], ['expectedGoals', 'xG'], ['expectedAssists', 'xA'],
  ['passes', 'تمرير'], ['accuratePasses', 'تمرير صحيح'], ['keyPasses', 'تمرير مفتاحي'],
  ['touches', 'لمسات'], ['tackles', 'تدخلات'], ['interceptions', 'اعتراضات'], ['clearances', 'تشتيت'], ['saves', 'تصديات'],
  ['yellowCards', 'صفراء'], ['redCards', 'حمراء'], ['playerSubbedOn', 'دخل بديلًا'], ['playerSubbedOff', 'خرج مستبدلًا'],
];

function fmt(value: number | string | boolean | null | undefined, suffix = '') {
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value).trim();
  const n = Number(text);
  if (!Number.isFinite(n)) return text || '—';
  return `${Number.isInteger(n) ? ar.format(n) : n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function timeOnly(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function normalizeName(value?: string | number | null) {
  return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function displayTeamName(team: { code?: string | null; name?: string | null }) {
  return getArabicTeamName(team.code, team.name);
}

function displayTeamFlagUrl(team: { code?: string | null; name?: string | null; image?: string | null }, width = 160) {
  return getTeamFlagUrl({ code: team.code, name: displayTeamName(team), image: team.image }, width) || team.image || null;
}

function initials(name?: string | null) {
  return String(name || 'لاعب').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '؟';
}

function numberValue(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) return String(n);
  }
  return '';
}

function playerNumber(player: AnyPlayer | null | undefined) {
  return player?.number ?? player?.shirtNumber ?? player?.jerseyNumber ?? player?.playerNumber ?? null;
}

function statNumber(stat?: PlayerStat | null) {
  return numberValue(stat?.number, stat?.shirtNumber, stat?.jerseyNumber, stat?.playerNumber);
}

function eventKindKey(event: MatchEventView): EventKindKey {
  const raw = normalizeName(`${event.type || ''} ${event.detail || ''}`);
  if (raw.includes('goal') || raw.includes('هدف')) return 'goal';
  if (raw.includes('red') || raw.includes('حمراء') || raw.includes('طرد')) return 'red';
  if (raw.includes('yellow') || raw.includes('صفراء')) return 'yellow';
  if (raw.includes('sub') || raw.includes('تبديل')) return 'substitution';
  if (raw.includes('var')) return 'var';
  if (raw.includes('penalty') || raw.includes('ركلة جزاء')) return 'penalty';
  if (raw.includes('corner') || raw.includes('ركنية')) return 'corner';
  if (raw.includes('shot') || raw.includes('تسديد')) return 'shot';
  if (raw.includes('foul') || raw.includes('خطأ')) return 'foul';
  return 'event';
}

function eventMeta(event: MatchEventView) {
  const kind = eventKindKey(event);
  const map: Record<EventKindKey, { label: string; icon: string; tone: string; line: string; baseX: number; critical: boolean }> = {
    goal: { label: 'هدف', icon: '⚽', tone: 'border-[#F8C846]/45 bg-[#F8C846] text-black', line: 'bg-[#F8C846]', baseX: 88, critical: true },
    red: { label: 'بطاقة حمراء', icon: '🟥', tone: 'border-red-300/45 bg-red-500 text-white', line: 'bg-red-500', baseX: 47, critical: true },
    yellow: { label: 'بطاقة صفراء', icon: '🟨', tone: 'border-yellow-100/45 bg-yellow-300 text-black', line: 'bg-yellow-300', baseX: 47, critical: false },
    substitution: { label: 'تبديل', icon: '🔁', tone: 'border-sky-100/40 bg-sky-300 text-black', line: 'bg-sky-300', baseX: 24, critical: false },
    var: { label: 'VAR', icon: '📺', tone: 'border-purple-100/40 bg-purple-300 text-black', line: 'bg-purple-300', baseX: 52, critical: true },
    penalty: { label: 'ركلة جزاء', icon: '🎯', tone: 'border-[#18E58F]/45 bg-[#18E58F] text-black', line: 'bg-[#18E58F]', baseX: 84, critical: true },
    corner: { label: 'ركنية', icon: '🚩', tone: 'border-cyan-100/40 bg-cyan-300 text-black', line: 'bg-cyan-300', baseX: 94, critical: false },
    shot: { label: 'تسديدة', icon: '🎯', tone: 'border-white/40 bg-white text-black', line: 'bg-white/70', baseX: 76, critical: false },
    foul: { label: 'خطأ', icon: '•', tone: 'border-orange-100/40 bg-orange-300 text-black', line: 'bg-orange-300', baseX: 50, critical: false },
    event: { label: event.type || 'حدث', icon: event.icon || '•', tone: 'border-white/15 bg-white/10 text-white', line: 'bg-white/25', baseX: 50, critical: false },
  };
  return { kind, ...map[kind] };
}

function eventSide(event: MatchEventView, data: MatchPageData): 'home' | 'away' | 'neutral' {
  if (event.teamId && (event.teamId === data.homeTeam.id || event.teamId === data.homeTeam.code)) return 'home';
  if (event.teamId && (event.teamId === data.awayTeam.id || event.teamId === data.awayTeam.code)) return 'away';
  const text = normalizeName(`${event.detail || ''} ${event.playerName || ''}`);
  const home = normalizeName(displayTeamName(data.homeTeam));
  const away = normalizeName(displayTeamName(data.awayTeam));
  if (home && text.includes(home)) return 'home';
  if (away && text.includes(away)) return 'away';
  return 'neutral';
}

function eventTeamName(event: MatchEventView, data: MatchPageData) {
  const side = eventSide(event, data);
  if (side === 'home') return displayTeamName(data.homeTeam);
  if (side === 'away') return displayTeamName(data.awayTeam);
  return 'المباراة';
}

function eventMinuteKey(event: MatchEventView) {
  if (event.minute !== null && event.minute !== undefined) return String(event.minute);
  return normalizeName(event.minuteLabel);
}

function eventDedupeKey(event: MatchEventView) {
  const meta = eventMeta(event);
  const minute = eventMinuteKey(event);
  const team = String(event.teamId || 'neutral');
  const player = normalizeName(event.playerName);
  const detail = normalizeName(event.detail);

  if (['goal', 'red', 'yellow', 'penalty', 'var'].includes(meta.kind)) return [minute, meta.kind, team, player || detail].join('|');
  if (meta.kind === 'substitution') return [minute, meta.kind, team, detail || player].join('|');
  return [minute, meta.kind, team, player, detail].join('|');
}

function normalizeAndDedupeEvents(events: MatchEventView[]) {
  const seen = new Set<string>();
  const rows: MatchEventView[] = [];
  for (const event of events || []) {
    const key = eventDedupeKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(event);
  }
  return rows.sort((a, b) => Number(a.minute ?? 999) - Number(b.minute ?? 999));
}

function filterEvents(events: MatchEventView[], filter: EventFilter, data: MatchPageData) {
  return events.filter((event) => {
    const kind = eventKindKey(event);
    const side = eventSide(event, data);
    if (filter === 'goals') return kind === 'goal' || kind === 'penalty';
    if (filter === 'cards') return kind === 'yellow' || kind === 'red';
    if (filter === 'subs') return kind === 'substitution';
    if (filter === 'home') return side === 'home';
    if (filter === 'away') return side === 'away';
    if (filter === 'critical') return eventMeta(event).critical;
    return true;
  });
}

function eventCounts(events: MatchEventView[], data: MatchPageData) {
  const counts: Record<EventFilter, number> = { all: events.length, goals: 0, cards: 0, subs: 0, home: 0, away: 0, critical: 0 };
  for (const event of events) {
    const kind = eventKindKey(event);
    const side = eventSide(event, data);
    if (kind === 'goal' || kind === 'penalty') counts.goals += 1;
    if (kind === 'yellow' || kind === 'red') counts.cards += 1;
    if (kind === 'substitution') counts.subs += 1;
    if (side === 'home') counts.home += 1;
    if (side === 'away') counts.away += 1;
    if (eventMeta(event).critical) counts.critical += 1;
  }
  return counts;
}

function normalizeCoord(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n * 100;
  if (n >= 0 && n <= 100) return n;
  return null;
}

function findPlayerByName(name: string | null | undefined, players: AnyPlayer[], stats: PlayerStat[]) {
  const normalized = normalizeName(name);
  if (!normalized) return { player: null as AnyPlayer | null, stat: null as PlayerStat | null };
  const player = players.find((item) => { const pName = normalizeName(item.name); return Boolean(pName && (pName === normalized || pName.includes(normalized) || normalized.includes(pName))); }) || null;
  const stat = stats.find((item) => { const sName = normalizeName(item.playerName); return Boolean(sName && (sName === normalized || sName.includes(normalized) || normalized.includes(sName))); }) || null;
  return { player, stat };
}

function buildEventPoints(data: MatchPageData, events: MatchEventView[]): EventPoint[] {
  const allPlayers = [...(data.homePlayers || []), ...(data.awayPlayers || [])] as AnyPlayer[];
  const stats = (data.advanced.playerStats || []) as PlayerStat[];
  return events.map((event, index) => {
    const meta = eventMeta(event);
    const side = eventSide(event, data);
    const shotX = normalizeCoord(event.x ?? event.shot?.x);
    const shotY = normalizeCoord(event.y ?? event.shot?.y);
    const hasExactCoordinates = shotX !== null && shotY !== null;
    const baseX = shotX ?? meta.baseX;
    const xPos = side === 'away' ? 100 - baseX : baseX;
    const ySeed = ((Number(event.minute || index * 7) * 37 + index * 19) % 64) + 18;
    const yPos = shotY ?? ySeed;
    const { player, stat } = findPlayerByName(event.playerName, allPlayers, stats);
    const playerImage = (player as AnyPlayer | null)?.image || null;
    const playerNumberText = numberValue(playerNumber(player), statNumber(stat));
    const teamName = side === 'home' ? displayTeamName(data.homeTeam) : side === 'away' ? displayTeamName(data.awayTeam) : 'حدث محايد';
    return { ...event, index, side, xPos: Math.max(6, Math.min(94, xPos)), yPos: Math.max(10, Math.min(90, yPos)), playerImage, playerNumber: playerNumberText || null, teamName, hasExactCoordinates };
  });
}

function statusTone(kind: MatchPageData['status']['kind']) {
  if (kind === 'live') return 'border-[#18E58F]/35 bg-[#18E58F]/12 text-[#18E58F]';
  if (kind === 'halftime') return 'border-[#F8C846]/35 bg-[#F8C846]/12 text-[#F8C846]';
  if (kind === 'finished') return 'border-sky-300/30 bg-sky-300/10 text-sky-100';
  if (kind === 'scheduled') return 'border-white/15 bg-white/10 text-slate-200';
  return 'border-red-300/30 bg-red-400/10 text-red-200';
}

function FlagImg({ team, small = false }: { team: TeamLite; small?: boolean }) {
  const image = displayTeamFlagUrl(team, small ? 80 : 160);
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-6 w-8 rounded-lg' : 'h-14 w-16 rounded-2xl sm:h-20 sm:w-24'}`}>{image ? <img src={image} alt={`علم ${displayTeamName(team)}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || displayTeamName(team).slice(0, 3)}</b>}</span>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>;
}

function Panel({ title, icon, hint, children, action }: { title: string; icon: ReactNode; hint?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:rounded-[1.65rem] sm:p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F] sm:h-11 sm:w-11">{icon}</span><div className="min-w-0"><h2 className="team-name-full text-lg font-black text-white sm:text-xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{hint}</p> : null}</div></div>{action}</div>{children}</section>;
}

function MatchStatusBadge({ status }: { status: MatchPageData['status'] }) {
  const minute = status.minute !== null && status.minute !== undefined ? ` · د${ar.format(status.minute)}` : '';
  return <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(status.kind)}`}>{status.shortLabel || status.label}{minute}</span>;
}

function TeamHero({ team, align }: { team: TeamLite; align: 'start' | 'end' }) {
  return <div className={`flex min-w-0 items-center gap-3 ${align === 'end' ? 'justify-end text-left sm:flex-row-reverse sm:text-right' : 'justify-start text-right'}`}><FlagImg team={team} /><div className="min-w-0"><p className="team-name-full truncate text-base font-black text-white sm:text-2xl">{displayTeamName(team)}</p><p className="mt-1 truncate text-[11px] font-bold text-slate-400">{team.code || '—'}{team.fifaRank ? ` · FIFA ${ar.format(team.fifaRank)}` : ''}</p></div></div>;
}

function MatchHeader({ data, onRefresh, onShare }: { data: MatchPageData; onRefresh: () => void; onShare: () => void }) {
  return <header className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_24px_70px_rgba(0,0,0,.26)] sm:rounded-[1.75rem] sm:p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2 text-xs font-black"><MatchStatusBadge status={data.status} /><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-slate-300">{data.groupLabel || data.stageLabel}</span></div><div className="flex items-center gap-2"><button onClick={onRefresh} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#18E58F] px-3 text-xs font-black text-black"><RefreshCw size={15} />تحديث</button><button onClick={onShare} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-xs font-black text-white"><Share2 size={15} />مشاركة</button></div></div><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5"><TeamHero team={data.homeTeam} align="start" /><div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-center sm:px-6 sm:py-3"><div className="flex items-center justify-center gap-2 tabular-nums sm:gap-4"><span className="text-4xl font-black text-[#F8C846] sm:text-6xl">{fmt(data.score.home)}</span><span className="text-2xl font-black text-white/60 sm:text-5xl">-</span><span className="text-4xl font-black text-white sm:text-6xl">{fmt(data.score.away)}</span></div><p className="mt-1 text-[11px] font-bold text-slate-400">{data.status.isScheduled ? timeOnly(data.matchDate) : data.status.label}</p></div><TeamHero team={data.awayTeam} align="end" /></div><div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-300 sm:grid-cols-4"><span><b className="text-[#18E58F]">الموعد:</b> {fullDate(data.matchDate)}</span><span><b className="text-[#18E58F]">الملعب:</b> {data.venue || 'غير متوفر'}</span><span><b className="text-[#18E58F]">الحكم:</b> {data.referee || 'غير متوفر'}</span><span><b className="text-[#18E58F]">آخر تحديث:</b> {data.lastUpdatedAt ? fullDate(data.lastUpdatedAt) : 'غير متوفر'}</span></div></header>;
}

function StatCompare({ metric, compact = false }: { metric: MatchStatMetric; compact?: boolean }) {
  const home = Number(metric.home ?? 0);
  const away = Number(metric.away ?? 0);
  const total = Math.abs(home) + Math.abs(away);
  const homeWidth = total ? Math.max(8, Math.round((Math.abs(home) / total) * 100)) : 50;
  return <article className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center justify-between gap-3"><b className={`${compact ? 'text-sm' : 'text-base'} text-[#F8C846] tabular-nums`}>{fmt(metric.home, metric.suffix)}</b><p className="truncate text-center text-xs font-black text-white">{metric.label}</p><b className={`${compact ? 'text-sm' : 'text-base'} text-[#18E58F] tabular-nums`}>{fmt(metric.away, metric.suffix)}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#18E58F]/40"><div className="h-full rounded-full bg-[#F8C846]" style={{ width: `${homeWidth}%` }} /></div></article>;
}

function MatchQuickStats({ data }: { data: MatchPageData }) {
  const available = data.stats.filter((metric) => metric.available);
  const preferred = ['possession', 'xg', 'shots', 'shotsOnTarget', 'yellowCards', 'redCards', 'corners'];
  const stats = [...preferred.map((key) => available.find((metric) => metric.key === key)).filter(Boolean), ...available.filter((metric) => !preferred.includes(metric.key))].slice(0, 5) as MatchStatMetric[];
  if (!stats.length) return null;
  return <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{stats.map((metric) => <StatCompare key={metric.key} metric={metric} compact />)}</section>;
}

function TabsNav({ active, onChange, data, events }: { active: TabId; onChange: (id: TabId) => void; data: MatchPageData; events: MatchEventView[] }) {
  const counts: Partial<Record<TabId, number>> = { events: events.length, lineups: data.advanced.playerStats.length || data.homePlayers.length + data.awayPlayers.length, group: data.groupStandings.length, articles: data.relatedArticles.length };
  return <nav className="sticky top-0 z-30 rounded-2xl border border-white/10 bg-[#07110D]/95 p-2 shadow-xl backdrop-blur"><div className="flex gap-2 overflow-x-auto pb-1 mobile-scrollbar">{TABS.map((tab) => { const Icon = tab.icon; const count = counts[tab.id]; return <button key={tab.id} type="button" onClick={() => onChange(tab.id)} aria-pressed={active === tab.id} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${active === tab.id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/20'}`}><Icon size={15} /><span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.short}</span>{typeof count === 'number' && count > 0 ? <b className={`rounded-full px-1.5 py-0.5 text-[10px] ${active === tab.id ? 'bg-black/15 text-black' : 'bg-white/10 text-slate-300'}`}>{ar.format(count)}</b> : null}</button>; })}</div></nav>;
}

function OverviewPanel({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const available = data.stats.filter((metric) => metric.available);
  const quickStats = available.filter((m) => ['possession', 'shots', 'shotsOnTarget', 'corners'].includes(m.key)).slice(0, 4);
  const criticalEvents = events.filter((event) => eventMeta(event).critical).slice(-3);
  return <Panel title="نظرة عامة" icon={<BarChart3 size={22} />} hint="ملخص سريع للنتيجة والمؤشرات واللحظات الحاسمة"><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{quickStats.length ? quickStats.map((metric) => <StatCompare key={metric.key} metric={metric} />) : <Empty title="لا توجد مؤشرات أساسية" body="ستظهر بعد حفظ الإحصائيات." />}</div><div className="grid gap-3 lg:grid-cols-2">{available.filter((metric) => !quickStats.some((item) => item.key === metric.key)).slice(0, 8).map((metric) => <StatCompare key={metric.key} metric={metric} compact />)}</div></div><aside className="rounded-2xl border border-white/10 bg-black/25 p-3"><h3 className="mb-3 text-sm font-black text-[#F8C846]">لحظات مؤثرة</h3>{criticalEvents.length ? <div className="space-y-2">{criticalEvents.map((event) => <MiniEvent key={event.id} event={event} data={data} />)}</div> : <p className="text-xs font-bold leading-6 text-slate-400">لم يتم تسجيل لحظات حاسمة بعد.</p>}</aside></div></Panel>;
}

function EventFilterBar({ active, counts, data, onChange }: { active: EventFilter; counts: Record<EventFilter, number>; data: MatchPageData; onChange: (filter: EventFilter) => void }) {
  const filters: Array<{ id: EventFilter; label: string }> = [
    { id: 'all', label: 'الكل' },
    { id: 'goals', label: 'الأهداف' },
    { id: 'cards', label: 'البطاقات' },
    { id: 'subs', label: 'التبديلات' },
    { id: 'home', label: displayTeamName(data.homeTeam) },
    { id: 'away', label: displayTeamName(data.awayTeam) },
    { id: 'critical', label: 'لحظات حاسمة' },
  ];
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-2"><div className="flex gap-2 overflow-x-auto pb-1 mobile-scrollbar">{filters.map((filter) => <button key={filter.id} type="button" onClick={() => onChange(filter.id)} aria-pressed={active === filter.id} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black ${active === filter.id ? 'border-[#F8C846]/45 bg-[#F8C846] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><span>{filter.label}</span><b className={`rounded-full px-1.5 py-0.5 text-[10px] ${active === filter.id ? 'bg-black/15 text-black' : 'bg-white/10 text-slate-300'}`}>{ar.format(counts[filter.id] || 0)}</b></button>)}</div></div>;
}

function MiniEvent({ event, data }: { event: MatchEventView; data: MatchPageData }) {
  const meta = eventMeta(event);
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2"><div className="flex items-center gap-2"><span className="w-10 rounded-lg bg-black/30 px-2 py-1 text-center text-[11px] font-black text-[#F8C846]">{event.minuteLabel || '—'}</span><span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-xs ${meta.tone}`}>{meta.icon}</span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{event.playerName || event.detail || meta.label}</b><p className="truncate text-[10px] font-bold text-slate-500">{eventTeamName(event, data)}</p></div></div></div>;
}

function EventRow({ event, data }: { event: MatchEventView; data: MatchPageData }) {
  const meta = eventMeta(event);
  const teamName = eventTeamName(event, data);
  return <article className={`relative grid grid-cols-[46px_38px_minmax(0,1fr)] gap-3 rounded-2xl border p-3 ${meta.critical ? 'border-[#F8C846]/25 bg-[#F8C846]/[0.055]' : 'border-white/10 bg-black/20'}`}><span className={`absolute bottom-3 top-3 right-0 w-1 rounded-l-full ${meta.line}`} /><div className="text-left"><span className="inline-flex min-w-11 justify-center rounded-lg bg-black/35 px-2 py-1 text-xs font-black text-[#F8C846]">{event.minuteLabel || '—'}</span></div><span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm ${meta.tone}`}>{meta.icon}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-white">{meta.label}</b>{meta.critical ? <span className="rounded-full border border-[#F8C846]/30 bg-[#F8C846]/10 px-2 py-0.5 text-[10px] font-black text-[#F8C846]">لحظة حاسمة</span> : null}<span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold text-slate-300">{teamName}</span></div><p className="mt-1 truncate text-sm font-black text-white">{event.playerName || event.detail || meta.label}</p>{event.detail && event.detail !== event.playerName ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{event.detail}</p> : null}</div></article>;
}

function EventsPanel({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const counts = useMemo(() => eventCounts(events, data), [events, data]);
  const filtered = useMemo(() => filterEvents(events, filter, data), [events, filter, data]);
  return <Panel title="أحداث المباراة" icon={<Radio size={22} />} hint="Timeline سريع قابل للفلترة، بدون تكرار أو مصطلحات تقنية"><div className="space-y-3"><EventFilterBar active={filter} counts={counts} data={data} onChange={setFilter} />{filtered.length ? <div className="space-y-2">{filtered.slice(0, 90).map((event) => <EventRow key={event.id} event={event} data={data} />)}</div> : <Empty title="لا توجد أحداث مطابقة" body="جرّب عرض كل الأحداث أو انتظر وصول Snapshot جديد." />}</div></Panel>;
}

function EventAvatar({ event, active }: { event: EventPoint; active: boolean }) {
  const meta = eventMeta(event);
  return <div className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-black/65 shadow-2xl ${active ? 'border-[#F8C846] ring-4 ring-[#F8C846]/20' : event.side === 'away' ? 'border-[#18E58F]/70' : 'border-[#F8C846]/70'}`}>{event.playerImage ? <img src={event.playerImage} alt={event.playerName || 'لاعب'} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-sm font-black text-white">{initials(event.playerName || meta.label)}</span>}{event.playerNumber ? <b className="absolute -bottom-1 -right-1 rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[10px] font-black text-black ring-2 ring-black">#{event.playerNumber}</b> : null}</div>;
}

function InteractiveEventsPitch({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const points = useMemo(() => buildEventPoints(data, events), [data, events]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const active = points[activeIndex] || points[0] || null;

  useEffect(() => { if (!playing || points.length <= 1) return; const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % points.length), 1800); return () => window.clearInterval(timer); }, [playing, points.length]);
  useEffect(() => { if (activeIndex > points.length - 1) setActiveIndex(0); }, [activeIndex, points.length]);

  if (!points.length) return <Empty title="لا توجد أحداث" body="ستظهر خريطة الأحداث بعد مزامنة الأهداف والبطاقات والتبديلات." />;

  const meta = active ? eventMeta(active) : null;

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="relative min-h-[390px] overflow-hidden rounded-[1.6rem] border border-emerald-300/20 bg-[linear-gradient(90deg,rgba(10,80,52,.85),rgba(4,62,42,.95))] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)]"><div className="absolute inset-3 rounded-[1.25rem] border-2 border-white/35" /><div className="absolute left-1/2 top-3 h-[calc(100%-1.5rem)] w-px bg-white/35" /><div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" /><div className="absolute left-3 top-1/2 h-40 w-20 -translate-y-1/2 rounded-r-2xl border-y-2 border-r-2 border-white/35" /><div className="absolute right-3 top-1/2 h-40 w-20 -translate-y-1/2 rounded-l-2xl border-y-2 border-l-2 border-white/35" /><div className="absolute inset-x-6 top-4 flex justify-between text-[10px] font-black text-white/65"><span>{displayTeamName(data.homeTeam)}</span><span>{displayTeamName(data.awayTeam)}</span></div>{active && meta ? <button type="button" onClick={() => setPlaying(false)} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 scale-125 rounded-full transition duration-300" style={{ left: `${active.xPos}%`, top: `${active.yPos}%` }} aria-label={`${meta.label} ${active.playerName || ''}`}><span className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-base font-black shadow-[0_10px_28px_rgba(0,0,0,.35)] ${meta.tone}`}>{active.icon || meta.icon}</span></button> : null}{active ? <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur"><div className="flex items-center gap-3"><EventAvatar event={active} active /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">{active.minuteLabel || '—'}</b>{meta ? <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${meta.tone}`}>{meta.label}</span> : null}<span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-black text-slate-300">{active.teamName}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${active.hasExactCoordinates ? 'border-[#18E58F]/30 bg-[#18E58F]/10 text-[#18E58F]' : 'border-white/10 bg-white/10 text-slate-400'}`}>{active.hasExactCoordinates ? 'موقع موثق' : 'موقع تقديري'}</span></div><h3 className="mt-2 truncate text-base font-black text-white">{active.playerName || 'حدث بدون لاعب محدد'} {active.playerNumber ? <span className="text-[#F8C846]">#{active.playerNumber}</span> : null}</h3><p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-300">{active.detail || 'حدث مسجل من مصدر البيانات.'}</p></div></div></div> : null}</section><aside className="rounded-[1.6rem] border border-white/10 bg-black/25 p-3"><div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-black text-white">تسلسل الأحداث</h3><p className="mt-1 text-[10px] font-bold text-slate-500">اختر حدثًا لعرض موقعه على الملعب.</p></div><button type="button" onClick={() => setPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black">{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'إيقاف' : 'تشغيل'}</button></div><div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 mobile-scrollbar">{points.map((event, index) => { const isActive = index === activeIndex; const itemMeta = eventMeta(event); return <button key={`${event.id}-${index}`} type="button" onClick={() => { setActiveIndex(index); setPlaying(false); }} className={`w-full rounded-2xl border p-2 text-right transition ${isActive ? 'border-[#F8C846]/55 bg-[#F8C846]/10' : 'border-white/10 bg-white/[0.035] hover:border-white/25'}`}><div className="flex items-center gap-2"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm ${itemMeta.tone}`}>{itemMeta.icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><b className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white">{event.minuteLabel || '—'}</b><span className="text-[10px] font-black text-[#F8C846]">{itemMeta.label}</span>{event.playerNumber ? <span className="text-[10px] font-black text-slate-400">#{event.playerNumber}</span> : null}</div><p className="mt-1 truncate text-xs font-black text-white">{event.playerName || event.detail || 'حدث'}</p><p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">{event.teamName}</p></div></div></button>; })}</div></aside></div>;
}

function InteractivePanel({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  return <Panel title="الملعب التفاعلي" icon={<MapPin size={22} />} hint="عرض بصري لمواقع الأحداث، منفصل عن Timeline النصي"><InteractiveEventsPitch data={data} events={events} /></Panel>;
}

function playerStatItems(stat: PlayerStat | null) {
  if (!stat) return [];
  return PLAYER_STAT_DEFS.map(([key, label]) => ({ key, label, value: stat[key] })).filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
}

function TeamPlayersPanel({ team, players, stats, accent }: { team: TeamLite; players: MatchPlayerLite[]; stats: PlayerStat[]; accent: 'home' | 'away' }) {
  const teamStats = stats.filter((stat) => stat.teamId === team.id || normalizeName(stat.teamName).includes(normalizeName(team.name)) || players.some((p) => normalizeName(p.name) === normalizeName(stat.playerName)));
  const rows = teamStats.length ? teamStats.slice(0, 18).map((stat, index) => ({ name: stat.playerName || 'لاعب', image: players.find((p) => normalizeName(p.name) === normalizeName(stat.playerName))?.image || null, number: statNumber(stat), position: stat.position, stat, index })) : players.slice(0, 18).map((player: AnyPlayer, index) => ({ name: player.name, image: player.image || null, number: playerNumber(player), position: player.position, stat: null as PlayerStat | null, index }));
  const color = accent === 'home' ? 'text-[#F8C846] border-[#F8C846]/25 bg-[#F8C846]/10' : 'text-[#18E58F] border-[#18E58F]/25 bg-[#18E58F]/10';
  return <section className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FlagImg team={team} small /><h3 className="truncate font-black text-white">{displayTeamName(team)}</h3></div><span className={`rounded-full border px-3 py-1 text-[11px] font-black ${color}`}>{ar.format(rows.length)} لاعب</span></div><div className="space-y-2">{rows.map((row) => { const items = playerStatItems(row.stat).slice(0, 4); return <article key={`${row.name}-${row.index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/35">{row.image ? <img src={row.image} alt={row.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-xs font-black text-white">{initials(row.name)}</span>}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="truncate text-sm text-white">{row.name}</b>{row.number ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-[#F8C846]">#{row.number}</span> : null}</div><p className="text-[11px] font-bold text-slate-500">{row.position || '—'}</p></div>{row.stat?.rating ? <b className="rounded-xl border border-[#18E58F]/20 bg-[#18E58F]/10 px-2 py-1 text-xs text-[#18E58F]">{fmt(row.stat.rating)}</b> : null}</div>{items.length ? <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-400 sm:grid-cols-4">{items.map((item) => <span key={item.key} className="rounded-xl bg-black/25 px-2 py-1"><b className="text-white">{fmt(item.value as any)}</b> {item.label}</span>)}</div> : null}</article>; })}</div></section>;
}

function LineupsPanel({ data }: { data: MatchPageData }) {
  const stats = (data.advanced.playerStats || []) as PlayerStat[];
  return <Panel title="التشكيلات وأداء اللاعبين" icon={<Users size={22} />} hint="قوائم اللاعبين مع أهم أرقام الأداء المتاحة"><div className="grid gap-4 lg:grid-cols-2"><TeamPlayersPanel team={data.homeTeam} players={data.homePlayers} stats={stats} accent="home" /><TeamPlayersPanel team={data.awayTeam} players={data.awayPlayers} stats={stats} accent="away" /></div></Panel>;
}

function AnalysisPanel({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const critical = events.filter((event) => eventMeta(event).critical);
  return <Panel title="تحليل تكتيكي" icon={<FileText size={22} />} hint="مفاتيح تحليلية مختصرة مبنية على البيانات المحفوظة"><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-3">{data.digest?.summary ? <div className="rounded-2xl border border-[#F8C846]/20 bg-[#F8C846]/[0.055] p-4"><h3 className="mb-2 text-sm font-black text-[#F8C846]">ملخص المباراة</h3><p className="text-sm font-bold leading-7 text-slate-200">{data.digest.summary}</p></div> : null}<div className="grid gap-3">{data.tacticalKeys.length ? data.tacticalKeys.map((item, index) => <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-3"><b className="text-sm text-white">{item}</b></div>) : <Empty title="لا يوجد تحليل محفوظ" body="سيظهر التحليل بعد اكتمال مصادر المباراة." />}</div></div><aside className="rounded-2xl border border-white/10 bg-black/25 p-3"><h3 className="mb-3 text-sm font-black text-[#18E58F]">لحظات أثرت على مسار اللقاء</h3>{critical.length ? <div className="space-y-2">{critical.slice(-5).map((event) => <MiniEvent key={event.id} event={event} data={data} />)}</div> : <p className="text-xs font-bold leading-6 text-slate-400">لم يتم تحديد لحظات حاسمة بعد.</p>}</aside></div></Panel>;
}

function StandingTable({ title, rows }: { title: string; rows: StandingRow[] }) {
  return <section className="rounded-2xl border border-white/10 bg-black/25 p-3"><h3 className="mb-3 text-sm font-black text-[#F8C846]">{title}</h3>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-right text-xs"><thead className="text-slate-500"><tr><th className="p-2">#</th><th className="p-2">المنتخب</th><th className="p-2">لعب</th><th className="p-2">ف</th><th className="p-2">ت</th><th className="p-2">خ</th><th className="p-2">+/-</th><th className="p-2">نقاط</th></tr></thead><tbody className="divide-y divide-white/10">{rows.map((row) => <tr key={row.teamId} className={row.qualifies ? 'bg-[#18E58F]/5' : ''}><td className="p-2 font-black text-slate-300">{ar.format(row.rank)}</td><td className="p-2"><span className="font-black text-white">{displayTeamName({ code: row.code, name: row.teamName })}</span></td><td className="p-2">{ar.format(row.played)}</td><td className="p-2">{ar.format(row.won)}</td><td className="p-2">{ar.format(row.drawn)}</td><td className="p-2">{ar.format(row.lost)}</td><td className="p-2">{row.goalDifference > 0 ? '+' : ''}{ar.format(row.goalDifference)}</td><td className="p-2 font-black text-[#F8C846]">{ar.format(row.points)}</td></tr>)}</tbody></table></div> : <Empty title="لا يوجد ترتيب متاح" body="سيظهر جدول المجموعة بعد مزامنة النتائج." />}</section>;
}

function GroupPanel({ data }: { data: MatchPageData }) {
  return <Panel title="المجموعة والترتيب" icon={<Trophy size={22} />} hint="ترتيب المجموعة وتأثير نتيجة المباراة"><div className="space-y-4"><StandingTable title={data.groupLabel || 'ترتيب المجموعة'} rows={data.groupStandings} />{data.thirdPlaceTable.length ? <StandingTable title="أفضل أصحاب المركز الثالث" rows={data.thirdPlaceTable} /> : null}{data.matchImpact.length ? <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><h3 className="mb-2 text-sm font-black text-[#18E58F]">تأثير المباراة</h3><div className="space-y-2">{data.matchImpact.map((item, index) => <p key={`${item}-${index}`} className="rounded-xl bg-white/[0.04] p-2 text-xs font-bold leading-6 text-slate-300">{item}</p>)}</div></div> : null}</div></Panel>;
}

function ArticlesPanel({ data }: { data: MatchPageData }) {
  return <Panel title="المقالات والمحتوى" icon={<List size={22} />} hint="تحليل نهائي ومحتوى مرتبط بالمباراة"><div className="grid gap-3 md:grid-cols-2">{data.relatedArticles.length ? data.relatedArticles.map((article) => <a key={article.id} href={article.href} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-[#18E58F]/30 hover:bg-[#18E58F]/10"><span className="mb-2 inline-flex rounded-full border border-[#18E58F]/20 px-3 py-1 text-[11px] font-black text-[#18E58F]">{article.label}</span><h3 className="font-black text-white">{article.title}</h3><p className="mt-2 text-xs font-bold leading-6 text-slate-400">{article.summary}</p></a>) : <Empty title="لا توجد مقالات مرتبطة" body="بعد اعتماد الإحصائيات النهائية سيظهر التحليل والمحتوى المرتبط هنا." />}</div></Panel>;
}

function MatchSideSummary({ data, events }: { data: MatchPageData; events: MatchEventView[] }) {
  const goals = events.filter((event) => eventKindKey(event) === 'goal' || eventKindKey(event) === 'penalty');
  const cards = events.filter((event) => ['yellow', 'red'].includes(eventKindKey(event)));
  const topMoment = [...events].reverse().find((event) => eventMeta(event).critical) || goals[goals.length - 1] || null;
  const bestRated = [...(data.advanced.playerStats || [])].filter((player) => player.rating !== null && player.rating !== undefined).sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))[0] || null;
  return <aside className="hidden lg:block"><div className="sticky top-[72px] space-y-3"><section className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4"><h3 className="mb-3 text-sm font-black text-white">ملخص المباراة</h3><div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><p className="text-xs font-bold text-slate-400">النتيجة</p><b className="mt-1 block text-3xl font-black tabular-nums"><span className="text-[#F8C846]">{fmt(data.score.home)}</span> - <span>{fmt(data.score.away)}</span></b><div className="mt-2"><MatchStatusBadge status={data.status} /></div></div><div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded-2xl bg-black/25 p-3"><b className="block text-xl text-[#F8C846]">{ar.format(goals.length)}</b><span className="text-[11px] font-bold text-slate-400">أهداف</span></div><div className="rounded-2xl bg-black/25 p-3"><b className="block text-xl text-red-200">{ar.format(cards.length)}</b><span className="text-[11px] font-bold text-slate-400">بطاقات</span></div></div></section><section className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4"><h3 className="mb-3 text-sm font-black text-[#F8C846]">أهم لحظة</h3>{topMoment ? <MiniEvent event={topMoment} data={data} /> : <p className="text-xs font-bold leading-6 text-slate-400">لم يتم تسجيل لحظة حاسمة بعد.</p>}</section><section className="rounded-[1.35rem] border border-[#18E58F]/15 bg-[#18E58F]/[0.045] p-4"><h3 className="mb-2 text-sm font-black text-[#18E58F]">إشارة بورصة المونديال</h3>{bestRated ? <div><div className="flex items-center justify-between gap-3"><b className="truncate text-white">{bestRated.playerName}</b><span className="rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-2 py-1 text-xs font-black text-[#18E58F]">▲ {fmt(bestRated.rating)}</span></div><p className="mt-2 text-xs font-bold leading-6 text-slate-400">أعلى تقييم محفوظ حاليًا، ويمكن ربطه لاحقًا بحركة قيمة اللاعب.</p></div> : <p className="text-xs font-bold leading-6 text-slate-400">ستظهر إشارات اللاعبين بعد توفر تقييمات موثقة.</p>}</section></div></aside>;
}

function defaultTab(data: MatchPageData): TabId {
  if (data.status.isLive) return 'events';
  if (data.status.isFinished) return 'analysis';
  return 'overview';
}

export default function ProfessionalMatchTabsPage({ data }: { data: MatchPageData }) {
  const [active, setActive] = useState<TabId>(() => defaultTab(data));
  const events = useMemo(() => normalizeAndDedupeEvents(data.events), [data.events]);
  const pageTitle = `${displayTeamName(data.homeTeam)} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${displayTeamName(data.awayTeam)}`;
  function refresh() { window.location.reload(); }
  async function share() { if (navigator.share) await navigator.share({ title: pageTitle, text: pageTitle, url: window.location.href }).catch(() => undefined); else await navigator.clipboard?.writeText(window.location.href).catch(() => undefined); }

  return <main className="min-h-screen bg-[#07110D] px-3 py-3 text-white lg:px-6" dir="rtl"><MatchAutoRefresh intervalMs={data.status.isLive ? 25000 : 90000} /><div className="mx-auto max-w-7xl space-y-4"><MatchHeader data={data} onRefresh={refresh} onShare={share} /><MatchQuickStats data={data} /><TabsNav active={active} onChange={setActive} data={data} events={events} /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><section className="min-w-0">{active === 'overview' ? <OverviewPanel data={data} events={events} /> : null}{active === 'events' ? <EventsPanel data={data} events={events} /> : null}{active === 'lineups' ? <LineupsPanel data={data} /> : null}{active === 'interactive' ? <InteractivePanel data={data} events={events} /> : null}{active === 'analysis' ? <AnalysisPanel data={data} events={events} /> : null}{active === 'group' ? <GroupPanel data={data} /> : null}{active === 'articles' ? <ArticlesPanel data={data} /> : null}</section><MatchSideSummary data={data} events={events} /></div></div></main>;
}
