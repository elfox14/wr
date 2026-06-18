import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Activity, ArrowLeft, BarChart3, FileJson, Radio, ShieldCheck, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';
import GenerateMatchArticleButton from './GenerateMatchArticleButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'البث التفاعلي | MC PRIME World Cup',
  description: 'البث التفاعلي للمباراة: بطاقة المباراة، الملعب التفاعلي، الإحصائيات، والأحداث المهمة.',
};

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type MatchArticleSummary = { latest: { id: string; title: string; status?: string | null; updatedAt?: Date | string | null } | null; count: number; latestUpdatedAt?: Date | string | null };
type PairLike = { home?: number | null; away?: number | null; sourcePath?: string | null } | null;
type Insight = { title: string; value: string; body: string };

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function suppliedSecret(params: Record<string, string | string[] | undefined> | undefined) {
  return String(getParam(params, 'adminSecret') || getParam(params, 'key') || getParam(params, 'cronSecret') || '').trim();
}

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 8 },
    },
  });
}

async function getMatchArticleSummary(matchId: string): Promise<MatchArticleSummary> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT "id", "title", "status", "updatedAt" FROM "PressNews" WHERE "relatedMatchId" = $1 ORDER BY "updatedAt" DESC, "publishedAt" DESC LIMIT 1',
      matchId
    );
    const counts = await prisma.$queryRawUnsafe<any[]>(
      'SELECT COUNT(*)::int AS "count", MAX("updatedAt") AS "latestUpdatedAt" FROM "PressNews" WHERE "relatedMatchId" = $1',
      matchId
    );
    return { latest: rows[0] || null, count: Number(counts[0]?.count || 0), latestUpdatedAt: counts[0]?.latestUpdatedAt || rows[0]?.updatedAt || null };
  } catch (error) {
    return { latest: null, count: 0, latestUpdatedAt: null };
  }
}

