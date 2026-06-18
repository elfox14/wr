import type { ReactNode } from 'react';
import { Activity, BarChart3, ShieldCheck, Sparkles, Target, Users, Zap } from 'lucide-react';
import { getTeamFlag, getTeamFlagUrl } from '@/lib/teamFlags';
import type { DataQuality, MatchEvent, MomentumSegment, PressureModel, Team } from '@/app/animation-live/player/types';
import { ar } from '@/app/animation-live/player/formatters';
import { eventIcon, eventLabel } from '@/app/animation-live/player/eventUtils';
import { calculatePressureModel, windowLabel } from '@/app/animation-live/player/livePressureUtils';
import { dataQuality, matchAnalysisArticle, matchStoryLines } from '@/app/animation-live/player/matchAnalysisUtils';
import { calculateMomentumSegments, strongestMomentumSegment } from '@/app/animation-live/player/momentumUtils';
import { sideName } from '@/app/animation-live/player/pressureUtils';

type Pair = { home: number | null; away: number | null } | null;

const finished = ['FINISHED', 'FT', 'AET', 'PEN'];
const live = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET'];

function obj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function n(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value: unknown, suffix = '') {
  const parsed = n(value);
  return parsed === null ? '—' : `${parsed.toLocaleString('ar-EG')}${suffix}`;
}

