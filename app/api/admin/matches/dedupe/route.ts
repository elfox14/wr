import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isAuthorized(req: Request, url: URL) {
  const valid = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((v) => String(v || '').trim()).filter(Boolean);
  if (valid.length === 0) return true;
  const candidates = [
    url.searchParams.get('key')?.trim() || '',
    url.searchParams.get('adminSecret')?.trim() || '',
    url.searchParams.get('cronSecret')?.trim() || '',
    req.headers.get('x-admin-secret')?.trim() || '',
    req.headers.get('x-cron-secret')?.trim() || '',
  ];
  return candidates.some((value) => value && valid.includes(value));
}

function dayKey(value: Date | string | null | undefined) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return 'unknown-date';
  return date.toISOString().slice(0, 10);
}

function normalizeText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function matchFilters(match: any, params: URLSearchParams) {
  const date = params.get('date') || '';
  const home = normalizeText(params.get('home') || params.get('homeCode'));
  const away = normalizeText(params.get('away') || params.get('awayCode'));
  if (date && dayKey(match.matchDate) !== date) return false;
  if (home && ![match.homeTeam?.code, match.homeTeam?.name].map(normalizeText).includes(home)) return false;
  if (away && ![match.awayTeam?.code, match.awayTeam?.name].map(normalizeText).includes(away)) return false;
  return true;
}

function groupKey(match: any) {
  return `${match.homeTeamId}|${match.awayTeamId}|${dayKey(match.matchDate)}`;
}

function statusRank(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'FINISHED' || value === 'FT') return 4;
  if (['IN_PLAY', 'LIVE', 'HT', 'PAUSED'].includes(value)) return 3;
  if (value === 'SCHEDULED' || value === 'TIMED') return 2;
  return 1;
}

function keeperScore(match: any) {
  return (
    (match.animationMatchId ? 10_000 : 0) +
    (match.externalId ? 1_000 : 0) +
    statusRank(match.status) * 100 +
    (match._count?.statsSnapshots || 0) * 10 +
    (match._count?.events || 0)
  );
}

function chooseKeeper(matches: any[]) {
  return [...matches].sort((a, b) => keeperScore(b) - keeperScore(a) || new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() || String(a.id).localeCompare(String(b.id)))[0];
}

function publicMatch(match: any) {
  return {
    id: match.id,
    externalId: match.externalId,
    animationMatchId: match.animationMatchId,
    status: match.status,
    matchDate: match.matchDate instanceof Date ? match.matchDate.toISOString() : match.matchDate,
    score: `${match.homeScore ?? 0}-${match.awayScore ?? 0}`,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    counts: match._count,
    keeperScore: keeperScore(match),
  };
}

function betterScoreSource(keeper: any, duplicate: any) {
  if (statusRank(duplicate.status) > statusRank(keeper.status)) return true;
  if (statusRank(duplicate.status) === statusRank(keeper.status)) {
    const keeperScoreSum = Number(keeper.homeScore || 0) + Number(keeper.awayScore || 0);
    const duplicateScoreSum = Number(duplicate.homeScore || 0) + Number(duplicate.awayScore || 0);
    return duplicateScoreSum > keeperScoreSum;
  }
  return false;
}

async function mergeDuplicateIntoKeeper(keeper: any, duplicate: any) {
  const updates: any = {};
  if (!keeper.externalId && duplicate.externalId) updates.externalId = duplicate.externalId;
  if (!keeper.animationMatchId && duplicate.animationMatchId) updates.animationMatchId = duplicate.animationMatchId;
  if (betterScoreSource(keeper, duplicate)) {
    updates.status = duplicate.status;
    updates.homeScore = duplicate.homeScore;
    updates.awayScore = duplicate.awayScore;
  }
  if (!keeper.groupPhase && duplicate.groupPhase) updates.groupPhase = duplicate.groupPhase;
  if ((!keeper.stage || keeper.stage === 'group') && duplicate.stage) updates.stage = duplicate.stage;

  const digestForKeeper = await prisma.matchDigest.findUnique({ where: { matchId: keeper.id } }).catch(() => null);
  const digestForDuplicate = await prisma.matchDigest.findUnique({ where: { matchId: duplicate.id } }).catch(() => null);
  if (digestForDuplicate) {
    if (digestForKeeper) await prisma.matchDigest.delete({ where: { matchId: duplicate.id } });
    else await prisma.matchDigest.update({ where: { matchId: duplicate.id }, data: { matchId: keeper.id } });
  }

  const [events, snapshots, pressNews] = await Promise.all([
    prisma.matchEvent.updateMany({ where: { matchId: duplicate.id }, data: { matchId: keeper.id } }),
    prisma.matchStatsSnapshot.updateMany({ where: { matchId: duplicate.id }, data: { matchId: keeper.id } }),
    prisma.pressNews.updateMany({ where: { relatedMatchId: duplicate.id }, data: { relatedMatchId: keeper.id } }).catch(() => ({ count: 0 })),
  ]);

  if (Object.keys(updates).length) await prisma.match.update({ where: { id: keeper.id }, data: updates });
  await prisma.match.delete({ where: { id: duplicate.id } });

  return { duplicateId: duplicate.id, moved: { events: events.count, snapshots: snapshots.count, pressNews: pressNews.count }, keeperUpdates: updates };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const execute = url.searchParams.get('execute') === 'true';
  const maxGroups = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 20), 100));
  const matches = await prisma.match.findMany({
    orderBy: { matchDate: 'asc' },
    take: 2000,
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      _count: { select: { events: true, statsSnapshots: true } },
    },
  });

  const groups = new Map<string, any[]>();
  for (const match of matches.filter((item) => matchFilters(item, url.searchParams))) {
    const key = groupKey(match);
    groups.set(key, [...(groups.get(key) || []), match]);
  }

  const duplicates = [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .slice(0, maxGroups)
    .map(([key, items]) => {
      const keeper = chooseKeeper(items);
      return { key, keeper, duplicates: items.filter((item) => item.id !== keeper.id), all: items };
    });

  const merged: any[] = [];
  if (execute) {
    for (const group of duplicates) {
      const groupResult = [];
      for (const duplicate of group.duplicates) groupResult.push(await mergeDuplicateIntoKeeper(group.keeper, duplicate));
      merged.push({ key: group.key, keeperId: group.keeper.id, merged: groupResult });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    scanned: matches.length,
    duplicateGroups: duplicates.length,
    filters: {
      date: url.searchParams.get('date') || null,
      home: url.searchParams.get('home') || url.searchParams.get('homeCode') || null,
      away: url.searchParams.get('away') || url.searchParams.get('awayCode') || null,
    },
    groups: duplicates.map((group) => ({
      key: group.key,
      keeper: publicMatch(group.keeper),
      removeOrMerge: group.duplicates.map(publicMatch),
      all: group.all.map(publicMatch),
    })),
    merged,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  return GET(req);
}
