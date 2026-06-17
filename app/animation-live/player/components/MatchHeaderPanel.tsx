'use client';

import type { LiveStatsResponse } from '../types';
import { ar, formatMatchDate, formatUpdatedAt, sourceLabel } from '../formatters';
import { displayMatchStatus, isFinishedStatus, isHalfTimeStatus, normalizeStatus } from '../statusUtils';
import TeamName from './TeamName';

type ClockSource = 'live_stats' | 'cached' | 'final_elapsed' | 'final_event' | 'unavailable';

type MatchHeaderPanelProps = {
  match?: LiveStatsResponse['match'];
  provider?: string | null;
  updatedAt?: string | null;
  currentMinute?: number | null;
  clockSource?: ClockSource;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

function statusClass(status?: string | null) {
  const value = normalizeStatus(status);
  if (isFinishedStatus(value)) return 'border-white/10 bg-white/10 text-gray-300';
  if (isHalfTimeStatus(value)) return 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]';
  if (['IN_PLAY', 'LIVE', '1H', '2H', 'ET'].includes(value)) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  return 'border-white/10 bg-black/30 text-gray-400';
}

function safeMinute(currentMinute?: number | null) {
  if (typeof currentMinute !== 'number' || !Number.isFinite(currentMinute)) return null;
  return Math.max(0, Math.floor(currentMinute));
}

function minuteLabel(minute: number | null) {
  return minute !== null && minute > 0 ? `د${ar(minute)}` : '—';
}

function firstHalfHint(minute: number | null) {
  if (minute !== null && minute > 0 && minute <= 5) return 'بداية الشوط الأول';
  return 'الشوط الأول بدأ';
}

function secondHalfHint(minute: number | null) {
  if (minute !== null && minute >= 46 && minute <= 50) return 'بداية الشوط الثاني';
  return 'الشوط الثاني';
}

function clockInfo(status?: string | null, currentMinute?: number | null) {
  const value = normalizeStatus(status);
  const minute = safeMinute(currentMinute);
  const scheduledStatus = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(value);
  const liveStatus = ['IN_PLAY', 'LIVE', '1H', '2H', 'ET'].includes(value);

  if (scheduledStatus) {
    return { label: 'لم تبدأ', hint: 'بانتظار صافرة البداية', active: false };
  }

  if (isHalfTimeStatus(value)) {
    const stoppedAt = minute ? `توقفت عند د${ar(Math.max(minute, 45))}` : 'استراحة بين الشوطين';
    return { label: 'نهاية الشوط الأول', hint: stoppedAt, active: false };
  }

  if (isFinishedStatus(value)) {
    return minute
      ? { label: minuteLabel(minute), hint: `انتهت عند د${ar(minute)}`, active: false }
      : { label: 'انتهت', hint: 'المباراة انتهت', active: false };
  }

  if (value === 'ET') {
    return { label: minute ? `د${ar(minute)}` : 'وقت إضافي', hint: 'وقت إضافي', active: true };
  }

  if (value === '2H' || (minute !== null && minute >= 46)) {
    return { label: minuteLabel(minute), hint: secondHalfHint(minute), active: true };
  }

  if (value === '1H' || liveStatus || (minute !== null && minute >= 1)) {
    return { label: minuteLabel(minute), hint: firstHalfHint(minute), active: true };
  }

  return { label: '—', hint: 'زمن المباراة غير متوفر بعد', active: false };
}

export default function MatchHeaderPanel({ match, provider, updatedAt, currentMinute, clockSource, loading = false, error, onRefresh }: MatchHeaderPanelProps) {
  const homeTeam = match?.homeTeam || null;
  const awayTeam = match?.awayTeam || null;
  const homeScore = match?.homeScore ?? 0;
  const awayScore = match?.awayScore ?? 0;
  const status = match?.status;
  const clock = clockInfo(status, currentMinute);
  const diagnosticClockMinute = safeMinute(currentMinute);

  return (
    <section
      className="order-1 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 md:rounded-[32px]"
      data-clock-source={clockSource || 'unavailable'}
      data-clock-minute={diagnosticClockMinute ?? undefined}
    >
      <div className="border-b border-white/10 bg-black/30 px-3 py-3 md:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-black uppercase tracking-[0.16em] text-gray-500 sm:text-[10px] sm:tracking-[0.24em]">
            <span className="text-[#FFD700]">مركز المباراة المباشر</span>
            <span>•</span>
            <span className="truncate">{sourceLabel(provider)}</span>
            <span>•</span>
            <span>آخر تحديث {formatUpdatedAt(updatedAt)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
            <span className={`flex items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(status)}`}>
              {displayMatchStatus(status)}
            </span>
            <span className={`flex items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-black ${clock.active ? 'border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/10 bg-black/30 text-gray-400'}`} title={clock.hint}>
              زمن المباراة: {clock.label}
            </span>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="col-span-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-300 transition hover:border-[#0FF0FC]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
              >
                {loading ? 'جاري التحديث...' : 'تحديث'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:p-5">
        <TeamName team={homeTeam} fallback="الفريق الأول" align="right" />

        <div className="rounded-3xl border border-[#FFD700]/20 bg-black/40 px-4 py-3 text-center shadow-xl shadow-black/30 sm:px-6 sm:py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500 sm:tracking-[0.28em]">النتيجة</div>
          <div className="mt-1 text-3xl font-black text-white sm:text-4xl md:text-5xl">
            <span className="text-[#FFD700]">{ar(homeScore)}</span>
            <span className="px-3 text-gray-500">-</span>
            <span className="text-[#0FF0FC]">{ar(awayScore)}</span>
          </div>
          <div className="mt-2 text-[10px] font-bold text-gray-500">{formatMatchDate(match?.matchDate)}</div>
          <div className="mt-2 text-[10px] font-black text-[#FFD700]" title={clock.hint}>{clock.hint}</div>
        </div>

        <TeamName team={awayTeam} fallback="الفريق الثاني" align="left" />
      </div>

      {error ? (
        <div className="border-t border-red-400/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-200 md:px-5">
          {error}
        </div>
      ) : null}
    </section>
  );
}