function dec(value: unknown) {
  const parsed = n(value);
  return parsed === null ? '—' : parsed.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function name(team: any, fallback: string) {
  return team?.name || team?.code || fallback;
}

function statusText(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (finished.includes(value)) return 'نهاية المباراة';
  if (live.includes(value)) return value === 'HT' ? 'استراحة' : 'مباشرة الآن';
  return 'قبل المباراة';
}

function latest(match: any, key: string) {
  const snapshots = Array.isArray(match?.statsSnapshots) ? match.statsSnapshots : [];
  return snapshots.find((s: any) => String(s?.provider || '').toUpperCase().includes(key));
}

function fallbackSnapshot(match: any) {
  const snapshots = Array.isArray(match?.statsSnapshots) ? match.statsSnapshots : [];
  return snapshots.find((s: any) => !String(s?.provider || '').toUpperCase().includes('THE_STATS')) || snapshots[0] || null;
}

function enrichment(snapshot: any) {
  const raw = obj(snapshot?.rawData);
  const nested = obj(raw.theStatsApi);
  return {
    stats: obj(raw.stats || raw.providerStats || nested.stats || nested.providerStats),
    derived: obj(raw.derived || nested.derived),
    lineup: obj(raw.lineup || raw.lineups || nested.lineup || nested.lineups),
  };
}

function fromSnapshot(snapshot: any, homeKey: string, awayKey: string): Pair {
  if (!snapshot) return null;
  const home = n(snapshot[homeKey]);
  const away = n(snapshot[awayKey]);
  return home === null && away === null ? null : { home, away };
}

function fromStats(stats: Record<string, any>, key: string): Pair {
  const stat = obj(stats[key]);
  const home = n(stat.home);
  const away = n(stat.away);
  return home === null && away === null ? null : { home, away };
}

function fromDerived(value: unknown): Pair {
  const data = obj(value);
  const home = n(data.home);
  const away = n(data.away);
  return home === null && away === null ? null : { home, away };
}

function share(pair: Pair) {
  const home = Math.max(0, Number(pair?.home ?? 0));
  const away = Math.max(0, Number(pair?.away ?? 0));
  const total = home + away;
  if (!total) return { home: 0, away: 0 };
  const homeShare = Math.max(3, Math.min(97, (home / total) * 100));
  return { home: homeShare, away: 100 - homeShare };
}

function pairHome(pair: Pair) {
  return pair?.home ?? null;
}

function pairAway(pair: Pair) {
  return pair?.away ?? null;
}

function normalizeEvents(events: unknown): MatchEvent[] {
  if (!Array.isArray(events)) return [];
  return events.map((event, index) => {
    const data = obj(event);
    const minute = n(data.minute);
    return {
      id: String(data.id ?? `${minute ?? 'x'}-${data.type ?? 'event'}-${index}`),
      minute,
      type: String(data.type || data.detail || 'event'),
      detail: String(data.detail || data.description || ''),
      playerName: data.playerName ? String(data.playerName) : null,
      sourceName: data.sourceName ? String(data.sourceName) : null,
      createdAt: data.createdAt ? String(data.createdAt) : null,
    };
  });
}

function buildIntelligenceSnapshot(match: any, pairs: {
  possession: Pair;
  attacks: Pair;
  danger: Pair;
  shots: Pair;
  onTarget: Pair;
  offTarget: Pair;
  corners: Pair;
  yellow: Pair;
  red: Pair;
}) {
  return {
    homeScore: match?.homeScore,
    awayScore: match?.awayScore,
    homePossession: pairHome(pairs.possession),
    awayPossession: pairAway(pairs.possession),
    homeAttacks: pairHome(pairs.attacks),
    awayAttacks: pairAway(pairs.attacks),
    homeDangerousAttacks: pairHome(pairs.danger),
    awayDangerousAttacks: pairAway(pairs.danger),
    homeShots: pairHome(pairs.shots),
    awayShots: pairAway(pairs.shots),
    homeShotsOnTarget: pairHome(pairs.onTarget),
    awayShotsOnTarget: pairAway(pairs.onTarget),
    homeShotsOffTarget: pairHome(pairs.offTarget),
    awayShotsOffTarget: pairAway(pairs.offTarget),
    homeCorners: pairHome(pairs.corners),
    awayCorners: pairAway(pairs.corners),
    homeYellowCards: pairHome(pairs.yellow),
    awayYellowCards: pairAway(pairs.yellow),
    homeRedCards: pairHome(pairs.red),
    awayRedCards: pairAway(pairs.red),
  };
}

function matchCurrentMinute(snapshot: Record<string, unknown>, events: MatchEvent[]) {
  const directMinute = n(snapshot.minute) ?? n(snapshot.elapsed);
  if (directMinute !== null) return directMinute;
  const eventMinutes = events.map((event) => event.minute).filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return eventMinutes.length ? Math.max(...eventMinutes) : null;
}

function latestStatsUpdatedAt(...values: unknown[]) {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return typeof value === 'string' ? value : undefined;
}

function flag(team: any, side: 'home' | 'away') {
  const url = getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 160);
  const emoji = getTeamFlag({ code: team?.code, name: team?.name, image: team?.image });
  const tone = side === 'home' ? 'border-[#0FF0FC]/45 shadow-[0_0_34px_rgba(15,240,252,.25)]' : 'border-[#ff4d5e]/45 shadow-[0_0_34px_rgba(255,77,94,.22)]';
  return <div className={`flex h-20 w-24 items-center justify-center overflow-hidden rounded-[1.35rem] border bg-black/40 ${tone} sm:h-24 sm:w-28`}>{url ? <img src={url} alt="flag" className="h-full w-full object-cover" loading="lazy" /> : <span className="text-3xl">{emoji || team?.code || '🏳️'}</span>}</div>;
}

