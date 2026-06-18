import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PairLike = { home?: number | null; away?: number | null; sourcePath?: string | null } | null;

function configuredSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function isAuthorized(req: Request, searchParams: URLSearchParams) {
  const validSecrets = configuredSecrets();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    bearer,
    req.headers.get('x-admin-secret') || '',
    req.headers.get('x-cron-secret') || '',
    searchParams.get('adminSecret') || '',
    searchParams.get('cronSecret') || '',
    searchParams.get('key') || '',
  ];
  return candidates.some((value) => String(value).trim() && validSecrets.includes(String(value).trim()));
}

function rawObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function providerLabel(provider?: string | null) {
  const value = String(provider || '').toUpperCase();
  if (value.includes('THE_STATS')) return 'TheStatsAPI';
  if (value.includes('ISPORTS')) return 'iSports';
  return provider || 'Local';
}

function pickLatestSnapshot(match: any, providerHint: string) {
  const snapshots = Array.isArray(match.statsSnapshots) ? match.statsSnapshots : [];
  return snapshots.find((snapshot: any) => String(snapshot.provider || '').toUpperCase().includes(providerHint));
}

function statPairFromSnapshot(snapshot: any, homeKey: string, awayKey: string): PairLike {
  if (!snapshot) return null;
  const home = snapshot[homeKey];
  const away = snapshot[awayKey];
  if (home === null && home === undefined && away === null && away === undefined) return null;
  return { home, away, sourcePath: providerLabel(snapshot.provider) };
}

function providerStatPair(stats: Record<string, any>, key: string): PairLike {
  const stat = rawObject(stats[key]);
  const home = stat.home;
  const away = stat.away;
  if (home === null && home === undefined && away === null && away === undefined) return null;
  return { home, away, sourcePath: stat.sourcePath || null };
}

function getProviderEnrichment(snapshot: any) {
  const raw = rawObject(snapshot?.rawData);
  const direct = rawObject(raw.theStatsApi || raw.providerStats || raw.stats ? raw : {});
  const stats = rawObject(raw.stats || raw.providerStats || direct.stats || direct.providerStats);
  const derived = rawObject(raw.derived || direct.derived);
  const lineup = rawObject(raw.lineup || raw.lineups || direct.lineup || direct.lineups);
  return { raw, stats, derived, lineup };
}

