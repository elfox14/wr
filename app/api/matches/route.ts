import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const FIRST_HALF_FALLBACK_CAP = 50;
const DEFAULT_PROVIDER_SNAPSHOT_TTL_SECONDS = 5 * 60;

type SnapshotState = { minute: number | null; capturedAt: Date; providerStatus?: string | null };

function providerSnapshotTtlMs() {
  const seconds = Number(process.env.MATCH_PROVIDER_SNAPSHOT_TTL_SECONDS || DEFAULT_PROVIDER_SNAPSHOT_TTL_SECONDS);
  return Math.max(60, Number.isFinite(seconds) ? Math.floor(seconds) : DEFAULT_PROVIDER_SNAPSHOT_TTL_SECONDS) * 1000;
}

function dayHourKey(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown-time';
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function teamsKey(match: any) {
  const ids = [match.homeTeamId || match.homeTeam?.id, match.awayTeamId || match.awayTeam?.id].filter(Boolean).map(String).sort();
  return ids.length === 2 ? ids.join(':') : `${match.homeTeam?.name || 'home'}:${match.awayTeam?.name || 'away'}`.toLowerCase();
}

function dedupeKey(match: any) {
  if (match.animationMatchId) return `animation:${match.animationMatchId}`;
  return `teams:${teamsKey(match)}:${dayHourKey(match.matchDate)}`;
}

function duplicateFamilyKey(match: any) {
  return `teams:${teamsKey(match)}:${dayHourKey(match.matchDate)}`;
}

function normalizeStatus(value?: string | null) {
  return String(value || '').toUpperCase();
}

function isGroupStage(match: any) {
  const value = String(match.groupPhase || match.group || match.stage || '').toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: any) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function minutesFromKickoff(match: any, now = Date.now()) {
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now - matchTime) / 60_000) + 1;
}

function isOfficialFinished(match: any) {
  const status = normalizeStatus(match.status);
  const displayStatus = normalizeStatus(match.displayStatus);
  return FINISHED_STATUSES.includes(status) || FINISHED_STATUSES.includes(displayStatus);
}

function isScheduledStatus(status?: string | null) {
  return SCHEDULED_STATUSES.includes(normalizeStatus(status));
}

function isLiveStatus(status?: string | null) {
  return LIVE_STATUSES.includes(normalizeStatus(status));
}

function isHalfTimeStatus(status?: string | null) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(status));
}

function isSecondHalfStatus(status?: string | null) {
  const value = normalizeStatus(status);
  return value === '2H' || value === 'ET';
}

