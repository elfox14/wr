import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ArrowLeft, CheckCircle2, Clock, Newspaper } from 'lucide-react';
import prisma from '@/lib/prisma';
import LiveMatchStatsPanel from '@/app/animation-live/player/LiveMatchStatsPanel';
import { getTeamFlagUrl } from '@/lib/teamFlags';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'مركز المباراة | MC PRIME World Cup',
  description: 'مركز المباراة: بطاقة المباراة، البث الأنيميشن، الرصد الصحفي المرتبط، وإحصائيات المباراة عند توفر البيانات الموثقة.',
};

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScoreNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function formatCountdown(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const n = (value: number) => value.toLocaleString('ar-EG');
  if (days > 0) return `بعد ${n(days)}ي ${n(hours)}س ${n(minutes)}د`;
  if (hours > 0) return `بعد ${n(hours)}س ${n(minutes)}د ${n(seconds)}ث`;
  return `بعد ${n(minutes)}د ${n(seconds)}ث`;
}

function isGroupStage(match: any) {
  const value = String(match.groupPhase || match.stage || '').toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: any) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function elapsedMinutes(match: any, now = new Date()) {
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now.getTime() - matchTime) / 60_000);
}

function isStaleLive(match: any, now = new Date()) {
  const status = String(match.status || '').toUpperCase();
  if (!LIVE_STATUSES.includes(status)) return false;
  const elapsed = elapsedMinutes(match, now);
  if (elapsed === null) return false;
  return elapsed >= maxLiveMinutes(match);
}

function isFinishedMatch(match: any, now = new Date()) {
  const status = String(match.status || '').toUpperCase();
  return FINISHED_STATUSES.includes(status) || isStaleLive(match, now);
}

function statusInfo(match: any) {
  const value = String(match.status || '').toUpperCase();
  if (isFinishedMatch(match)) {
    return { label: 'انتهت', className: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]', icon: CheckCircle2 };
  }
  if (LIVE_STATUSES.includes(value)) {
    return { label: value === 'HT' ? 'استراحة' : 'مباشرة الآن', className: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]', icon: Activity };
  }
  const countdown = match.matchDate ? formatCountdown(match.matchDate) : null;
  return { label: countdown || 'قادمة', className: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]', icon: Clock };
}

function teamFlagUrl(asset: any) {
  return getTeamFlagUrl({ code: asset?.code, name: asset?.name, image: asset?.image }, 96);
}

function safeImage(asset: any) {
  const src = teamFlagUrl(asset);
  if (src) return <img src={src} alt={`علم ${asset?.name || asset?.code || 'منتخب'}`} className="h-full w-full object-cover" loading="lazy" />;
  return <span className="text-sm font-black text-[#FFD700]">{asset?.code || '🏳️'}</span>;
}

function TeamInlineName({ asset, fallback }: { asset: any; fallback: string }) {
  const src = teamFlagUrl(asset);
  const name = asset?.name || fallback;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] border border-white/10 bg-black/30">
        {src ? <img src={src} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : null}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

function teamCode(asset: any) {
  return asset?.code || asset?.name?.slice?.(0, 3) || '---';
}

function groupLabel(match: any) {
  return match.groupPhase || match.stage || 'كأس العالم 2026';
}

function RtlScore({ homeScore, awayScore }: { homeScore?: number | null; awayScore?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums" dir="rtl">
      <span>{formatScoreNumber(homeScore)}</span>
      <span className="text-[#FFD700]/70">-</span>
      <span>{formatScoreNumber(awayScore)}</span>
    </span>
  );
}

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: { homeTeam: true, awayTeam: true },
  });
}

