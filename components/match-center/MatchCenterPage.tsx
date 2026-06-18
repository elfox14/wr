import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'إحصائيات المباراة | MC PRIME World Cup',
  description: 'صفحة رقمية موحدة لإحصائيات المباراة.',
};

type Pair = { home: number | null; away: number | null } | null;
type Side = 'home' | 'away';
type PlayerCard = { name: string; number?: string | number | null; image?: string | null };

function n(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function fmt(value: unknown, suffix = '') {
  const number = n(value);
  return number === null ? '—' : `${number.toLocaleString('ar-EG')}${suffix}`;
}

function dec(value: unknown) {
  const number = n(value);
  return number === null ? '—' : number.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function obj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function arr(...values: unknown[]) {
  for (const value of values) if (Array.isArray(value)) return value;
  return [];
}

function teamName(team: any, fallback: string) {
  return team?.name || team?.code || fallback;
}

function latest(match: any, provider: string) {
  return (match.statsSnapshots || []).find((snapshot: any) => String(snapshot.provider || '').toUpperCase().includes(provider));
}

function fallbackSnapshot(match: any) {
  return (match.statsSnapshots || []).find((snapshot: any) => !String(snapshot.provider || '').toUpperCase().includes('THE_STATS')) || match.statsSnapshots?.[0] || null;
}

function pair(snapshot: any, stats: Record<string, any>, key: string, homeKey: string, awayKey: string): Pair {
  const home = n(snapshot?.[homeKey]);
  const away = n(snapshot?.[awayKey]);
  if (home !== null || away !== null) return { home, away };
  const stat = obj(stats[key]);
  const statHome = n(stat.home);
  const statAway = n(stat.away);
  return statHome === null && statAway === null ? null : { home: statHome, away: statAway };
}

function statPair(stats: Record<string, any>, key: string): Pair {
  const stat = obj(stats[key]);
  const home = n(stat.home);
  const away = n(stat.away);
  return home === null && away === null ? null : { home, away };
}

function derivedPair(value: unknown): Pair {
  const data = obj(value);
  const home = n(data.home);
  const away = n(data.away);
  return home === null && away === null ? null : { home, away };
}

function share(value: Pair) {
  const home = Math.max(0, Number(value?.home ?? 0));
  const away = Math.max(0, Number(value?.away ?? 0));
  const total = home + away;
  if (!total) return { home: 0, away: 0 };
  const homeWidth = Math.max(4, Math.min(96, (home / total) * 100));
  return { home: homeWidth, away: 100 - homeWidth };
}

function rawData(snapshot: any) {
  return obj(snapshot?.rawData);
}

function rawLineup(snapshot: any) {
  const raw = rawData(snapshot);
  const nested = obj(raw.theStatsApi);
  return obj(raw.lineup || raw.lineups || nested.lineup || nested.lineups);
}

function rawStats(snapshot: any) {
  const raw = rawData(snapshot);
  const nested = obj(raw.theStatsApi);
  return obj(raw.stats || raw.providerStats || nested.stats || nested.providerStats);
}

function rawDerived(snapshot: any) {
  const raw = rawData(snapshot);
  const nested = obj(raw.theStatsApi);
  return obj(raw.derived || nested.derived);
}

function sideLineup(lineup: Record<string, any>, side: Side) {
  return obj(lineup[side]);
}

function normalize(value: unknown) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePlayer(row: any): PlayerCard | null {
  const player = obj(row?.player || row?.athlete || row?.person);
  const name = player.name || player.full_name || row?.name || row?.playerName || row?.display_name;
  if (!name) return null;
  return {
    name: String(name),
    number: player.shirt_number || player.jersey_number || player.number || row?.shirt_number || row?.jersey_number || row?.number || null,
    image: player.image || player.photo || player.image_url || row?.image || row?.photo || row?.image_url || null,
  };
}

function matchAsset(player: PlayerCard, squad: any[]) {
  const key = normalize(player.name);
  return squad.find((asset) => normalize(asset.name) === key || normalize(asset.code) === key) || squad.find((asset) => normalize(asset.name).includes(key) || key.includes(normalize(asset.name)));
}

function withImages(players: PlayerCard[], squad: any[]) {
  return players.map((player) => {
    const asset = matchAsset(player, squad);
    return { ...player, image: player.image || asset?.image || null };
  });
}

function lineupPlayers(lineup: Record<string, any>, squad: any[]) {
  const official = arr(lineup.startingXi, lineup.startingXI, lineup.starting_xi, lineup.starters, lineup.lineup).map(parsePlayer).filter(Boolean) as PlayerCard[];
  if (official.length) return withImages(official.slice(0, 11), squad);
  return squad.slice(0, 11).map((player) => ({ name: player.name, image: player.image, number: player.code }));
}

function usedSubs(lineup: Record<string, any>, squad: any[]) {
  const rows = arr(lineup.usedSubstitutes, lineup.substitutesUsed, lineup.substitutedIn, lineup.used_substitutes, lineup.substitutions).map(parsePlayer).filter(Boolean) as PlayerCard[];
  return withImages(rows, squad);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
}

function PlayerDot({ player, side }: { player: PlayerCard; side: Side }) {
  const color = side === 'home' ? 'border-[#0FF0FC]/70 shadow-[0_0_14px_rgba(15,240,252,.28)]' : 'border-[#ff5a67]/70 shadow-[0_0_14px_rgba(255,77,94,.25)]';
  return <div className="flex min-w-0 flex-col items-center gap-1"><div className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border bg-black/60 ${color}`}>{player.image ? <img src={player.image} alt={player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-xs font-black text-white">{initials(player.name)}</span>}{player.number ? <span className="absolute -bottom-0.5 -left-0.5 rounded-full bg-[#FFD700] px-1 text-[9px] font-black text-black">{player.number}</span> : null}</div><p className="max-w-[56px] truncate text-[9px] font-black text-white">{player.name}</p></div>;
}

function formationRows(formation?: string | null) {
  const rows = String(formation || '').split(/[-–—]/).map((part) => Number(part.trim())).filter((value) => Number.isFinite(value) && value > 0 && value <= 6);
  return rows.length ? [1, ...rows] : [1, 4, 3, 3];
}

function Pitch({ players, formation, side }: { players: PlayerCard[]; formation?: string | null; side: Side }) {
  const padded = [...players];
  while (padded.length < 11) padded.push({ name: 'غير متوفر' });
  let cursor = 0;
  const lines = formationRows(formation).map((count) => {
    const line = padded.slice(cursor, cursor + count);
    cursor += count;
    return line;
  });
  return <div className="relative h-[330px] overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] p-3"><div className="absolute inset-3 rounded-xl border border-white/15" /><div className="absolute left-1/2 top-3 h-[calc(100%-24px)] w-px bg-white/10" /><div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" /><div className="relative z-10 flex h-full flex-col-reverse justify-between">{lines.map((line, index) => <div key={index} className="flex items-start justify-around gap-1">{line.map((player, playerIndex) => <PlayerDot key={`${player.name}-${playerIndex}`} player={player} side={side} />)}</div>)}</div></div>;
}

function FlagBadge({ team, side }: { team: any; side: Side }) {
  const url = getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 160);
  const border = side === 'home' ? 'border-[#0FF0FC]/50 shadow-[0_0_40px_rgba(15,240,252,.28)]' : 'border-[#ff4055]/50 shadow-[0_0_40px_rgba(255,64,85,.24)]';
  return <div className={`flex h-20 w-24 items-center justify-center overflow-hidden rounded-[1.35rem] border bg-black/45 ${border} sm:h-24 sm:w-28`}>{url ? <img src={url} alt={`علم ${teamName(team, 'منتخب')}`} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-sm font-black text-[#FFD700]">{team?.code || '---'}</span>}</div>;
}

function StatRow({ label, value, suffix = '' }: { label: string; value: Pair; suffix?: string }) {
  const width = share(value);
  return <div className="grid grid-cols-[52px_1fr_100px_1fr_52px] items-center gap-2 border-b border-white/10 py-2.5 last:border-b-0 sm:grid-cols-[70px_1fr_190px_1fr_70px] sm:gap-4"><b className="text-center text-lg text-white tabular-nums sm:text-2xl">{fmt(value?.home, suffix)}</b><div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="ml-auto h-full rounded-full bg-gradient-to-l from-[#0FF0FC] to-[#69d7ff]" style={{ width: `${width.home}%` }} /></div><div className="min-h-10 rounded-xl border border-white/10 bg-black/60 px-2 py-2 text-center text-[11px] font-black text-white sm:text-sm">{label}</div><div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#FFD700] to-[#ffea83]" style={{ width: `${width.away}%` }} /></div><b className="text-center text-lg text-white tabular-nums sm:text-2xl">{fmt(value?.away, suffix)}</b></div>;
}

function AdvancedCard({ label, description, value, decimal = false }: { label: string; description: string; value: Pair; decimal?: boolean }) {
  return <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/[.055] p-4 text-center"><p className="text-lg font-black text-white">{description}</p><p className="mt-1 text-xs font-black text-[#FFD700]">{label}</p><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><b className="text-3xl text-[#69d7ff]">{decimal ? dec(value?.home) : fmt(value?.home)}</b><span className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs font-black text-white">{label}</span><b className="text-3xl text-[#FFD700]">{decimal ? dec(value?.away) : fmt(value?.away)}</b></div></div>;
}

function LineupPanel({ team, lineup, squad, side }: { team: any; lineup: Record<string, any>; squad: any[]; side: Side }) {
  const formation = String(lineup.formation || lineup.shape || '') || null;
  const players = lineupPlayers(lineup, squad);
  const substitutes = usedSubs(lineup, squad);
  const tone = side === 'home' ? 'border-[#0FF0FC]/20 bg-[#0FF0FC]/[.04] text-[#69d7ff]' : 'border-[#ff4d5e]/20 bg-[#ff4d5e]/[.04] text-[#ff858f]';
  return <div className={`rounded-2xl border p-3 ${tone}`}><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-white">{teamName(team, 'الفريق')}</h3><p className="text-xs font-bold text-gray-400">١١ لاعبًا أساسيًا</p></div><b className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-2xl">{formation || '—'}</b></div><Pitch players={players} formation={formation} side={side} /><div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-black text-white">البدلاء المشاركون</p><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black">{fmt(substitutes.length)}</span></div>{substitutes.length ? <div className="flex flex-wrap gap-2">{substitutes.map((player) => <PlayerDot key={player.name} player={player} side={side} />)}</div> : <p className="text-xs font-bold text-gray-500">غير متوفر من بيانات التبديلات الرسمية.</p>}</div></div>;
}

function EventPanel({ events }: { events: any[] }) {
  return <section className="rounded-[1.45rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black text-[#69d7ff]">أحداث المباراة</h2><b className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-gray-400">{fmt(events.length)} حدث</b></div>{events.length ? <div className="relative space-y-3 before:absolute before:right-[21px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[#0FF0FC]/35">{events.map((event) => <div key={event.id} className="relative pr-12"><div className="absolute right-0 top-1 flex h-11 w-11 items-center justify-center rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-xs font-black text-[#69d7ff]">{event.minute !== null && event.minute !== undefined ? `${fmt(event.minute)}د` : '—'}</div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-sm font-black text-white">{event.detail || event.type || 'حدث'}</p>{event.playerName ? <p className="mt-1 text-xs font-bold text-[#FFD700]">{event.playerName}</p> : null}</div></div>)}</div> : <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-center text-sm font-bold text-gray-400">لا توجد أحداث محفوظة.</div>}</section>;
}

async function getMatch(id: string) {
  const match = await prisma.match.findUnique({ where: { id }, include: { homeTeam: true, awayTeam: true, events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] }, statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 10 } } });
  if (!match) return null;
  const players = await prisma.asset.findMany({ where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } }, select: { id: true, name: true, code: true, image: true, teamId: true }, take: 80 });
  return { ...match, squadPlayers: players };
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();
  const baseSnapshot = latest(match, 'ISPORTS') || fallbackSnapshot(match);
  const theStats = latest(match, 'THE_STATS');
  const stats = rawStats(theStats);
  const lineup = rawLineup(theStats);
  const derived = rawDerived(theStats);
  const homeSquad = (match.squadPlayers || []).filter((player: any) => player.teamId === match.homeTeamId);
  const awaySquad = (match.squadPlayers || []).filter((player: any) => player.teamId === match.awayTeamId);
  const xg = statPair(stats, 'xg');
  const npxg = statPair(stats, 'npxg');
  const bigChances = statPair(stats, 'bigChances');
  const shotsOffTarget = derivedPair(derived.shotsOffTargetForLocalCompare || derived.shotsOffTargetWithBlocked) || pair(baseSnapshot, stats, 'shotsOffTarget', 'homeShotsOffTarget', 'awayShotsOffTarget');
  const rows = [
    ['الاستحواذ', pair(baseSnapshot, stats, 'possession', 'homePossession', 'awayPossession'), '%'],
    ['الهجمات', pair(baseSnapshot, stats, 'attacks', 'homeAttacks', 'awayAttacks'), ''],
    ['الهجمات الخطيرة', pair(baseSnapshot, stats, 'dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks'), ''],
    ['التسديدات', pair(baseSnapshot, stats, 'shots', 'homeShots', 'awayShots'), ''],
    ['على المرمى', pair(baseSnapshot, stats, 'shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget'), ''],
    ['تسديدات خارج المرمى', shotsOffTarget, ''],
    ['الركنيات', pair(baseSnapshot, stats, 'corners', 'homeCorners', 'awayCorners'), ''],
    ['بطاقات صفراء', pair(baseSnapshot, stats, 'yellowCards', 'homeYellowCards', 'awayYellowCards'), ''],
    ['بطاقات حمراء', pair(baseSnapshot, stats, 'redCards', 'homeRedCards', 'awayRedCards'), ''],
  ] as const;
  return <main className="min-h-screen bg-[#02060d] px-3 py-4 text-white sm:px-6" dir="rtl"><section className="mx-auto max-w-7xl space-y-5"><section className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#030912] px-4 py-6 text-center shadow-[0_0_70px_rgba(0,0,0,.55)] sm:px-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(15,240,252,.20),transparent_34%),radial-gradient(circle_at_82%_14%,rgba(255,48,69,.18),transparent_34%),linear-gradient(180deg,rgba(255,215,0,.08),transparent_36%)]" /><div className="relative"><h1 className="text-3xl font-black text-[#FFD700] sm:text-5xl">إحصائيات المباراة</h1><p className="mt-2 text-sm font-bold text-gray-300">عرض موحّد للأرقام والأحداث في مكان واحد</p></div><div className="relative mt-8 grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]" dir="ltr"><div className="flex items-center justify-center gap-4 lg:justify-start"><FlagBadge team={match.homeTeam} side="home" /><p className="text-2xl font-black text-white sm:text-4xl">{teamName(match.homeTeam, 'Home')}</p></div><div><div className="inline-flex items-center justify-center gap-5 rounded-[1.3rem] border border-white/10 bg-black/45 px-6 py-3"><span className="text-5xl font-black text-[#FFD700] sm:text-7xl">{fmt(match.homeScore)}</span><span className="text-4xl font-black text-white/80 sm:text-6xl">-</span><span className="text-5xl font-black text-white sm:text-7xl">{fmt(match.awayScore)}</span></div><div className="mx-auto mt-3 inline-flex min-h-9 items-center rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-5 text-sm font-black text-[#FFD700]">نهاية المباراة</div></div><div className="flex items-center justify-center gap-4 lg:justify-end"><p className="text-2xl font-black text-white sm:text-4xl">{teamName(match.awayTeam, 'Away')}</p><FlagBadge team={match.awayTeam} side="away" /></div></div></section><section className="rounded-[1.6rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><h2 className="text-left text-lg font-black text-[#69d7ff]">{teamName(match.homeTeam, 'Home')}</h2><div className="rounded-full border border-white/10 bg-black/35 px-4 py-1 text-[10px] font-black uppercase tracking-[.24em] text-gray-400">Stats Board</div><h2 className="text-right text-lg font-black text-[#ff6b7a]">{teamName(match.awayTeam, 'Away')}</h2></div><div className="rounded-[1.2rem] border border-white/10 bg-black/30 px-2 sm:px-4">{rows.map(([label, value, suffix]) => <StatRow key={label} label={label} value={value} suffix={suffix} />)}</div></section><div className="grid gap-5 xl:grid-cols-[.7fr_1.15fr_.7fr]"><section className="rounded-[1.45rem] border border-white/10 bg-white/[.035] p-4"><h2 className="mb-4 text-xl font-black text-[#69d7ff]">إحصائيات متقدمة</h2><div className="grid gap-3"><AdvancedCard label="xG" description="الأهداف المتوقعة" value={xg} decimal /><AdvancedCard label="npxG" description="الأهداف المتوقعة بدون ركلات جزاء" value={npxg} decimal /><AdvancedCard label="Big Chances" description="الفرص الكبيرة" value={bigChances} /></div></section><section className="rounded-[1.45rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black text-white">التشكيلات المؤكدة</h2></div><div className="grid gap-4 lg:grid-cols-2"><LineupPanel team={match.homeTeam} lineup={sideLineup(lineup, 'home')} squad={homeSquad} side="home" /><LineupPanel team={match.awayTeam} lineup={sideLineup(lineup, 'away')} squad={awaySquad} side="away" /></div></section><EventPanel events={match.events || []} /></div><section className="rounded-[1.6rem] border border-[#FFD700]/20 bg-[#030912] p-5"><div className="text-center"><p className="text-sm font-black text-[#69d7ff]">Match Intelligence</p><h2 className="mt-1 text-3xl font-black text-[#FFD700]">قراءة ذكية للمباراة</h2></div><div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/[.06] p-4"><div className="mb-3 text-2xl text-[#FFD700]">✓</div><h3 className="text-lg font-black text-white">بيانات موثقة</h3><p className="mt-2 text-xs font-bold leading-6 text-gray-300">الأرقام المعروضة تأتي من قاعدة البيانات فقط، وأي رقم غير متوفر يظهر بشرطة.</p></div><div className="rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/[.06] p-4"><div className="mb-3 text-2xl text-[#FFD700]">xG</div><h3 className="text-lg font-black text-white">جودة الفرص</h3><p className="mt-2 text-xs font-bold leading-6 text-gray-300">xG يعني الأهداف المتوقعة، و npxG يعني الأهداف المتوقعة بدون ركلات جزاء.</p></div></div></section></section></main>;
}
