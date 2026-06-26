'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, FileText, Layers, List, MapPin, Pause, Play, Radio, RefreshCw, Share2, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchPlayerStatItem, MatchStatMetric, StandingRow } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');

type TabId = 'overview' | 'events' | 'lineups' | 'interactive' | 'analysis' | 'group' | 'articles';
type TeamLite = MatchPageData['homeTeam'];
type AnyPlayer = Record<string, any>;
type PlayerStat = MatchPlayerStatItem & Record<string, any>;

type EventPoint = MatchEventView & {
  index: number;
  side: 'home' | 'away' | 'neutral';
  xPos: number;
  yPos: number;
  playerImage?: string | null;
  playerNumber?: string | null;
  teamName: string;
};

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'overview', label: 'نظرة عامة والإحصائيات', icon: Layers },
  { id: 'events', label: 'الأحداث', icon: Radio },
  { id: 'lineups', label: 'التشكيلات وأداء اللاعبين', icon: Users },
  { id: 'interactive', label: 'الملعب التفاعلي', icon: MapPin },
  { id: 'analysis', label: 'تحليل تكتيكي', icon: FileText },
  { id: 'group', label: 'المجموعة', icon: Trophy },
  { id: 'articles', label: 'المقالات', icon: List },
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

function normalizeName(value?: string | null) {
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

function playerPosition(player: AnyPlayer | null | undefined, stat?: PlayerStat | null) {
  return player?.position || stat?.position || '—';
}

function playedStat(stat?: PlayerStat | null) {
  return Boolean(stat?.played) || Boolean(stat?.playerSubbedOn) || Boolean(stat?.playerSubbedOff) || Number(stat?.minutes || 0) > 0;
}

function statStarted(stat?: PlayerStat | null) {
  return Boolean(stat?.started) || Number(stat?.started || 0) === 1;
}

function FlagImg({ team, small = false }: { team: TeamLite; small?: boolean }) {
  const image = displayTeamFlagUrl(team, small ? 80 : 160);
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-5 w-7 rounded' : 'h-14 w-16 rounded-2xl sm:h-20 sm:w-24'}`}>{image ? <img src={image} alt={`علم ${displayTeamName(team)}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || displayTeamName(team).slice(0, 3)}</b>}</span>;
}

function Panel({ title, icon, hint, children }: { title: string; icon: ReactNode; hint?: string; children: ReactNode }) {
  return <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:rounded-[1.65rem] sm:p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-[#18E58F] sm:h-11 sm:w-11">{icon}</span><div className="min-w-0"><h2 className="team-name-full text-lg font-black text-white sm:text-2xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{hint}</p> : null}</div></div>{children}</section>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>;
}

function findPlayerByName(name: string | null | undefined, players: AnyPlayer[], stats: PlayerStat[]) {
  const normalized = normalizeName(name);
  if (!normalized) return { player: null as AnyPlayer | null, stat: null as PlayerStat | null };
  const player = players.find((item) => {
    const pName = normalizeName(item.name);
    return Boolean(pName && (pName === normalized || pName.includes(normalized) || normalized.includes(pName)));
  }) || null;
  const stat = stats.find((item) => {
    const sName = normalizeName(item.playerName);
    return Boolean(sName && (sName === normalized || sName.includes(normalized) || normalized.includes(sName)));
  }) || null;
  return { player, stat };
}

function eventKind(event: MatchEventView) {
  const raw = `${event.type || ''} ${event.detail || ''}`.toLowerCase();
  if (raw.includes('goal') || raw.includes('هدف')) return { label: 'هدف', tone: 'bg-[#F8C846] text-black border-[#F8C846]', baseX: 88 };
  if (raw.includes('red') || raw.includes('حمراء') || raw.includes('طرد')) return { label: 'بطاقة حمراء', tone: 'bg-red-500 text-white border-red-300', baseX: 47 };
  if (raw.includes('yellow') || raw.includes('صفراء')) return { label: 'بطاقة صفراء', tone: 'bg-yellow-300 text-black border-yellow-100', baseX: 47 };
  if (raw.includes('sub') || raw.includes('تبديل')) return { label: 'تبديل', tone: 'bg-sky-300 text-black border-sky-100', baseX: 24 };
  if (raw.includes('var')) return { label: 'VAR', tone: 'bg-purple-300 text-black border-purple-100', baseX: 52 };
  if (raw.includes('pen')) return { label: 'ركلة جزاء', tone: 'bg-[#18E58F] text-black border-[#18E58F]', baseX: 84 };
  if (raw.includes('corner')) return { label: 'ركنية', tone: 'bg-cyan-300 text-black border-cyan-100', baseX: 94 };
  if (raw.includes('shot') || raw.includes('تسديد')) return { label: 'تسديدة', tone: 'bg-white text-black border-white', baseX: 76 };
  return { label: event.type || 'حدث', tone: 'bg-white/90 text-black border-white', baseX: 50 };
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

function normalizeCoord(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n * 100;
  if (n >= 0 && n <= 100) return n;
  return null;
}

function buildEventPoints(data: MatchPageData): EventPoint[] {
  const allPlayers = [...(data.homePlayers || []), ...(data.awayPlayers || [])] as AnyPlayer[];
  const stats = (data.advanced.playerStats || []) as PlayerStat[];
  return data.events.map((event, index) => {
    const kind = eventKind(event);
    const side = eventSide(event, data);
    const shotX = normalizeCoord(event.x ?? event.shot?.x);
    const shotY = normalizeCoord(event.y ?? event.shot?.y);
    const baseX = shotX ?? kind.baseX;
    const xPos = side === 'away' ? 100 - baseX : baseX;
    const ySeed = ((Number(event.minute || index * 7) * 37 + index * 19) % 64) + 18;
    const yPos = shotY ?? ySeed;
    const { player, stat } = findPlayerByName(event.playerName, allPlayers, stats);
    const playerImage = (player as AnyPlayer | null)?.image || null;
    const playerNumberText = numberValue(playerNumber(player), statNumber(stat));
    const teamName = side === 'home' ? displayTeamName(data.homeTeam) : side === 'away' ? displayTeamName(data.awayTeam) : 'حدث محايد';
    return { ...event, index, side, xPos: Math.max(6, Math.min(94, xPos)), yPos: Math.max(10, Math.min(90, yPos)), playerImage, playerNumber: playerNumberText || null, teamName };
  });
}

function EventAvatar({ event, active }: { event: EventPoint; active: boolean }) {
  const kind = eventKind(event);
  return <div className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-black/65 shadow-2xl ${active ? 'border-[#F8C846] ring-4 ring-[#F8C846]/20' : event.side === 'away' ? 'border-[#18E58F]/70' : 'border-[#F8C846]/70'}`}>{event.playerImage ? <img src={event.playerImage} alt={event.playerName || 'لاعب'} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-sm font-black text-white">{initials(event.playerName || kind.label)}</span>}{event.playerNumber ? <b className="absolute -bottom-1 -right-1 rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[10px] font-black text-black ring-2 ring-black">#{event.playerNumber}</b> : null}</div>;
}

function InteractiveEventsPitch({ data }: { data: MatchPageData }) {
  const points = useMemo(() => buildEventPoints(data), [data]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const active = points[activeIndex] || points[0] || null;

  useEffect(() => {
    if (!playing || points.length <= 1) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % points.length), 1800);
    return () => window.clearInterval(timer);
  }, [playing, points.length]);

  if (!points.length) return <Empty title="لا توجد أحداث" body="ستظهر خريطة الأحداث بعد مزامنة الأهداف والبطاقات والتبديلات." />;

  return <div className="space-y-4">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="relative min-h-[390px] overflow-hidden rounded-[1.6rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_center,rgba(24,229,143,0.18),transparent_32%),linear-gradient(90deg,rgba(10,80,52,.85),rgba(4,62,42,.95))] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)]">
        <div className="absolute inset-3 rounded-[1.25rem] border-2 border-white/35" />
        <div className="absolute left-1/2 top-3 h-[calc(100%-1.5rem)] w-px bg-white/35" />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
        <div className="absolute left-3 top-1/2 h-40 w-20 -translate-y-1/2 rounded-r-2xl border-y-2 border-r-2 border-white/35" />
        <div className="absolute right-3 top-1/2 h-40 w-20 -translate-y-1/2 rounded-l-2xl border-y-2 border-l-2 border-white/35" />
        <div className="absolute inset-x-6 top-4 flex justify-between text-[10px] font-black text-white/65"><span>{displayTeamName(data.homeTeam)}</span><span>{displayTeamName(data.awayTeam)}</span></div>
        {points.map((event, index) => {
          const isActive = index === activeIndex;
          const kind = eventKind(event);
          return <button key={event.id} type="button" onClick={() => { setActiveIndex(index); setPlaying(false); }} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition duration-300 ${isActive ? 'scale-125' : 'scale-100 opacity-80 hover:scale-110 hover:opacity-100'}`} style={{ left: `${event.xPos}%`, top: `${event.yPos}%` }} aria-label={`${kind.label} ${event.playerName || ''}`}>
            <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-black shadow-[0_10px_28px_rgba(0,0,0,.35)] ${kind.tone}`}>{event.icon || (index + 1)}</span>
            {isActive ? <span className="absolute inset-[-12px] animate-ping rounded-full border border-[#F8C846]/70" /> : null}
          </button>;
        })}
        {active ? <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur"><div className="flex items-center gap-3"><EventAvatar event={active} active /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">{active.minuteLabel || '—'}</b><span className={`rounded-full border px-2 py-1 text-[11px] font-black ${eventKind(active).tone}`}>{eventKind(active).label}</span><span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-black text-slate-300">{active.teamName}</span></div><h3 className="mt-2 truncate text-base font-black text-white">{active.playerName || 'حدث بدون لاعب محدد'} {active.playerNumber ? <span className="text-[#F8C846]">#{active.playerNumber}</span> : null}</h3><p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-300">{active.detail || 'حدث محفوظ في قاعدة البيانات.'}</p></div></div></div> : null}
      </section>

      <aside className="rounded-[1.6rem] border border-white/10 bg-black/25 p-3">
        <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-black text-white">تشغيل الأحداث</h3><p className="mt-1 text-[10px] font-bold text-slate-500">اضغط على أي حدث أو شغّل التسلسل.</p></div><button type="button" onClick={() => setPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black">{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'إيقاف' : 'تشغيل'}</button></div>
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 mobile-scrollbar">{points.map((event, index) => { const isActive = index === activeIndex; const kind = eventKind(event); return <button key={event.id} type="button" onClick={() => { setActiveIndex(index); setPlaying(false); }} className={`w-full rounded-2xl border p-2 text-right transition ${isActive ? 'border-[#F8C846]/55 bg-[#F8C846]/10' : 'border-white/10 bg-white/[0.035] hover:border-white/25'}`}><div className="flex items-center gap-2"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm ${kind.tone}`}>{event.icon || index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><b className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white">{event.minuteLabel || '—'}</b><span className="text-[10px] font-black text-[#F8C846]">{kind.label}</span>{event.playerNumber ? <span className="text-[10px] font-black text-slate-400">#{event.playerNumber}</span> : null}</div><p className="mt-1 truncate text-xs font-black text-white">{event.playerName || event.detail || 'حدث'}</p><p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">{event.teamName}</p></div></div></button>; })}</div>
      </aside>
    </div>
  </div>;
}

function Hero({ data, onRefresh, onShare }: { data: MatchPageData; onRefresh: () => void; onShare: () => void }) {
  return <header className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#04110D] p-4 text-center shadow-[0_24px_70px_rgba(0,0,0,.36)] sm:rounded-[2rem] sm:p-6"><div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-black"><span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-white">{data.status.label}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-slate-300">{data.groupLabel || data.stageLabel}</span></div><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5" dir="rtl"><TeamHero team={data.homeTeam} /><div className="space-y-2"><div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 shadow-inner sm:gap-5 sm:px-7 sm:py-3"><span className="text-3xl font-black text-[#F8C846] tabular-nums sm:text-6xl">{fmt(data.score.home)}</span><span className="text-2xl font-black text-white/70 sm:text-5xl">-</span><span className="text-3xl font-black text-white tabular-nums sm:text-6xl">{fmt(data.score.away)}</span></div><p className="text-xs font-bold text-slate-400">{data.status.isScheduled ? `موعد المباراة: ${fullDate(data.matchDate)}` : data.status.isFinished ? 'نهاية المباراة' : data.status.shortLabel}</p></div><TeamHero team={data.awayTeam} /></div><div className="mt-4 flex flex-wrap items-center justify-center gap-2"><button onClick={onRefresh} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black sm:text-sm"><RefreshCw size={16} /> تحديث</button><button onClick={onShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white sm:text-sm"><Share2 size={16} /> مشاركة</button></div></header>;
}

function TeamHero({ team }: { team: TeamLite }) {
  return <div className="flex min-w-0 flex-col items-center gap-2"><FlagImg team={team} /><p className="team-name-full text-base font-black text-white sm:text-2xl">{displayTeamName(team)}</p></div>;
}

function TabsNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return <nav className="sticky top-0 z-30 rounded-2xl border border-white/10 bg-[#04110D]/95 p-2 shadow-xl backdrop-blur"><div className="flex gap-2 overflow-x-auto pb-1">{TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${active === tab.id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Icon size={15} />{tab.label}</button>; })}</div></nav>;
}

function StatCard({ metric, data }: { metric: MatchStatMetric; data: MatchPageData }) {
  return <article className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center"><div className="grid grid-cols-[70px_1fr_70px] items-center gap-3"><b className="text-base font-black text-[#F8C846] tabular-nums">{fmt(metric.home, metric.suffix)}</b><p className="text-xs font-black text-white sm:text-sm">{metric.label}</p><b className="text-base font-black text-[#18E58F] tabular-nums">{fmt(metric.away, metric.suffix)}</b></div><div className="mt-2 grid grid-cols-2 text-[10px] font-bold text-slate-500"><span>{displayTeamName(data.homeTeam)}</span><span className="text-left">{displayTeamName(data.awayTeam)}</span></div></article>;
}

function OverviewPanel({ data }: { data: MatchPageData }) {
  const available = data.stats.filter((metric) => metric.available);
  const quickStats = available.filter((m) => ['possession', 'shots', 'shotsOnTarget', 'corners'].includes(m.key)).slice(0, 4);
  const otherStats = available.filter((metric) => !quickStats.some((item) => item.key === metric.key));
  return <Panel title="نظرة عامة والإحصائيات" icon={<BarChart3 size={22} />} hint="ملخص المباراة والإحصائيات في تاب واحد"><div className="space-y-5"><div><h3 className="mb-3 text-sm font-black text-[#F8C846]">أهم المؤشرات</h3><div className="grid gap-3 sm:grid-cols-2">{quickStats.length ? quickStats.map((metric) => <StatCard key={metric.key} metric={metric} data={data} />) : <Empty title="لا توجد مؤشرات أساسية" body="ستظهر بعد حفظ الإحصائيات." />}</div></div><div><h3 className="mb-3 text-sm font-black text-[#18E58F]">كل الإحصائيات المتاحة</h3><div className="grid gap-3 lg:grid-cols-2">{otherStats.length ? otherStats.map((metric) => <StatCard key={metric.key} metric={metric} data={data} />) : <Empty title="لا توجد إحصائيات إضافية" body="سيتم عرض أي إحصائية محفوظة بمجرد وصولها." />}</div></div></div></Panel>;
}

function EventsPanel({ data }: { data: MatchPageData }) {
  return <Panel title="أحداث المباراة" icon={<Radio size={22} />} hint="ملعب تفاعلي يعرض الأحداث، اللاعب، الرقم، نوع الحدث، والدقيقة"><InteractiveEventsPitch data={data} /></Panel>;
}

function TeamMiniPlayers({ team, players, stats, accent }: { team: TeamLite; players: MatchPlayerLite[]; stats: PlayerStat[]; accent: 'home' | 'away' }) {
  const teamStats = stats.filter((stat) => stat.teamId === team.id || normalizeName(stat.teamName).includes(normalizeName(team.name)) || players.some((p) => normalizeName(p.name) === normalizeName(stat.playerName)));
  const playerRows = teamStats.length ? teamStats.slice(0, 18).map((stat, index) => ({ name: stat.playerName || 'لاعب', image: players.find((p) => normalizeName(p.name) === normalizeName(stat.playerName))?.image || null, number: statNumber(stat), position: stat.position, stat, index })) : players.slice(0, 18).map((player: AnyPlayer, index) => ({ name: player.name, image: player.image || null, number: playerNumber(player), position: player.position, stat: null as PlayerStat | null, index }));
  const color = accent === 'home' ? 'text-[#F8C846] border-[#F8C846]/25 bg-[#F8C846]/10' : 'text-[#18E58F] border-[#18E58F]/25 bg-[#18E58F]/10';
  return <section className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FlagImg team={team} small /><h3 className="team-name-full text-lg font-black text-white">{displayTeamName(team)}</h3></div><span className={`rounded-full border px-3 py-1 text-[11px] font-black ${color}`}>{ar.format(playerRows.length)} لاعب</span></div><div className="grid gap-3">{playerRows.length ? playerRows.map((row) => <article key={`${row.name}-${row.index}`} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><div className="flex gap-3"><div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${accent === 'home' ? 'border-[#F8C846]' : 'border-[#18E58F]'} bg-black/45`}>{row.image ? <img src={row.image} alt={row.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[11px] font-black text-white">{initials(row.name)}</span>}{row.number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white ring-1 ring-white/20">{row.number}</b> : null}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{row.name}</p><p className="mt-1 text-[10px] font-bold text-slate-400">رقم {row.number || '—'} · {playerPosition(row, row.stat)}</p><div className="mt-2 flex flex-wrap gap-1.5">{(row.stat ? PLAYER_STAT_DEFS.map(([key, label]) => ({ key, label, value: row.stat?.[key] })).filter((item) => item.value !== null && item.value !== undefined && item.value !== '').slice(0, 6) : []).map((item) => <span key={item.key} className="rounded-lg bg-black/35 px-2 py-1 text-[10px] font-bold text-slate-300"><b className="text-white">{fmt(item.value as any)}</b> {item.label}</span>)}</div></div></div></article>) : <Empty title="غير متوفر" body="لم تصل بيانات اللاعبين بعد." />}</div></section>;
}

function LineupsPanel({ data }: { data: MatchPageData }) {
  const playerStats = (data.advanced.playerStats || []) as PlayerStat[];
  return <Panel title="التشكيلات وأداء اللاعبين" icon={<Users size={22} />} hint="عرض مختصر للاعبين المشاركين مع الصورة والرقم وأهم الإحصائيات المتاحة"><div className="grid gap-5 xl:grid-cols-2"><TeamMiniPlayers team={data.homeTeam} players={data.homePlayers} stats={playerStats} accent="home" /><TeamMiniPlayers team={data.awayTeam} players={data.awayPlayers} stats={playerStats} accent="away" /></div></Panel>;
}

function InteractivePanel({ data }: { data: MatchPageData }) {
  return <Panel title="الملعب التفاعلي" icon={<MapPin size={22} />} hint="يفتح في صفحة مستقلة"><div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-5 text-center"><p className="text-lg font-black text-white">افتح عرض الملعب التفاعلي الكامل</p><Link href={`/live-animation/${data.id}`} className="mt-4 inline-flex rounded-xl bg-sky-300 px-5 py-3 text-sm font-black text-black">فتح الملعب التفاعلي</Link></div></Panel>;
}

function AnalysisPanel({ data }: { data: MatchPageData }) {
  return <Panel title="تحليل تكتيكي" icon={<FileText size={22} />}><div className="space-y-2">{data.tacticalKeys.length ? data.tacticalKeys.map((item, index) => <p key={index} className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-200">{item}</p>) : <Empty title="لا توجد ملاحظات" body="أضف ملاحظات تكتيكية محفوظة لهذه المباراة." />}</div></Panel>;
}

function StandingCard({ row }: { row: StandingRow }) {
  const name = getArabicTeamName(row.code, row.teamName);
  return <article className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center justify-between"><p className="font-black text-white">{ar.format(row.rank)}. {name}</p><b className="text-xl font-black text-[#18E58F]">{ar.format(row.points)}</b></div><p className="mt-2 text-xs font-bold text-slate-400">لعب {ar.format(row.played)} · فاز {ar.format(row.won)} · فارق {ar.format(row.goalDifference)}</p></article>;
}

function GroupPanel({ data }: { data: MatchPageData }) {
  return <Panel title="المجموعة" icon={<Trophy size={22} />}><div className="grid gap-3 lg:grid-cols-2">{data.groupStandings.length ? data.groupStandings.map((row) => <StandingCard key={`${row.teamId}-${row.rank}`} row={row} />) : <Empty title="الترتيب غير متوفر" body="سيظهر بعد حفظ مباريات المجموعة." />}</div></Panel>;
}

function ArticlesPanel({ data }: { data: MatchPageData }) {
  return <Panel title="المقالات" icon={<List size={22} />}><div className="grid gap-3">{data.digest?.href ? <Link href={data.digest.href} className="rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 p-4 text-right"><p className="font-black text-[#F8C846]">تقرير المباراة</p><p className="mt-2 text-sm font-bold leading-7 text-white">{data.digest.summary || data.digest.turningPoint || 'افتح تقرير المباراة الكامل.'}</p></Link> : null}{data.relatedArticles.map((article) => <Link key={article.id} href={article.href} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-right"><p className="font-black text-white">{article.title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{article.summary}</p></Link>)}{!data.digest?.href && !data.relatedArticles.length ? <Empty title="لا توجد مقالات" body="ستظهر المقالات المرتبطة بهذه المباراة هنا." /> : null}</div></Panel>;
}

export default function ProfessionalMatchTabsPage({ data }: { data: MatchPageData }) {
  const [active, setActive] = useState<TabId>('overview');
  const pageTitle = useMemo(() => `${displayTeamName(data.homeTeam)} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${displayTeamName(data.awayTeam)}`, [data]);
  function refresh() { window.location.reload(); }
  async function share() { if (navigator.share) await navigator.share({ title: pageTitle, text: pageTitle, url: window.location.href }).catch(() => undefined); else await navigator.clipboard?.writeText(window.location.href).catch(() => undefined); }
  return <main className="min-h-screen bg-[#04110D] px-3 py-4 text-white" dir="rtl"><MatchAutoRefresh intervalMs={data.status.isLive ? 25000 : 90000} /><div className="mx-auto max-w-7xl space-y-4"><Hero data={data} onRefresh={refresh} onShare={share} /><TabsNav active={active} onChange={setActive} />{active === 'overview' ? <OverviewPanel data={data} /> : null}{active === 'events' ? <EventsPanel data={data} /> : null}{active === 'lineups' ? <LineupsPanel data={data} /> : null}{active === 'interactive' ? <InteractivePanel data={data} /> : null}{active === 'analysis' ? <AnalysisPanel data={data} /> : null}{active === 'group' ? <GroupPanel data={data} /> : null}{active === 'articles' ? <ArticlesPanel data={data} /> : null}</div></main>;
}
