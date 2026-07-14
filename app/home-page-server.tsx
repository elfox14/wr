import { unstable_cache } from 'next/cache';
import HomePremiumClient from '@/components/HomePremiumClient';
import prisma from '@/lib/prisma';
import { getHomeGroupStandings } from '@/lib/homeGroupStandings';
import LiveOnlyRefresh from '@/components/LiveOnlyRefresh';


const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED', 'COMPLETED', 'FINAL_VERIFIED'];
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'HT', 'HALFTIME', 'HALF_TIME', 'BT', 'P', 'PEN_LIVE'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const ACTIVE_HOME_STATUSES = [...SCHEDULED_STATUSES, ...LIVE_STATUSES];
const KNOCKOUT_STAGES = ['ROUND_OF_32', 'LAST_32', 'R32', 'ROUND_OF_16', 'LAST_16', 'R16', 'QUARTER_FINALS', 'QUARTER_FINAL', 'QF', 'SEMI_FINALS', 'SEMI_FINAL', 'SF', 'FINAL', 'THIRD_PLACE', 'THIRD'];
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;
const KNOCKOUT_MAX_LIVE_MINUTES = 150;
const STALE_FINAL_SNAPSHOT_MS = 7 * 60 * 1000;
const FINAL_MINUTE_FLOOR = 85;
const FINAL_LOCAL_MINUTE_FALLBACK = 100;

function knockoutStageWhere() {
  const contains = ['32', '16', 'FINAL', 'SEMI', 'QUARTER', 'THIRD'];
  return {
    OR: [
      ...KNOCKOUT_STAGES.flatMap((stage) => [
        { stage: { equals: stage, mode: 'insensitive' as const } },
        { groupPhase: { equals: stage, mode: 'insensitive' as const } },
      ]),
      ...contains.flatMap((term) => [
        { stage: { contains: term, mode: 'insensitive' as const } },
        { groupPhase: { contains: term, mode: 'insensitive' as const } },
      ]),
    ],
  };
}

function fifaTrustedWhere() {
  return {
    OR: [
      { syncSource: { contains: 'FIFA', mode: 'insensitive' as const } },
      { externalId: { startsWith: 'fifa-', mode: 'insensitive' as const } },
    ],
  };
}

type TournamentMatchSummaryRow = {
  id: string;
  externalId?: string | null;
  syncSource?: string | null;
  status?: string | null;
  stage?: string | null;
  groupPhase?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  lastSyncedAt?: Date | null;
  homeTeam: { id: string };
  awayTeam: { id: string };
};

type MatchCandidate = {
  id: string;
  matchDate: Date;
  status?: string | null;
  groupPhase?: string | null;
  stage?: string | null;
};

const teamSelect = {
  id: true,
  name: true,
  code: true,
  image: true,
  group: true,
} as const;

const knockoutTeamSelect = {
  id: true,
  name: true,
  code: true,
  image: true,
  group: true,
} as const;

function validMinute(value: unknown) {
  const minute = Number(value);
  if (!Number.isFinite(minute) || minute <= 0) return null;
  return Math.max(1, Math.min(150, Math.floor(minute)));
}

function normalizeStatus(value?: string | null) {
  return String(value || []).toUpperCase();
}

function tournamentStageKey(match: TournamentMatchSummaryRow) {
  const raw = String(match.stage || match.groupPhase || 'GROUP').trim().toUpperCase();
  return raw.replace(/[^A-Z0-9]+/g, '_');
}

function canonicalTournamentMatches(matches: TournamentMatchSummaryRow[]) {
  const canonical = new Map<string, TournamentMatchSummaryRow>();
  for (const match of matches) {
    const pair = [match.homeTeam.id, match.awayTeam.id].sort().join('|');
    const key = `${tournamentStageKey(match)}:${pair}`;
    const current = canonical.get(key);
    const priority = (String(match.syncSource || '').toUpperCase().includes('FIFA') ? 1_000_000_000_000_000 : 0) + Number(match.lastSyncedAt?.getTime() || 0);
    const currentPriority = current ? (String(current.syncSource || '').toUpperCase().includes('FIFA') ? 1_000_000_000_000_000 : 0) + Number(current.lastSyncedAt?.getTime() || 0) : -1;
    if (!current || priority > currentPriority) canonical.set(key, match);
  }
  return [...canonical.values()];
}

function isHalfTimeStatus(value?: string | null) {
  return ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'].includes(normalizeStatus(value));
}

function isSecondHalfStatus(value?: string | null) {
  const status = normalizeStatus(value);
  return status === '2H' || status === 'ET';
}

function isGroupStage(match: MatchCandidate) {
  const value = String(match.groupPhase || match.stage || []).toUpperCase();
  return value.includes('GROUP');
}

function maxLiveMinutes(match: MatchCandidate) {
  return isGroupStage(match) ? GROUP_STAGE_MAX_LIVE_MINUTES : KNOCKOUT_MAX_LIVE_MINUTES;
}

