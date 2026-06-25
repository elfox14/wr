'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, FileText, Flag, MapPin, Radio, RefreshCw, Share2, Shield, Trophy, Users } from 'lucide-react';
import MatchAutoRefresh from '@/components/match-center/MatchAutoRefresh';
import type { MatchEventView, MatchPageData, MatchPlayerLite, MatchPlayerStatItem, MatchStatMetric, OfficialLineupPlayer, OfficialLineupTeam, StandingRow } from '@/lib/match-page/types';

const ar = new Intl.NumberFormat('ar-EG');

type TeamSideKey = 'home' | 'away';
type PitchPlayer = OfficialLineupPlayer | MatchPlayerLite;
type PlayerRole = 'starter' | 'substitute';
type PlayerRow = { player: PitchPlayer; stat: MatchPlayerStatItem | null; role: PlayerRole; index: number };

type TabId = 'events' | 'stats' | 'lineups' | 'standings' | 'analysis';
const tabs: Array<[TabId, string, ReactNode]> = [
  ['events', 'الأحداث', <Radio size={15} key="events" />],
  ['stats', 'الإحصائيات', <BarChart3 size={15} key="stats" />],
  ['lineups', 'التشكيل', <Users size={15} key="lineups" />],
  ['standings', 'الترتيب', <Trophy size={15} key="standings" />],
  ['analysis', 'التحليل', <FileText size={15} key="analysis" />],
];

const statusClasses = {
  scheduled: 'border-white/15 bg-white/10 text-white',
  live: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  halftime: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  finished: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
  delayed: 'border-rose-300/35 bg-rose-400/10 text-rose-100',
};

