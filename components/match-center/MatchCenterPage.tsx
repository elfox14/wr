import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ArrowLeft, CalendarDays, CheckCircle2, Clock, Radio, Shield } from 'lucide-react';
import prisma from '@/lib/prisma';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';
import { getTeamFlagUrl } from '@/lib/teamFlags';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'البث التفاعلي | MC PRIME World Cup',
  description: 'البث التفاعلي للمباراة: بطاقة المباراة، الملعب التفاعلي، الإحصائيات، والأحداث المهمة.',
};

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const NOT_STARTED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
  const n = (value: number) => value.toLocaleString('ar-EG');
  if (days > 0) return `بعد ${n(days)}ي ${n(hours)}س`;
  if (hours > 0) return `بعد ${n(hours)}س ${n(minutes)}د`;
  return `بعد ${n(minutes)}د`;
}

function matchStatusValue(match: any) {
  return String(match.displayStatus || match.status || '').toUpperCase();
}

function isGroupStage(match: any) {
  return String(match.groupPhase || match.stage || '').toUpperCase().includes('GROUP');
}

function elapsedMinutes(match: any, now = new Date()) {
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now.getTime() - matchTime) / 60_000);
}

function isStaleLive(match: any, now = new Date()) {
  const status = matchStatusValue(match);
  if (!LIVE_STATUSES.includes(status)) return false;
  const elapsed = elapsedMinutes(match, now);
  if (elapsed === null) return false;
  return elapsed >= (isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES);
}

function isFinishedMatch(match: any, now = new Date()) {
  const status = matchStatusValue(match);
  return FINISHED_STATUSES.includes(status) || Boolean(match.isStaleAutoFinished) || isStaleLive(match, now);
}

function statusInfo(match: any) {
  const value = matchStatusValue(match);
  if (isFinishedMatch(match)) return { label: 'انتهت', className: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]', icon: CheckCircle2 };
  if (LIVE_STATUSES.includes(value)) return { label: value === 'HT' ? 'استراحة' : 'مباشرة الآن', className: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]', icon: Activity };
  return { label: match.matchDate ? formatCountdown(match.matchDate) || 'قادمة' : 'قادمة', className: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]', icon: Clock };
}

function teamFlagUrl(asset: any) {
  return getTeamFlagUrl({ code: asset?.code, name: asset?.name, image: asset?.image, continent: asset?.continent }, 128);
}

function teamName(asset: any, fallback: string) {
  return asset?.name || fallback;
}

function teamCode(asset: any) {
  return asset?.code || asset?.name?.slice?.(0, 3) || '---';
}

function teamImage(asset: any, fallback: string) {
  const src = teamFlagUrl(asset);
  if (src) return <img src={src} alt={`علم ${teamName(asset, fallback)}`} className="h-full w-full object-cover" loading="lazy" />;
  return <span className="text-sm font-black text-[#FFD700]">{teamCode(asset)}</span>;
}

function groupLabel(match: any) {
  return match.groupPhase || match.stage || 'كأس العالم 2026';
}

function RtlScore({ homeScore, awayScore }: { homeScore?: number | null; awayScore?: number | null }) {
  return <span className="inline-flex items-center gap-1.5 tabular-nums" dir="rtl"><span>{formatScoreNumber(homeScore)}</span><span className="text-[#FFD700]/70">-</span><span>{formatScoreNumber(awayScore)}</span></span>;
}

async function getMatch(id: string) {
  return prisma.match.findUnique({ where: { id }, include: { homeTeam: true, awayTeam: true } });
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const status = statusInfo(match);
  const StatusIcon = status.icon;
  const rawStatus = matchStatusValue(match);
  const finished = isFinishedMatch(match);
  const showScore = finished || !NOT_STARTED_STATUSES.includes(rawStatus);
  const animationMatchId = match.animationMatchId ? String(match.animationMatchId) : '';

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-white sm:px-6 sm:py-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 sm:px-4">
          <Link href="/matches" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-black text-gray-300 transition hover:border-[#0FF0FC]/30 hover:text-white">
            <ArrowLeft size={16} /> العودة إلى المباريات
          </Link>
          <span className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-2 text-[11px] font-black text-[#FFD700]">البث التفاعلي</span>
        </div>

        <section className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.10),transparent_34%),linear-gradient(145deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur sm:rounded-[2rem] sm:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/55 to-transparent opacity-70" />
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1.5 text-center text-[11px] font-black text-[#FFD700]">{groupLabel(match)}</span>
            <span className={`min-w-0 truncate rounded-full border px-3 py-1.5 text-center text-[11px] font-black ${status.className}`}><StatusIcon size={13} className="inline" /> {status.label}</span>
            <span className="col-span-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-center text-[11px] font-black text-gray-300 sm:col-span-1">{formatDate(match.matchDate)}</span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">
            <TeamBlock asset={match.homeTeam} align="right" fallback="الفريق الأول" />
            <div className="flex flex-col items-center gap-2">
              <div className={`flex min-h-16 min-w-20 items-center justify-center rounded-2xl border px-3 text-lg font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-20 sm:min-w-28 sm:px-5 sm:text-3xl ${showScore ? 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' : 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]'}`}>{showScore ? <RtlScore homeScore={match.homeScore} awayScore={match.awayScore} /> : 'VS'}</div>
              <span className="hidden rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-bold text-gray-400 sm:inline-flex">{rawStatus || 'SCHEDULED'}</span>
            </div>
            <TeamBlock asset={match.awayTeam} align="left" fallback="الفريق الثاني" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <InfoTile icon={<CalendarDays size={16} />} label="الموعد" value={formatShortDate(match.matchDate)} />
            <InfoTile icon={<Shield size={16} />} label="المرحلة" value={groupLabel(match)} />
            <InfoTile icon={<StatusIcon size={16} />} label="الحالة" value={status.label} />
            <InfoTile icon={<Radio size={16} />} label="البث" value={match.animationMatchId ? 'متاح' : 'غير متاح'} />
          </div>
        </section>

        <Panel id="live-broadcast" title="البث التفاعلي" icon={<Radio className="text-[#FFD700]" />}>
          <InternalAnimationPlayer matchId={animationMatchId} dbMatchId={match.id} />
        </Panel>
      </section>
    </main>
  );
}

function TeamBlock({ asset, align, fallback }: { asset: any; align: 'right' | 'left'; fallback: string }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className="mb-2 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.24)] sm:h-20 sm:w-20"><div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[0.9rem] bg-black/25">{teamImage(asset, fallback)}</div></div>
      <h2 className="truncate text-sm font-black text-white sm:text-xl">{teamName(asset, fallback)}</h2>
      <p className="mt-1 text-[11px] font-bold text-gray-500 sm:text-xs">{teamCode(asset)}</p>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-black text-gray-500"><span className="text-[#0FF0FC]">{icon}</span>{label}</div><div className="truncate text-xs font-black text-white sm:text-sm">{value}</div></div>;
}

function Panel({ id, title, icon, children }: { id?: string; title: string; icon?: ReactNode; children: ReactNode }) {
  return <section id={id} className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-3 shadow-card sm:rounded-[1.5rem] sm:p-5"><div className="mb-4 flex items-center justify-between gap-4"><h3 className="flex min-w-0 items-center gap-2 text-base font-black text-white sm:text-xl">{icon}{title}</h3></div>{children}</section>;
}
