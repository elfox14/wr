'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, CalendarDays, CheckCircle2, Clock, FileText, Flag, ListChecks, Radio, RefreshCw, Share2, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchPlayerStatItem, MatchSourceView, MatchStatMetric, OfficialLineupPlayer, OfficialLineupTeam, SourceChecklistItem, StandingRow } from '@/lib/match-page/types';

const numberFormat = new Intl.NumberFormat('ar-EG');

type PitchPlayer = OfficialLineupPlayer | MatchPlayerLite;
type PlayerRole = 'starter' | 'substitute';
type PlayerRow = { player: PitchPlayer; stat: MatchPlayerStatItem | null; role: PlayerRole; index: number };
type Accent = 'home' | 'away';

const tabs = [
  { id: 'overview', label: 'نظرة عامة', icon: Sparkles },
  { id: 'events', label: 'الأحداث', icon: Radio },
  { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
  { id: 'lineups', label: 'التشكيل', icon: Users },
  { id: 'standings', label: 'الترتيب', icon: Trophy },
  { id: 'analysis', label: 'التحليل', icon: FileText },
  { id: 'sources', label: 'المصادر', icon: ListChecks },
];

const statusClasses = {
  scheduled: 'border-white/15 bg-white/10 text-white',
  live: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_32px_rgba(24,229,143,.18)]',
  halftime: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  finished: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
  delayed: 'border-rose-300/35 bg-rose-400/10 text-rose-100',
};

