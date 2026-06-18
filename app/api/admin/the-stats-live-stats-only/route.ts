import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isAuthorized(req: Request, params: URLSearchParams) {
  const valid = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret') || '',
    req.headers.get('x-cron-secret') || '',
    params.get('key') || '',
    params.get('adminSecret') || '',
    params.get('cronSecret') || '',
  ];
  return candidates.some((value) => String(value || '').trim() && valid.includes(String(value || '').trim()));
}

function boolParam(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function n(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function first(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return null;
}

function pair(value: any) {
  if (!value || typeof value !== 'object') return null;
  const source = value.all && typeof value.all === 'object' ? value.all : value;
  const home = n(source.home);
  const away = n(source.away);
  if (home === null && away === null) return null;
  return { home, away };
}

function statInt(stats: Record<string, any>, key: string, side: 'home' | 'away') {
  const value = n(stats[key]?.[side]);
  return value === null ? null : Math.round(value);
}

function compactStats(payload: any) {
  const data = payload?.data || payload || {};
  const meta = data.meta || {};
  const source = data.stats || {};
  const stats: Record<string, any> = {};
  const map: Array<[string, any]> = [
    ['possession', pair(source.ball_possession)],
    ['shots', pair(source.total_shots)],
    ['shotsOnTarget', pair(source.shots_on_target)],
    ['shotsOffTarget', pair(source.shots_off_target)],
    ['corners', pair(source.corner_kicks)],
    ['yellowCards', pair(source.yellow_cards)],
    ['redCards', pair(source.red_cards)],
    ['xg', pair(source.expected_goals || source.xg)],
    ['bigChances', pair(source.big_chances)],
    ['fouls', pair(source.fouls)],
    ['offsides', pair(source.offsides)],
  ];
  for (const [key, value] of map) if (value) stats[key] = value;
  return { meta, stats };
}

function scoreFromMeta(match: any, meta: any) {
  return {
    home: Math.round(n(first(meta.home_goals, meta.homeGoals, meta.home_score)) ?? n(match?.homeScore) ?? 0),
    away: Math.round(n(first(meta.away_goals, meta.awayGoals, meta.away_score)) ?? n(match?.awayScore) ?? 0),
  };
}

function minuteFromMeta(match: any, meta: any) {
  const direct = n(first(meta.elapsed_minutes, meta.minute, meta.elapsed, meta.currentMinute));
  if (direct !== null) return Math.round(direct);
  const elapsed = Math.floor((Date.now() - new Date(match.matchDate).getTime()) / 60_000) + 1;
  return Number.isFinite(elapsed) ? Math.max(1, Math.min(130, elapsed)) : null;
}

async function createScoreUpdateEvent(match: any, score: { home: number; away: number }, minute: number | null, sourcePath: string) {
  if (score.home + score.away <= 0) return false;
  const detail = `تحديث النتيجة المباشرة من TheStatsAPI: ${match.homeTeam?.name || 'Home'} ${score.home} - ${score.away} ${match.awayTeam?.name || 'Away'} — توقيت واسم مسجل الهدف غير متوفرين من timeline`;
  const existing = await prisma.matchEvent.findFirst({
    where: {
      matchId: match.id,
      type: 'score_update',
      sourceName: 'THE_STATS_API_LIVE_SCORE',
      detail: { contains: `${score.home} - ${score.away}` },
    },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.matchEvent.create({
    data: {
      matchId: match.id,
      minute,
      type: 'score_update',
      teamId: score.home > score.away ? match.homeTeamId : score.away > score.home ? match.awayTeamId : null,
      detail,
      sourceName: 'THE_STATS_API_LIVE_SCORE',
      sourceUrl: sourcePath,
    },
  });
  return true;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const matchId = url.searchParams.get('matchId') || '';
  const providerMatchId = url.searchParams.get('providerMatchId') || '';
  const dryRun = boolParam(url.searchParams.get('dryRun'), true);
  if (!matchId || !providerMatchId) {
    return NextResponse.json({ ok: false, error: 'matchId and providerMatchId are required to avoid extra provider lookup calls' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const liveStatsPath = `/api/football/matches/${encodeURIComponent(providerMatchId)}/live-stats`;
    const liveStatsPayload = await theStatsApiFetch(liveStatsPath, {}, { timeoutMs: 15000 });
    const { meta, stats } = compactStats(liveStatsPayload);
    const score = scoreFromMeta(match, meta);
    const minute = minuteFromMeta(match, meta);
    let snapshotSaved = false;
    let matchUpdated = false;
    let scoreEventCreated = false;

    if (!dryRun) {
      await prisma.matchStatsSnapshot.create({ data: {
        id: randomUUID(),
        matchId: match.id,
        provider: 'THE_STATS_API_LIVE',
        providerMatchId: Number(String(providerMatchId).replace(/\D/g, '')) || 0,
        minute,
        homePossession: statInt(stats, 'possession', 'home'),
        awayPossession: statInt(stats, 'possession', 'away'),
        homeShots: statInt(stats, 'shots', 'home'),
        awayShots: statInt(stats, 'shots', 'away'),
        homeShotsOnTarget: statInt(stats, 'shotsOnTarget', 'home'),
        awayShotsOnTarget: statInt(stats, 'shotsOnTarget', 'away'),
        homeShotsOffTarget: statInt(stats, 'shotsOffTarget', 'home'),
        awayShotsOffTarget: statInt(stats, 'shotsOffTarget', 'away'),
        homeCorners: statInt(stats, 'corners', 'home'),
        awayCorners: statInt(stats, 'corners', 'away'),
        homeYellowCards: statInt(stats, 'yellowCards', 'home'),
        awayYellowCards: statInt(stats, 'yellowCards', 'away'),
        homeRedCards: statInt(stats, 'redCards', 'home'),
        awayRedCards: statInt(stats, 'redCards', 'away'),
        homeScore: score.home,
        awayScore: score.away,
        rawData: { status: 'IN_PLAY', minute, stats, meta, liveStats: liveStatsPayload, source: { provider: 'THE_STATS_API', liveStatsPath }, importedAt: new Date().toISOString() },
      } });
      snapshotSaved = true;

      const updateData: Record<string, any> = { status: 'IN_PLAY' };
      if (score.home !== match.homeScore) updateData.homeScore = score.home;
      if (score.away !== match.awayScore) updateData.awayScore = score.away;
      await prisma.match.update({ where: { id: match.id }, data: updateData });
      matchUpdated = true;
      scoreEventCreated = await createScoreUpdateEvent(match, score, minute, liveStatsPath);
    }

    return NextResponse.json({
      ok: true,
      provider: 'THE_STATS_API',
      mode: 'the_stats_live_stats_only',
      dryRun,
      saved: !dryRun,
      matchId: match.id,
      localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
      resolvedProviderMatchId: providerMatchId,
      liveStatsFound: Object.keys(stats).length,
      liveStatsKeys: Object.keys(stats),
      minute,
      score,
      snapshotSaved,
      matchUpdated,
      scoreEventCreated,
      sourcePath: liveStatsPath,
      displayNotes: {
        timelineEventsAvailable: false,
        scoreUpdateEventIsFallback: true,
        unavailableFromLiveStats: ['attacks', 'dangerousAttacks', 'exactGoalMinute', 'goalScorer'],
      },
      safety: {
        singleProviderRequest: true,
        noTimelineRequest: true,
        noProviderMatchListRequest: true,
        dryRunDefault: true,
        prohibitedOddsStillBlocked: true,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      provider: 'THE_STATS_API',
      mode: 'the_stats_live_stats_only',
      error: safeTheStatsApiError(error),
      retryAdvice: 'If status is 429, wait 2-5 minutes and retry with this stats-only endpoint. Avoid running debug and catch-up repeatedly during the same minute.',
      config: getTheStatsApiConfigStatus(),
    }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
