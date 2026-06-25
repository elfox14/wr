'use client';

import { type ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, FileText, Layers, List, MapPin, Radio, RefreshCw, Share2, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchPlayerStatItem, MatchStatMetric, OfficialLineupTeam, StandingRow } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');

type TabId = 'overview' | 'events' | 'lineups' | 'interactive' | 'analysis' | 'group' | 'articles';
type TeamLite = MatchPageData['homeTeam'];
type AnyPlayer = Record<string, any>;
type PlayerStat = MatchPlayerStatItem & Record<string, any>;
type PlayerRow = { player: AnyPlayer; stat: PlayerStat | null; role: 'starter' | 'substitute'; index: number };

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
  ['rating', 'تقييم'], ['started', 'أساسي'], ['played', 'شارك'], ['minutes', 'دقائق'],
  ['goals', 'أهداف'], ['assists', 'أسيست'],
  ['shots', 'تسديد'], ['shotsOnTarget', 'على المرمى'], ['shotsOffTarget', 'خارج المرمى'], ['blockedShots', 'محجوبة'],
  ['expectedGoals', 'xG'], ['npExpectedGoals', 'npxG'], ['expectedAssists', 'xA'], ['bigChancesCreated', 'فرص خلقها'],
  ['passes', 'تمرير'], ['accuratePasses', 'تمرير صحيح'], ['keyPasses', 'تمرير مفتاحي'],
  ['crosses', 'عرضيات'], ['accurateCrosses', 'عرضيات صحيحة'], ['longBalls', 'طولية'], ['accurateLongBalls', 'طولية صحيحة'],
  ['touches', 'لمسات'], ['tackles', 'تدخلات'], ['interceptions', 'اعتراضات'], ['clearances', 'تشتيت'], ['saves', 'تصديات'],
  ['duelWon', 'التحامات فاز'], ['duelLost', 'التحامات خسر'], ['aerialWon', 'هوائيات'], ['challengeLost', 'تحديات خسر'], ['wonContest', 'مراوغات ناجحة'], ['dispossessed', 'افتكاك منه'], ['possessionLost', 'فقد استحواذ'],
  ['foulsCommitted', 'أخطاء ارتكبها'], ['foulsWon', 'أخطاء حصل عليها'], ['offsides', 'تسلل'],
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

function lastNameToken(value?: string | null) {
  const parts = normalizeName(value).split(' ').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function displayTeamName(team: { code?: string | null; name?: string | null }) {
  return getArabicTeamName(team.code, team.name);
}

function displayTeamFlagUrl(team: { code?: string | null; name?: string | null; image?: string | null }, width = 160) {
  return getTeamFlagUrl({ code: team.code, name: displayTeamName(team), image: team.image }, width) || team.image || null;
}

function initials(name?: string | null) {
  return String(name || 'لاعب').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function playerId(player: AnyPlayer) {
  return player?.id ? String(player.id) : null;
}

function numberValue(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) return String(n);
  }
  return '';
}

function playerNumber(player: AnyPlayer) {
  return player?.number ?? player?.shirtNumber ?? player?.jerseyNumber ?? null;
}

function statNumber(stat?: PlayerStat | null) {
  return numberValue(stat?.number, stat?.shirtNumber, stat?.jerseyNumber, stat?.playerNumber);
}

function playerPosition(player: AnyPlayer, stat?: PlayerStat | null) {
  return player?.position || stat?.position || '—';
}

function playedStat(stat?: PlayerStat | null) {
  return Boolean(stat?.played) || Boolean(stat?.playerSubbedOn) || Boolean(stat?.playerSubbedOff) || Number(stat?.minutes || 0) > 0;
}

function statStarted(stat?: PlayerStat | null) {
  return Boolean(stat?.started) || Number(stat?.started || 0) === 1;
}