function numberValue(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

function leaderName(pair: PairLike, homeName: string, awayName: string) {
  const home = numberValue(pair?.home);
  const away = numberValue(pair?.away);
  if (home === null || away === null) return null;
  if (home === away) return 'balanced';
  return home > away ? homeName : awayName;
}

function diff(pair: PairLike) {
  const home = numberValue(pair?.home);
  const away = numberValue(pair?.away);
  if (home === null || away === null) return null;
  return Math.abs(home - away);
}

function buildInsights(homeName: string, awayName: string, pairs: Record<string, PairLike>) {
  const insights: Array<{ key: string; title: string; leader: string | null; diff: number | null; text: string }> = [];
  const xgLeader = leaderName(pairs.xg, homeName, awayName);
  if (xgLeader) insights.push({ key: 'xg', title: 'جودة الفرص', leader: xgLeader, diff: diff(pairs.xg), text: xgLeader === 'balanced' ? 'جودة الفرص متقاربة.' : `${xgLeader} صنع فرصًا أعلى جودة.` });
  const possessionLeader = leaderName(pairs.possession, homeName, awayName);
  if (possessionLeader) insights.push({ key: 'possession', title: 'إيقاع اللعب', leader: possessionLeader, diff: diff(pairs.possession), text: possessionLeader === 'balanced' ? 'الاستحواذ متوازن.' : `${possessionLeader} امتلك الكرة أكثر.` });
  const targetLeader = leaderName(pairs.shotsOnTarget, homeName, awayName);
  if (targetLeader) insights.push({ key: 'shotsOnTarget', title: 'الفاعلية على المرمى', leader: targetLeader, diff: diff(pairs.shotsOnTarget), text: targetLeader === 'balanced' ? 'التسديدات على المرمى متعادلة.' : `${targetLeader} وصل للمرمى أكثر.` });
  const shotsLeader = leaderName(pairs.shots, homeName, awayName);
  if (shotsLeader) insights.push({ key: 'shots', title: 'حجم المحاولات', leader: shotsLeader, diff: diff(pairs.shots), text: shotsLeader === 'balanced' ? 'حجم المحاولات متقارب.' : `${shotsLeader} امتلك حجم محاولات أكبر.` });
  return insights.slice(0, 4);
}

function pairValue(pair: PairLike) {
  if (!pair) return null;
  return { home: pair.home ?? null, away: pair.away ?? null, sourcePath: pair.sourcePath || null };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const matchId = url.searchParams.get('matchId') || '';
  if (!matchId) {
    return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 10 },
    },
  });

  if (!match) {
    return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const homeName = match.homeTeam?.name || match.homeTeam?.code || 'Home';
  const awayName = match.awayTeam?.name || match.awayTeam?.code || 'Away';
  const iSportsSnapshot = pickLatestSnapshot(match, 'ISPORTS') || match.statsSnapshots.find((snapshot: any) => !String(snapshot.provider || '').toUpperCase().includes('THE_STATS')) || null;
  const theStatsSnapshot = pickLatestSnapshot(match, 'THE_STATS') || null;
  const { raw, stats, derived, lineup } = getProviderEnrichment(theStatsSnapshot);
  const pair = (key: string, homeKey: string, awayKey: string): PairLike => statPairFromSnapshot(iSportsSnapshot, homeKey, awayKey) || providerStatPair(stats, key);

  const pairs = {
    possession: pair('possession', 'homePossession', 'awayPossession'),
    shots: pair('shots', 'homeShots', 'awayShots'),
    shotsOnTarget: pair('shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget'),
    shotsOffTarget: statPairFromSnapshot(iSportsSnapshot, 'homeShotsOffTarget', 'awayShotsOffTarget') || rawObject(derived.shotsOffTargetForLocalCompare || derived.shotsOffTargetWithBlocked),
    corners: pair('corners', 'homeCorners', 'awayCorners'),
    yellowCards: pair('yellowCards', 'homeYellowCards', 'awayYellowCards'),
    redCards: pair('redCards', 'homeRedCards', 'awayRedCards'),
    xg: providerStatPair(stats, 'xg'),
    npxg: providerStatPair(stats, 'npxg'),
    bigChances: providerStatPair(stats, 'bigChances'),
    passes: providerStatPair(stats, 'passes'),
    accuratePasses: providerStatPair(stats, 'accuratePasses'),
    fouls: providerStatPair(stats, 'fouls'),
    tackles: providerStatPair(stats, 'tackles'),
    saves: providerStatPair(stats, 'saves'),
    clearances: providerStatPair(stats, 'clearances'),
    ballRecoveries: providerStatPair(stats, 'ballRecoveries'),
  };

  return NextResponse.json({
    ok: true,
    mode: 'match_infographic_data',
    match: {
      id: match.id,
      title: `${homeName} vs ${awayName}`,
      date: match.matchDate,
      status: match.status,
      stage: match.stage,
      groupPhase: match.groupPhase,
      score: { home: match.homeScore, away: match.awayScore },
      teams: {
        home: { id: match.homeTeam?.id, name: homeName, code: match.homeTeam?.code },
        away: { id: match.awayTeam?.id, name: awayName, code: match.awayTeam?.code },
      },
    },
    sources: {
      primarySnapshot: iSportsSnapshot ? { id: iSportsSnapshot.id, provider: iSportsSnapshot.provider, capturedAt: iSportsSnapshot.capturedAt } : null,
      enrichmentSnapshot: theStatsSnapshot ? { id: theStatsSnapshot.id, provider: theStatsSnapshot.provider, capturedAt: theStatsSnapshot.capturedAt, theStatsApiMatchId: raw.theStatsApiMatchId || null } : null,
      noOddsOrBetting: true,
    },
    stats: Object.fromEntries(Object.entries(pairs).map(([key, value]) => [key, pairValue(value as PairLike)])),
    formations: {
      home: rawObject(lineup.home).formation || null,
      away: rawObject(lineup.away).formation || null,
      confirmed: Boolean(lineup.confirmed),
    },
    insights: buildInsights(homeName, awayName, pairs as Record<string, PairLike>),
    events: match.events.map((event: any) => ({
      id: event.id,
      minute: event.minute,
      type: event.type,
      teamId: event.teamId,
      playerName: event.playerName,
      detail: event.detail,
      sourceName: event.sourceName,
    })),
    usage: {
      forInfographic: true,
      forArticleDraft: true,
      rule: 'Use only fields present in this response. If a field is null, write غير متوفر in editorial output.',
    },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
