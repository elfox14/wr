import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const DEFAULT_PROVIDER_SNAPSHOT_TTL_SECONDS = 5 * 60;
const SNAPSHOT_LOOKBACK_MS = 4 * 60 * 60 * 1000;
const SNAPSHOT_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const GROUP_KEYS = 'ABCDEFGHIJKL'.split('');

type MatchFilter = 'today' | 'finished' | 'group';
type SnapshotState = { minute: number | null; capturedAt: Date; providerStatus?: string | null };

type PublicMatch = {
  id: string;
  externalId: string | null;
  animationMatchId: number | null;
  homeTeamId: string;
  awayTeamId: string;
  matchDate: Date;
  status: string;
  homeScore: number;
  awayScore: number;
  groupPhase: string | null;
  stage: string;
  homeTeam: { id: string; name: string; code: string | null; image: string | null; group: string | null };
  awayTeam: { id: string; name: string; code: string | null; image: string | null; group: string | null };
};

const matchSelect = {
  id: true,
  externalId: true,
  animationMatchId: true,
  homeTeamId: true,
  awayTeamId: true,
  matchDate: true,
  status: true,
  homeScore: true,
  awayScore: true,
  groupPhase: true,
  stage: true,
  homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
  awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
} as const;

function providerSnapshotTtlMs() {
  const seconds = Number(process.env.MATCH_PROVIDER_SNAPSHOT_TTL_SECONDS || DEFAULT_PROVIDER_SNAPSHOT_TTL_SECONDS);
  return Math.max(60, Number.isFinite(seconds) ? Math.floor(seconds) : DEFAULT_PROVIDER_SNAPSHOT_TTL_SECONDS) * 1000;
}

function normalizeStatus(value?: string | null) {
  return String(value || '').toUpperCase();
}

function isFinishedStatus(value?: string | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(value));
}

function isScheduledStatus(value?: string | null) {
  return SCHEDULED_STATUSES.includes(normalizeStatus(value));
}

function isLiveStatus(value?: string | null) {
  return LIVE_STATUSES.includes(normalizeStatus(value));
}

function isHalfTimeStatus(value?: string | null) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(value));
}

function isSecondHalfStatus(value?: string | null) {
  const status = normalizeStatus(value);
  return status === '2H' || status === 'ET';
}

function isGroupStage(match: Pick<PublicMatch, 'groupPhase' | 'stage'>) {
  const value = String(match.groupPhase || match.stage || '').toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: Pick<PublicMatch, 'groupPhase' | 'stage'>) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function minutesFromKickoff(match: Pick<PublicMatch, 'matchDate'>, now = Date.now()) {
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now - matchTime) / 60_000) + 1;
}

function dayHourKey(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown-time';
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function teamsKey(match: PublicMatch) {
  return [match.homeTeamId, match.awayTeamId].filter(Boolean).map(String).sort().join(':');
}

function dedupeKey(match: PublicMatch) {
  if (match.animationMatchId) return `animation:${match.animationMatchId}`;
  return `teams:${teamsKey(match)}:${dayHourKey(match.matchDate)}`;
}

function rankMatch(match: any) {
  const status = normalizeStatus(match.displayStatus || match.status);
  const statusRank = isFinishedStatus(status) ? 30 : isLiveStatus(status) || isHalfTimeStatus(status) ? 50 : 10;
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
  return Array.from(byExact.values()).sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
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

function isFreshProviderSnapshot(snapshot: SnapshotState | undefined, now = Date.now()) {
  if (!snapshot?.capturedAt) return false;
  const capturedAt = new Date(snapshot.capturedAt).getTime();
  if (!Number.isFinite(capturedAt)) return false;
  return now - capturedAt <= providerSnapshotTtlMs();
}

function needsSnapshot(match: PublicMatch, now = Date.now()) {
  if (isFinishedStatus(match.status)) return false;
  if (isLiveStatus(match.status) || isHalfTimeStatus(match.status)) return true;
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return false;
  return matchTime >= now - SNAPSHOT_LOOKBACK_MS && matchTime <= now + SNAPSHOT_LOOKAHEAD_MS;
}

async function latestDocumentedSnapshots(matchIds: string[]) {
  if (!matchIds.length) return new Map<string, SnapshotState>();
  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, minute: true, capturedAt: true, rawData: true },
    orderBy: { capturedAt: 'desc' },
    take: Math.max(40, matchIds.length * 3),
  });
  const latestByMatch = new Map<string, SnapshotState>();
  for (const snapshot of snapshots) {
    if (latestByMatch.has(snapshot.matchId)) continue;
    latestByMatch.set(snapshot.matchId, { minute: validMinute(snapshot.minute), capturedAt: snapshot.capturedAt, providerStatus: snapshotProviderStatus(snapshot.rawData) });
  }
  return latestByMatch;
}

