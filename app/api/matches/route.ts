import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;

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
  return FINISHED_STATUSES.includes(normalizeStatus(match.status || match.displayStatus));
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

function isLikelyLiveByTime(match: any, now = Date.now()) {
  if (isOfficialFinished(match)) return false;
  if (!isScheduledStatus(match.status)) return false;
  const minute = minutesFromKickoff(match, now);
  if (minute === null) return false;
  return minute >= 1 && minute < maxLiveMinutes(match);
}

function normalizeMatchForDisplay(match: any, now = Date.now()) {
  const status = normalizeStatus(match.status);
  const minute = minutesFromKickoff(match, now);

  if (!isOfficialFinished(match) && (isLiveStatus(status) || isScheduledStatus(status)) && isStaleByTime(match, now)) {
    return {
      ...match,
      status: 'FINISHED',
      displayStatus: 'FINISHED',
      isLiveNow: false,
      isLikelyLiveByTime: false,
      isStaleAutoFinished: true,
    };
  }

  if (isLikelyLiveByTime(match, now)) {
    const safeMinute = minute ? Math.max(1, Math.min(130, minute)) : null;
    return {
      ...match,
      displayStatus: 'IN_PLAY',
      isLiveNow: true,
      isLikelyLiveByTime: true,
      minute: safeMinute,
      liveLabel: safeMinute ? `الدقيقة ${safeMinute}` : 'مباشر الآن',
    };
  }

  if (isLiveStatus(status)) {
    return {
      ...match,
      displayStatus: status,
      isLiveNow: true,
      isLikelyLiveByTime: false,
    };
  }

  return match;
}

function rankMatch(match: any) {
  const status = normalizeStatus(match.displayStatus || match.status);
  const statusRank = status === 'IN_PLAY' || status === 'LIVE' || status === 'HT' ? 50 : status === 'FINISHED' ? 30 : 10;
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

async function latestDocumentedMinutes(matchIds: string[]) {
  if (matchIds.length === 0) return new Map<string, number>();

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

  const latestByMatch = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (latestByMatch.has(snapshot.matchId)) continue;
    const minute = validMinute(snapshot.minute);
    if (minute !== null) latestByMatch.set(snapshot.matchId, minute);
  }
  return latestByMatch;
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        events: true,
      },
      orderBy: { matchDate: 'asc' },
    });

    const documentedMinutes = await latestDocumentedMinutes(matches.map((match) => match.id));
    const enrichedMatches = matches.map((match) => {
      const minute = documentedMinutes.get(match.id);
      return minute ? { ...match, minute, displayStatus: 'IN_PLAY', isLiveNow: true, liveLabel: `الدقيقة ${minute}` } : match;
    });

    return NextResponse.json(dedupeMatches(enrichedMatches), { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