function formatNumber(value?: number | null, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('ar-EG')}${suffix}`;
}

function formatDecimal(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('ar-EG', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function numberValue(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'غير متوفر';
  return new Date(value).toLocaleString('ar-EG');
}

function rawObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function getProviderEnrichment(snapshot: any) {
  const raw = rawObject(snapshot?.rawData);
  const nested = rawObject(raw.theStatsApi);
  const stats = rawObject(raw.stats || raw.providerStats || nested.stats || nested.providerStats);
  const derived = rawObject(raw.derived || nested.derived);
  const lineup = rawObject(raw.lineup || raw.lineups || nested.lineup || nested.lineups);
  return { stats, derived, lineup };
}

function pickLatestSnapshot(match: any, providerHint: string) {
  const snapshots = Array.isArray(match.statsSnapshots) ? match.statsSnapshots : [];
  return snapshots.find((snapshot: any) => String(snapshot.provider || '').toUpperCase().includes(providerHint));
}

function statPairFromSnapshot(snapshot: any, homeKey: string, awayKey: string): PairLike {
  if (!snapshot) return null;
  const home = snapshot[homeKey];
  const away = snapshot[awayKey];
  if (home === null && home === undefined && away === null && away === undefined) return null;
  return { home, away };
}

function providerStatPair(stats: Record<string, any>, key: string): PairLike {
  const stat = rawObject(stats[key]);
  const home = stat.home;
  const away = stat.away;
  if (home === null && home === undefined && away === null && away === undefined) return null;
  return { home, away, sourcePath: stat.sourcePath || null };
}

function hasPair(pair: PairLike) {
  return Boolean(pair && (pair.home !== null && pair.home !== undefined || pair.away !== null && pair.away !== undefined));
}

function pairShare(pair: PairLike) {
  const home = Math.max(0, Number(pair?.home || 0));
  const away = Math.max(0, Number(pair?.away || 0));
  const total = home + away;
  if (!total) return { home: 50, away: 50 };
  const homeShare = Math.max(4, Math.min(96, (home / total) * 100));
  return { home: homeShare, away: 100 - homeShare };
}

function teamName(team: any, fallback: string) {
  return team?.name || team?.code || fallback;
}

function leaderName(pair: PairLike, homeName: string, awayName: string) {
  const home = numberValue(pair?.home);
  const away = numberValue(pair?.away);
  if (home === null || away === null) return null;
  if (home === away) return 'تعادل';
  return home > away ? homeName : awayName;
}

function pairDiff(pair: PairLike) {
  const home = numberValue(pair?.home);
  const away = numberValue(pair?.away);
  if (home === null || away === null) return null;
  return Math.abs(home - away);
}

function buildInsights({ homeName, awayName, xg, possession, attacks, dangerousAttacks, shotsOnTarget }: { homeName: string; awayName: string; xg: PairLike; possession: PairLike; attacks: PairLike; dangerousAttacks: PairLike; shotsOnTarget: PairLike }) {
  const cards: Insight[] = [];
  const dangerousLeader = leaderName(dangerousAttacks, homeName, awayName);
  const dangerousDiff = pairDiff(dangerousAttacks);
  if (dangerousLeader && dangerousDiff !== null) cards.push({ title: 'الهجمات الخطيرة', value: dangerousLeader === 'تعادل' ? 'متقاربة' : dangerousLeader, body: dangerousLeader === 'تعادل' ? 'الهجمات الخطيرة متقاربة بين الطرفين.' : `${dangerousLeader} أكثر خطورة بفارق ${formatNumber(dangerousDiff)} هجمات خطيرة.` });
  const xgLeader = leaderName(xg, homeName, awayName);
  const xgDiff = pairDiff(xg);
  if (xgLeader && xgDiff !== null) cards.push({ title: 'جودة الفرص', value: xgLeader === 'تعادل' ? 'متقاربة' : xgLeader, body: xgLeader === 'تعادل' ? `xG متقارب (${formatDecimal(xg?.home, 2)} - ${formatDecimal(xg?.away, 2)}).` : `${xgLeader} صنع فرصًا أعلى جودة بفارق ${formatDecimal(xgDiff, 2)} xG.` });
  const possessionLeader = leaderName(possession, homeName, awayName);
  const possessionDiff = pairDiff(possession);
  if (possessionLeader && possessionDiff !== null) cards.push({ title: 'إيقاع اللعب', value: possessionLeader === 'تعادل' ? 'متوازن' : possessionLeader, body: possessionLeader === 'تعادل' ? 'الاستحواذ متوازن تقريبًا.' : `${possessionLeader} امتلك الكرة أكثر بفارق ${formatNumber(possessionDiff, '%')}.` });
  const targetLeader = leaderName(shotsOnTarget, homeName, awayName);
  const targetDiff = pairDiff(shotsOnTarget);
  if (targetLeader && targetDiff !== null) cards.push({ title: 'الفاعلية على المرمى', value: targetLeader === 'تعادل' ? 'متعادلة' : targetLeader, body: targetLeader === 'تعادل' ? 'التسديدات على المرمى متعادلة.' : `${targetLeader} وصل للمرمى أكثر بفارق ${formatNumber(targetDiff)} تسديدات.` });
  const attacksLeader = leaderName(attacks, homeName, awayName);
  const attacksDiff = pairDiff(attacks);
  if (attacksLeader && attacksDiff !== null) cards.push({ title: 'النشاط الهجومي', value: attacksLeader === 'تعادل' ? 'متوازن' : attacksLeader, body: attacksLeader === 'تعادل' ? 'الهجمات متوازنة.' : `${attacksLeader} أكثر نشاطًا بفارق ${formatNumber(attacksDiff)} هجمة.` });
  return cards.slice(0, 4);
}

function QualityCard({ title, pair, icon, decimals = 0, accent = 'cyan' }: { title: string; pair: PairLike; icon: ReactNode; decimals?: number; accent?: 'cyan' | 'gold' | 'green' }) {
  const border = accent === 'gold' ? 'border-[#FFD700]/25 bg-[#FFD700]/[0.06]' : accent === 'green' ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.05]';
  const text = accent === 'gold' ? 'text-[#FFD700]' : accent === 'green' ? 'text-emerald-300' : 'text-[#0FF0FC]';
  return (
    <div className={`rounded-2xl border ${border} p-4`}>
      <div className="flex items-center justify-between gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ${text}`}>{icon}</div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">{title}</p></div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3 text-center">
        <p className="text-2xl font-black text-white">{decimals ? formatDecimal(pair?.home, decimals) : formatNumber(pair?.home)}</p>
        <span className="pb-1 text-xs font-black text-gray-500">VS</span>
        <p className="text-2xl font-black text-white">{decimals ? formatDecimal(pair?.away, decimals) : formatNumber(pair?.away)}</p>
      </div>
    </div>
  );
}