function normalizeMatchForDisplay(match: PublicMatch, now = Date.now(), snapshot?: SnapshotState) {
  const status = normalizeStatus(match.status);
  const freshSnapshot = isFreshProviderSnapshot(snapshot, now) ? snapshot : undefined;
  const providerStatus = normalizeStatus(freshSnapshot?.providerStatus || status);
  const snapshotMinute = freshSnapshot?.minute || null;
  const snapshotConfirmsLive = Boolean(snapshotMinute && snapshotMinute > 0 && snapshotMinute < maxLiveMinutes(match));

  if (isFinishedStatus(status) || isFinishedStatus(providerStatus)) return { ...match, displayStatus: 'FINISHED', isLiveNow: false, isLikelyLiveByTime: false, minute: null, liveLabel: null };
  if (isHalfTimeStatus(providerStatus)) return { ...match, displayStatus: 'HT', isLiveNow: true, isHalfTime: true, isLikelyLiveByTime: false, minute: null, liveLabel: 'استراحة' };
  if (isLiveStatus(providerStatus) || snapshotConfirmsLive) {
    const displayStatus = isSecondHalfStatus(providerStatus) || Number(snapshotMinute || 0) >= 46 ? '2H' : '1H';
    return { ...match, displayStatus, isLiveNow: true, isHalfTime: false, isLikelyLiveByTime: false, minute: null, liveLabel: 'جارية الآن' };
  }
  if (isScheduledStatus(status) && minutesFromKickoff(match, now) !== null && (minutesFromKickoff(match, now) || 0) >= 1) return { ...match, displayStatus: 'SCHEDULED', isLiveNow: false, isLikelyLiveByTime: false, minute: null, liveLabel: 'بانتظار تأكيد البداية' };
  return { ...match, isLiveNow: false, isLikelyLiveByTime: false, minute: null, liveLabel: null };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function normalizeFilter(value: string | null): MatchFilter {
  return value === 'finished' || value === 'group' ? value : 'today';
}

function normalizeGroup(value: string | null) {
  const key = String(value || 'A').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1) || 'A';
  return GROUP_KEYS.includes(key) ? key : 'A';
}

function groupWhere(group: string) {
  const labels = [group, `Group ${group}`, `GROUP ${group}`, `GROUP_${group}`, `المجموعة ${group}`];
  return {
    OR: [
      { homeTeam: { group } },
      { awayTeam: { group } },
      { groupPhase: { in: labels } },
      { stage: { in: labels } },
    ],
  };
}

function matchWhere(filter: MatchFilter, group: string) {
  if (filter === 'finished') return { status: { in: FINISHED_STATUSES } };
  if (filter === 'group') return groupWhere(group);
  return { matchDate: { gte: startOfToday(), lt: endOfToday() } };
}

function orderByFor(filter: MatchFilter) {
  return filter === 'finished' ? { matchDate: 'desc' as const } : { matchDate: 'asc' as const };
}

function takeFor(filter: MatchFilter) {
  if (filter === 'finished') return 40;
  if (filter === 'group') return 24;
  return 24;
}

const getScopedMatches = unstable_cache(
  async (filter: MatchFilter, group: string) => {
    const matches = await prisma.match.findMany({
      where: matchWhere(filter, group),
      select: matchSelect,
      orderBy: orderByFor(filter),
      take: takeFor(filter),
    });

    const now = Date.now();
    const snapshotIds = matches.filter((match) => needsSnapshot(match as PublicMatch, now)).map((match) => match.id);
    const documentedSnapshots = await latestDocumentedSnapshots(snapshotIds);
    const enrichedMatches = matches.map((match) => normalizeMatchForDisplay(match as PublicMatch, now, documentedSnapshots.get(match.id)));
    const deduped = dedupeMatches(enrichedMatches);
    return filter === 'finished' ? deduped.reverse() : deduped;
  },
  ['public-matches-scoped-v1'],
  { revalidate: 30 },
);

export async function GET(request: NextRequest) {
  try {
    const filter = normalizeFilter(request.nextUrl.searchParams.get('filter'));
    const group = normalizeGroup(request.nextUrl.searchParams.get('group'));
    const matches = await getScopedMatches(filter, group);
    return NextResponse.json(matches, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
