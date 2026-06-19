import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import MatchAutoRefresh from './MatchAutoRefresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'إحصائيات المباراة | MC PRIME World Cup',
  description: 'صفحة رقمية موحدة لإحصائيات المباراة.',
};

type Pair = { home: number | null; away: number | null } | null;
type ScorePair = { home: number | null; away: number | null; source: string };

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const HALF_TIME = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const LIVE = ['IN_PLAY', 'LIVE', '1H', '2H', 'ET'];
const FINAL_MINUTE_FALLBACK = 120;

function n(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function fmt(value: unknown, suffix = '') {
  const number = n(value);
  return number === null ? '—' : `${number.toLocaleString('ar-EG')}${suffix}`;
}

function obj(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
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

function sourceName(snapshot: any) {
  const p = provider(snapshot);
  if (p.includes('THE_STATS') && p.includes('LIVE')) return 'TheStatsAPI Live';
  if (p.includes('THE_STATS')) return 'TheStatsAPI';
  if (p.includes('ISPORTS_FLASH')) return 'iSport Flash Stats';
  if (p.includes('ISPORT')) return 'iSport Animation';
  if (snapshot) return 'قاعدة البيانات';
  return 'غير متوفر';
}

function scoreFromSnapshot(snapshot: any): ScorePair | null {
  if (!snapshot) return null;
  const data = raw(snapshot);
  const counts = obj(data.counts);
  const meta = obj(data.meta);
  const home = n(snapshot.homeScore ?? data.homeScore ?? data.home_goals ?? meta.home_goals ?? counts.homeScore);
  const away = n(snapshot.awayScore ?? data.awayScore ?? data.away_goals ?? meta.away_goals ?? counts.awayScore);
  if (home === null && away === null) return null;
  return { home, away, source: sourceName(snapshot) };
}

function scoreForDisplay(match: any, snapshots: any[]): ScorePair {
  const matchHome = n(match.homeScore);
  const matchAway = n(match.awayScore);
  const matchScore: ScorePair = { home: matchHome, away: matchAway, source: 'قاعدة المباراة' };
  const matchTotal = Number(matchHome || 0) + Number(matchAway || 0);
  const snapshotScore = snapshots.map(scoreFromSnapshot).find(Boolean) as ScorePair | null;
  const snapshotTotal = Number(snapshotScore?.home || 0) + Number(snapshotScore?.away || 0);

  if (snapshotScore && snapshotTotal > matchTotal) return snapshotScore;
  if (matchHome !== null || matchAway !== null) return matchScore;
  return snapshotScore || { home: null, away: null, source: 'غير متوفر' };
}

function isFinalMinute(minute: number | null) {
  return minute !== null && minute >= FINAL_MINUTE_FALLBACK;
}

function statusFromProviderValue(value: unknown, minute: number | null) {
  const status = String(value ?? '').trim().toUpperCase();
  if (['-1', '4', 'FT', 'FINISHED', 'ENDED', 'COMPLETED'].includes(status)) return 'FINISHED';
  if (isFinalMinute(minute) && !['ET', 'AET', 'P', 'PEN', '5'].includes(status)) return 'FINISHED';
  if (['2', 'HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'].includes(status) || status.includes('HALF')) return 'HT';
  if (['1', '1H', 'FIRST_HALF', 'FIRST HALF'].includes(status) || status.includes('FIRST')) return '1H';
  if (['3', '2H', 'SECOND_HALF', 'SECOND HALF'].includes(status) || status.includes('SECOND')) return '2H';
  if (['5', 'P', 'PEN'].includes(status)) return 'PEN';
  if (['LIVE', 'IN_PLAY', 'ET'].includes(status)) return status;
  return isFinalMinute(minute) ? 'FINISHED' : null;
}

function snapshotMinute(snapshot: any) {
  const data = raw(snapshot);
  const meta = obj(data.meta);
  const flashMeta = obj(data.flashMeta);
  const p = provider(snapshot);
  const directMinute = n(snapshot?.minute ?? data.minute ?? data.elapsed ?? data.currentMinute ?? meta.elapsed_minutes ?? meta.minute);

  if (p.includes('ISPORTS_FLASH')) {
    const scheduleMinute = n(flashMeta.scheduleMinute);
    const recordsSample = Array.isArray(data.recordsSample) ? data.recordsSample : [];
    if (directMinute !== null && scheduleMinute !== null && directMinute === scheduleMinute && recordsSample.length === 0) return null;
  }

  return directMinute;
}

function statusFromSources(sources: any[]) {
  for (const snapshot of sources) {
    const data = raw(snapshot);
    const flashMeta = obj(data.flashMeta);
    const meta = obj(data.meta);
    const minute = snapshotMinute(snapshot);
    const status = statusFromProviderValue(data.status ?? data.providerStatus ?? data.matchState ?? flashMeta.matchState ?? meta.status ?? meta.matchState, minute);
    if (status) return status;
  }
  return null;
}

function share(value: Pair) {
  const home = Math.max(0, Number(value?.home ?? 0));
  const away = Math.max(0, Number(value?.away ?? 0));
  const total = home + away;
  if (!total) return { home: 0, away: 0 };
  const homeWidth = Math.max(4, Math.min(96, (home / total) * 100));
  return { home: homeWidth, away: 100 - homeWidth };
}

function latest(match: any, predicate: (p: string) => boolean) {
  return (match.statsSnapshots || []).find((snapshot: any) => predicate(provider(snapshot))) || null;
}

function metric(sources: any[], key: string, homeKey: string, awayKey: string): Pair {
  return firstPair(...sources.map((snapshot) => snapshotPair(snapshot, key, homeKey, awayKey)));
}

function minuteFrom(_match: any, sources: any[]) {
  for (const snapshot of sources) {
    const minute = snapshotMinute(snapshot);
    if (minute !== null) return minute;
  }
  return null;
}

function displayMinute(_match: any, _status: string, providerMinute: number | null) {
  // Do not estimate the match clock from kickoff time.
  // Real kickoff/halftime delays can make schedule-based clocks wrong.
  return providerMinute;
}

function inferHalfTime(_match: any, status: string, minute: number | null) {
  if (status === '2H' || FINISHED.includes(status) || HALF_TIME.includes(status)) return false;
  return minute !== null && minute >= 45 && minute <= 65;
}

function clockLabel(match: any, sources: any[]) {
  const dbStatus = String(match.status || '').toUpperCase();
  const rawMinute = minuteFrom(match, sources);
  if (FINISHED.includes(dbStatus)) return 'انتهت';

  const providerStatus = statusFromSources(sources);
  const status = providerStatus || dbStatus;
  const minute = displayMinute(match, status, rawMinute);

  if (isFinalMinute(minute)) return 'انتهت';
  if (FINISHED.includes(status)) return 'انتهت';
  if (HALF_TIME.includes(status)) return 'استراحة';
  if (inferHalfTime(match, status, minute)) return 'استراحة';
  if (LIVE.includes(status)) return minute === null ? 'مباشرة الآن' : `د${fmt(Math.floor(minute))}`;

  if (minute !== null) return `د${fmt(Math.floor(minute))}`;
  const snapshotScore = sources.map(scoreFromSnapshot).find(Boolean) as ScorePair | null;
  if (snapshotScore && (Number(snapshotScore.home || 0) + Number(snapshotScore.away || 0) > 0)) return 'مباشرة الآن';

  const startMs = new Date(match.matchDate || '').getTime();
  if (Number.isFinite(startMs) && Date.now() > startMs + 5 * 60000) return 'تأخر البدء';
  return 'لم تبدأ';
}

function eventMinute(event: any) {
  const detail = String(event?.detail || '');
  const stoppage = detail.match(/(?:د|minute|min)?\s*(45|90|105)\s*\+\s*(\d+)/i);
  if (stoppage) return `د${fmt(stoppage[1])}+${fmt(stoppage[2])}`;
  return event.minute !== null && event.minute !== undefined ? `د${fmt(event.minute)}` : '—';
}

function flagUrl(team: any) {
  return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 160);
}

function StatRow({ label, value, suffix = '' }: { label: string; value: Pair; suffix?: string }) {
  const width = share(value);
  return <div className="grid grid-cols-[52px_1fr_120px_1fr_52px] items-center gap-2 border-b border-white/10 py-2.5 last:border-b-0 sm:grid-cols-[76px_1fr_210px_1fr_76px] sm:gap-4"><b className="text-center text-lg text-white tabular-nums sm:text-2xl">{fmt(value?.home, suffix)}</b><div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="ml-auto h-full rounded-full bg-gradient-to-l from-[#0FF0FC] to-[#69d7ff]" style={{ width: `${width.home}%` }} /></div><div className="min-h-10 rounded-xl border border-white/10 bg-black/60 px-2 py-2 text-center text-[11px] font-black text-white sm:text-sm">{label}</div><div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#FFD700] to-[#ffea83]" style={{ width: `${width.away}%` }} /></div><b className="text-center text-lg text-white tabular-nums sm:text-2xl">{fmt(value?.away, suffix)}</b></div>;
}

function TeamBlock({ team, side }: { team: any; side: 'home' | 'away' }) {
  const url = flagUrl(team);
  const border = side === 'home' ? 'border-[#0FF0FC]/50 shadow-[0_0_40px_rgba(15,240,252,.22)]' : 'border-[#ff4055]/50 shadow-[0_0_40px_rgba(255,64,85,.20)]';
  return <div className="flex items-center justify-center gap-4"><div className={`flex h-20 w-24 items-center justify-center overflow-hidden rounded-[1.35rem] border bg-black/45 ${border} sm:h-24 sm:w-28`}>{url ? <img src={url} alt={`علم ${team?.name || 'منتخب'}`} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-sm font-black text-[#FFD700]">{team?.code || '---'}</span>}</div><p className="text-2xl font-black text-white sm:text-4xl">{team?.name || team?.code || 'Team'}</p></div>;
}

function EventsPanel({ events }: { events: any[] }) {
  return <section className="rounded-[1.45rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black text-[#69d7ff]">أحداث المباراة</h2><b className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-gray-400">{fmt(events.length)} حدث</b></div>{events.length ? <div className="relative space-y-3 before:absolute before:right-[21px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[#0FF0FC]/35">{events.map((event) => <div key={event.id} className="relative pr-12"><div className="absolute right-0 top-1 flex h-11 w-11 items-center justify-center rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-xs font-black text-[#69d7ff]">{eventMinute(event)}</div><div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="flex flex-wrap items-center gap-2"><b className="rounded-full bg-[#FFD700]/15 px-2 py-1 text-xs text-[#FFD700]">{event.type}</b>{event.playerName ? <span className="text-sm font-bold text-white">{event.playerName}</span> : null}</div><p className="mt-1 text-sm leading-7 text-gray-200">{event.detail || 'حدث مباراة'}</p><small className="text-[10px] uppercase tracking-wider text-gray-500">{event.sourceName || 'manual'}</small></div></div>)}</div> : <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-center text-sm text-gray-400">لا توجد أحداث مسجلة بعد.</p>}</section>;
}

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  noStore();
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 25 },
    },
  });

  if (!match) notFound();

  const snapshots = match.statsSnapshots || [];
  const theStatsLive = latest(match, (p) => p.includes('THE_STATS') && p.includes('LIVE'));
  const theStats = latest(match, (p) => p.includes('THE_STATS'));
  const iSportsFlash = latest(match, (p) => p.includes('ISPORTS_FLASH'));
  const iSportsLive = latest(match, (p) => p.includes('ISPORTS_REMOTE_LIVE'));
  const iSportsTimeline = latest(match, (p) => p.includes('ISPORTS_TIMELINE'));
  const dbFallback = snapshots[0] || null;
  const sources = [theStatsLive, theStats, iSportsFlash, iSportsLive, iSportsTimeline, dbFallback].filter(Boolean);
  const primary = sources[0] || null;
  const displayScore = scoreForDisplay(match, sources);

  const rows = [
    ['الاستحواذ', metric(sources, 'possession', 'homePossession', 'awayPossession'), '%'],
    ['الهجمات', metric(sources, 'attacks', 'homeAttacks', 'awayAttacks'), ''],
    ['الهجمات الخطيرة', metric(sources, 'dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks'), ''],
    ['التسديدات', metric(sources, 'shots', 'homeShots', 'awayShots'), ''],
    ['على المرمى', metric(sources, 'shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget'), ''],
    ['تسديدات خارج المرمى', metric(sources, 'shotsOffTarget', 'homeShotsOffTarget', 'awayShotsOffTarget'), ''],
    ['الركنيات', metric(sources, 'corners', 'homeCorners', 'awayCorners'), ''],
    ['بطاقات صفراء', metric(sources, 'yellowCards', 'homeYellowCards', 'awayYellowCards'), ''],
    ['بطاقات حمراء', metric(sources, 'redCards', 'homeRedCards', 'awayRedCards'), ''],
    ['الأخطاء', metric(sources, 'fouls', 'homeFouls', 'awayFouls'), ''],
    ['التسللات', metric(sources, 'offsides', 'homeOffsides', 'awayOffsides'), ''],
    ['الأهداف المتوقعة xG', metric(sources, 'xg', 'homeXg', 'awayXg'), ''],
    ['الأهداف المتوقعة بدون ركلات جزاء npxG', metric(sources, 'npxg', 'homeNpxg', 'awayNpxg'), ''],
    ['الفرص الكبيرة Big Chances', metric(sources, 'bigChances', 'homeBigChances', 'awayBigChances'), ''],
  ] as const;

  return (
    <main className="min-h-screen bg-[#02060d] px-3 py-4 text-white sm:px-6" dir="rtl">
      <MatchAutoRefresh intervalMs={25000} />
      <section className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#030912] px-4 py-6 text-center shadow-[0_0_70px_rgba(0,0,0,.55)] sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(15,240,252,.20),transparent_34%),radial-gradient(circle_at_82%_14%,rgba(255,48,69,.18),transparent_34%),linear-gradient(180deg,rgba(255,215,0,.08),transparent_36%)]" />
          <div className="relative">
            <h1 className="text-3xl font-black text-[#FFD700] sm:text-5xl">إحصائيات المباراة</h1>
            <p className="mt-2 text-sm font-bold text-gray-300">عرض موحّد للأرقام والأحداث في مكان واحد</p>
          </div>
          <div className="relative mt-8 grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]" dir="ltr">
            <TeamBlock team={match.homeTeam} side="home" />
            <div>
              <div className="inline-flex items-center justify-center gap-5 rounded-[1.3rem] border border-white/10 bg-black/45 px-6 py-3">
                <span className="text-5xl font-black text-[#FFD700] sm:text-7xl">{fmt(displayScore.home)}</span>
                <span className="text-4xl font-black text-white/80 sm:text-6xl">-</span>
                <span className="text-5xl font-black text-white sm:text-7xl">{fmt(displayScore.away)}</span>
              </div>
              <div className="mx-auto mt-3 inline-flex min-h-9 items-center rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-5 text-sm font-black text-[#FFD700]">{clockLabel(match, sources)}</div>
            </div>
            <TeamBlock team={match.awayTeam} side="away" />
          </div>
          <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs font-bold leading-6 text-gray-300">
            <b className="text-[#FFD700]">ترتيب مصادر العرض:</b> النتيجة من صف المباراة المحدث عبر TheStats/iSport، ثم أحدث Snapshot عند الحاجة. الأرقام: TheStatsAPI Live ثم TheStatsAPI ثم iSport Flash/Animation ثم آخر Snapshot. <span className="text-[#69d7ff]">المصدر الأساسي الحالي: {sourceName(primary)}</span>{displayScore.source ? <span> — مصدر النتيجة: {displayScore.source}</span> : null}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/10 bg-white/[.035] p-4" dir="ltr">
          <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <h2 className="text-left text-lg font-black text-[#69d7ff]">{match.homeTeam?.name}</h2>
            <div className="rounded-full border border-white/10 bg-black/35 px-4 py-1 text-[10px] font-black uppercase tracking-[.24em] text-gray-400">Stats Board</div>
            <h2 className="text-right text-lg font-black text-[#ff6b7a]">{match.awayTeam?.name}</h2>
          </div>
          <div className="rounded-[1.2rem] border border-white/10 bg-black/30 px-2 sm:px-4">
            {rows.map(([label, value, suffix]) => <StatRow key={label} label={label} value={value} suffix={suffix} />)}
          </div>
        </section>

        <EventsPanel events={match.events || []} />
      </section>
    </main>
  );
}