const eventArabicMap: Record<string, string> = {
  goal: 'هدف', shot_on_target: 'تسديدة على المرمى', shot_off_target: 'تسديدة خارج المرمى', shot_blocked: 'تسديدة محجوبة',
  corner_kick: 'ركلة ركنية', foul: 'خطأ', yellow_card: 'بطاقة صفراء', red_card: 'بطاقة حمراء', substitution: 'تبديل',
  var: 'مراجعة VAR', offside: 'تسلل', added_time: 'وقت بدل ضائع', period_start: 'بداية شوط', period_end: 'نهاية شوط',
  save: 'تصدي', penalty: 'ركلة جزاء', own_goal: 'هدف عكسي',
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

function fmt(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number.isInteger(value) ? ar.format(value) : value.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}
function fullDate(value: string) { return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function normalizeName(value?: string | null) { return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function initials(name?: string | null) { return String(name || 'لاعب').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function eventArabic(type?: string | null) { const raw = String(type || '').trim(); const key = raw.toLowerCase().replace(/\s+/g, '_'); if (eventArabicMap[key]) return eventArabicMap[key]; for (const [needle, label] of Object.entries(eventArabicMap)) if (key.includes(needle)) return label; return raw || 'حدث مباراة'; }
function gd(value: number) { return value > 0 ? `+${ar.format(value)}` : ar.format(value); }
function playerNumber(player: PitchPlayer) { return 'number' in player ? player.number : null; }
function playerCaptain(player: PitchPlayer) { return 'isCaptain' in player ? Boolean(player.isCaptain) : false; }
function playerId(player: PitchPlayer) { return 'id' in player && player.id ? String(player.id) : null; }
function playedStat(stat: MatchPlayerStatItem | null | undefined) { return Boolean(stat?.played) || Number(stat?.minutes || 0) > 0 || Boolean(stat?.started); }
function matchClockLabel(data: MatchPageData) { if (data.status.isScheduled) return `موعد المباراة: ${fullDate(data.matchDate)}`; if (data.status.isFinished) return 'نهاية المباراة'; return data.status.label || 'زمن المباراة'; }

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
  const usedSubstitutes = (team?.substitutes || []).map((player, index) => ({ player: playerWithRealImage(player, localPlayers), stat: playerStatFor(player, stats), role: 'substitute' as PlayerRole, index })).filter((row) => playedStat(row.stat));
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

function Empty({ title, body }: { title: string; body: string }) { return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-white">{title}</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">{body}</p></div>; }
function Section({ id, title, icon, hint, children }: { id: TabId; title: string; icon: ReactNode; hint?: string; children: ReactNode }) { return <section id={id} className="scroll-mt-[132px] rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_48px_rgba(0,0,0,.20)] sm:rounded-[1.65rem] sm:p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/12 text-[#18E58F]">{icon}</span><div className="min-w-0"><h2 className="truncate text-lg font-black text-white sm:text-2xl">{title}</h2>{hint ? <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{hint}</p> : null}</div></div>{children}</section>; }
function FlagImg({ team, small = false }: { team: MatchPageData['homeTeam']; small?: boolean }) { return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/35 ${small ? 'h-5 w-7 rounded' : 'h-14 w-16 rounded-2xl sm:h-24 sm:w-28'}`}>{team.image ? <img src={team.image} alt={`علم ${team.name}`} className="h-full w-full object-cover" loading="lazy" /> : <b className="text-xs text-[#F8C846]">{team.code || team.name.slice(0, 3)}</b>}</span>; }
function PlayerAvatar({ player, accent }: { player: PitchPlayer; accent: TeamSideKey }) { const number = playerNumber(player); const border = accent === 'home' ? 'border-[#F8C846]' : 'border-[#18E58F]'; return <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${border} bg-black/45 shadow-lg sm:h-14 sm:w-14`}>{player.image ? <img src={player.image} alt={player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[11px] font-black text-white">{initials(player.name)}</span>}{number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white ring-1 ring-white/20">{number}</b> : null}</div>; }
function StatChip({ label, value }: { label: string; value: any }) { return <span className="rounded-xl border border-white/10 bg-black/25 px-2 py-1.5 text-center"><b className="block text-sm font-black text-white tabular-nums">{fmt(Number(value))}</b><small className="mt-0.5 block text-[9px] font-black text-slate-500">{label}</small></span>; }

function TeamSide({ team }: { team: MatchPageData['homeTeam'] }) { return <div className="flex min-w-0 flex-col items-center gap-2"><FlagImg team={team} /><div className="min-w-0 text-center"><p className="truncate text-base font-black text-white sm:text-3xl">{team.name}</p><div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[10px] font-bold text-slate-400 sm:text-xs">{team.code ? <span>{team.code}</span> : null}{team.fifaRank ? <span>تصنيف {ar.format(team.fifaRank)}</span> : null}</div></div></div>; }
function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-2.5 text-center sm:p-3 sm:text-right"><div className="mb-1 flex items-center justify-center gap-1.5 text-[#18E58F] sm:justify-start">{icon}<span className="text-[10px] font-black sm:text-xs">{label}</span></div><p className="line-clamp-2 min-h-[2.35rem] text-[10px] font-black leading-5 text-white sm:min-h-0 sm:text-sm sm:font-bold sm:leading-6">{value || '—'}</p></div>; }
function Hero({ data, onRefresh, onShare }: { data: MatchPageData; onRefresh: () => void; onShare: () => void }) { return <header className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#04110D] p-3 text-center shadow-[0_24px_70px_rgba(0,0,0,.36)] sm:rounded-[2rem] sm:p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(24,229,143,.20),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(248,200,70,.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_42%)]" /><div className="relative"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5" dir="rtl"><TeamSide team={data.homeTeam} /><div className="space-y-2"><div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 shadow-inner sm:gap-5 sm:px-7 sm:py-3"><span className="text-3xl font-black text-[#F8C846] tabular-nums sm:text-7xl">{fmt(data.score.home)}</span><span className="text-2xl font-black text-white/70 sm:text-6xl">-</span><span className="text-3xl font-black text-white tabular-nums sm:text-7xl">{fmt(data.score.away)}</span></div><p className={`mx-auto inline-flex rounded-full border px-3 py-1.5 text-xs font-black sm:px-4 sm:py-2 ${statusClasses[data.status.kind]}`}>{matchClockLabel(data)}</p></div><TeamSide team={data.awayTeam} /></div><div className="mt-5 grid grid-cols-2 gap-2 text-right lg:grid-cols-4"><Info icon={<MapPin size={15} />} label="الملعب" value={data.venue || 'جاري جلب اسم الملعب'} /><Info icon={<Shield size={15} />} label="المدينة" value={data.city || '—'} /><Info icon={<Flag size={15} />} label="الحكم" value={data.referee || '—'} /><Info icon={<Trophy size={15} />} label="المجموعة" value={data.groupLabel || data.stageLabel} /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center"><button onClick={onRefresh} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18E58F] px-3 py-2 text-xs font-black text-black sm:text-sm"><RefreshCw size={16} /> تحديث</button><button onClick={onShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white sm:text-sm"><Share2 size={16} /> مشاركة</button>{data.digest?.href ? <Link href={data.digest.href} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#F8C846]/30 bg-[#F8C846]/12 px-3 py-2 text-xs font-black text-[#F8C846] sm:col-span-1 sm:text-sm"><FileText size={16} /> تقرير المباراة</Link> : null}</div></div></header>; }
function StickyTabs({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) { return <nav className="sticky top-[72px] z-40 -mx-2 border-y border-white/10 bg-[#04110D]/96 shadow-[0_12px_32px_rgba(0,0,0,.36)] backdrop-blur-xl"><div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-2 py-2 scrollbar-none sm:px-4">{tabs.map(([id, label, icon]) => <button key={id} type="button" onClick={() => onSelect(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition sm:text-xs ${active === id ? 'border-[#18E58F]/45 bg-[#18E58F] text-black' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}>{icon}{label}</button>)}</div></nav>; }

function EventsPanel({ data }: { data: MatchPageData }) { return <Section id="events" title="أحداث المباراة" icon={<Radio size={22} />} hint="الأحداث النهائية من TheStats بدون تكرار مع iSports"><div className="rounded-[1.4rem] border border-white/10 bg-black/25 p-3">{data.events.length ? <div className="space-y-2">{data.events.map((event: MatchEventView) => <article key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-right"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/35 text-lg">{event.icon}</span><div className="min-w-0 flex-1"><p className="text-xs font-black text-[#F8C846]">{event.minuteLabel} · {eventArabic(event.type)}</p><p className="mt-1 text-sm font-bold leading-6 text-white">{event.playerName ? `${event.playerName} — ` : ''}{event.detail || eventArabic(event.type)}</p></div></div></article>)}</div> : <Empty title="لا توجد أحداث" body="ستظهر الأحداث بعد حفظ Snapshot النهائي من TheStats." />}</div></Section>; }
function StatComparisonRow({ metric }: { metric: MatchStatMetric }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="grid grid-cols-[72px_1fr_72px] items-center gap-2"><b className="text-center text-sm text-[#F8C846] tabular-nums">{fmt(metric.home, metric.suffix)}</b><div className="text-center"><p className="text-sm font-black text-white">{metric.label}</p><p className="mt-1 text-[10px] font-bold text-slate-500">{metric.source || '—'}</p></div><b className="text-center text-sm text-[#18E58F] tabular-nums">{fmt(metric.away, metric.suffix)}</b></div></div>; }
function StatsPanel({ data }: { data: MatchPageData }) { const available = data.stats.filter((m) => m.available); return <Section id="stats" title="إحصائيات المباراة" icon={<BarChart3 size={22} />} hint={`${ar.format(available.length)} مؤشر متوفر · TheStats أولًا وiSports كاحتياطي للمؤشرات غير المتوفرة`}><div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/5 pb-4"><div className="flex items-center gap-2 justify-start min-w-0"><span className="truncate text-sm font-black text-white">{data.homeTeam.name}</span><FlagImg team={data.homeTeam} small /></div><span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black text-slate-400">المقارنة</span><div className="flex items-center gap-2 justify-end min-w-0"><FlagImg team={data.awayTeam} small /><span className="truncate text-sm font-black text-white">{data.awayTeam.name}</span></div></div><div className="grid gap-3 lg:grid-cols-2">{available.map((metric) => <StatComparisonRow key={metric.key} metric={metric} />)}</div></div></Section>; }
function PlayerStatCard({ row, accent }: { row: PlayerRow; accent: TeamSideKey }) { const player = row.player; const stat = row.stat; const items = statItems(stat); return <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><div className="flex items-start gap-3"><PlayerAvatar player={player} accent={accent} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-sm font-black text-white sm:text-base">{player.name}</p>{playerCaptain(player) ? <span className="rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[9px] font-black text-black">C</span> : null}<span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black text-slate-300">{row.role === 'starter' ? 'أساسي' : 'بديل شارك'}</span></div><p className="mt-1 text-[10px] font-bold text-slate-400">#{playerNumber(player) || '—'} · {player.position || stat?.position || '—'}{stat?.playerSubbedOn ? ` · دخل بدل ${stat.playerSubbedOn}` : ''}{stat?.playerSubbedOff ? ` · خرج وبدله ${stat.playerSubbedOff}` : ''}</p>{items.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{items.map((item) => <StatChip key={item.key} label={item.label} value={item.value} />)}</div> : <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-400">لا توجد إحصائيات تفصيلية لهذا اللاعب حتى الآن.</p>}</div></div></article>; }
function PlayerGroup({ title, rows, accent }: { title: string; rows: PlayerRow[]; accent: TeamSideKey }) { if (!rows.length) return null; return <div><h4 className="mb-2 text-xs font-black text-[#F8C846]">{title}</h4><div className="grid gap-2">{rows.map((row) => <PlayerStatCard key={`${title}-${row.player.name}-${row.index}`} row={row} accent={accent} />)}</div></div>; }
function TeamPlayerStatsCard({ team, lineup, localPlayers, stats, accent }: { team: MatchPageData['homeTeam']; lineup: OfficialLineupTeam | null | undefined; localPlayers: MatchPlayerLite[]; stats: MatchPlayerStatItem[]; accent: TeamSideKey }) { const teamStats = stats.filter((stat) => statBelongsToTeam(stat, team, localPlayers)); const rows = lineupRows(lineup, localPlayers, teamStats); const color = accent === 'home' ? 'text-[#F8C846] border-[#F8C846]/25 bg-[#F8C846]/10' : 'text-[#18E58F] border-[#18E58F]/25 bg-[#18E58F]/10'; return <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FlagImg team={team} small /><div className="min-w-0"><h3 className="truncate text-lg font-black text-white">{team.name}</h3><p className="mt-1 text-[10px] font-bold text-slate-500">{lineup?.formation ? `الخطة ${lineup.formation}` : 'لاعبو المنتخب المشاركون'}</p></div></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${color}`}>{ar.format(rows.withStats)} / {ar.format(rows.total)} لاعب</span></div><div className="space-y-5"><PlayerGroup title="الأساسيون فقط" rows={rows.starters} accent={accent} /><PlayerGroup title="البدلاء الذين شاركوا فقط" rows={rows.usedSubstitutes} accent={accent} />{!rows.total ? <Empty title="جاري جلب إحصائيات اللاعبين" body="لم تصل إحصائيات اللاعبين بعد. ستظهر هنا تلقائيًا فور حفظ بيانات ما بعد المباراة." /> : null}</div></div>; }
function LineupsPanel({ data }: { data: MatchPageData }) { const stats = data.advanced.playerStats || []; const official = data.officialLineup; return <Section id="lineups" title="التشكيل وأداء اللاعبين" icon={<Users size={22} />} hint="كل منتخب بلاعبيه: الأساسيون فقط + البدلاء الذين شاركوا، مع صورة كل لاعب وكل الإحصائيات المتاحة"><div className="grid gap-4"><TeamPlayerStatsCard team={data.homeTeam} lineup={official?.home} localPlayers={data.homePlayers} stats={stats} accent="home" /><TeamPlayerStatsCard team={data.awayTeam} lineup={official?.away} localPlayers={data.awayPlayers} stats={stats} accent="away" /></div></Section>; }
function StatMini({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) { return <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-center"><span className="block text-[10px] font-black text-slate-500">{label}</span><b className={`mt-1 block text-sm font-black tabular-nums ${accent ? 'text-[#18E58F]' : 'text-white'}`}>{value}</b></div>; }
function StandingCard({ row, compact = false }: { row: StandingRow; compact?: boolean }) { return <article className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-inner"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#F8C846]/25 bg-[#F8C846]/10 text-sm font-black text-[#F8C846]">{ar.format(row.rank)}</span><div className="min-w-0"><p className="truncate text-sm font-black text-white sm:text-base">{row.teamName}</p><p className="mt-0.5 text-[10px] font-bold text-slate-500">{compact ? 'ترتيب الثوالث' : 'ترتيب المجموعة'}</p></div></div><div className="rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-3 py-2 text-center"><span className="block text-[10px] font-black text-[#18E58F]/80">نقاط</span><b className="text-xl font-black text-[#18E58F] tabular-nums">{ar.format(row.points)}</b></div></div><div className="grid grid-cols-4 gap-2 sm:grid-cols-8"><StatMini label="لعب" value={ar.format(row.played)} /><StatMini label="فاز" value={ar.format(row.won)} /><StatMini label="تعادل" value={ar.format(row.drawn)} /><StatMini label="خسر" value={ar.format(row.lost)} /><StatMini label="له" value={ar.format(row.goalsFor)} /><StatMini label="عليه" value={ar.format(row.goalsAgainst)} /><StatMini label="فارق" value={gd(row.goalDifference)} /><StatMini label="نقاط" value={ar.format(row.points)} accent /></div></article>; }
function StandingsList({ rows, compact = false }: { rows: StandingRow[]; compact?: boolean }) { if (!rows.length) return <Empty title="غير متاح الآن" body="لن يظهر ترتيب غير موثوق حتى تتوفر بيانات المجموعة بشكل صحيح." />; return <div className="space-y-2">{rows.map((row) => <StandingCard key={`${row.teamId}-${row.rank}-${row.teamName}`} row={row} compact={compact} />)}</div>; }
function StandingsPanel({ data }: { data: MatchPageData }) { if (!data.groupStandings.length && !data.thirdPlaceTable.length) return null; return <Section id="standings" title="الترتيب والتأهل" icon={<Trophy size={22} />} hint="ترتيب المجموعة وأفضل الثوالث"><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-black text-white">ترتيب المجموعة</h3><span className="rounded-full bg-[#18E58F]/10 px-3 py-1 text-[11px] font-black text-[#18E58F]">{data.groupLabel || 'مجموعة المباراة'}</span></div><StandingsList rows={data.groupStandings} /></div><div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-black text-white">أفضل الثوالث</h3><span className="rounded-full bg-[#F8C846]/10 px-3 py-1 text-[11px] font-black text-[#F8C846]">أفضل ٨</span></div><StandingsList rows={data.thirdPlaceTable.slice(0, 8)} compact /></div></div></Section>; }
function AnalysisPanel({ data }: { data: MatchPageData }) { return <Section id="analysis" title="التحليل والتقرير" icon={<FileText size={22} />}><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="mb-3 text-lg font-black text-white">مفاتيح تكتيكية</h3><div className="space-y-2">{data.tacticalKeys.map((item, index) => <p key={index} className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-200">{item}</p>)}</div></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="mb-3 text-lg font-black text-white">تأثير المباراة</h3><div className="space-y-2">{data.matchImpact.length ? data.matchImpact.map((item, index) => <p key={index} className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-200">{item}</p>) : <p className="rounded-xl bg-white/[0.045] p-3 text-sm font-bold leading-7 text-slate-400">سيظهر تأثير المباراة عند توفر ترتيب مجموعة موثوق.</p>}</div></div></div>{data.digest ? <Link href={data.digest.href || '#'} className="mt-4 block rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 p-4 text-right"><p className="font-black text-[#F8C846]">تقرير المباراة</p><p className="mt-2 text-sm font-bold leading-7 text-white">{data.digest.summary || data.digest.turningPoint || 'افتح تقرير المباراة الكامل.'}</p></Link> : null}</Section>; }

export default function ProfessionalMatchPageClient({ data }: { data: MatchPageData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const pageTitle = useMemo(() => `${data.homeTeam.name} ${fmt(data.score.home)} - ${fmt(data.score.away)} ${data.awayTeam.name}`, [data]);
  function refresh() { router.refresh(); }
  function selectTab(id: TabId) { setActiveTab(id); const target = document.getElementById(id); if (!target || typeof window === 'undefined') return; const top = target.getBoundingClientRect().top + window.scrollY - 120; window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); }
  async function share() { if (typeof navigator !== 'undefined' && navigator.share) { try { await navigator.share({ title: pageTitle, text: pageTitle, url: window.location.href }); return; } catch {} } if (typeof navigator !== 'undefined') await navigator.clipboard?.writeText(window.location.href); }
  const refreshMs = data.status.kind === 'live' ? 25000 : 90000;
  return <main className="min-h-screen bg-[#04110D] pb-16 text-white" dir="rtl"><MatchAutoRefresh intervalMs={refreshMs} /><div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:px-5 lg:px-6"><Hero data={data} onRefresh={refresh} onShare={share} /><StickyTabs active={activeTab} onSelect={selectTab} /><EventsPanel data={data} /><StatsPanel data={data} /><LineupsPanel data={data} /><StandingsPanel data={data} /><AnalysisPanel data={data} /></div></main>;
}
