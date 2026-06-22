import prisma from '@/lib/prisma';
import type { MatchStatusView } from './types';

type ClockRow = {
  matchId: string;
  status: string;
  period: string;
  providerStatus: string | null;
  providerMinute: number | null;
  displayMinute: string | null;
  periodStartedAt: Date | null;
  lastConfirmedAt: Date | null;
  source: string;
  confidence: string;
  note: string | null;
  updatedAt: Date;
};

let tablesReady: Promise<void> | null = null;

function normalize(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function arMinute(value: number) {
  return `${new Intl.NumberFormat('ar-EG').format(value)}'`;
}

function clampMinute(period: string, minute: number) {
  if (period === 'FIRST_HALF') return Math.max(1, Math.min(60, minute));
  if (period === 'SECOND_HALF') return Math.max(46, Math.min(120, minute));
  if (period === 'EXTRA_TIME') return Math.max(91, Math.min(130, minute));
  return Math.max(1, Math.min(130, minute));
}

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MatchClockState" (
      "matchId" TEXT PRIMARY KEY,
      "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
      "period" TEXT NOT NULL DEFAULT 'SCHEDULED',
      "providerStatus" TEXT,
      "providerMinute" INTEGER,
      "displayMinute" TEXT,
      "periodStartedAt" TIMESTAMP(3),
      "lastConfirmedAt" TIMESTAMP(3),
      "source" TEXT NOT NULL DEFAULT 'DATABASE',
      "confidence" TEXT NOT NULL DEFAULT 'low',
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchClockState_status_idx" ON "MatchClockState" ("status")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchClockState_lastConfirmedAt_idx" ON "MatchClockState" ("lastConfirmedAt")');
}

export async function getMatchClockState(matchId: string) {
  tablesReady ||= ensureTables();
  await tablesReady;
  const rows = await prisma.$queryRawUnsafe<ClockRow[]>(
    'SELECT * FROM "MatchClockState" WHERE "matchId" = $1 LIMIT 1',
    matchId,
  );
  return rows[0] || null;
}

export function applyClockStateToStatus(fallback: MatchStatusView, clock: ClockRow | null): MatchStatusView {
  if (!clock) {
    if (fallback.isFinished) return fallback;
    return {
      raw: fallback.raw || 'SCHEDULED',
      kind: 'scheduled',
      label: 'لم تبدأ',
      shortLabel: 'لم تبدأ',
      minute: null,
      isLive: false,
      isFinished: false,
      isScheduled: true,
    };
  }

  const status = normalize(clock.status);
  const period = normalize(clock.period);
  const confirmedAt = clock.lastConfirmedAt ? new Date(clock.lastConfirmedAt).getTime() : null;
  const baseMinute = typeof clock.providerMinute === 'number' ? clock.providerMinute : null;
  const stale = confirmedAt ? Date.now() - confirmedAt > 5 * 60_000 : false;
  const liveMinute = baseMinute === null ? null : clampMinute(period, stale ? baseMinute : baseMinute + Math.max(0, Math.floor((Date.now() - (confirmedAt || Date.now())) / 60_000)));
  const minuteLabel = clock.displayMinute || (liveMinute ? arMinute(liveMinute) : null);

  if (status === 'FINISHED' || status === 'FINAL_CONFIRMED' || period === 'FINISHED') {
    return { raw: status || period, kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false };
  }
  if (period === 'HALF_TIME' || status === 'HALF_TIME') {
    return { raw: status || period, kind: 'halftime', label: 'استراحة بين الشوطين مؤكدة', shortLabel: 'استراحة', minute: null, isLive: false, isFinished: false, isScheduled: false };
  }
  if (['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME', 'PENALTIES'].includes(period) || status === 'LIVE') {
    const phase = period === 'FIRST_HALF' ? 'الشوط الأول' : period === 'SECOND_HALF' ? 'الشوط الثاني' : period === 'EXTRA_TIME' ? 'وقت إضافي' : period === 'PENALTIES' ? 'ركلات الترجيح' : 'مباشرة الآن';
    const suffix = stale && baseMinute !== null ? ' · بانتظار تأكيد جديد' : '';
    return { raw: status || period, kind: 'live', label: minuteLabel ? `${phase} ${minuteLabel}${suffix}` : phase, shortLabel: phase, minute: liveMinute, isLive: true, isFinished: false, isScheduled: false };
  }
  if (status === 'POSTPONED' || status === 'CANCELLED' || period === 'POSTPONED') {
    return { raw: status || period, kind: 'delayed', label: 'المباراة مؤجلة أو غير مؤكدة', shortLabel: 'غير مؤكدة', minute: null, isLive: false, isFinished: false, isScheduled: false };
  }
  return { raw: status || period || 'SCHEDULED', kind: 'scheduled', label: 'لم تبدأ', shortLabel: 'لم تبدأ', minute: null, isLive: false, isFinished: false, isScheduled: true };
}

export function clockView(clock: ClockRow | null, status: MatchStatusView) {
  return {
    status: clock?.status || status.raw,
    period: clock?.period || (status.isScheduled ? 'SCHEDULED' : status.raw),
    displayLabel: status.label,
    minute: status.minute,
    source: clock?.source || 'DATABASE',
    confidence: clock?.confidence || (clock ? 'medium' : 'low'),
    lastConfirmedAt: clock?.lastConfirmedAt ? new Date(clock.lastConfirmedAt).toISOString() : null,
    note: clock?.note || (clock ? null : 'لا يتم تقدير زمن المباراة من موعد البداية. ننتظر تأكيدًا محفوظًا في قاعدة البيانات.'),
  };
}