function isFreshProviderSnapshot(snapshot: SnapshotState | undefined, now = Date.now()) {
  if (!snapshot?.capturedAt) return false;
  const capturedAt = new Date(snapshot.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return false;
  return now - capturedAt <= providerSnapshotTtlMs();
}

function halftimeDisplay(match: any) {
  return {
    ...match,
    displayStatus: 'HT',
    isLiveNow: true,
    isHalfTime: true,
    isLikelyLiveByTime: false,
    minute: null,
    liveLabel: 'استراحة',
    minuteSource: 'provider_status',
  };
}

function displayMinute(match: any, snapshot: SnapshotState | undefined) {
  const status = normalizeStatus(match.status);
  const snapshotMinute = snapshot?.minute || Number(match.latestStatsMinute) || null;
  if (!snapshotMinute || !Number.isFinite(snapshotMinute)) return null;

  if (isSecondHalfStatus(status)) return Math.min(Math.max(46, snapshotMinute), maxLiveMinutes(match));
  if (status === '1H') return Math.min(snapshotMinute, FIRST_HALF_FALLBACK_CAP);
  if (status === 'IN_PLAY' || status === 'LIVE') return Math.min(snapshotMinute, maxLiveMinutes(match));
  return Math.min(snapshotMinute, maxLiveMinutes(match));
}

function livePhaseLabel(status: string) {
  const value = normalizeStatus(status);
  if (isHalfTimeStatus(value)) return 'استراحة';
  return 'جارية الآن';
}

function effectiveProviderStatus(matchStatus: string, snapshot?: SnapshotState) {
  const snapshotStatus = normalizeStatus(snapshot?.providerStatus);
  if (snapshotStatus) return snapshotStatus === 'PAUSED' ? 'HT' : snapshotStatus;
  return matchStatus;
}

function normalizeMatchForDisplay(match: any, now = Date.now(), snapshot?: SnapshotState) {
  const status = normalizeStatus(match.status);
  const freshSnapshot = isFreshProviderSnapshot(snapshot, now) ? snapshot : undefined;
  const providerStatus = effectiveProviderStatus(status, freshSnapshot);
  const snapshotMinute = freshSnapshot?.minute || null;
  const snapshotConfirmsLive = Boolean(snapshotMinute && snapshotMinute > 0 && snapshotMinute < maxLiveMinutes(match));

  if (isOfficialFinished(match) || FINISHED_STATUSES.includes(providerStatus)) {
    return { ...match, displayStatus: 'FINISHED', isLiveNow: false, isLikelyLiveByTime: false, minute: null, liveLabel: null, minuteSource: 'provider_status' };
  }

  if (isHalfTimeStatus(providerStatus)) return halftimeDisplay(match);

  if (isLiveStatus(providerStatus) || snapshotConfirmsLive) {
    const effectiveStatus = isScheduledStatus(status) && snapshotConfirmsLive
      ? snapshotMinute && snapshotMinute >= 46 ? '2H' : '1H'
      : providerStatus;
    return {
      ...match,
      displayStatus: effectiveStatus,
      isLiveNow: true,
      isLikelyLiveByTime: false,
      isHalfTime: false,
      minute: null,
      liveLabel: livePhaseLabel(effectiveStatus),
      minuteSource: freshSnapshot ? 'provider_snapshot_hidden' : 'provider_status_hidden',
    };
  }

  if (isScheduledStatus(status) && minutesFromKickoff(match, now) !== null && (minutesFromKickoff(match, now) || 0) >= 1) {
    return {
      ...match,
      displayStatus: 'SCHEDULED',
      isLiveNow: false,
      isLikelyLiveByTime: false,
      minute: null,
      liveLabel: 'بانتظار تأكيد البداية',
      minuteSource: null,
    };
  }

  return { ...match, isLiveNow: false, isLikelyLiveByTime: false, minute: null, liveLabel: null, minuteSource: null };
}

function rankMatch(match: any) {
  const status = normalizeStatus(match.displayStatus || match.status);
  const statusRank = isOfficialFinished(match) ? 30 : status === 'IN_PLAY' || status === 'LIVE' || status === 'HT' || status === '1H' || status === '2H' ? 50 : 10;
  const animationRank = match.animationMatchId ? 20 : 0;
  const externalRank = match.externalId ? 5 : 0;
  return statusRank + animationRank + externalRank;
}

function dedupeMatches(matches: any[]) {
  const byExact = new Map<string, any>();
  for (const match of matches) {
    const key = dedupeKey(match);
    const previous = byExact.get(key);
    if (!previous || rankMatch(match) > rankMatch(previous)) byExact.set(key, match);
  }

  const byFamily = new Map<string, any>();
  for (const match of byExact.values()) {
    const key = duplicateFamilyKey(match);
    const previous = byFamily.get(key);
    if (!previous || rankMatch(match) > rankMatch(previous)) byFamily.set(key, match);
  }

  return Array.from(byFamily.values()).sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
}

function validMinute(value: unknown) {
  const minute = Number(value);
  if (!Number.isFinite(minute) || minute <= 0) return null;
  return Math.max(1, Math.min(130, Math.floor(minute)));
}

function snapshotProviderStatus(rawData: unknown) {
  const raw = rawData as any;
  return raw?.providerStatus || raw?.status || raw?.fixture?.status?.short || raw?.fixture?.status?.long || null;
}

async function latestDocumentedSnapshots(matchIds: string[]) {
  if (matchIds.length === 0) return new Map<string, SnapshotState>();

  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, minute: true, capturedAt: true, rawData: true },
    orderBy: { capturedAt: 'desc' },
  });

  const latestByMatch = new Map<string, SnapshotState>();
  for (const snapshot of snapshots) {
    if (latestByMatch.has(snapshot.matchId)) continue;
    latestByMatch.set(snapshot.matchId, { minute: validMinute(snapshot.minute), capturedAt: snapshot.capturedAt, providerStatus: snapshotProviderStatus(snapshot.rawData) });
  }
  return latestByMatch;
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      include: { homeTeam: true, awayTeam: true },
      orderBy: { matchDate: 'asc' },
    });

    const documentedSnapshots = await latestDocumentedSnapshots(matches.map((match) => match.id));
    const now = Date.now();
    const enrichedMatches = matches.map((match) => {
      const snapshot = documentedSnapshots.get(match.id);
      const freshSnapshot = isFreshProviderSnapshot(snapshot, now) ? snapshot : undefined;
      const matchWithSnapshot = freshSnapshot ? { ...match, latestStatsMinute: freshSnapshot.minute, latestStatsCapturedAt: freshSnapshot.capturedAt } : match;
      return normalizeMatchForDisplay(matchWithSnapshot, now, freshSnapshot);
    });

    return NextResponse.json(dedupeMatches(enrichedMatches), { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