function ScoreHero({ match }: { match: any }) {
  const homeName = name(match.homeTeam, 'Home');
  const awayName = name(match.awayTeam, 'Away');
  const status = String(match.status || '').toUpperCase();
  const showScore = finished.includes(status) || live.includes(status);
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#030912] px-4 py-6 text-center shadow-[0_0_70px_rgba(0,0,0,.55)] sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(15,240,252,.20),transparent_34%),radial-gradient(circle_at_82%_14%,rgba(255,48,69,.18),transparent_34%),linear-gradient(180deg,rgba(255,215,0,.08),transparent_36%)]" />
      <div className="relative"><p className="text-xs font-black uppercase tracking-[.32em] text-[#FFD700]">Match Intelligence</p><h1 className="mt-2 text-3xl font-black text-[#FFD700] sm:text-5xl">إحصائيات المباراة</h1><p className="mt-2 text-sm font-bold text-gray-300">عرض موحّد للأرقام والأحداث في مكان واحد</p></div>
      <div className="relative mt-8 grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]" dir="ltr">
        <div className="flex items-center justify-center gap-4 lg:justify-start">{flag(match.homeTeam, 'home')}<div><p className="text-2xl font-black text-white sm:text-4xl">{homeName}</p><p className="mt-1 text-xs font-black text-[#0FF0FC]">{match.homeTeam?.code || 'HOME'}</p></div></div>
        <div><div className="inline-flex items-center justify-center gap-5 rounded-[1.3rem] border border-white/10 bg-black/45 px-5 py-3"><span className="text-5xl font-black text-[#FFD700] sm:text-7xl">{showScore ? fmt(match.homeScore) : 'VS'}</span>{showScore && <span className="text-4xl font-black text-white/80 sm:text-6xl">-</span>}{showScore && <span className="text-5xl font-black text-white sm:text-7xl">{fmt(match.awayScore)}</span>}</div><div className="mx-auto mt-3 inline-flex min-h-9 items-center rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-5 text-sm font-black text-[#FFD700]">{statusText(match.status)}</div><p className="mt-2 text-xs font-bold text-gray-500">{match.matchDate ? new Date(match.matchDate).toLocaleString('ar-EG') : 'غير متوفر'}</p></div>
        <div className="flex items-center justify-center gap-4 lg:justify-end"><div><p className="text-2xl font-black text-white sm:text-4xl">{awayName}</p><p className="mt-1 text-xs font-black text-[#ff6b7a]">{match.awayTeam?.code || 'AWAY'}</p></div>{flag(match.awayTeam, 'away')}</div>
      </div>
    </section>
  );
}

