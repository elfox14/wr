import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withTeamDisplay } from '@/lib/teamDisplay';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
const GROUPS = 'ABCDEFGHIJKL'.split('');
const GROUP_STAGE_LABELS = ['group', 'GROUP', 'Group', 'GROUP_STAGE', 'Group Stage', 'دور المجموعات'];
const ROUND_OF_32_LABELS = [
  'round_of_32',
  'ROUND_OF_32',
  'ROUND_32',
  'LAST_32',
  'last_32',
  'Round of 32',
  'ROUND OF 32',
  'R32',
  'دور الـ32',
  'دور ال32',
  'دور 32',
];

type HubFilter = 'round32' | 'today' | 'yesterday' | 'tomorrow' | 'latest' | 'live' | 'group' | 'all';

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toUpperCase();
}

function normalizeStage(stage?: string | null) {
  return String(stage || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
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

function isGroupStage(stage?: string | null) {
  const value = normalizeStage(stage);
  return !value || value === 'GROUP' || value === 'GROUP_STAGE' || value.includes('GROUP');
}

function isRoundOf32(stage?: string | null) {
  const value = normalizeStage(stage);
  return value === 'ROUND_OF_32' || value === 'ROUND_32' || value === 'LAST_32' || value === 'R32' || value.includes('32');
}

function displayStageLabel(stage?: string | null) {
  const value = normalizeStage(stage);
  if (isRoundOf32(stage)) return 'دور الـ32';
  if (value === 'ROUND_OF_16' || value === 'LAST_16') return 'دور الـ16';
  if (value.includes('QUARTER')) return 'ربع النهائي';
  if (value.includes('SEMI')) return 'نصف النهائي';
  if (value.includes('THIRD')) return 'تحديد المركز الثالث';
  if (value === 'FINAL') return 'النهائي';
  if (isGroupStage(stage)) return 'دور المجموعات';
  return stage || 'المباراة';
}

function labelForStatus(status?: string | null) {
  const value = normalizeStatus(status);
  if (isLive(value)) return value === 'HT' || value.includes('HALF') ? 'استراحة' : 'مباشر';
  if (isFinished(value)) return 'انتهت';
  if (isScheduled(value)) return 'لم تبدأ';
  return value || 'مباراة';
}

function normalizeFilter(value: string | null): HubFilter {
  const allowed: HubFilter[] = ['round32', 'today', 'yesterday', 'tomorrow', 'latest', 'live', 'group', 'all'];
  return allowed.includes(value as HubFilter) ? value as HubFilter : 'round32';
}

function normalizeGroup(value: string | null) {
  const key = String(value || 'A').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1) || 'A';
  return GROUPS.includes(key) ? key : 'A';
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
      { groupPhase: { in: labels } },
      { stage: { in: labels } },
      {
        AND: [
          { stage: { in: GROUP_STAGE_LABELS } },
          { OR: [{ homeTeam: { group } }, { awayTeam: { group } }] },
        ],
      },
    ],
  };
}

function roundOf32Where() {
  return {
    OR: [
      { stage: { in: ROUND_OF_32_LABELS } },
      { groupPhase: { in: ROUND_OF_32_LABELS } },
      { stage: { contains: '32', mode: 'insensitive' as const } },
      { groupPhase: { contains: '32', mode: 'insensitive' as const } },
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
  if (filter === 'round32') return roundOf32Where();
  if (filter === 'yesterday') return { matchDate: dayRangeInEgypt(-1) };
  if (filter === 'tomorrow') return { matchDate: dayRangeInEgypt(1) };
  if (filter === 'latest') return { status: { in: FINISHED_STATUSES } };
  if (filter === 'live') return { status: { in: [...LIVE_STATUSES, ...HALF_TIME_STATUSES] } };
  if (filter === 'group') return groupWhere(group);
  if (filter === 'all') return {};
  return { matchDate: dayRangeInEgypt(0) };
}

function orderByFor(filter: HubFilter) {
  return filter === 'latest' ? { matchDate: 'desc' as const } : { matchDate: 'asc' as const };
}

function takeFor(filter: HubFilter, limit: number) {
  if (filter === 'all') return Math.min(limit, 120);
  if (filter === 'round32') return Math.min(limit, 32);
  if (filter === 'group') return Math.min(limit, 12);
  if (filter === 'latest') return Math.min(limit, 30);
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
    const limit = Math.max(1, Math.min(120, Number(req.nextUrl.searchParams.get('limit') || 32)));
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
        homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
        _count: { select: { events: true, statsSnapshots: true } },
      },
      orderBy: orderByFor(filter),
      take: takeFor(filter, limit),
    });

    const normalized = matches.map((match) => {
      const stageValue = match.stage || match.groupPhase || null;
      const groupValue = isGroupStage(stageValue)
        ? match.groupPhase || match.homeTeam.group || match.awayTeam.group || displayStageLabel(stageValue)
        : displayStageLabel(stageValue);

      return {
        id: match.id,
        href: `/match-center/${match.id}`,
        liveHref: `/live-animation/${match.id}`,
        reportHref: `/articles/match/${match.id}`,
        matchDate: match.matchDate,
        dayKey: matchDateDayKey(match.matchDate),
        status: match.status,
        statusLabel: labelForStatus(match.status),
        isLive: isLive(match.status),
        isFinished: isFinished(match.status),
        isScheduled: isScheduled(match.status),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        group: groupValue,
        stage: match.stage,
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

    return NextResponse.json(
      { ok: true, mode: 'matches_hub_v2_round32', filter, group, q, summary, matches: normalized },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch (error) {
    console.error('matches hub error', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
