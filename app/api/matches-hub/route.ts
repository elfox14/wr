import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withTeamDisplay } from '@/lib/teamDisplay';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const GROUPS = 'ABCDEFGHIJKL'.split('');

type HubFilter = 'today' | 'yesterday' | 'tomorrow' | 'latest' | 'live' | 'group' | 'all' | 'round_of_32' | 'round_of_16' | 'quarter_finals' | 'semi_finals' | 'final';

const ROUND_OF_32_ALIASES = ['round_of_32', 'last_32', 'r32', 'round 32', 'round of 32', 'last 32', 'دور الـ32', 'دور ال32', 'دور 32'];
const ROUND_OF_16_ALIASES = ['round_of_16', 'last_16', 'r16', 'round 16', 'round of 16', 'last 16', 'دور الـ16', 'دور ال16', 'دور 16'];
const QUARTER_FINAL_ALIASES = ['quarter_finals', 'quarter_final', 'quarter-finals', 'quarter-final', 'quarterfinals', 'quarterfinal', 'ربع النهائي'];
const SEMI_FINAL_ALIASES = ['semi_finals', 'semi_final', 'semi-finals', 'semi-final', 'semifinals', 'semifinal', 'نصف النهائي'];
const FINAL_ALIASES = ['final', 'third_place', 'third-place', 'third place', 'match_for_third_place', 'المباراة النهائية', 'النهائي', 'المركز الثالث'];

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toUpperCase();
}

function isLive(status?: string | null) {
  const value = normalizeStatus(status);
  return LIVE_STATUSES.includes(value) || HALF_TIME_STATUSES.includes(value);
}

function isFinished(status?: string | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(status));
}

function isScheduled(status?: string | null) {
  return SCHEDULED_STATUSES.includes(normalizeStatus(status));
}

function labelForStatus(status?: string | null, hasPenalties = false) {
  const value = normalizeStatus(status);
  if (isLive(value)) return value === 'HT' || value.includes('HALF') ? 'استراحة' : 'مباشر';
  if (isFinished(value)) return hasPenalties ? 'حُسمت بركلات الترجيح' : 'انتهت';
  if (isScheduled(value)) return 'لم تبدأ';
  return value || 'مباراة';
}

