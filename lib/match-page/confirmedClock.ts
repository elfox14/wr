import type { MatchEventView, MatchStatusView } from './types';
import { asObject, FINISHED_STATUSES, HALF_TIME_STATUSES, LIVE_STATUSES, normalizeStatusValue, rawData, toNumber } from './normalizers';

type SnapshotLike = { minute?: number | null; capturedAt?: Date | string | null; provider?: string | null; rawData?: any };

type ClockEvidence = {
  raw: string;
  minute: number | null;
  source: string;
  capturedAt: number;
};

function statusFromText(value: unknown, minute: number | null) {
  const raw = normalizeStatusValue(String(value || ''));
  if (!raw && minute !== null) return minute >= 46 ? '2H' : '1H';
  if (['FIRST_HALF', 'FIRST', '1ST_HALF', '1H'].includes(raw)) return '1H';
  if (['SECOND_HALF', 'SECOND', '2ND_HALF', '2H'].includes(raw)) return '2H';
  if (raw.includes('HALF') && raw.includes('TIME')) return 'HT';
  if (raw.includes('FINISH') || raw === 'FT' || raw === 'ENDED' || raw === 'COMPLETED') return 'FINISHED';
  if (raw === 'LIVE' || raw === 'IN_PLAY') return minute && minute >= 46 ? '2H' : '1H';
  return raw || '';
}

function minuteFromSnapshot(snapshot: SnapshotLike) {
  const data = rawData(snapshot);
  const meta = asObject(data.meta);
  const flashMeta = asObject(data.flashMeta);
  const nestedFlashMeta = asObject(data.flash?.meta);
  return toNumber(snapshot.minute ?? data.minute ?? data.elapsed ?? meta.minute ?? meta.elapsed ?? flashMeta.minute ?? flashMeta.elapsed ?? nestedFlashMeta.minute ?? nestedFlashMeta.elapsed);
}

function evidenceFromSnapshot(snapshot: SnapshotLike): ClockEvidence | null {
  const data = rawData(snapshot);
  const meta = asObject(data.meta);
  const flashMeta = asObject(data.flashMeta);
  const nestedFlashMeta = asObject(data.flash?.meta);
  const minute = minuteFromSnapshot(snapshot);
  const raw = statusFromText(data.status ?? data.providerStatus ?? data.matchState ?? meta.status ?? meta.matchState ?? flashMeta.matchState ?? nestedFlashMeta.matchState, minute);
  if (!raw && minute === null) return null;
  return {
    raw: raw || (minute !== null ? (minute >= 46 ? '2H' : '1H') : ''),
    minute,
    source: String(snapshot.provider || 'DB_SNAPSHOT'),
    capturedAt: snapshot.capturedAt ? new Date(snapshot.capturedAt).getTime() : 0,
  };
}

function latestEventMinute(events: MatchEventView[]) {
  const minutes = events.map((event) => toNumber(event.minute)).filter((value): value is number => value !== null);
  return minutes.length ? Math.max(...minutes) : null;
}

function statusView(raw: string, minute: number | null): MatchStatusView {
  const value = normalizeStatusValue(raw || 'SCHEDULED');
  if (FINISHED_STATUSES.includes(value) || value === 'FINISHED') {
    return { raw: value, kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false };
  }
  if (HALF_TIME_STATUSES.includes(value) || value === 'HT') {
    return { raw: value, kind: 'halftime', label: 'استراحة بين الشوطين', shortLabel: 'استراحة', minute: null, isLive: false, isFinished: false, isScheduled: false };
  }
  if (LIVE_STATUSES.includes(value) || value === '1H' || value === '2H') {
    const label = value === '2H' ? 'الشوط الثاني' : value === 'ET' ? 'وقت إضافي' : 'الشوط الأول';
    return { raw: value, kind: 'live', label, shortLabel: label, minute, isLive: true, isFinished: false, isScheduled: false };
  }
  return { raw: value || 'SCHEDULED', kind: 'scheduled', label: 'لم تبدأ', shortLabel: 'لم تبدأ', minute: null, isLive: false, isFinished: false, isScheduled: true };
}

export function buildConfirmedStatusView(match: any, snapshots: SnapshotLike[], events: MatchEventView[]): MatchStatusView {
  const matchStatus = normalizeStatusValue(match?.status || 'SCHEDULED');
  if (FINISHED_STATUSES.includes(matchStatus)) return statusView('FINISHED', null);
  if (HALF_TIME_STATUSES.includes(matchStatus)) return statusView('HT', null);

  const evidence = snapshots
    .map(evidenceFromSnapshot)
    .filter(Boolean)
    .sort((a, b) => (b!.capturedAt || 0) - (a!.capturedAt || 0))[0] as ClockEvidence | undefined;

  if (evidence) {
    const minute = evidence.minute ?? latestEventMinute(events);
    return statusView(evidence.raw, minute);
  }

  // Critical rule: never start the match clock from matchDate alone.
  // Without provider/event confirmation, keep the match scheduled/pending.
  return statusView(matchStatus, null);
}
