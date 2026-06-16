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

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const home = match.homeTeam;
  const away = match.awayTeam;
  const finished = isFinishedMatch(match);
  const status = statusInfo(match);
  const StatusIcon = status.icon;
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

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.10),rgba(255,255,255,0.035)_42%,rgba(0,0,0,0.20))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
          <div className="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-[11px] font-black text-[#FFD700]">{groupLabel(match)}</span>
            <span className={`min-w-0 truncate rounded-full border px-3 py-1 text-center text-[11px] font-black ${status.className}`}>
              <StatusIcon size={13} className="inline" /> {status.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-black text-gray-300">{formatDate(match.matchDate)}</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
            <TeamBlock asset={home} align="right" fallback="الفريق الأول" />
            <div className={`flex min-h-16 min-w-20 items-center justify-center rounded-2xl border px-4 text-lg font-black sm:text-3xl ${showScore ? 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>
              {showScore ? <RtlScore homeScore={match.homeScore} awayScore={match.awayScore} /> : 'VS'}
            </div>
            <TeamBlock asset={away} align="left" fallback="الفريق الثاني" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href="#match-stats" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-[11px] font-black text-gray-200 transition hover:bg-white/[0.1]">تفاصيل المباراة</Link>
            {!finished ? (
              <Link href={animationHref} className="rounded-xl bg-[#0FF0FC] px-3 py-2 text-center text-[11px] font-black text-black transition hover:bg-[#4AFAFF]">البث التفاعلي</Link>
            ) : (
              <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-center text-[11px] font-black text-[#FFD700]">أرشيف المباراة</span>
            )}
          </div>
        </section>

        <div id="match-stats">
          <LiveMatchStatsPanel matchId={match.animationMatchId ? String(match.animationMatchId) : undefined} dbMatchId={match.id} />
        </div>

        <Panel title="مرصد المباراة الإخباري ومجريات اللعب" icon={<Newspaper className="text-[#FFD700]" />} action={<Link href="/news" className="text-xs font-black text-[#0FF0FC]">غرفة الأخبار</Link>}>
          <EmptyText text="الأحداث المحفوظة من iSports Timeline تظهر الآن داخل كارت بيانات المباراة. التحليل الصحفي المنفصل سيظهر هنا عند ربط مصادر الأخبار." />
        </Panel>
      </section>
    </main>
  );
}

function TeamBlock({ asset, align, fallback }: { asset: any; align: 'right' | 'left'; fallback: string }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className="mb-2 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] shadow-[0_8px_24px_rgba(0,0,0,0.24)] sm:h-16 sm:w-16">{safeImage(asset)}</div>
      <h2 className="truncate text-base font-black text-white sm:text-xl"><TeamInlineName asset={asset} fallback={fallback} /></h2>
      <p className="mt-1 text-[11px] font-bold text-gray-500 sm:text-xs">{teamCode(asset)}</p>
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