function normalizeFilter(value: string | null): HubFilter {
  const allowed: HubFilter[] = ['today', 'yesterday', 'tomorrow', 'latest', 'live', 'group', 'all', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final'];
  return allowed.includes(value as HubFilter) ? value as HubFilter : 'today';
}

function normalizeGroup(value: string | null) {
  const key = String(value || 'A').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1) || 'A';
  return GROUPS.includes(key) ? key : 'A';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch { return null; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPenalties(value: unknown) {
  const external = asRecord(value);
  const penalties = asRecord(external?.penalties) || asRecord(external?.penaltyScore) || asRecord(external?.pens);
  const home = numberOrNull(penalties?.home ?? penalties?.Home ?? penalties?.homeTeam ?? penalties?.HomeTeam);
  const away = numberOrNull(penalties?.away ?? penalties?.Away ?? penalties?.awayTeam ?? penalties?.AwayTeam);
  return home !== null && away !== null ? { home, away } : null;
}

function dayRangeInEgypt(dayOffset: number) {
  const offsetMs = 3 * 60 * 60 * 1000;
  const localNow = new Date(Date.now() + offsetMs);
  const localStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + dayOffset, 0, 0, 0, 0));
  const start = new Date(localStart.getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

function groupLabels(group: string) {
  return [group, `Group ${group}`, `GROUP ${group}`, `GROUP_${group}`, `المجموعة ${group}`];
}

function groupWhere(group: string) {
  const labels = groupLabels(group);
  return {
    OR: [
      { homeTeam: { group } },
      { awayTeam: { group } },
      { groupPhase: { in: labels } },
      { stage: { in: labels } },
    ],
  };
}

function stageWhere(aliases: string[], contains: string[] = []) {
  return {
    OR: [
      ...aliases.flatMap((alias) => [
        { stage: { equals: alias, mode: 'insensitive' as const } },
        { groupPhase: { equals: alias, mode: 'insensitive' as const } },
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

function searchWhere(query: string) {
  const q = query.trim();
  if (!q) return {};
  return {
    OR: [
      { homeTeam: { name: { contains: q, mode: 'insensitive' as const } } },
      { awayTeam: { name: { contains: q, mode: 'insensitive' as const } } },
      { homeTeam: { code: { contains: q, mode: 'insensitive' as const } } },
      { awayTeam: { code: { contains: q, mode: 'insensitive' as const } } },
    ],
  };
}

function whereFor(filter: HubFilter, group: string) {
  if (filter === 'yesterday') return { matchDate: dayRangeInEgypt(-1) };
  if (filter === 'tomorrow') return { matchDate: dayRangeInEgypt(1) };
  if (filter === 'latest') return { status: { in: FINISHED_STATUSES } };
  if (filter === 'live') return { status: { in: [...LIVE_STATUSES, ...HALF_TIME_STATUSES] } };
  if (filter === 'group') return groupWhere(group);
  if (filter === 'all') return {};
  if (filter === 'round_of_32') return { AND: [stageWhere(ROUND_OF_32_ALIASES, ['round of 32', 'last 32', 'r32', 'دور الـ32', 'دور ال32']), fifaTrustedWhere()] };
  if (filter === 'round_of_16') return stageWhere(ROUND_OF_16_ALIASES, ['round of 16', 'last 16', 'r16', 'دور الـ16', 'دور ال16']);
  if (filter === 'quarter_finals') return stageWhere(QUARTER_FINAL_ALIASES, ['quarter']);
  if (filter === 'semi_finals') return stageWhere(SEMI_FINAL_ALIASES, ['semi']);
  if (filter === 'final') return stageWhere(FINAL_ALIASES);
  return { matchDate: dayRangeInEgypt(0) };
}

function orderByFor(filter: HubFilter) {
  return filter === 'latest' ? { matchDate: 'desc' as const } : { matchDate: 'asc' as const };
}

function takeFor(filter: HubFilter, limit: number) {
  if (filter === 'all') return Math.min(limit, 120);
  if (filter === 'group') return Math.min(limit, 12);
  if (filter === 'latest') return Math.min(limit, 30);
  if (filter === 'round_of_32') return 32;
  if (filter === 'round_of_16') return 16;
  if (filter === 'quarter_finals') return 8;
  if (filter === 'semi_finals') return 4;
  if (filter === 'final') return 2;
  return Math.min(limit, 24);
}

function matchDateDayKey(value: Date) {
  const offsetMs = 3 * 60 * 60 * 1000;
  const local = new Date(value.getTime() + offsetMs);
  return local.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const filter = normalizeFilter(req.nextUrl.searchParams.get('filter'));
    const group = normalizeGroup(req.nextUrl.searchParams.get('group'));
    const q = String(req.nextUrl.searchParams.get('q') || '').trim();
    const limit = Math.max(1, Math.min(80, Number(req.nextUrl.searchParams.get('limit') || 24)));
    const where = { AND: [whereFor(filter, group), searchWhere(q)].filter((part) => Object.keys(part).length) };

    const matches = await prisma.match.findMany({
      where,
      select: {
        id: true,
        matchDate: true,
        status: true,
        homeScore: true,
        awayScore: true,
        groupPhase: true,
        stage: true,
        animationMatchId: true,
        syncSource: true,
        lastSyncedAt: true,
        externalIds: true,
        homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
        _count: { select: { events: true, statsSnapshots: true } },
      },
      orderBy: orderByFor(filter),
      take: takeFor(filter, limit),
    });

    const normalized = matches.map((match) => {
      const groupValue = match.homeTeam.group || match.awayTeam.group || match.groupPhase || match.stage || null;
      const penalties = getPenalties(match.externalIds);
      return {
        id: match.id,
        href: `/matches/${match.id}`,
        liveHref: `/live-animation/${match.id}`,
        matchDate: match.matchDate,
        dayKey: matchDateDayKey(match.matchDate),
        status: match.status,
        statusLabel: labelForStatus(match.status, Boolean(penalties)),
        isLive: isLive(match.status),
        isFinished: isFinished(match.status),
        isScheduled: isScheduled(match.status),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        penalties,
        group: groupValue,
        stage: match.stage,
        syncSource: match.syncSource,
        lastSyncedAt: match.lastSyncedAt,
        hasLiveAnimation: Boolean(match.animationMatchId || match._count.events > 0),
        hasStats: match._count.statsSnapshots > 0,
        hasEvents: match._count.events > 0,
        homeTeam: withTeamDisplay(match.homeTeam),
        awayTeam: withTeamDisplay(match.awayTeam),
      };
    });

    const summary = {
      total: normalized.length,
      live: normalized.filter((item) => item.isLive).length,
      finished: normalized.filter((item) => item.isFinished).length,
      scheduled: normalized.filter((item) => item.isScheduled).length,
    };

    return NextResponse.json({ ok: true, mode: 'matches_hub_v4_fifa_r32_penalties', filter, group, q, summary, matches: normalized }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('matches hub error', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
