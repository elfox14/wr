import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ArrowLeft, Radio } from 'lucide-react';
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

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

type MatchArticleSummary = {
  latest: {
    id: string;
    title: string;
    status?: string | null;
    updatedAt?: Date | string | null;
  } | null;
  count: number;
  latestUpdatedAt?: Date | string | null;
};

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 6 },
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
    return {
      latest: rows[0] || null,
      count: Number(counts[0]?.count || 0),
      latestUpdatedAt: counts[0]?.latestUpdatedAt || rows[0]?.updatedAt || null,
    };
  } catch (error) {
    return { latest: null, count: 0, latestUpdatedAt: null };
  }
}

function formatNumber(value?: number | null, suffix = '') {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toLocaleString('ar-EG')}${suffix}`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'غير متوفر';
  return new Date(value).toLocaleString('ar-EG');
}

function providerLabel(provider?: string | null) {
  const value = String(provider || '').toUpperCase();
  if (value.includes('THE_STATS')) return 'TheStatsAPI';
  if (value.includes('ISPORTS')) return 'iSports';
  return provider || 'مصدر غير محدد';
}

function rawObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function getProviderEnrichment(snapshot: any) {
  const raw = rawObject(snapshot?.rawData);
  const direct = rawObject(raw.theStatsApi || raw.providerStats || raw.stats ? raw : {});
  const stats = rawObject(raw.stats || raw.providerStats || direct.stats || direct.providerStats);
  const derived = rawObject(raw.derived || direct.derived);
  const lineup = rawObject(raw.lineup || raw.lineups || direct.lineup || direct.lineups);
  return { stats, derived, lineup };
}

function pickLatestSnapshot(match: any, providerHint: string) {
  const snapshots = Array.isArray(match.statsSnapshots) ? match.statsSnapshots : [];
  return snapshots.find((snapshot: any) => String(snapshot.provider || '').toUpperCase().includes(providerHint));
}

function statPairFromSnapshot(snapshot: any, homeKey: string, awayKey: string) {
  if (!snapshot) return null;
  const home = snapshot[homeKey];
  const away = snapshot[awayKey];
  if (home === null && home === undefined && away === null && away === undefined) return null;
  return { home, away };
}

function providerStatPair(stats: Record<string, any>, key: string) {
  const stat = rawObject(stats[key]);
  const home = stat.home;
  const away = stat.away;
  if (home === null && home === undefined && away === null && away === undefined) return null;
  return { home, away, sourcePath: stat.sourcePath || null };
}

function StatRow({ label, home, away, suffix = '' }: { label: string; home?: number | null; away?: number | null; suffix?: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr_64px] items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
      <div className="text-left font-black text-white tabular-nums">{formatNumber(home, suffix)}</div>
      <div className="text-center text-xs font-black text-gray-300">{label}</div>
      <div className="text-right font-black text-white tabular-nums">{formatNumber(away, suffix)}</div>
    </div>
  );
}

function ProviderStatsBlock({ title, snapshot, rows }: { title: string; snapshot: any; rows: Array<{ label: string; home: string; away: string; suffix?: string }> }) {
  const availableRows = rows
    .map((row) => ({ ...row, pair: statPairFromSnapshot(snapshot, row.home, row.away) }))
    .filter((row) => row.pair);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-white">{title}</h3>
        {snapshot ? <span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-2.5 py-1 text-[10px] font-black text-[#0FF0FC]">{providerLabel(snapshot.provider)}</span> : null}
      </div>
      {availableRows.length ? (
        <div className="space-y-2">
          {availableRows.map((row) => <StatRow key={row.label} label={row.label} home={row.pair?.home} away={row.pair?.away} suffix={row.suffix} />)}
        </div>
      ) : (
        <p className="rounded-xl border border-white/5 bg-black/20 p-3 text-center text-xs font-bold text-gray-400">لا توجد إحصائيات محفوظة لهذا المصدر بعد.</p>
      )}
      {snapshot?.capturedAt ? <p className="mt-3 text-[10px] font-bold text-gray-500">آخر تحديث: {formatDate(snapshot.capturedAt)}</p> : null}
    </div>
  );
}

function TheStatsApiEnrichmentBlock({ snapshot }: { snapshot: any }) {
  if (!snapshot) return null;
  const { stats, derived, lineup } = getProviderEnrichment(snapshot);
  const lineupHome = rawObject(lineup.home);
  const lineupAway = rawObject(lineup.away);
  const richStats = [
    { key: 'xg', label: 'xG' },
    { key: 'npxg', label: 'npxG' },
    { key: 'bigChances', label: 'فرص كبيرة' },
    { key: 'passes', label: 'تمريرات' },
    { key: 'accuratePasses', label: 'تمريرات صحيحة' },
    { key: 'fouls', label: 'أخطاء' },
    { key: 'tackles', label: 'تدخلات' },
    { key: 'interceptions', label: 'اعتراضات' },
    { key: 'clearances', label: 'تشتيت' },
    { key: 'ballRecoveries', label: 'استخلاصات' },
    { key: 'saves', label: 'تصديات' },
  ]
    .map((row) => ({ ...row, pair: providerStatPair(stats, row.key) }))
    .filter((row) => row.pair);

  const derivedShots = rawObject(derived.shotsOffTargetForLocalCompare || derived.shotsOffTargetWithBlocked);

  return (
    <div className="rounded-2xl border border-[#FFD700]/15 bg-[#FFD700]/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-white">إثراء TheStatsAPI</h3>
          <p className="mt-1 text-[10px] font-bold text-gray-400">إحصائيات متقدمة وتشكيلات مؤكدة — بدون Odds أو مراهنات.</p>
        </div>
        <span className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">بيانات إضافية</span>
      </div>

      {richStats.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {richStats.map((row) => <StatRow key={row.key} label={row.label} home={row.pair?.home} away={row.pair?.away} />)}
          {derivedShots.home !== undefined || derivedShots.away !== undefined ? <StatRow label="خارج المرمى + المحجوبة" home={derivedShots.home} away={derivedShots.away} /> : null}
        </div>
      ) : (
        <p className="rounded-xl border border-white/5 bg-black/20 p-3 text-center text-xs font-bold text-gray-400">لم يتم حفظ إحصائيات TheStatsAPI لهذه المباراة بعد.</p>
      )}

      {(lineupHome.formation || lineupAway.formation) ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-black/25 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">خطة الفريق الأول</p>
            <p className="mt-1 text-lg font-black text-white">{lineupHome.name || 'الفريق الأول'}: {lineupHome.formation || 'غير متوفر'}</p>
            <p className="mt-1 text-xs font-bold text-gray-400">أساسي: {formatNumber(lineupHome.startingXiCount)} · بدلاء: {formatNumber(lineupHome.substitutesCount)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/25 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">خطة الفريق الثاني</p>
            <p className="mt-1 text-lg font-black text-white">{lineupAway.name || 'الفريق الثاني'}: {lineupAway.formation || 'غير متوفر'}</p>
            <p className="mt-1 text-xs font-bold text-gray-400">أساسي: {formatNumber(lineupAway.startingXiCount)} · بدلاء: {formatNumber(lineupAway.substitutesCount)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MatchEventsBlock({ events }: { events: any[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-white">أحداث المباراة</h3>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black text-gray-400">{formatNumber(events.length)} حدث</span>
      </div>
      {events.length ? (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-black">
                <span className="text-[#FFD700]">{event.minute !== null && event.minute !== undefined ? `${formatNumber(event.minute)}'` : 'بدون دقيقة'}</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">{event.type || 'note'}</span>
              </div>
              <p className="text-sm font-bold text-white">{event.detail}</p>
              {event.playerName ? <p className="mt-1 text-xs text-gray-400">اللاعب: {event.playerName}</p> : null}
              {event.sourceName ? <p className="mt-1 text-[10px] font-bold text-gray-500">المصدر: {event.sourceName}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-white/5 bg-black/20 p-3 text-center text-xs font-bold text-gray-400">لم يتم تسجيل أحداث محفوظة لهذه المباراة بعد.</p>
      )}
    </div>
  );
}