const playerStatDefs: Array<[keyof MatchPlayerStatItem | string, string]> = [
  ['rating', 'تقييم'], ['minutes', 'دقائق'], ['goals', 'أهداف'], ['assists', 'أسيست'],
  ['shots', 'تسديد'], ['shotsOnTarget', 'على المرمى'], ['shotsOffTarget', 'خارج المرمى'], ['blockedShots', 'محجوبة'],
  ['expectedGoals', 'xG'], ['npExpectedGoals', 'npxG'], ['expectedAssists', 'xA'], ['bigChancesCreated', 'فرص خلقها'],
  ['passes', 'تمرير'], ['accuratePasses', 'تمرير صحيح'], ['keyPasses', 'تمرير مفتاحي'], ['crosses', 'عرضيات'], ['accurateCrosses', 'عرضيات صحيحة'], ['longBalls', 'كرات طويلة'], ['accurateLongBalls', 'طويلة صحيحة'],
  ['touches', 'لمسات'], ['tackles', 'تدخلات'], ['interceptions', 'اعتراضات'], ['clearances', 'تشتيت'], ['saves', 'تصديات'],
  ['duelWon', 'التحامات فاز'], ['duelLost', 'التحامات خسر'], ['aerialWon', 'هوائيات'], ['challengeLost', 'مراوغات عليه'], ['wonContest', 'مراوغات ناجحة'], ['dispossessed', 'فقد تحت ضغط'], ['possessionLost', 'فقد استحواذ'],
  ['foulsCommitted', 'أخطاء عليه'], ['foulsWon', 'أخطاء حصل عليها'], ['offsides', 'تسلل'], ['yellowCards', 'صفراء'], ['redCards', 'حمراء'],
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
}
function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function formatNumber(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const rounded = Number.isInteger(value) ? numberFormat.format(value) : value.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
  return `${rounded}${suffix}`;
}
function sharePercent(home: number | null, away: number | null) {
  const h = Math.max(0, Number(home || 0));
  const a = Math.max(0, Number(away || 0));
  const total = h + a;
  if (!total) return { home: 50, away: 50 };
  const width = Math.max(6, Math.min(94, (h / total) * 100));
  return { home: width, away: 100 - width };
}
function normalizeName(value?: string | null) {
  return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function initials(name?: string | null) {
  return String(name || 'لاعب').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
function gd(value: number) { return value > 0 ? `+${numberFormat.format(value)}` : numberFormat.format(value); }
function playerNumber(player: PitchPlayer) { return 'number' in player ? player.number : null; }
function playerCaptain(player: PitchPlayer) { return 'isCaptain' in player ? Boolean(player.isCaptain) : false; }
function playerId(player: PitchPlayer) { return 'id' in player && player.id ? String(player.id) : null; }
function playedStat(stat: MatchPlayerStatItem | null | undefined) { return Boolean(stat?.played) || Number(stat?.minutes || 0) > 0 || Boolean(stat?.started); }
function statHasSubSignal(stat: MatchPlayerStatItem | null | undefined) { return Boolean(stat?.playerSubbedOn || stat?.playerSubbedOff || playedStat(stat)); }

function TeamFlag({ team, size = 'lg' }: { team: MatchPageData['homeTeam']; size?: 'sm' | 'lg' }) {
  const className = size === 'sm' ? 'h-5 w-7 rounded' : 'h-20 w-24 rounded-[1.35rem] sm:h-24 sm:w-28';
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${className}`}>{team.image ? <img src={team.image} alt={`علم ${team.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || team.name.slice(0, 3)}</b>}</span>;
}
function Section({ id, title, icon, children, hint }: { id: string; title: string; icon: ReactNode; hint?: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-28 rounded-[1.65rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-[#18E58F]">{icon}</span><div><h2 className="text-xl font-black text-white sm:text-2xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold text-slate-400">{hint}</p> : null}</div></div></div>{children}</section>;
}
function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>;
}

function findLocalPlayer(player: PitchPlayer | { name?: string | null; id?: string | null }, localPlayers: MatchPlayerLite[]) {
  const id = player.id ? String(player.id) : null;
  const name = normalizeName(player.name);
  return localPlayers.find((item) => {
    const localName = normalizeName(item.name);
    const localCode = normalizeName(item.code);
    return Boolean((id && item.id === id) || (name && localName && (localName === name || localName.includes(name) || name.includes(localName))) || (name && localCode && localCode === name));
  });
}
function playerWithRealImage(player: PitchPlayer, localPlayers: MatchPlayerLite[]): PitchPlayer {
  const local = findLocalPlayer(player, localPlayers);
  return { ...player, image: player.image || local?.image || null, position: player.position || local?.position || null } as PitchPlayer;
}
function playerStatFor(player: PitchPlayer, stats: MatchPlayerStatItem[]) {
  const id = playerId(player);
  const name = normalizeName(player.name);
  return stats.find((item) => {
    const statId = item.playerId ? String(item.playerId) : null;
    const statName = normalizeName(item.playerName);
    return Boolean((id && statId && id === statId) || (name && statName && (statName === name || statName.includes(name) || name.includes(statName))));
  }) || null;
}
function statAsPlayer(stat: MatchPlayerStatItem, localPlayers: MatchPlayerLite[]): PitchPlayer {
  const fallback = { id: stat.playerId || stat.playerName || 'player', name: stat.playerName || 'لاعب غير معروف', image: (stat as any).image || (stat as any).photo || null, position: stat.position || null } as PitchPlayer;
  return playerWithRealImage(fallback, localPlayers);
}
function statBelongsToTeam(stat: MatchPlayerStatItem, team: MatchPageData['homeTeam'], localPlayers: MatchPlayerLite[]) {
  const teamId = String(stat.teamId || '').trim();
  if (teamId && (teamId === team.id || teamId === team.code)) return true;
  const statTeam = normalizeName(stat.teamName);
  const teamKey = normalizeName(team.name);
  const codeKey = normalizeName(team.code);
  if (statTeam && ((teamKey && (statTeam === teamKey || statTeam.includes(teamKey) || teamKey.includes(statTeam))) || (codeKey && statTeam === codeKey))) return true;
  const playerName = normalizeName(stat.playerName);
  return Boolean(playerName && localPlayers.some((player) => {
    const localName = normalizeName(player.name);
    return localName && (localName === playerName || localName.includes(playerName) || playerName.includes(localName));
  }));
}
function uniqueRows(rows: PlayerRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = normalizeName(String(playerId(row.player) || row.player.name || row.stat?.playerName || row.index));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function lineupRows(team: OfficialLineupTeam | null | undefined, localPlayers: MatchPlayerLite[], stats: MatchPlayerStatItem[]) {
  const starters = (team?.startingXi || []).map((player, index) => ({ player: playerWithRealImage(player, localPlayers), stat: playerStatFor(player, stats), role: 'starter' as PlayerRole, index }));
  const starterKeys = new Set(starters.map((row) => normalizeName(String(playerId(row.player) || row.player.name))));
  const usedSubstitutes = (team?.substitutes || []).map((player, index) => ({ player: playerWithRealImage(player, localPlayers), stat: playerStatFor(player, stats), role: 'substitute' as PlayerRole, index })).filter((row) => statHasSubSignal(row.stat));
  const statOnlyRows = stats.filter((stat) => playedStat(stat)).map((stat, index) => ({ player: statAsPlayer(stat, localPlayers), stat, role: stat.started ? 'starter' as PlayerRole : 'substitute' as PlayerRole, index: index + 1000 }));
  const extraStarters = !starters.length ? statOnlyRows.filter((row) => row.role === 'starter') : [];
  const extraSubs = statOnlyRows.filter((row) => row.role !== 'starter' && !starterKeys.has(normalizeName(String(row.stat?.playerId || row.stat?.playerName))));
  const finalStarters = uniqueRows([...starters, ...extraStarters]);
  const finalSubs = uniqueRows([...usedSubstitutes, ...extraSubs]).filter((row) => !finalStarters.some((starter) => normalizeName(starter.player.name) === normalizeName(row.player.name)));
  return { starters: finalStarters, usedSubstitutes: finalSubs, total: finalStarters.length + finalSubs.length, withStats: [...finalStarters, ...finalSubs].filter((row) => row.stat).length };
}
function statItems(stat: MatchPlayerStatItem | null) {
  if (!stat) return [];
  return playerStatDefs.map(([key, label]) => ({ key: String(key), label, value: (stat as any)[key] })).filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
}
function PlayerAvatar({ player, accent }: { player: PitchPlayer; accent: Accent }) {
  const number = playerNumber(player);
  const border = accent === 'home' ? 'border-[#F8C846]' : 'border-[#18E58F]';
  return <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${border} bg-black/45 shadow-lg sm:h-14 sm:w-14`}>{player.image ? <img src={player.image} alt={player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[11px] font-black text-white">{initials(player.name)}</span>}{number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white ring-1 ring-white/20">{number}</b> : null}</div>;
}
function StatChip({ label, value }: { label: string; value: any }) {
  return <span className="rounded-xl border border-white/10 bg-black/25 px-2 py-1.5 text-center"><b className="block text-sm font-black text-white tabular-nums">{formatNumber(Number(value))}</b><small className="mt-0.5 block text-[9px] font-black text-slate-500">{label}</small></span>;
}

function ScoreBox({ data }: { data: MatchPageData }) {
  return <div className="inline-flex items-center justify-center gap-4 rounded-[1.25rem] border border-white/10 bg-black/45 px-5 py-3 shadow-inner sm:gap-6 sm:px-7"><span className="text-5xl font-black text-[#F8C846] tabular-nums sm:text-7xl">{formatNumber(data.score.home)}</span><span className="text-4xl font-black text-white/70 sm:text-6xl">-</span><span className="text-5xl font-black text-white tabular-nums sm:text-7xl">{formatNumber(data.score.away)}</span></div>;
}
function Hero({ data, onRefresh, onShare }: { data: MatchPageData; onRefresh: () => void; onShare: () => void }) {
  return <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#04110D] p-4 text-center shadow-[0_24px_70px_rgba(0,0,0,.36)] sm:p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(24,229,143,.20),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(248,200,70,.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_42%)]" /><div className="relative"><div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs font-black"><span className={`rounded-full border px-4 py-2 ${statusClasses[data.status.kind]}`}>{data.status.label}</span><span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-slate-300">{data.competition}</span><span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-slate-300">{data.groupLabel || data.stageLabel}</span></div><div className="grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]" dir="ltr"><TeamHeroSide team={data.homeTeam} side="home" /><div className="space-y-3"><ScoreBox data={data} /><p className="text-xs font-bold text-slate-400">مصدر النتيجة: {data.score.source}</p></div><TeamHeroSide team={data.awayTeam} side="away" /></div><div className="mt-6 grid gap-3 text-right md:grid-cols-3"><InfoPill icon={<CalendarDays size={17} />} label="الموعد" value={formatDate(data.matchDate)} /><InfoPill icon={<Flag size={17} />} label="الملعب" value={data.venue || 'غير متوفر في المصادر'} /><InfoPill icon={<Clock size={17} />} label="آخر تحديث" value={formatShortDate(data.lastUpdatedAt)} /></div><div className="mt-5 flex flex-wrap items-center justify-center gap-2"><button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl bg-[#18E58F] px-4 py-2 text-sm font-black text-black transition hover:scale-[1.02]"><RefreshCw size={16} /> تحديث بيانات المباراة</button><button onClick={onShare} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"><Share2 size={16} /> مشاركة</button>{data.digest?.href ? <Link href={data.digest.href} className="inline-flex items-center gap-2 rounded-xl border border-[#F8C846]/30 bg-[#F8C846]/12 px-4 py-2 text-sm font-black text-[#F8C846]"><FileText size={16} /> تقرير المباراة</Link> : null}</div></div></header>;
}
function TeamHeroSide({ team, side }: { team: MatchPageData['homeTeam']; side: 'home' | 'away' }) {
  return <div className={`flex items-center justify-center gap-4 ${side === 'away' ? 'lg:flex-row-reverse' : ''}`}><TeamFlag team={team} /><div className="text-center lg:text-right"><p className="text-2xl font-black text-white sm:text-4xl">{team.name}</p><div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-400 lg:justify-start">{team.code ? <span>{team.code}</span> : null}{team.fifaRank ? <span>تصنيف FIFA: {numberFormat.format(team.fifaRank)}</span> : null}{team.coach ? <span>المدرب: {team.coach}</span> : null}</div></div></div>;
}
function InfoPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex items-center gap-2 text-[#18E58F]">{icon}<span className="text-xs font-black">{label}</span></div><p className="text-sm font-bold leading-6 text-white">{value}</p></div>;
}
function StickyTabs() {
  return <nav className="sticky top-0 z-20 -mx-4 border-y border-white/10 bg-[#04110D]/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border"><div className="flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => { const Icon = tab.icon; return <a key={tab.id} href={`#${tab.id}`} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-200 hover:border-[#18E58F]/40 hover:text-white"><Icon size={15} />{tab.label}</a>; })}</div></nav>;
}

function PredictionWidget({ data }: { data: MatchPageData }) {
  const storageKey = `match-vote:${data.id}`;
  const [vote, setVote] = useState<string | null>(() => (typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey)));
  const options = [{ id: 'home', label: data.homeTeam.name }, { id: 'draw', label: 'تعادل' }, { id: 'away', label: data.awayTeam.name }];
  function choose(id: string) { setVote(id); if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, id); }
  return <div className="rounded-2xl border border-[#F8C846]/20 bg-[#F8C846]/10 p-4"><h3 className="mb-3 text-lg font-black text-[#F8C846]">توقع الجمهور</h3><div className="grid gap-2 sm:grid-cols-3">{options.map((option) => <button key={option.id} onClick={() => choose(option.id)} className={`rounded-xl border px-3 py-3 text-sm font-black transition ${vote === option.id ? 'border-[#18E58F] bg-[#18E58F] text-black' : 'border-white/10 bg-black/25 text-white hover:bg-white/10'}`}>{option.label}</button>)}</div><p className="mt-3 text-xs font-bold text-slate-400">{vote ? 'تم حفظ اختيارك على جهازك.' : 'اختر توقعك قبل أو أثناء المباراة.'}</p></div>;
}
function Overview({ data }: { data: MatchPageData }) {
  return <Section id="overview" title="نظرة عامة" icon={<Sparkles size={22} />} hint="ملخص سريع قبل وأثناء وبعد المباراة"><div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="mb-3 text-lg font-black text-white">مفاتيح المباراة</h3><ul className="space-y-2">{data.tacticalKeys.map((item) => <li key={item} className="flex gap-2 rounded-xl bg-white/[0.04] p-3 text-sm font-bold leading-7 text-slate-200"><Shield className="mt-1 shrink-0 text-[#18E58F]" size={16} />{item}</li>)}</ul></div>{data.digest?.summary ? <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-4"><h3 className="mb-2 text-lg font-black text-sky-100">ملخص التقرير</h3><p className="text-sm font-bold leading-8 text-slate-200">{data.digest.summary}</p></div> : null}</div><PredictionWidget data={data} /></div></Section>;
}
function EventsPanel({ events }: { events: MatchEventView[] }) {
  return <Section id="events" title="الأحداث المباشرة" icon={<Radio size={22} />} hint="Timeline موثق من مصادر المباراة"><div className="relative space-y-3 before:absolute before:right-[22px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-[#18E58F]/30">{events.length ? events.map((event) => <article key={event.id} className="relative pr-12"><div className="absolute right-0 top-1 flex h-11 w-11 items-center justify-center rounded-full border border-[#18E58F]/30 bg-[#18E58F]/12 text-sm font-black"><span>{event.icon}</span></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex flex-wrap items-center gap-2"><b className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">{event.minuteLabel}</b><span className="rounded-full bg-[#F8C846]/15 px-2 py-1 text-xs font-black text-[#F8C846]">{event.type}</span>{event.playerName ? <span className="text-sm font-black text-white">{event.playerName}</span> : null}</div><p className="text-sm font-bold leading-7 text-slate-200">{event.detail}</p>{event.sourceName ? <small className="mt-2 block text-[11px] font-bold text-slate-500">المصدر: {event.sourceName}</small> : null}</div></article>) : <EmptyState title="لا توجد أحداث بعد" body="الأهداف والبطاقات والتبديلات ستظهر عند وصولها من المصدر." />}</div></Section>;
}
function StatRow({ metric, homeName, awayName }: { metric: MatchStatMetric; homeName: string; awayName: string }) {
  const width = sharePercent(metric.home, metric.away);
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 grid grid-cols-[64px_1fr_64px] items-center gap-3"><b className="text-center text-lg text-white tabular-nums">{formatNumber(metric.home, metric.suffix)}</b><div className="text-center"><p className="text-sm font-black text-white">{metric.label}</p><p className="text-[10px] font-bold text-slate-500">{metric.source}</p></div><b className="text-center text-lg text-white tabular-nums">{formatNumber(metric.away, metric.suffix)}</b></div><div className="grid grid-cols-2 overflow-hidden rounded-full bg-white/10"><div title={homeName} className="h-2.5 bg-[#18E58F]" style={{ width: `${width.home * 2}%`, maxWidth: '100%' }} /><div title={awayName} className="h-2.5 justify-self-end bg-[#F8C846]" style={{ width: `${width.away * 2}%`, maxWidth: '100%' }} /></div></div>;
}
function StatsPanel({ data }: { data: MatchPageData }) {
  const available = data.stats.filter((metric) => metric.available);
  return <Section id="stats" title="إحصائيات المباراة" icon={<BarChart3 size={22} />} hint={`${numberFormat.format(available.length)} مؤشر متوفر · TheStats أولًا وiSports كاحتياطي`}><div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-xs font-black text-slate-300"><span>{data.homeTeam.name}</span><span>المؤشر</span><span>{data.awayTeam.name}</span></div><div className="grid gap-3 lg:grid-cols-2">{available.map((metric) => <StatRow key={metric.key} metric={metric} homeName={data.homeTeam.name} awayName={data.awayTeam.name} />)}</div></Section>;
}
function PlayerStatCard({ row, accent }: { row: PlayerRow; accent: Accent }) {
  const items = statItems(row.stat);
  const player = row.player;
  const stat = row.stat;
  return <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><div className="flex items-start gap-3"><PlayerAvatar player={player} accent={accent} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-sm font-black text-white sm:text-base">{player.name}</p>{playerCaptain(player) ? <span className="rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[9px] font-black text-black">C</span> : null}<span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black text-slate-300">{row.role === 'starter' ? 'أساسي' : 'بديل شارك'}</span></div><p className="mt-1 text-[10px] font-bold text-slate-400">#{playerNumber(player) || '—'} · {player.position || stat?.position || '—'}{stat?.playerSubbedOn ? ` · دخل بدل ${stat.playerSubbedOn}` : ''}{stat?.playerSubbedOff ? ` · خرج وبدله ${stat.playerSubbedOff}` : ''}</p>{items.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{items.map((item) => <StatChip key={item.key} label={item.label} value={item.value} />)}</div> : <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-400">لا توجد إحصائيات تفصيلية لهذا اللاعب حتى الآن.</p>}</div></div></article>;
}
function PlayerGroup({ title, rows, accent }: { title: string; rows: PlayerRow[]; accent: Accent }) {
  if (!rows.length) return null;
  return <div><h4 className="mb-2 text-xs font-black text-[#F8C846]">{title}</h4><div className="grid gap-2">{rows.map((row) => <PlayerStatCard key={`${title}-${row.player.name}-${row.index}`} row={row} accent={accent} />)}</div></div>;
}
function TeamPlayerCard({ team, lineup, localPlayers, stats, accent }: { team: MatchPageData['homeTeam']; lineup: OfficialLineupTeam | null | undefined; localPlayers: MatchPlayerLite[]; stats: MatchPlayerStatItem[]; accent: Accent }) {
  const teamStats = stats.filter((stat) => statBelongsToTeam(stat, team, localPlayers));
  const rows = lineupRows(lineup, localPlayers, teamStats);
  const color = accent === 'home' ? 'text-[#F8C846] border-[#F8C846]/25 bg-[#F8C846]/10' : 'text-[#18E58F] border-[#18E58F]/25 bg-[#18E58F]/10';
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><TeamFlag team={team} size="sm" /><div className="min-w-0"><h3 className="text-lg font-black text-white">{team.name}</h3><p className="mt-1 text-[10px] font-bold text-slate-500">{lineup?.formation ? `الخطة ${lineup.formation}` : 'لاعبو المنتخب المشاركون'}</p></div></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${color}`}>{numberFormat.format(rows.withStats)} / {numberFormat.format(rows.total)} لاعب</span></div><div className="space-y-5"><PlayerGroup title="الأساسيون فقط" rows={rows.starters} accent={accent} /><PlayerGroup title="البدلاء الذين شاركوا فقط" rows={rows.usedSubstitutes} accent={accent} />{!rows.total ? <EmptyState title="التشكيل وإحصائيات اللاعبين غير متوفرة" body="شغّل TheStats finalize بعد المباراة لجلب lineups وplayer-stats." /> : null}</div></div>;
}
function LineupsPanel({ data }: { data: MatchPageData }) {
  const stats = data.advanced.playerStats || [];
  const official = data.officialLineup;
  return <Section id="lineups" title="التشكيل وأداء اللاعبين" icon={<Users size={22} />} hint="كل منتخب بلاعبيه: الأساسيون فقط + البدلاء الذين شاركوا، مع صورة كل لاعب وكل الإحصائيات المتاحة"><div className="grid gap-4 lg:grid-cols-2"><TeamPlayerCard team={data.homeTeam} lineup={official?.home} localPlayers={data.homePlayers} stats={stats} accent="home" /><TeamPlayerCard team={data.awayTeam} lineup={official?.away} localPlayers={data.awayPlayers} stats={stats} accent="away" /></div></Section>;
}
function StandingsTable({ rows, compact = false }: { rows: StandingRow[]; compact?: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-separate border-spacing-y-2 text-right text-sm"><thead><tr className="text-xs text-slate-500"><th className="px-3">#</th><th className="px-3">المنتخب</th><th className="px-3">لعب</th><th className="px-3">ف</th><th className="px-3">ت</th><th className="px-3">خ</th><th className="px-3">له</th><th className="px-3">عليه</th><th className="px-3">فارق</th><th className="px-3">نقاط</th>{compact ? <th className="px-3">الحالة</th> : null}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.teamId}-${row.rank}`} className="bg-black/25 text-white"><td className="rounded-r-xl px-3 py-3 font-black text-[#F8C846]">{numberFormat.format(row.rank)}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-2 font-black">{row.image ? <img src={row.image} alt="" className="h-4 w-6 rounded object-cover" /> : null}{row.teamName}</span></td><td className="px-3">{numberFormat.format(row.played)}</td><td className="px-3">{numberFormat.format(row.won)}</td><td className="px-3">{numberFormat.format(row.drawn)}</td><td className="px-3">{numberFormat.format(row.lost)}</td><td className="px-3">{numberFormat.format(row.goalsFor)}</td><td className="px-3">{numberFormat.format(row.goalsAgainst)}</td><td className="px-3">{gd(row.goalDifference)}</td><td className="px-3 font-black text-[#18E58F]">{numberFormat.format(row.points)}</td>{compact ? <td className="rounded-l-xl px-3"><span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.qualifies ? 'bg-[#18E58F] text-black' : 'bg-white/10 text-slate-300'}`}>{row.qualifies ? 'يتأهل' : 'ينتظر'}</span></td> : <td className="rounded-l-xl" />}</tr>)}</tbody></table>{rows.length ? null : <EmptyState title="الترتيب غير متوفر" body="سيظهر ترتيب المجموعة بعد توفر مباريات المجموعة ونتائجها." />}</div>;
}
function StandingsPanel({ data }: { data: MatchPageData }) {
  return <Section id="standings" title="الترتيب وتأثير النتيجة" icon={<Trophy size={22} />} hint="يحسب من نتائج المجموعة وأفضل الثوالث"><div className="grid gap-4 xl:grid-cols-[1fr_.9fr]"><div><h3 className="mb-3 text-lg font-black text-white">{data.groupLabel || 'ترتيب المجموعة'}</h3><StandingsTable rows={data.groupStandings} /></div><div className="space-y-4"><div className="rounded-2xl border border-[#18E58F]/20 bg-[#18E58F]/10 p-4"><h3 className="mb-3 text-lg font-black text-[#18E58F]">تأثير النتيجة</h3><ul className="space-y-2">{data.matchImpact.map((item) => <li key={item} className="rounded-xl bg-black/25 p-3 text-sm font-bold leading-7 text-slate-200">{item}</li>)}</ul></div><div><h3 className="mb-3 text-lg font-black text-white">أفضل الثوالث</h3><StandingsTable rows={data.thirdPlaceTable.slice(0, 8)} compact /></div></div></div></Section>;
}
function AnalysisPanel({ data }: { data: MatchPageData }) {
  return <Section id="analysis" title="التحليل والمقالات" icon={<FileText size={22} />} hint="بعد المباراة تتحول الصفحة إلى تقرير وتحليل"><div className="grid gap-4 lg:grid-cols-2">{data.relatedArticles.length ? data.relatedArticles.map((article) => <Link key={article.id} href={article.href} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-[#18E58F]/40 hover:bg-white/[0.06]"><span className="rounded-full bg-[#F8C846]/15 px-2 py-1 text-[11px] font-black text-[#F8C846]">{article.label}</span><h3 className="mt-3 text-lg font-black text-white">{article.title}</h3><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{article.summary}</p></Link>) : <EmptyState title="لا توجد مقالات مرتبطة بعد" body="اربط MatchDigest أو PressNews بالمباراة لظهور التقارير هنا." />}</div></Section>;
}
function SourceStatus({ item }: { item: SourceChecklistItem }) {
  const styles = item.status === 'ready' ? 'border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F]' : item.status === 'missing' ? 'border-rose-300/25 bg-rose-400/10 text-rose-100' : 'border-[#F8C846]/25 bg-[#F8C846]/10 text-[#F8C846]';
  return <div className={`rounded-2xl border p-3 ${styles}`}><div className="mb-1 flex items-center gap-2"><CheckCircle2 size={16} /><b className="text-sm">{item.label}</b></div><p className="text-xs font-bold leading-6 text-slate-300">{item.note}</p></div>;
}
function SourceCard({ source }: { source: MatchSourceView }) {
  const badge = source.status === 'active' ? 'bg-[#18E58F] text-black' : source.status === 'fallback' ? 'bg-[#F8C846] text-black' : 'bg-white/10 text-white';
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-black text-white">{source.name}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-black ${badge}`}>{source.status === 'active' ? 'نشط' : source.status === 'fallback' ? 'احتياطي' : 'غير متوفر'}</span></div><p className="text-xs font-bold leading-6 text-slate-400">الأولوية: {numberFormat.format(source.priority)}{source.lastCheckedAt ? ` — آخر فحص: ${formatShortDate(source.lastCheckedAt)}` : ''}</p>{source.details ? <p className="mt-1 text-xs font-bold text-slate-500">{source.details}</p> : null}</div>;
}
function SourcesPanel({ data }: { data: MatchPageData }) {
  return <Section id="sources" title="المصادر وطلبات الربط" icon={<ListChecks size={22} />} hint="واضحة حتى تعرف ما الذي ينقص الصفحة"><div className="grid gap-4 lg:grid-cols-2"><div><h3 className="mb-3 text-lg font-black text-white">قائمة الجاهزية</h3><div className="grid gap-3">{data.sourceChecklist.map((item) => <SourceStatus key={item.label} item={item} />)}</div></div><div><h3 className="mb-3 text-lg font-black text-white">ترتيب مصادر العرض</h3><div className="grid gap-3">{data.sources.map((source) => <SourceCard key={source.key} source={source} />)}</div></div></div></Section>;
}

export default function ProfessionalMatchPage({ data }: { data: MatchPageData }) {
  const router = useRouter();
  const refreshMs = data.status.isLive ? 25000 : 90000;
  const pageTitle = useMemo(() => `${data.homeTeam.name} ${formatNumber(data.score.home)} - ${formatNumber(data.score.away)} ${data.awayTeam.name}`, [data]);
  function refresh() { router.refresh(); }
  async function share() {
    const text = `${pageTitle} — ${data.status.label}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) await navigator.share({ title: data.title, text, url: window.location.href }).catch(() => undefined);
    else if (typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(`${text}\n${window.location.href}`).catch(() => undefined);
  }

  return <main className="min-h-screen bg-[#04110D] px-4 pb-20 pt-4 text-white" dir="rtl"><MatchAutoRefresh intervalMs={refreshMs} /><div className="mx-auto max-w-7xl space-y-5"><Hero data={data} onRefresh={refresh} onShare={share} /><StickyTabs /><Overview data={data} /><EventsPanel events={data.events} /><StatsPanel data={data} /><LineupsPanel data={data} /><StandingsPanel data={data} /><AnalysisPanel data={data} /><SourcesPanel data={data} /></div></main>;
}
