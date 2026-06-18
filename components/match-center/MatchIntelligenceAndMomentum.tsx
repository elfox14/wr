import { Activity, BarChart3, Sparkles, Target, Zap } from 'lucide-react';
import type { DataQuality, MatchEvent, MomentumSegment, PressureModel, Team } from '@/app/animation-live/player/types';
import { ar } from '@/app/animation-live/player/formatters';
import { eventIcon, eventLabel } from '@/app/animation-live/player/eventUtils';
import { calculatePressureModel, windowLabel } from '@/app/animation-live/player/livePressureUtils';
import { dataQuality, matchAnalysisArticle, matchStoryLines } from '@/app/animation-live/player/matchAnalysisUtils';
import { calculateMomentumSegments, strongestMomentumSegment } from '@/app/animation-live/player/momentumUtils';
import { sideName } from '@/app/animation-live/player/pressureUtils';

type Pair = { home: number | null; away: number | null } | null;

function obj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function n(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function provider(snapshot: any) {
  return String(snapshot?.provider || '').toUpperCase();
}

function raw(snapshot: any) {
  return obj(snapshot?.rawData);
}

function rawStats(snapshot: any) {
  const data = raw(snapshot);
  const nested = obj(data.theStatsApi);
  return obj(data.stats || data.providerStats || nested.stats || nested.providerStats);
}

function statPair(stats: Record<string, any>, key: string): Pair {
  const stat = obj(stats[key]);
  const all = obj(stat.all);
  const home = n(stat.home ?? all.home);
  const away = n(stat.away ?? all.away);
  return home === null && away === null ? null : { home, away };
}

function snapshotPair(snapshot: any, key: string, homeKey: string, awayKey: string): Pair {
  if (!snapshot) return null;
  const home = n(snapshot[homeKey]);
  const away = n(snapshot[awayKey]);
  if (home !== null || away !== null) return { home, away };
  return statPair(rawStats(snapshot), key);
}

function firstPair(...pairs: Pair[]): Pair {
  return pairs.find((pair) => pair && (pair.home !== null || pair.away !== null)) || null;
}

function latest(match: any, predicate: (providerName: string) => boolean) {
  return (match?.statsSnapshots || []).find((snapshot: any) => predicate(provider(snapshot))) || null;
}

function metric(sources: any[], key: string, homeKey: string, awayKey: string): Pair {
  return firstPair(...sources.map((snapshot) => snapshotPair(snapshot, key, homeKey, awayKey)));
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

function buildSnapshot(match: any, pairs: {
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

function currentMinute(snapshot: Record<string, unknown>, events: MatchEvent[], sources: any[]) {
  for (const source of sources) {
    const data = raw(source);
    const meta = obj(data.meta);
    const minute = n(source?.minute ?? data.minute ?? data.elapsed ?? data.currentMinute ?? meta.elapsed_minutes ?? meta.minute);
    if (minute !== null) return minute;
  }

  const eventMinutes = events.map((event) => event.minute).filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return eventMinutes.length ? Math.max(...eventMinutes) : null;
}

function latestUpdatedAt(...values: unknown[]) {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return typeof value === 'string' ? value : undefined;
}

function StoryCards({ lines }: { lines: string[] }) {
  return <div className="mb-3 grid gap-3 md:grid-cols-3">{lines.map((line, index) => <div key={`${index}-${line.slice(0, 18)}`} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm font-bold leading-7 text-gray-200"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.24em] text-[#FFD700]">Insight {ar(index + 1)}</span>{line}</div>)}</div>;
}

function QualityCard({ quality }: { quality: DataQuality }) {
  return <div className="mb-3 rounded-3xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-[#0FF0FC]">Data Quality</p><h3 className="text-lg font-black text-white">جودة القراءة الذكية</h3></div><b className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1 text-xs text-[#FFD700]">{quality.label} · {ar(quality.score)}%</b></div><p className="text-sm font-bold leading-7 text-gray-300">{quality.hint}</p><div className="mt-3 grid gap-2 text-xs font-bold text-gray-400 sm:grid-cols-3"><div>إحصائيات متاحة: <span className="text-white">{ar(quality.availableStats)} / {ar(quality.totalStats)}</span></div><div>أحداث محفوظة: <span className="text-white">{ar(quality.eventsCount)}</span></div><div>آخر تحديث: <span className="text-white">{quality.lastUpdated}</span></div></div></div>;
}

function IntelligenceTile({ label, value, hint, icon, accent = false }: { label: string; value: string; hint: string; icon: React.ReactNode; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? 'border-[#FFD700]/35 bg-[#FFD700]/10' : 'border-white/10 bg-black/25'}`}><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-[#FFD700]">{icon}</div><p className="text-xs font-black text-gray-400">{label}</p><b className="mt-1 block text-xl text-white">{value}</b><p className="mt-2 text-xs font-bold leading-5 text-gray-400">{hint}</p></div>;
}

function MatchIntelligencePanel({ pressure, quality, storyLines, articleLines, home, away }: { pressure: PressureModel; quality: DataQuality; storyLines: string[]; articleLines: string[]; home: Team; away: Team }) {
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

function MomentumCard({ segment, home, away }: { segment: MomentumSegment; home: Team; away: Team }) {
  const topMinute = segment.topEvent?.minute;
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black text-[#FFD700]">د {segment.label}</span><span className="text-[10px] font-black text-gray-500">{segment.rating}</span></div><div className="text-sm font-black text-white">الأكثر ضغطًا: <span className="text-[#FFD700]">{sideName(segment.leader, home, away)}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400"><div>أحداث ضغط: <span className="text-white">{segment.available ? `${ar(segment.homeEvents)} - ${ar(segment.awayEvents)}` : 'غير متوفر'}</span></div><div>هجمات خطيرة: <span className="text-white">{segment.available ? `${ar(segment.homeDangerEvents)} - ${ar(segment.awayDangerEvents)}` : 'غير متوفر'}</span></div></div><div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] leading-5 text-gray-300"><span className="font-black text-gray-500">أهم حدث: </span>{segment.topEvent ? <span className="font-bold text-[#0FF0FC]">{topMinute !== null && topMinute !== undefined ? `د${topMinute} - ` : ''}{eventIcon(segment.topEvent.type)} {eventLabel(segment.topEvent.type)}</span> : 'غير متوفر'}</div></div>;
}

function MatchMomentumPanel({ segments, strongestSegment, home, away }: { segments: MomentumSegment[]; strongestSegment: MomentumSegment | null; home: Team; away: Team }) {
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
            return <div key={segment.key} className="flex min-h-[126px] flex-col items-center justify-end gap-2"><div className="text-[9px] font-black text-gray-500">{segmentLeaderText(segment, home, away)}</div><div className="flex h-24 w-full max-w-[34px] items-end overflow-hidden rounded-full bg-white/10"><div className={`w-full rounded-full ${segment.leader === 'home' ? 'bg-[#0FF0FC]' : segment.leader === 'away' ? 'bg-[#FFD700]' : 'bg-white/25'}`} style={{ height: `${height}%` }} /></div><div className="text-[10px] font-black text-white">{segment.label}</div></div>;
          })}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{segments.map((segment) => <MomentumCard key={segment.key} segment={segment} home={home} away={away} />)}</div>
    </section>
  );
}

export default function MatchIntelligenceAndMomentum({ match }: { match: any }) {
  const theStatsLive = latest(match, (p) => p.includes('THE_STATS') && p.includes('LIVE'));
  const theStatsOfficial = latest(match, (p) => p.includes('THE_STATS') && !p.includes('LIVE'));
  const iSportFlash = latest(match, (p) => p.includes('ISPORTS_FLASH'));
  const iSport = latest(match, (p) => p.includes('ISPORT') && !p.includes('FLASH'));
  const dbFallback = match?.statsSnapshots?.[0] || null;
  const sources = [theStatsLive, theStatsOfficial, iSportFlash, iSport, dbFallback].filter(Boolean);
  const possession = metric(sources, 'possession', 'homePossession', 'awayPossession');
  const attacks = metric(sources, 'attacks', 'homeAttacks', 'awayAttacks');
  const danger = metric(sources, 'dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks');
  const shots = metric(sources, 'shots', 'homeShots', 'awayShots');
  const onTarget = metric(sources, 'shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget');
  const offTarget = metric(sources, 'shotsOffTarget', 'homeShotsOffTarget', 'awayShotsOffTarget');
  const corners = metric(sources, 'corners', 'homeCorners', 'awayCorners');
  const yellow = metric(sources, 'yellowCards', 'homeYellowCards', 'awayYellowCards');
  const red = metric(sources, 'redCards', 'homeRedCards', 'awayRedCards');
  const events = normalizeEvents(match?.events);
  const snapshot = buildSnapshot(match, { possession, attacks, danger, shots, onTarget, offTarget, corners, yellow, red });
  const minute = currentMinute(snapshot, events, sources);
  const pressure = calculatePressureModel(snapshot, events, minute, match?.homeTeam, match?.awayTeam);
  const segments = calculateMomentumSegments(events, match?.homeTeam, match?.awayTeam);
  const strongestSegment = strongestMomentumSegment(segments);
  const quality = dataQuality(snapshot, events, latestUpdatedAt(sources[0]?.capturedAt, sources[0]?.updatedAt, sources[0]?.createdAt, match?.updatedAt));
  const storyLines = matchStoryLines(match, snapshot, strongestSegment);
  const articleLines = matchAnalysisArticle(match, snapshot, events, pressure, strongestSegment, minute);

  return (
    <div className="space-y-5">
      <MatchIntelligencePanel pressure={pressure} quality={quality} storyLines={storyLines} articleLines={articleLines} home={match?.homeTeam} away={match?.awayTeam} />
      <MatchMomentumPanel segments={segments} strongestSegment={strongestSegment} home={match?.homeTeam} away={match?.awayTeam} />
    </div>
  );
}