function MatchDataPanel({ match }: { match: any }) {
  const iSportsSnapshot = pickLatestSnapshot(match, 'ISPORTS') || match.statsSnapshots?.[0] || null;
  const theStatsSnapshot = pickLatestSnapshot(match, 'THE_STATS') || null;
  const events = Array.isArray(match.events) ? match.events : [];

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <ProviderStatsBlock
          title="إحصائيات المباراة الأساسية"
          snapshot={iSportsSnapshot}
          rows={[
            { label: 'الاستحواذ', home: 'homePossession', away: 'awayPossession', suffix: '%' },
            { label: 'الهجمات', home: 'homeAttacks', away: 'awayAttacks' },
            { label: 'هجمات خطيرة', home: 'homeDangerousAttacks', away: 'awayDangerousAttacks' },
            { label: 'التسديدات', home: 'homeShots', away: 'awayShots' },
            { label: 'على المرمى', home: 'homeShotsOnTarget', away: 'awayShotsOnTarget' },
            { label: 'خارج المرمى', home: 'homeShotsOffTarget', away: 'awayShotsOffTarget' },
            { label: 'ركنيات', home: 'homeCorners', away: 'awayCorners' },
            { label: 'بطاقات صفراء', home: 'homeYellowCards', away: 'awayYellowCards' },
            { label: 'بطاقات حمراء', home: 'homeRedCards', away: 'awayRedCards' },
          ]}
        />
        <TheStatsApiEnrichmentBlock snapshot={theStatsSnapshot} />
      </div>
      <MatchEventsBlock events={events} />
    </section>
  );
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const session = await getServerSession(authOptions as any) as AdminSession;
  const canGenerateArticle = isAdmin(session);
  const articleSummary = canGenerateArticle ? await getMatchArticleSummary(match.id) : { latest: null, count: 0, latestUpdatedAt: null };
  const existingArticle = articleSummary.latest;
  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        {canGenerateArticle && (
          <GenerateMatchArticleButton
            matchId={match.id}
            existingArticle={existingArticle ? {
              title: existingArticle.title,
              url: `/news/${existingArticle.id}`,
              status: existingArticle.status || 'published',
              updatedAt: existingArticle.updatedAt || articleSummary.latestUpdatedAt || null,
              count: articleSummary.count,
            } : {
              title: '',
              url: '',
              status: null,
              updatedAt: articleSummary.latestUpdatedAt || null,
              count: articleSummary.count,
            }}
          />
        )}

        <section id="live-broadcast" className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-3 shadow-card sm:rounded-[1.5rem] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex min-w-0 items-center gap-2 text-base font-black text-white sm:text-xl"><Radio className="text-[#FFD700]" /> البث التفاعلي</h1>
              <div className="mt-1 text-[10px] font-black text-[#FFD700]">المشغل التفاعلي المباشر</div>
            </div>
            <Link href="/matches" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 text-sm font-black text-[#EAFBFF] transition hover:border-[#0FF0FC]/45 hover:bg-[#0FF0FC]/15 hover:text-white">
              العودة إلى المباريات <ArrowLeft size={16} />
            </Link>
          </div>
          <InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} />
        </section>

        <MatchDataPanel match={match} />
      </section>
    </main>
  );
}