function CompareBarRow({ label, pair, suffix = '', decimals = 0, note }: { label: string; pair: PairLike; suffix?: string; decimals?: number; note?: string }) {
  if (!hasPair(pair)) return null;
  const share = pairShare(pair);
  const homeValue = decimals ? formatDecimal(pair?.home, decimals) : formatNumber(pair?.home, suffix);
  const awayValue = decimals ? formatDecimal(pair?.away, decimals) : formatNumber(pair?.away, suffix);
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 grid grid-cols-[64px_1fr_64px] items-center gap-3 text-sm">
        <div className="text-left font-black text-white tabular-nums">{homeValue}</div>
        <div className="text-center"><p className="text-xs font-black text-gray-200">{label}</p>{note ? <p className="mt-0.5 text-[10px] font-bold text-gray-500">{note}</p> : null}</div>
        <div className="text-right font-black text-white tabular-nums">{awayValue}</div>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-r-full bg-[#0FF0FC]" style={{ width: `${share.home}%` }} /><div className="h-full rounded-l-full bg-[#FFD700]" style={{ width: `${share.away}%` }} /></div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">{insight.title}</p><Sparkles size={15} className="text-[#FFD700]" /></div><p className="mt-2 text-lg font-black text-white">{insight.value}</p><p className="mt-2 text-xs font-bold leading-6 text-gray-400">{insight.body}</p></div>;
}

function FormationCard({ side, lineup, fallbackName }: { side: 'home' | 'away'; lineup: Record<string, any>; fallbackName: string }) {
  return <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-500">{side === 'home' ? 'الفريق الأول' : 'الفريق الثاني'}</p><div className="mt-3 flex items-end justify-between gap-3"><div><h4 className="text-lg font-black text-white">{lineup.name || fallbackName}</h4><p className="mt-1 text-xs font-bold text-gray-400">أساسي: {formatNumber(lineup.startingXiCount)} · بدلاء: {formatNumber(lineup.substitutesCount)}</p></div><div className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-2 text-2xl font-black text-[#FFD700]">{lineup.formation || '—'}</div></div></div>;
}

function ProfessionalStatsPanel({ match, iSportsSnapshot, theStatsSnapshot }: { match: any; iSportsSnapshot: any; theStatsSnapshot: any }) {
  const homeName = teamName(match.homeTeam, 'Home');
  const awayName = teamName(match.awayTeam, 'Away');
  const { stats, derived, lineup } = getProviderEnrichment(theStatsSnapshot);
  const lineupHome = rawObject(lineup.home);
  const lineupAway = rawObject(lineup.away);
  const pair = (key: string, homeKey: string, awayKey: string): PairLike => statPairFromSnapshot(iSportsSnapshot, homeKey, awayKey) || providerStatPair(stats, key);
  const xg = providerStatPair(stats, 'xg');
  const npxg = providerStatPair(stats, 'npxg');
  const bigChances = providerStatPair(stats, 'bigChances');
  const possession = pair('possession', 'homePossession', 'awayPossession');
  const attacks = pair('attacks', 'homeAttacks', 'awayAttacks');
  const dangerousAttacks = pair('dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks');
  const shots = pair('shots', 'homeShots', 'awayShots');
  const shotsOnTarget = pair('shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget');
  const shotsOffTarget = statPairFromSnapshot(iSportsSnapshot, 'homeShotsOffTarget', 'awayShotsOffTarget') || rawObject(derived.shotsOffTargetForLocalCompare || derived.shotsOffTargetWithBlocked) as PairLike;
  const corners = pair('corners', 'homeCorners', 'awayCorners');
  const passes = providerStatPair(stats, 'passes');
  const accuratePasses = providerStatPair(stats, 'accuratePasses');
  const fouls = providerStatPair(stats, 'fouls');
  const tackles = providerStatPair(stats, 'tackles');
  const saves = providerStatPair(stats, 'saves');
  const clearances = providerStatPair(stats, 'clearances');
  const ballRecoveries = providerStatPair(stats, 'ballRecoveries');
  const yellowCards = pair('yellowCards', 'homeYellowCards', 'awayYellowCards');
  const redCards = pair('redCards', 'homeRedCards', 'awayRedCards');
  const lastUpdated = theStatsSnapshot?.capturedAt || iSportsSnapshot?.capturedAt || null;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] p-4 shadow-card sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><div className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[#0FF0FC]"><BarChart3 size={14} /> Live Match Stats</div><h2 className="mt-3 text-2xl font-black text-white">إحصائيات المباراة</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">عرض موحّد لكل الأرقام المتاحة: الاستحواذ، الهجمات، الخطورة، التسديدات، جودة الفرص، التشكيلات، والأحداث — في مكان واحد.</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">آخر تحديث</p><p className="mt-1 text-sm font-black text-white">{lastUpdated ? formatDate(lastUpdated) : 'غير متوفر'}</p></div>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-3"><QualityCard title="xG" pair={xg} decimals={2} icon={<TrendingUp size={20} />} accent="gold" /><QualityCard title="npxG" pair={npxg} decimals={2} icon={<Activity size={20} />} accent="cyan" /><QualityCard title="فرص كبيرة" pair={bigChances} icon={<Target size={20} />} accent="green" /></div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-sm font-black text-white">لوحة المقارنة الموحدة</h3><div className="flex items-center gap-2 text-[10px] font-black text-gray-500"><span className="h-2 w-2 rounded-full bg-[#0FF0FC]" /> {homeName}<span className="h-2 w-2 rounded-full bg-[#FFD700]" /> {awayName}</div></div><div className="space-y-2">
          <CompareBarRow label="الاستحواذ" pair={possession} suffix="%" />
          <CompareBarRow label="الهجمات" pair={attacks} />
          <CompareBarRow label="الهجمات الخطيرة" pair={dangerousAttacks} />
          <CompareBarRow label="التسديدات" pair={shots} />
          <CompareBarRow label="على المرمى" pair={shotsOnTarget} />
          <CompareBarRow label="تسديدات خارج المرمى" pair={shotsOffTarget} note="تشمل التسديدات المحجوبة عند الحاجة لتوحيد التعريف" />
          <CompareBarRow label="الركنيات" pair={corners} />
          <CompareBarRow label="التمريرات" pair={passes} />
          <CompareBarRow label="تمريرات صحيحة" pair={accuratePasses} />
          <CompareBarRow label="الأخطاء" pair={fouls} />
          <CompareBarRow label="التدخلات" pair={tackles} />
          <CompareBarRow label="التصديات" pair={saves} />
          <CompareBarRow label="التشتيت" pair={clearances} />
          <CompareBarRow label="استخلاصات الكرة" pair={ballRecoveries} />
          <CompareBarRow label="بطاقات صفراء" pair={yellowCards} />
          <CompareBarRow label="بطاقات حمراء" pair={redCards} />
        </div></div>
        <div className="space-y-4"><div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/[0.05] p-4"><div className="mb-3 flex items-center gap-2 text-[#FFD700]"><ShieldCheck size={18} /><h3 className="text-sm font-black text-white">جودة البيانات</h3></div><ul className="space-y-2 text-xs font-bold leading-6 text-gray-400"><li>• الأرقام المعروضة مأخوذة من بيانات محفوظة داخل قاعدة بيانات الموقع.</li><li>• أي رقم غير متوفر لا يتم استنتاجه أو اختراعه.</li><li>• العرض رياضي فقط ومخصص لقراءة المباراة.</li></ul></div>{(lineupHome.formation || lineupAway.formation) ? <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="mb-3 flex items-center gap-2 text-[#0FF0FC]"><Users size={18} /><h3 className="text-sm font-black text-white">التشكيلات المؤكدة</h3></div><div className="space-y-3"><FormationCard side="home" lineup={lineupHome} fallbackName={homeName} /><FormationCard side="away" lineup={lineupAway} fallbackName={awayName} /></div></div> : <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center text-sm font-bold text-gray-400">التشكيلات غير متوفرة في snapshot الحالية.</div>}</div>
      </div>
    </section>
  );
}

function MatchEventsBlock({ events }: { events: any[] }) {
  return <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 shadow-card"><div className="mb-4 flex items-center justify-between gap-2"><div><h3 className="text-sm font-black text-white">أحداث المباراة</h3><p className="mt-1 text-[10px] font-bold text-gray-500">كل الأحداث المحفوظة بجانب الإحصائيات داخل نفس التجربة.</p></div><span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black text-gray-400">{formatNumber(events.length)} حدث</span></div>{events.length ? <div className="relative space-y-3 before:absolute before:right-[17px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-white/10">{events.map((event) => <div key={event.id} className="relative pr-10"><div className="absolute right-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 text-xs font-black text-[#FFD700]">{event.minute !== null && event.minute !== undefined ? `${formatNumber(event.minute)}'` : '—'}</div><div className="rounded-2xl border border-white/5 bg-black/25 p-3"><div className="mb-1 flex items-center justify-between gap-2 text-xs font-black"><span className="text-gray-400">{event.type || 'note'}</span>{event.sourceName ? <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-500">{event.sourceName}</span> : null}</div><p className="text-sm font-bold text-white">{event.detail}</p>{event.playerName ? <p className="mt-1 text-xs text-gray-400">اللاعب: {event.playerName}</p> : null}</div></div>)}</div> : <p className="rounded-xl border border-white/5 bg-black/20 p-4 text-center text-xs font-bold text-gray-400">لم يتم تسجيل أحداث محفوظة لهذه المباراة بعد.</p>}</div>;
}

function SmartMatchReadingBlock({ match, iSportsSnapshot, theStatsSnapshot }: { match: any; iSportsSnapshot: any; theStatsSnapshot: any }) {
  const homeName = teamName(match.homeTeam, 'Home');
  const awayName = teamName(match.awayTeam, 'Away');
  const { stats } = getProviderEnrichment(theStatsSnapshot);
  const pair = (key: string, homeKey: string, awayKey: string): PairLike => statPairFromSnapshot(iSportsSnapshot, homeKey, awayKey) || providerStatPair(stats, key);
  const insights = buildInsights({ homeName, awayName, xg: providerStatPair(stats, 'xg'), possession: pair('possession', 'homePossession', 'awayPossession'), attacks: pair('attacks', 'homeAttacks', 'awayAttacks'), dangerousAttacks: pair('dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks'), shotsOnTarget: pair('shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget') });
  return <section className="rounded-[1.6rem] border border-[#FFD700]/15 bg-gradient-to-br from-[#FFD700]/[0.08] via-white/[0.035] to-[#0FF0FC]/[0.05] p-4 shadow-card sm:p-5"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[#FFD700]"><Sparkles size={14} /> Match Intelligence</div><h2 className="mt-3 text-2xl font-black text-white">قراءة ذكية للمباراة</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">هذا القسم يأتي في آخر صفحة المباراة بعد عرض الأرقام والأحداث، ويحوّل الإحصائيات المحفوظة إلى قراءة سريعة.</p></div><div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">قراءة تحليلية</p><p className="mt-1 text-sm font-black text-white">من الأرقام المحفوظة فقط</p></div></div>{insights.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{insights.map((insight) => <InsightCard key={insight.title} insight={insight} />)}</div> : <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-center text-sm font-bold text-gray-400">القراءة الذكية غير متوفرة لأن الأرقام الداعمة غير مكتملة.</div>}</section>;
}

function AdminMatchTools({ matchId, secret }: { matchId: string; secret: string }) {
  if (!secret) return null;
  const query = encodeURIComponent(secret);
  return <section className="rounded-[1.45rem] border border-emerald-400/15 bg-emerald-400/[0.06] p-4 shadow-card"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">Admin tools</p><h2 className="mt-1 text-lg font-black text-white">أدوات تحديث بيانات هذه المباراة</h2></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-black text-emerald-200">مخفية عن الزوار</span></div><div className="flex flex-wrap gap-2"><a href={`/api/admin/the-stats-import-match-enrichment?adminSecret=${query}&matchId=${encodeURIComponent(matchId)}&dryRun=true`} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-300/15">Preview الإثراء</a><a href={`/api/admin/the-stats-import-match-enrichment?adminSecret=${query}&matchId=${encodeURIComponent(matchId)}&dryRun=false`} target="_blank" rel="noreferrer" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/15">Import الإثراء</a><a href={`/api/admin/match-infographic-data?adminSecret=${query}&matchId=${encodeURIComponent(matchId)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-2 text-xs font-black text-[#EAFBFF] hover:bg-[#0FF0FC]/15"><FileJson size={14} className="inline" /> JSON الإنفوجراف</a><Link href={`/admin/match-snapshots?adminSecret=${query}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10">مراجعة Snapshots</Link></div></section>;
}

function MatchDataPanel({ match }: { match: any }) {
  const iSportsSnapshot = pickLatestSnapshot(match, 'ISPORTS') || match.statsSnapshots?.find((snapshot: any) => !String(snapshot.provider || '').toUpperCase().includes('THE_STATS')) || null;
  const theStatsSnapshot = pickLatestSnapshot(match, 'THE_STATS') || null;
  const events = Array.isArray(match.events) ? match.events : [];
  return <div className="space-y-5"><section className="grid gap-5 xl:grid-cols-[1fr_0.38fr]"><ProfessionalStatsPanel match={match} iSportsSnapshot={iSportsSnapshot} theStatsSnapshot={theStatsSnapshot} /><MatchEventsBlock events={events} /></section><SmartMatchReadingBlock match={match} iSportsSnapshot={iSportsSnapshot} theStatsSnapshot={theStatsSnapshot} /></div>;
}

export default async function MatchCenterPage({ params, searchParams }: { params: Promise<{ id: string }> | { id: string }; searchParams?: SearchParams }) {
  const resolved = await params;
  const queryParams = (await searchParams) || {};
  const match = await getMatch(resolved.id);
  if (!match) notFound();
  const session = await getServerSession(authOptions as any) as AdminSession;
  const canGenerateArticle = isAdmin(session);
  const articleSummary = canGenerateArticle ? await getMatchArticleSummary(match.id) : { latest: null, count: 0, latestUpdatedAt: null };
  const existingArticle = articleSummary.latest;
  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';
  const adminSecret = canGenerateArticle ? suppliedSecret(queryParams) : '';
  return <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl"><section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">{canGenerateArticle && <GenerateMatchArticleButton matchId={match.id} existingArticle={existingArticle ? { title: existingArticle.title, url: `/news/${existingArticle.id}`, status: existingArticle.status || 'published', updatedAt: existingArticle.updatedAt || articleSummary.latestUpdatedAt || null, count: articleSummary.count } : { title: '', url: '', status: null, updatedAt: articleSummary.latestUpdatedAt || null, count: articleSummary.count }} />}{canGenerateArticle ? <AdminMatchTools matchId={match.id} secret={adminSecret} /> : null}<section id="live-broadcast" className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-3 shadow-card sm:rounded-[1.5rem] sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex min-w-0 items-center gap-2 text-base font-black text-white sm:text-xl"><Radio className="text-[#FFD700]" /> البث التفاعلي</h1><div className="mt-1 text-[10px] font-black text-[#FFD700]">المشغل التفاعلي المباشر</div></div><Link href="/matches" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 text-sm font-black text-[#EAFBFF] transition hover:border-[#0FF0FC]/45 hover:bg-[#0FF0FC]/15 hover:text-white">العودة إلى المباريات <ArrowLeft size={16} /></Link></div><InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} /></section><MatchDataPanel match={match} /></section></main>;
}