function minutesFromKickoff(match: MatchCandidate, now: Date) {
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return null;
  return Math.floor((now.getTime() - matchTime) / 60_000) + 1;
}

function decorateLiveCandidateWithSnapshot<T extends MatchCandidate>(match: T, snapshot?: { minute: number; capturedAt: Date }) {
  const status = normalizeStatus(match.status);

  if (isHalfTimeStatus(status)) {
    return {
      ...match,
      status: 'HT',
      displayStatus: 'HT',
      isLiveNow: false,
      isHalfTime: true,
      isLikelyLiveByTime: false,
      minute: null,
      liveLabel: 'استراحة',
    };
  }

  const snapshotMinute = validMinute(snapshot?.minute);
  const minute = isSecondHalfStatus(status)
    ? snapshotMinute && snapshotMinute >= 46 ? snapshotMinute : 46
    : snapshotMinute;

  return {
    ...match,
    status: isSecondHalfStatus(status) ? '2H' : 'IN_PLAY',
    displayStatus: isSecondHalfStatus(status) ? '2H' : 'IN_PLAY',
    isLiveNow: true,
    isHalfTime: false,
    isLikelyLiveByTime: false,
    minute,
    liveLabel: minute ? `الدقيقة ${minute}` : 'جارية الآن',
  };
}

async function findFreshLiveCandidate<T extends MatchCandidate>(candidates: T[], now: Date) {
  if (!candidates.length) return null;

  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: {
      matchId: { in: candidates.map((match) => match.id) },
      minute: { not: null },
    },
    select: {
      matchId: true,
      minute: true,
      capturedAt: true,
    },
    orderBy: { capturedAt: 'desc' },
    take: Math.max(12, candidates.length * 3),
  });

  const latestByMatch = new Map<string, { minute: number; capturedAt: Date }>();
  for (const snapshot of snapshots) {
    if (latestByMatch.has(snapshot.matchId)) continue;
    const minute = validMinute(snapshot.minute);
    if (minute !== null) latestByMatch.set(snapshot.matchId, { minute, capturedAt: snapshot.capturedAt });
  }

  const candidate = candidates.find((match) => {
    if (isHalfTimeStatus(match.status)) return true;
    const localMinute = minutesFromKickoff(match, now);
    if (localMinute !== null && localMinute >= maxLiveMinutes(match)) return false;
    if (localMinute !== null && localMinute >= FINAL_LOCAL_MINUTE_FALLBACK) return false;
    const snapshot = latestByMatch.get(match.id);
    if (!snapshot) return true;
    const snapshotAge = now.getTime() - new Date(snapshot.capturedAt).getTime();
    if (snapshot.minute >= FINAL_MINUTE_FLOOR && snapshotAge >= STALE_FINAL_SNAPSHOT_MS) return false;
    return true;
  });

  return candidate ? decorateLiveCandidateWithSnapshot(candidate, latestByMatch.get(candidate.id)) : null;
}

