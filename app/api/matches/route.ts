import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE', 'HT'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const STALE_FINAL_SNAPSHOT_MS = 7 * 60 * 1000;
const FINAL_MINUTE_FLOOR = 85;
const FINAL_LOCAL_MINUTE_FALLBACK = 100;

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

function safeKickoffMinute(match: any, now = Date.now()) {
  const minute = minutesFromKickoff(match, now);
  if (minute === null || minute < 1) return null;
  return Math.max(1, Math.min(maxLiveMinutes(match), minute));
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

function isStaleByTime(match: any, now = Date.now()) {
  const minute = minutesFromKickoff(match, now);
  if (minute === null) return false;
  return minute >= maxLiveMinutes(match);
}

function isFinalSnapshotStale(match: any, now = Date.now()) {
  const minute = Number(match.latestStatsMinute);
  const capturedAt = match.latestStatsCapturedAt ? new Date(match.latestStatsCapturedAt).getTime() : NaN;
  if (!Number.isFinite(minute) || minute < FINAL_MINUTE_FLOOR || !Number.isFinite(capturedAt)) return false;
  return now - capturedAt >= STALE_FINAL_SNAPSHOT_MS;
}

function isFinishedByNoProviderFallback(match: any, now = Date.now()) {
  const status = normalizeStatus(match.status);
  if (status !== 'IN_PLAY' && status !== 'LIVE') return false;
  const minute = minutesFromKickoff(match, now);
  return minute !== null && minute >= FINAL_LOCAL_MINUTE_FALLBACK;
}

function isLikelyLiveByTime(match: any, now = Date.now()) {
  if (isOfficialFinished(match) || isFinalSnapshotStale(match, now) || isFinishedByNoProviderFallback(match, now)) return false;
  if (!isScheduledStatus(match.status)) return false;
  const minute = minutesFromKickoff(match, now);
  if (minute === null) return false;
  return minute >= 1 && minute < maxLiveMinutes(match);
}

function normalizeMatchForDisplay(match: any, now = Date.now()) {
  const status = normalizeStatus(match.status);
  const minute = minutesFromKickoff(match, now);
  const shouldAutoFinish = isStaleByTime(match, now) || isFinalSnapshotStale(match, now) || isFinishedByNoProviderFallback(match, now);

  if (isOfficialFinished(match)) {
    return {
      ...match,
      displayStatus: 'FINISHED',
      isLiveNow: false,
      isLikelyLiveByTime: false,
      minute: null,
      liveLabel: null,
    };
  }

  if ((isLiveStatus(status) || isScheduledStatus(status)) && shouldAutoFinish) {
    return {
      ...match,
      status: 'FINISHED',
      displayStatus: 'FINISHED',
      isLiveNow: false,
      isLikelyLiveByTime: false,
      isStaleAutoFinished: true,
      minute: null,
      liveLabel: null,
    };
  }

  if (isLikelyLiveByTime(match, now)) {
    const safeMinute = minute ? Math.max(1, Math.min(maxLiveMinutes(match), minute)) : null;
    return {
      ...match,
      displayStatus: 'IN_PLAY',
      isLiveNow: true,
      isLikelyLiveByTime: true,
      minute: safeMinute,
      liveLabel: safeMinute ? `الدقيقة ${safeMinute}` : 'مباشر الآن',
      minuteSource: 'kickoff_time',
    };
  }

  if (isLiveStatus(status)) {
    const safeMinute = safeKickoffMinute(match, now);
    return {
      ...match,
      displayStatus: status,
      isLiveNow: true,
      isLikelyLiveByTime: false,
      minute: safeMinute ?? match.minute ?? null,
      liveLabel: safeMinute ? `الدقيقة ${safeMinute}` : match.liveLabel || 'مباشر الآن',
      minuteSource: safeMinute ? 'kickoff_time' : 'snapshot',
    };
  }

  return match;
}

function rankMatch(match: any) {
  const status = normalizeStatus(match.displayStatus || match.status);
  const statusRank = isOfficialFinished(match) ? 30 : status === 'IN_PLAY' || status === 'LIVE' || status === 'HT' || status === '1H' || status === '2H' ? 50 : 10;
  const animationRank = match.animationMatchId ? 20 : 0;
  const externalRank = match.externalId ? 5 : 0;
  return statusRank + animationRank + externalRank;
}

function dedupeMatches(matches: any[]) {
  const now = Date.now();
  const normalizedMatches = matches.map((match) => normalizeMatchForDisplay(match, now));
  const byExact = new Map<string, any>();
  for (const match of normalizedMatches) {
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

type SnapshotState = { minute: number; capturedAt: Date };

async function latestDocumentedSnapshots(matchIds: string[]) {
  if (matchIds.length === 0) return new Map<string, SnapshotState>();

  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      matchId: { in: matchIds },
      minute: { not: null },
    },
    select: {
      matchId: true,
      minute: true,
      capturedAt: true,
    },
    orderBy: { capturedAt: 'desc' },
  });

  const latestByMatch = new Map<string, SnapshotState>();
  for (const snapshot of snapshots) {
    if (latestByMatch.has(snapshot.matchId)) continue;
    const minute = validMinute(snapshot.minute);
    if (minute !== null) latestByMatch.set(snapshot.matchId, { minute, capturedAt: snapshot.capturedAt });
  }
  return latestByMatch;
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: { matchDate: 'asc' },
    });

    const documentedSnapshots = await latestDocumentedSnapshots(matches.map((match) => match.id));
    const now = Date.now();
    const enrichedMatches = matches.map((match) => {
      const snapshot = documentedSnapshots.get(match.id);
      const matchWithSnapshot = snapshot ? { ...match, latestStatsMinute: snapshot.minute, latestStatsCapturedAt: snapshot.capturedAt } : match;
      const kickoffMinute = safeKickoffMinute(matchWithSnapshot, now);
      const liveByStatusOrTime = isLiveStatus(matchWithSnapshot.status) || isLikelyLiveByTime(matchWithSnapshot, now);
      if (liveByStatusOrTime && kickoffMinute !== null && !isOfficialFinished(matchWithSnapshot) && !isStaleByTime(matchWithSnapshot, now)) {
        return { ...matchWithSnapshot, minute: kickoffMinute, displayStatus: 'IN_PLAY', isLiveNow: true, liveLabel: `الدقيقة ${kickoffMinute}`, minuteSource: 'kickoff_time' };
      }
      const canUseLiveSnapshot = snapshot && !isOfficialFinished(matchWithSnapshot) && !isStaleByTime(matchWithSnapshot, now) && !isFinalSnapshotStale(matchWithSnapshot, now);
      return canUseLiveSnapshot ? { ...matchWithSnapshot, minute: snapshot.minute, displayStatus: 'IN_PLAY', isLiveNow: true, liveLabel: `الدقيقة ${snapshot.minute}`, minuteSource: 'snapshot' } : matchWithSnapshot;
    });

    return NextResponse.json(dedupeMatches(enrichedMatches), { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