function isSubstituteStat(stat?: PlayerStat | null) {
  return Boolean(stat?.playerSubbedOn) || (!statStarted(stat) && playedStat(stat));
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

function findLocalPlayer(player: AnyPlayer | { id?: string | null; name?: string | null }, localPlayers: MatchPlayerLite[]) {
  const id = player.id ? String(player.id) : null;
  const name = normalizeName(player.name);
  return localPlayers.find((item: AnyPlayer) => {
    const localName = normalizeName(item.name);
    const sameNumber = numberValue((player as AnyPlayer).number, (player as AnyPlayer).shirtNumber, (player as AnyPlayer).jerseyNumber) && numberValue(item.number, item.shirtNumber, item.jerseyNumber) === numberValue((player as AnyPlayer).number, (player as AnyPlayer).shirtNumber, (player as AnyPlayer).jerseyNumber);
    return Boolean((id && item.id === id) || sameNumber || (name && localName && (localName === name || localName.includes(name) || name.includes(localName))));
  });
}

function playerWithImage(player: AnyPlayer, localPlayers: MatchPlayerLite[]) {
  const local = findLocalPlayer(player, localPlayers) as AnyPlayer | undefined;
  return { ...player, image: player.image || local?.image || null, position: player.position || local?.position || null, number: playerNumber(player) || playerNumber(local || {}) || null };
}

function playerStatFor(player: AnyPlayer, stats: PlayerStat[]) {
  const id = playerId(player);
  const name = normalizeName(player.name);
  const last = lastNameToken(player.name);
  const pNumber = numberValue(playerNumber(player));
  const pPos = normalizeName(player.position);
  return stats.find((stat) => {
    const statId = stat.playerId ? String(stat.playerId) : null;
    const statName = normalizeName(stat.playerName);
    const sLast = lastNameToken(stat.playerName);
    const sNumber = statNumber(stat);
    const sPos = normalizeName(stat.position);
    const numberMatch = Boolean(pNumber && sNumber && pNumber === sNumber);
    const exactName = Boolean(name && statName && (statName === name || statName.includes(name) || name.includes(statName)));
    const lastNameMatch = Boolean(last && sLast && last === sLast && (!pPos || !sPos || pPos === sPos));
    return Boolean((id && statId && id === statId) || exactName || numberMatch || lastNameMatch);
  }) || null;
}

function statBelongsToTeam(stat: PlayerStat, team: TeamLite, localPlayers: MatchPlayerLite[]) {
  if (stat.teamId && (stat.teamId === team.id || stat.teamId === team.code)) return true;
  const statTeam = normalizeName(stat.teamName);
  const teamName = normalizeName(team.name);
  const teamCode = normalizeName(team.code);
  if (statTeam && ((teamName && (statTeam === teamName || statTeam.includes(teamName) || teamName.includes(statTeam))) || (teamCode && statTeam === teamCode))) return true;
  const playerName = normalizeName(stat.playerName);
  return Boolean(playerName && localPlayers.some((player) => normalizeName(player.name) === playerName || lastNameToken(player.name) === lastNameToken(stat.playerName)));
}

function statAsPlayer(stat: PlayerStat, localPlayers: MatchPlayerLite[]) {
  return playerWithImage({ id: stat.playerId || stat.playerName || 'player', name: stat.playerName || 'لاعب', image: null, number: stat.number || stat.shirtNumber || stat.jerseyNumber || null, position: stat.position || null }, localPlayers);
}

function uniqueRows(rows: PlayerRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = normalizeName(String(playerId(row.player) || row.player.name || row.stat?.playerName || playerNumber(row.player) || row.index));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildRows(lineup: OfficialLineupTeam | null | undefined, localPlayers: MatchPlayerLite[], teamStats: PlayerStat[]) {
  const starters: PlayerRow[] = (lineup?.startingXi || []).map((player: AnyPlayer, index) => ({ player: playerWithImage(player, localPlayers), stat: playerStatFor(player, teamStats), role: 'starter', index }));
  const starterKeys = new Set(starters.map((row) => normalizeName(String(playerId(row.player) || row.player.name))));
  const usedSubsFromLineup: PlayerRow[] = (lineup?.substitutes || [])
    .map((player: AnyPlayer, index) => ({ player: playerWithImage(player, localPlayers), stat: playerStatFor(player, teamStats), role: 'substitute' as const, index }))
    .filter((row) => playedStat(row.stat) || Boolean(row.player?.playerSubbedOn || row.player?.playerSubbedOff));
  const statRows: PlayerRow[] = teamStats
    .filter((stat) => playedStat(stat))
    .map((stat, index) => ({ player: statAsPlayer(stat, localPlayers), stat, role: statStarted(stat) ? 'starter' : 'substitute', index: index + 1000 }));
  const fallbackStarters = starters.length ? [] : statRows.filter((row) => row.role === 'starter');
  const statSubs = statRows.filter((row) => row.role === 'substitute' || isSubstituteStat(row.stat)).filter((row) => !starterKeys.has(normalizeName(String(row.stat?.playerId || row.stat?.playerName || row.player.name))));
  const finalStarters = uniqueRows([...starters, ...fallbackStarters]);
  const finalSubs = uniqueRows([...usedSubsFromLineup, ...statSubs]).filter((row) => !finalStarters.some((starter) => normalizeName(starter.player.name) === normalizeName(row.player.name)));
  return { starters: finalStarters, substitutes: finalSubs, total: finalStarters.length + finalSubs.length };
}

function statItems(stat: PlayerStat | null) {
  if (!stat) return [];
  return PLAYER_STAT_DEFS.map(([key, label]) => ({ key, label, value: stat[key] })).filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
}

function fallbackPlayerItems(row: PlayerRow) {
  return [
    { key: 'role', label: 'الحالة', value: row.role === 'starter' ? 'أساسي' : 'شارك كبديل / تم استبداله' },
    { key: 'number', label: 'رقم اللاعب', value: playerNumber(row.player) || '—' },
    { key: 'position', label: 'المركز', value: playerPosition(row.player, row.stat) },
  ];
}

function PlayerAvatar({ player, accent }: { player: AnyPlayer; accent: 'home' | 'away' }) {
  const border = accent === 'home' ? 'border-[#F8C846]' : 'border-[#18E58F]';
  const number = playerNumber(player);
  return <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${border} bg-black/45`}>{player.image ? <img src={player.image} alt={player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[11px] font-black text-white">{initials(player.name)}</span>}{number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white ring-1 ring-white/20">{number}</b> : null}</div>;
}

function PlayerCard({ row, accent }: { row: PlayerRow; accent: 'home' | 'away' }) {
  const detailedItems = statItems(row.stat);
  const items = detailedItems.length ? detailedItems : fallbackPlayerItems(row);
  return <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><div className="flex items-start gap-3"><PlayerAvatar player={row.player} accent={accent} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-sm font-black text-white sm:text-base">{row.player.name}</p>{row.player?.isCaptain ? <span className="rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[9px] font-black text-black">C</span> : null}<span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black text-slate-300">{row.role === 'starter' ? 'أساسي' : 'شارك كبديل / تم استبداله'}</span></div><p className="mt-1 text-[10px] font-bold text-slate-400">رقم {playerNumber(row.player) || '—'} · {playerPosition(row.player, row.stat)}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{items.map((item) => <span key={item.key} className="rounded-xl border border-white/10 bg-black/25 px-2 py-1.5 text-center"><b className="block text-sm font-black text-white tabular-nums">{fmt(item.value as any)}</b><small className="mt-0.5 block text-[9px] font-black text-slate-500">{item.label}</small></span>)}</div>{!detailedItems.length ? <p className="mt-2 text-[10px] font-bold text-slate-500">الإحصائيات التفصيلية لم تصل لهذا اللاعب بعد، وتم عرض بيانات المشاركة الأساسية بدلًا من ترك الكارت فارغًا.</p> : null}</div></div></article>;
}

function TeamPlayersSection({ team, lineup, localPlayers, stats, accent }: { team: TeamLite; lineup: OfficialLineupTeam | null | undefined; localPlayers: MatchPlayerLite[]; stats: PlayerStat[]; accent: 'home' | 'away' }) {
  const rows = buildRows(lineup, localPlayers, stats.filter((stat) => statBelongsToTeam(stat, team, localPlayers)));
  const color = accent === 'home' ? 'text-[#F8C846] border-[#F8C846]/25 bg-[#F8C846]/10' : 'text-[#18E58F] border-[#18E58F]/25 bg-[#18E58F]/10';
  return <section className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FlagImg team={team} small /><div className="min-w-0"><h3 className="team-name-full text-xl font-black text-white">{displayTeamName(team)}</h3><p className="mt-1 text-xs font-bold text-slate-500">{lineup?.formation ? `الخطة ${lineup.formation}` : 'كل منتخب بلاعبيه المشاركين'}</p></div></div><span className={`rounded-full border px-3 py-1 text-[11px] font-black ${color}`}>{ar.format(rows.total)} لاعب</span></div><div className="space-y-6"><div><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-black text-[#F8C846]">اللاعبون الأساسيون</h4><span className="text-xs font-bold text-slate-500">{ar.format(rows.starters.length)} لاعب</span></div><div className="grid gap-3">{rows.starters.length ? rows.starters.map((row) => <PlayerCard key={`starter-${row.player.name}-${row.index}`} row={row} accent={accent} />) : <Empty title="غير متوفر" body="لم يصل التشكيل الأساسي بعد." />}</div></div><div><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-black text-[#18E58F]">اللاعبون الذين شاركوا كبدلاء / تم استبدالهم</h4><span className="text-xs font-bold text-slate-500">{ar.format(rows.substitutes.length)} لاعب</span></div><div className="grid gap-3">{rows.substitutes.length ? rows.substitutes.map((row) => <PlayerCard key={`sub-${row.player.name}-${row.index}`} row={row} accent={accent} />) : <Empty title="لا يوجد لاعبو تبديل مشاركون" body="لن يتم عرض كل دكة البدلاء؛ فقط من شارك فعليًا أو ظهر في بيانات التبديلات." />}</div></div></div></section>;
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
  return <Panel title="أحداث المباراة" icon={<Radio size={22} />}><div className="space-y-3">{data.events.length ? data.events.map((event: MatchEventView) => <article key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-lg">{event.icon}</span><b className="rounded-full bg-white/10 px-2 py-1 text-xs text-white">{event.minuteLabel || '—'}</b><span className="rounded-full bg-[#F8C846]/15 px-2 py-1 text-xs font-black text-[#F8C846]">{event.type}</span>{event.playerName ? <span className="text-sm font-black text-white">{event.playerName}</span> : null}</div><p className="text-sm font-bold leading-7 text-slate-200">{event.detail || 'حدث محفوظ.'}</p></article>) : <Empty title="لا توجد أحداث" body="ستظهر بعد مزامنة الأحداث." />}</div></Panel>;
}

function LineupsPanel({ data }: { data: MatchPageData }) {
  const playerStats = (data.advanced.playerStats || []) as PlayerStat[];
  return <Panel title="التشكيلات وأداء اللاعبين" icon={<Users size={22} />} hint="صفحة واحدة تعرض كل منتخب وحده: الأساسيون أولًا، ثم لاعبو التبديل المشاركون، مع الصورة والرقم وكل الإحصائيات المتاحة."><div className="space-y-5"><TeamPlayersSection team={data.homeTeam} lineup={data.officialLineup?.home} localPlayers={data.homePlayers} stats={playerStats} accent="home" /><TeamPlayersSection team={data.awayTeam} lineup={data.officialLineup?.away} localPlayers={data.awayPlayers} stats={playerStats} accent="away" /></div></Panel>;
}

function InteractivePanel({ data }: { data: MatchPageData }) {
  return <Panel title="الملعب التفاعلي" icon={<MapPin size={22} />} hint="يفتح في صفحة مستقلة"><div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-5 text-center"><p className="text-lg font-black text-white">افتح عرض الملعب التفاعلي</p><Link href={`/live-animation/${data.id}`} className="mt-4 inline-flex rounded-xl bg-sky-300 px-5 py-3 text-sm font-black text-black">فتح الملعب التفاعلي</Link></div></Panel>;
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
  return <Panel title="المقالات" icon={<List size={22} />}><div className="grid gap-3">{data.digest?.href ? <Link href={data.digest.href} className="rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 p-4 text-right"><p className="font-black text-[#F8C846]">تقرير المباراة</p><p className="mt-2 text-sm font-bold leading-7 text-white">{data.digest.summary || data.digest.turningPoint || 'افتح تقرير المباراة الكامل.'}</p></Link> : null}{!data.digest?.href && !data.relatedArticles.length ? <Empty title="لا توجد مقالات" body="ستظهر المقالات المرتبطة بهذه المباراة هنا." /> : null}</div></Panel>;
}

export default function ProfessionalMatchTabsPage({ data }: { data: MatchPageData }) {
  const [active, setActive] = useState<TabId>('overview');
  const pageTitle = useMemo(() => `${displayTeamName(data.homeTeam)} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${displayTeamName(data.awayTeam)}`, [data]);
  function refresh() { window.location.reload(); }
  async function share() { if (navigator.share) await navigator.share({ title: pageTitle, text: pageTitle, url: window.location.href }).catch(() => undefined); else await navigator.clipboard?.writeText(window.location.href).catch(() => undefined); }
  return <main className="min-h-screen bg-[#04110D] px-3 py-4 text-white" dir="rtl"><MatchAutoRefresh intervalMs={data.status.isLive ? 25000 : 90000} /><div className="mx-auto max-w-7xl space-y-4"><Hero data={data} onRefresh={refresh} onShare={share} /><TabsNav active={active} onChange={setActive} />{active === 'overview' ? <OverviewPanel data={data} /> : null}{active === 'events' ? <EventsPanel data={data} /> : null}{active === 'lineups' ? <LineupsPanel data={data} /> : null}{active === 'interactive' ? <InteractivePanel data={data} /> : null}{active === 'analysis' ? <AnalysisPanel data={data} /> : null}{active === 'group' ? <GroupPanel data={data} /> : null}{active === 'articles' ? <ArticlesPanel data={data} /> : null}</div></main>;
}