async function loadHomeDataUncached() {
    const now = new Date();
    const tickerStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const tickerEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);
    const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [totalPlayers, totalTeams, totalUpcomingMatches, upcomingMatchesRaw, tickerMatchesRaw, liveCandidatesRaw, nextMatchRaw, groupStandingsRaw, knockoutMatchesRaw] = await Promise.all([
      prisma.asset.count({ where: { type: 'PLAYER' } }),
      prisma.asset.count({ where: { type: 'TEAM' } }),
      prisma.match.count({
        where: {
          status: { in: ACTIVE_HOME_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
      }),
      prisma.match.findMany({
        where: {
          status: { in: ACTIVE_HOME_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'asc' },
        take: 4,
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
      prisma.match.findMany({
        where: { matchDate: { gte: tickerStart, lte: tickerEnd } },
        orderBy: { matchDate: 'asc' },
        take: 8,
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
      prisma.match.findMany({
        where: {
          status: { in: LIVE_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'desc' },
        take: 3,
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
      prisma.match.findFirst({
        where: {
          status: { in: SCHEDULED_STATUSES },
          matchDate: { gte: liveWindowStart, lte: upcomingUntil },
        },
        orderBy: { matchDate: 'asc' },
        select: {
          id: true,
          matchDate: true,
          status: true,
          groupPhase: true,
          stage: true,
          homeScore: true,
          awayScore: true,
          animationMatchId: true,
          homeTeam: { select: teamSelect },
          awayTeam: { select: teamSelect },
        },
      }),
      getHomeGroupStandings().catch(() => []),
      // Knockout bracket — fetch all knockout stage matches
      prisma.match.findMany({
        where: {
          AND: [
            knockoutStageWhere(),
            fifaTrustedWhere(),
          ],
        },
        orderBy: { matchDate: 'asc' },
        take: 64,
        select: {
          id: true,
          matchDate: true,
          status: true,
          homeScore: true,
          awayScore: true,
          groupPhase: true,
          stage: true,
          syncSource: true,
          lastSyncedAt: true,
          externalId: true,
          externalIds: true,
          homeTeam: { select: knockoutTeamSelect },
          awayTeam: { select: knockoutTeamSelect },
        },
      }),
    ]);

    const [tournamentMatchesRaw, latestStatisticsSnapshot] = await Promise.all([
      prisma.match.findMany({
        select: {
          id: true,
          externalId: true,
          syncSource: true,
          status: true,
          stage: true,
          groupPhase: true,
          homeScore: true,
          awayScore: true,
          lastSyncedAt: true,
          homeTeam: { select: { id: true } },
          awayTeam: { select: { id: true } },
        },
      }),
      prisma.matchStatsSnapshot.findFirst({ orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } }),
    ]);
    const tournamentMatches = canonicalTournamentMatches(tournamentMatchesRaw);
    const finishedTournamentMatches = tournamentMatches.filter((match) => FINISHED_STATUSES.includes(normalizeStatus(match.status)));
    const liveTournamentMatches = tournamentMatches.filter((match) => LIVE_STATUSES.includes(normalizeStatus(match.status)));
    const upcomingTournamentMatches = tournamentMatches.filter((match) => SCHEDULED_STATUSES.includes(normalizeStatus(match.status)));
    const scoredTournamentMatches = [...finishedTournamentMatches, ...liveTournamentMatches];
    const totalTournamentGoals = scoredTournamentMatches.reduce((sum, match) => sum + Number(match.homeScore || 0) + Number(match.awayScore || 0), 0);
    const cleanSheets = finishedTournamentMatches.reduce((sum, match) => sum + (Number(match.awayScore || 0) === 0 ? 1 : 0) + (Number(match.homeScore || 0) === 0 ? 1 : 0), 0);
    const latestMatchSync = tournamentMatches.reduce<Date | null>((latest, match) => !match.lastSyncedAt || (latest && latest >= match.lastSyncedAt) ? latest : match.lastSyncedAt, null);
    const updatedAt = [latestStatisticsSnapshot?.capturedAt || null, latestMatchSync].filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const freshLiveMatch = await findFreshLiveCandidate(liveCandidatesRaw, now);
    return {
      playersCount: totalPlayers,
      teamsCount: totalTeams,
      upcomingMatchesCount: totalUpcomingMatches,
      upcomingMatches: JSON.parse(JSON.stringify(upcomingMatchesRaw)),
      tickerMatches: JSON.parse(JSON.stringify(tickerMatchesRaw)),
      nextMarqueeMatch: freshLiveMatch || nextMatchRaw ? JSON.parse(JSON.stringify(freshLiveMatch || nextMatchRaw)) : null,
      groupStandings: JSON.parse(JSON.stringify(groupStandingsRaw)),
      knockoutMatches: JSON.parse(JSON.stringify(knockoutMatchesRaw)),
      tournamentStats: {
        totalMatches: tournamentMatches.length,
        playedMatches: finishedTournamentMatches.length,
        liveMatches: liveTournamentMatches.length,
        upcomingMatches: upcomingTournamentMatches.length,
        totalGoals: totalTournamentGoals,
        cleanSheets,
        playersCount: totalPlayers,
        teamsCount: totalTeams,
        updatedAt: updatedAt?.toISOString() || null,
      },
    };
}

const getHomeDataLive = unstable_cache(loadHomeDataUncached, ['home-dashboard-v10-live'], {
  revalidate: 30,
  tags: ['home-dashboard'],
});
const getHomeDataIdle = unstable_cache(loadHomeDataUncached, ['home-dashboard-v10-idle'], {
  revalidate: false,
  tags: ['home-dashboard'],
});

export default async function Home() {
  let hasLiveMatches = false;
  let data = {
    playersCount: 0,
    teamsCount: 0,
    upcomingMatchesCount: 0,
    upcomingMatches: [] as unknown[],
    tickerMatches: [] as unknown[],
    nextMarqueeMatch: null as any,
    groupStandings: [] as unknown[],
    knockoutMatches: [] as unknown[],
    tournamentStats: null as {
      totalMatches: number;
      playedMatches: number;
      liveMatches: number;
      upcomingMatches: number;
      totalGoals: number;
      cleanSheets: number;
      playersCount: number;
      teamsCount: number;
      updatedAt: string | null;
    } | null,
  };

  try {
    hasLiveMatches = Boolean(await prisma.match.findFirst({ where: { status: { in: LIVE_STATUSES } }, select: { id: true } }));
    data = await (hasLiveMatches ? getHomeDataLive() : getHomeDataIdle());
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }

  return (
    <>
      <LiveOnlyRefresh active={hasLiveMatches} intervalMs={30_000} />
      <HomePremiumClient
        upcomingMatches={data.upcomingMatches}
        tickerMatches={data.tickerMatches}
        nextMarqueeMatch={data.nextMarqueeMatch}
        groupStandings={data.groupStandings}
        playersCount={data.playersCount}
        teamsCount={data.teamsCount}
        upcomingMatchesCount={data.upcomingMatchesCount}
        knockoutMatches={data.knockoutMatches}
        tournamentStats={data.tournamentStats}
      />
    </>
  );
}