async function getRelatedPressNews(matchId: string, homeId: string, awayId: string, homeName: string, awayName: string) {
  try {
    const homePattern = `%${homeName}%`;
    const awayPattern = `%${awayName}%`;
    return await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "PressNews"
      WHERE "status" = 'published'
        AND (
          "relatedMatchId" = ${matchId}
          OR "relatedTeamId" = ${homeId}
          OR "relatedTeamId" = ${awayId}
          OR "title" ILIKE ${homePattern}
          OR "body" ILIKE ${homePattern}
          OR "title" ILIKE ${awayPattern}
          OR "body" ILIKE ${awayPattern}
        )
      ORDER BY "publishedAt" DESC, "importance" DESC
      LIMIT 8
    `;
  } catch (error) {
    console.error('match center press news error:', error);
    return [];
  }
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const home = match.homeTeam;
  const away = match.awayTeam;
  const finished = isFinishedMatch(match);
  const status = statusInfo(match);
  const StatusIcon = status.icon;
  const pressNews = await getRelatedPressNews(match.id, home.id, away.id, home.name, away.name);
  const showScore = finished || !['SCHEDULED', 'TIMED', 'NOT_STARTED'].includes(String(match.status).toUpperCase());
  const animationHref = match.animationMatchId
    ? `/animation-live/player?matchId=${encodeURIComponent(String(match.animationMatchId))}&dbMatchId=${encodeURIComponent(String(match.id))}&lang=en&statsPanel=simple&teamPanel=1`
    : '/animation-live';

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-5">
        <Link href="/matches" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 transition hover:text-white">
          <ArrowLeft size={16} /> العودة إلى المباريات
        </Link>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur sm:p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
          <div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1 text-[11px] font-black text-[#FFD700]">{groupLabel(match)}</span>
            <span className={`min-w-0 truncate rounded-full border px-2.5 py-1 text-center text-[11px] font-black ${status.className}`}>
              <StatusIcon size={13} className="inline" /> {status.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-gray-300">{formatDate(match.matchDate)}</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <TeamBlock asset={home} align="right" fallback="الفريق الأول" />
            <div className={`flex min-h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-xs font-black ${showScore ? 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
              {showScore ? <RtlScore homeScore={match.homeScore} awayScore={match.awayScore} /> : 'VS'}
            </div>
            <TeamBlock asset={away} align="left" fallback="الفريق الثاني" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="#match-stats" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-[11px] font-black text-gray-200 transition hover:bg-white/[0.1]">تفاصيل المباراة</Link>
            {!finished ? (
              <Link href={animationHref} className="rounded-xl bg-[#0FF0FC] px-3 py-2 text-center text-[11px] font-black text-black transition hover:bg-[#4AFAFF]">البث التفاعلي</Link>
            ) : (
              <span className="rounded-xl border border-gray-500/20 bg-gray-500/10 px-3 py-2 text-center text-[11px] font-black text-gray-300">البث مغلق</span>
            )}
          </div>
        </section>

        <div id="match-stats">
          {!finished ? (
            <LiveMatchStatsPanel matchId={match.animationMatchId ? String(match.animationMatchId) : undefined} dbMatchId={match.id} />
          ) : (
            <EmptyText text="انتهت المباراة، لذلك تم إيقاف لوحة البث الحي لهذه المباراة. ستظهر هنا الإحصائيات النهائية عند توفر مصدر موثق." />
          )}
        </div>

        <Panel title="مرصد المباراة الإخباري ومجريات اللعب" icon={<Newspaper className="text-[#FFD700]" />} action={<Link href="/news" className="text-xs font-black text-[#0FF0FC]">غرفة الأخبار</Link>}>
          {pressNews.length ? (
            <div className="grid gap-3 md:grid-cols-2">{pressNews.map((item) => <PressNewsCard key={item.id} item={item} />)}</div>
          ) : (
            <EmptyText text="لا توجد أخبار صحفية مرتبطة بهذه المباراة حاليًا. مجريات اللعب اللحظية تظهر في كارت الإحصائيات عند توفر مصدر موثق." />
          )}
        </Panel>
      </section>
    </main>
  );
}

function TeamBlock({ asset, align, fallback }: { asset: any; align: 'right' | 'left'; fallback: string }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className="mb-1.5 inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.07]">{safeImage(asset)}</div>
      <h2 className="truncate text-sm font-black text-white"><TeamInlineName asset={asset} fallback={fallback} /></h2>
      <p className="mt-0.5 text-[11px] font-bold text-gray-500">{teamCode(asset)}</p>
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-xl font-black text-white">{icon}{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold leading-7 text-gray-400">{text}</div>;
}

function PressNewsCard({ item }: { item: any }) {
  const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ar-EG') : '';
  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black text-gray-500">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-[#FFD700]">{item.category || 'رصد صحفي'}</span>
        <span>{item.sourceName || 'مصدر غير محدد'}</span>
        {date ? <span>{date}</span> : null}
      </div>
      <h4 className="text-base font-black leading-7 text-white">{item.title}</h4>
      <p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-400">{item.body}</p>
      {item.sourceUrl ? (
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-xs font-black text-[#0FF0FC]">فتح المصدر</a>
      ) : null}
    </article>
  );
}