function Row({ label, pair, suffix = '', decimals = false, icon }: { label: string; pair: Pair; suffix?: string; decimals?: boolean; icon: string }) {
  const width = share(pair);
  const home = decimals ? dec(pair?.home) : fmt(pair?.home, suffix);
  const away = decimals ? dec(pair?.away) : fmt(pair?.away, suffix);
  return <div className="grid grid-cols-[52px_1fr_80px_1fr_52px] items-center gap-2 border-b border-white/10 py-2.5 last:border-b-0 sm:grid-cols-[70px_1fr_180px_1fr_70px] sm:gap-4"><b className="text-center text-lg text-white tabular-nums sm:text-2xl">{home}</b><div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="ml-auto h-full rounded-full bg-gradient-to-l from-[#0FF0FC] to-[#69d7ff]" style={{ width: `${width.home}%` }} /></div><div className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/55 px-2 text-[11px] font-black text-white sm:text-sm"><span className="text-[#FFD700]">{icon}</span>{label}</div><div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#FFD700] to-[#ffea83]" style={{ width: `${width.away}%` }} /></div><b className="text-center text-lg text-white tabular-nums sm:text-2xl">{away}</b></div>;
}

function Advanced({ xg, npxg, big }: { xg: Pair; npxg: Pair; big: Pair }) {
  const cards = [{ label: 'xG', pair: xg, dec: true }, { label: 'npxG', pair: npxg, dec: true }, { label: 'فرص كبيرة', pair: big, dec: false }];
  if (!cards.some((c) => c.pair)) return <section className="rounded-[1.45rem] border border-white/10 bg-white/[.035] p-5 text-center text-sm font-bold text-gray-400">الإحصائيات المتقدمة غير متوفرة في snapshot الحالية.</section>;
  return <section className="grid gap-3">{cards.map((card) => <div key={card.label} className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/[.055] p-4 text-center"><p className="font-black text-white">{card.label}</p><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><b className="text-3xl text-[#FFD700]">{card.dec ? dec(card.pair?.home) : fmt(card.pair?.home)}</b><span className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs font-black text-white">{card.label}</span><b className="text-3xl text-[#FFD700]">{card.dec ? dec(card.pair?.away) : fmt(card.pair?.away)}</b></div></div>)}</section>;
}

function pitchRows(formation?: string | null) {
  const rows = String(formation || '').split(/[-–—]/).map((part) => Number(part.trim())).filter((v) => Number.isFinite(v) && v > 0 && v <= 6);
  return rows.length ? [1, ...rows] : [1, 4, 3, 3];
}

function MiniPitch({ formation, tone }: { formation?: string | null; tone: 'cyan' | 'red' }) {
  const dot = tone === 'cyan' ? 'bg-[#69d7ff]' : 'bg-[#ff6565]';
  return <div className="relative h-44 overflow-hidden rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="absolute inset-3 rounded-xl border border-white/15" /><div className="absolute left-1/2 top-3 h-[calc(100%-24px)] w-px bg-white/10" /><div className="relative z-10 flex h-full flex-col-reverse justify-between">{pitchRows(formation).map((count, i) => <div key={`${i}-${count}`} className="flex justify-around">{Array.from({ length: count }).map((_, x) => <span key={x} className={`h-3 w-3 rounded-full border border-white/50 ${dot}`} />)}</div>)}</div></div>;
}

function Lineups({ home, away, homeName, awayName }: { home: Record<string, any>; away: Record<string, any>; homeName: string; awayName: string }) {
  const hf = home.formation || home.shape;
  const af = away.formation || away.shape;
  const has = hf || af || home.startingXiCount || away.startingXiCount;
  return <section className="rounded-[1.45rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-[#0FF0FC]">Lineups</p><h3 className="text-xl font-black text-white">التشكيلات المؤكدة</h3></div><Users className="text-[#FFD700]" /></div>{has ? <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/[.04] p-3"><div className="mb-3 flex justify-between"><div><b className="text-white">{home.name || homeName}</b><p className="text-xs text-gray-400">{fmt(home.startingXiCount)} أساسي · {fmt(home.substitutesCount)} بديل</p></div><b className="text-xl text-[#69d7ff]">{hf || '—'}</b></div><MiniPitch formation={hf} tone="cyan" /></div><div className="rounded-2xl border border-[#ff4d5e]/20 bg-[#ff4d5e]/[.04] p-3"><div className="mb-3 flex justify-between"><div><b className="text-white">{away.name || awayName}</b><p className="text-xs text-gray-400">{fmt(away.startingXiCount)} أساسي · {fmt(away.substitutesCount)} بديل</p></div><b className="text-xl text-[#ff858f]">{af || '—'}</b></div><MiniPitch formation={af} tone="red" /></div></div> : <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-center text-sm font-bold text-gray-400">التشكيلات غير متوفرة.</div>}</section>;
}

function Events({ events }: { events: any[] }) {
  return <section className="rounded-[1.45rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-[#FFD700]">Timeline</p><h3 className="text-xl font-black text-white">أحداث المباراة</h3></div><b className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-gray-400">{fmt(events.length)} حدث</b></div>{events.length ? <div className="relative space-y-3 before:absolute before:right-[21px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[#0FF0FC]/35">{events.map((e) => <div key={e.id} className="relative pr-12"><div className="absolute right-0 top-1 flex h-11 w-11 items-center justify-center rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-xs font-black text-[#69d7ff]">{e.minute !== null && e.minute !== undefined ? `${fmt(e.minute)}’` : '—'}</div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><b className="text-sm text-white">{String(e.type || '').toLowerCase().includes('goal') ? '⚽ هدف' : e.detail || 'حدث'}</b><p className="mt-1 text-xs font-bold leading-6 text-gray-400">{e.detail}</p>{e.playerName && <p className="mt-1 text-xs font-bold text-[#FFD700]">{e.playerName}</p>}</div></div>)}</div> : <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-center text-sm font-bold text-gray-400">لا توجد أحداث محفوظة.</div>}</section>;
}

function StoryCards({ lines }: { lines: string[] }) {
  return <div className="mb-3 grid gap-3 md:grid-cols-3">{lines.map((line, index) => <div key={`${index}-${line.slice(0, 18)}`} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm font-bold leading-7 text-gray-200"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.24em] text-[#FFD700]">Insight {ar(index + 1)}</span>{line}</div>)}</div>;
}

function QualityCard({ quality }: { quality: DataQuality }) {
  return <div className="mb-3 rounded-3xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-[#0FF0FC]">Data Quality</p><h3 className="text-lg font-black text-white">جودة القراءة الذكية</h3></div><b className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1 text-xs text-[#FFD700]">{quality.label} · {ar(quality.score)}%</b></div><p className="text-sm font-bold leading-7 text-gray-300">{quality.hint}</p><div className="mt-3 grid gap-2 text-xs font-bold text-gray-400 sm:grid-cols-3"><div>إحصائيات متاحة: <span className="text-white">{ar(quality.availableStats)} / {ar(quality.totalStats)}</span></div><div>أحداث محفوظة: <span className="text-white">{ar(quality.eventsCount)}</span></div><div>آخر تحديث: <span className="text-white">{quality.lastUpdated}</span></div></div></div>;
}

function IntelligenceTile({ label, value, hint, icon, accent = false }: { label: string; value: string; hint: string; icon: ReactNode; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? 'border-[#FFD700]/35 bg-[#FFD700]/10' : 'border-white/10 bg-black/25'}`}><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-[#FFD700]">{icon}</div><p className="text-xs font-black text-gray-400">{label}</p><b className="mt-1 block text-xl text-white">{value}</b><p className="mt-2 text-xs font-bold leading-5 text-gray-400">{hint}</p></div>;
}

function MatchIntelligenceArchive({ pressure, quality, storyLines, articleLines, home, away }: { pressure: PressureModel; quality: DataQuality; storyLines: string[]; articleLines: string[]; home: Team; away: Team }) {
  const leaderName = sideName(pressure.leader, home, away);
  const totalPressure = pressure.home + pressure.away;
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]"><Sparkles size={20} /></div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD700]">Match Intelligence</div>
            <h2 className="mt-1 text-xl font-black text-white">قراءة ذكية للمباراة</h2>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">ضغط إجمالي: <span className="text-white">{ar(totalPressure)}</span></div>
      </div>
      <div className="mb-3 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-3 text-sm font-bold leading-7 text-white">{pressure.readout}</div>
      <StoryCards lines={storyLines} />
      {articleLines.length ? <article className="mb-3 rounded-3xl border border-[#FFD700]/15 bg-black/25 p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black text-[#FFD700]">مقالة تحليلية مباشرة</h3><span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black text-gray-400">تتحدث مع كل حدث وإحصائية</span></div><div className="space-y-2 text-sm font-bold leading-7 text-gray-100">{articleLines.map((line, index) => <p key={`${index}-${line.slice(0, 18)}`}>{line}</p>)}</div></article> : null}
      <QualityCard quality={quality} />
      <div className="grid gap-3 md:grid-cols-3">
        <IntelligenceTile label="الأخطر الآن" value={leaderName} hint={`المؤشر: ${ar(pressure.home)} - ${ar(pressure.away)}`} icon={<Target size={20} />} accent={pressure.leader !== 'balanced' && pressure.leader !== 'unknown'} />
        <IntelligenceTile label="رتم آخر ١٥ دقيقة" value={pressure.rhythm} hint={`آخر ١٥ دقيقة: ${windowLabel(pressure.window15)}`} icon={<Activity size={20} />} />
        <IntelligenceTile label="الخطورة اللحظية" value={pressure.danger} hint={`آخر ٥ دقائق: ${windowLabel(pressure.window5)}`} icon={<Zap size={20} />} accent={pressure.danger === 'مرتفعة'} />
      </div>
    </section>
  );
}

function segmentTotal(segment: MomentumSegment) {
  return segment.home + segment.away;
}

function segmentLeaderText(segment: MomentumSegment, home: Team, away: Team) {
  if (!segment.available) return 'غير متوفر';
  return sideName(segment.leader, home, away);
}

function MomentumCardStatic({ segment, home, away }: { segment: MomentumSegment; home: Team; away: Team }) {
  const topMinute = segment.topEvent?.minute;
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black text-[#FFD700]">د {segment.label}</span><span className="text-[10px] font-black text-gray-500">{segment.rating}</span></div><div className="text-sm font-black text-white">الأكثر ضغطًا: <span className="text-[#FFD700]">{sideName(segment.leader, home, away)}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400"><div>أحداث ضغط: <span className="text-white">{segment.available ? `${ar(segment.homeEvents)} - ${ar(segment.awayEvents)}` : 'غير متوفر'}</span></div><div>هجمات خطيرة: <span className="text-white">{segment.available ? `${ar(segment.homeDangerEvents)} - ${ar(segment.awayDangerEvents)}` : 'غير متوفر'}</span></div></div><div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] leading-5 text-gray-300"><span className="font-black text-gray-500">أهم حدث: </span>{segment.topEvent ? <span className="font-bold text-[#0FF0FC]">{topMinute !== null && topMinute !== undefined ? `د${topMinute} - ` : ''}{eventIcon(segment.topEvent.type)} {eventLabel(segment.topEvent.type)}</span> : 'غير متوفر'}</div></div>;
}

function MatchMomentumArchive({ segments, strongestSegment, home, away }: { segments: MomentumSegment[]; strongestSegment: MomentumSegment | null; home: Team; away: Team }) {
  const maxTotal = Math.max(1, ...segments.map(segmentTotal));
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD700]">Match Momentum</div>
          <h2 className="mt-1 text-xl font-black text-white">منحنى الزخم حسب فترات المباراة</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">أقوى فترة: <span className="text-white">{strongestSegment ? `د ${strongestSegment.label}` : 'غير متوفر'}</span></div>
      </div>
      <div className="mb-3 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-3 text-sm font-bold leading-7 text-white">{strongestSegment ? `أقوى فترة كانت د ${strongestSegment.label} لصالح ${sideName(strongestSegment.leader, home, away)} بمؤشر ${ar(segmentTotal(strongestSegment))}.` : 'لا توجد أحداث كافية لاستخراج أقوى فترة في المباراة.'}</div>
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-black text-gray-400"><BarChart3 size={14} className="text-[#FFD700]" /> منحنى الزخم</div>
        <div className="grid grid-cols-6 items-end gap-2">
          {segments.map((segment) => {
            const total = segmentTotal(segment);
            const height = segment.available ? Math.max(14, Math.round((total / maxTotal) * 92)) : 10;
            const segmentLeader = segmentLeaderText(segment, home, away);
            return <div key={segment.key} className="flex min-h-[126px] flex-col items-center justify-end gap-2"><div className="text-[9px] font-black text-gray-500">{segmentLeader}</div><div className="flex h-24 w-full max-w-[34px] items-end overflow-hidden rounded-full bg-white/10"><div className={`w-full rounded-full ${segment.leader === 'home' ? 'bg-[#0FF0FC]' : segment.leader === 'away' ? 'bg-[#FFD700]' : 'bg-white/25'}`} style={{ height: `${height}%` }} /></div><div className="text-[10px] font-black text-white">{segment.label}</div></div>;
          })}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{segments.map((segment) => <MomentumCardStatic key={segment.key} segment={segment} home={home} away={away} />)}</div>
    </section>
  );
}

export default function DigitalMatchStatsPage({ match }: { match: any }) {
  const homeName = name(match.homeTeam, 'Home');
  const awayName = name(match.awayTeam, 'Away');
  const normal = latest(match, 'ISPORTS') || fallbackSnapshot(match);
  const theStats = latest(match, 'THE_STATS');
  const { stats, derived, lineup } = enrichment(theStats);
  const getPair = (statKey: string, homeKey: string, awayKey: string) => fromSnapshot(normal, homeKey, awayKey) || fromStats(stats, statKey);
  const dangerHome = 'home' + 'DangerousAttacks';
  const dangerAway = 'away' + 'DangerousAttacks';
  const xg = fromStats(stats, 'xg');
  const npxg = fromStats(stats, 'npxg');
  const big = fromStats(stats, 'bigChances');
  const possession = getPair('possession', 'homePossession', 'awayPossession');
  const attacks = getPair('attacks', 'homeAttacks', 'awayAttacks');
  const danger = getPair('dangerousAttacks', dangerHome, dangerAway);
  const shots = getPair('shots', 'homeShots', 'awayShots');
  const onTarget = getPair('shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget');
  const offTarget = fromSnapshot(normal, 'homeShotsOffTarget', 'awayShotsOffTarget') || fromDerived(derived.shotsOffTargetForLocalCompare || derived.shotsOffTargetWithBlocked);
  const corners = getPair('corners', 'homeCorners', 'awayCorners');
  const yellow = getPair('yellowCards', 'homeYellowCards', 'awayYellowCards');
  const red = getPair('redCards', 'homeRedCards', 'awayRedCards');
  const events = normalizeEvents(match.events);
  const intelligenceSnapshot = buildIntelligenceSnapshot(match, { possession, attacks, danger, shots, onTarget, offTarget, corners, yellow, red });
  const currentMinute = matchCurrentMinute(intelligenceSnapshot, events);
  const pressure = calculatePressureModel(intelligenceSnapshot, events, currentMinute, match.homeTeam, match.awayTeam);
  const momentumSegments = calculateMomentumSegments(events, match.homeTeam, match.awayTeam);
  const strongestSegment = strongestMomentumSegment(momentumSegments);
  const quality = dataQuality(intelligenceSnapshot, events, latestStatsUpdatedAt(normal?.updatedAt, normal?.createdAt, theStats?.updatedAt, theStats?.createdAt, match?.updatedAt));
  const storyLines = matchStoryLines(match, intelligenceSnapshot, strongestSegment);
  const articleLines = matchAnalysisArticle(match, intelligenceSnapshot, events, pressure, strongestSegment, currentMinute);
  const rows = [
    ['الاستحواذ', possession, '%', '◔'], ['الهجمات', attacks, '', '↗'], ['الهجمات الخطيرة', danger, '', '◎'], ['التسديدات', shots, '', '✦'], ['على المرمى', onTarget, '', '▣'], ['تسديدات خارج المرمى', offTarget, '', '◌'], ['الركنيات', corners, '', '⚑'], ['بطاقات صفراء', yellow, '', '🟨'], ['بطاقات حمراء', red, '', '🟥'],
  ] as const;
  return <div className="space-y-5"><ScoreHero match={match} /><section className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[.035] p-4"><div className="relative mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><h2 className="text-left text-lg font-black text-[#69d7ff]">{homeName}</h2><div className="rounded-full border border-white/10 bg-black/35 px-4 py-1 text-[10px] font-black uppercase tracking-[.24em] text-gray-400">Stats Board</div><h2 className="text-right text-lg font-black text-[#ff6b7a]">{awayName}</h2></div><div className="relative rounded-[1.2rem] border border-white/10 bg-black/30 px-2 sm:px-4">{rows.map(([label, pair, suffix, icon]) => <Row key={label} label={label} pair={pair} suffix={suffix} icon={icon} />)}</div></section><div className="grid gap-5 xl:grid-cols-[.72fr_.92fr_.72fr]"><Advanced xg={xg} npxg={npxg} big={big} /><Lineups home={obj(lineup.home)} away={obj(lineup.away)} homeName={homeName} awayName={awayName} /><Events events={Array.isArray(match.events) ? match.events : []} /></div><section className="rounded-[1.45rem] border border-[#FFD700]/20 bg-[#FFD700]/[.055] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 text-[#FFD700]" /><p className="text-xs font-bold leading-6 text-gray-400"><b className="text-white">جودة البيانات:</b> الأرقام المعروضة مأخوذة من snapshots محفوظة داخل قاعدة بيانات الموقع. أي رقم غير متوفر يظهر كشرطة ولا يتم استنتاجه.</p></div></section><MatchIntelligenceArchive pressure={pressure} quality={quality} storyLines={storyLines} articleLines={articleLines} home={match.homeTeam} away={match.awayTeam} /><MatchMomentumArchive segments={momentumSegments} strongestSegment={strongestSegment} home={match.homeTeam} away={match.awayTeam} /></div>;
}
