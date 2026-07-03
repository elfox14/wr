import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';
import { revalidateStatsViews } from '@/lib/revalidateStatsViews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const parsed = Number(url.searchParams.get(name) ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function latinFold(value: string) {
  return value
    .replace(/[Øø]/g, 'o')
    .replace(/[Ðð]/g, 'd')
    .replace(/[Þþ]/g, 'th')
    .replace(/[Łł]/g, 'l')
    .replace(/[Đđ]/g, 'd')
    .replace(/[İIı]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Çç]/g, 'c')
    .replace(/[Öö]/g, 'o')
    .replace(/[Üü]/g, 'u');
}

function normalizeText(value: unknown) {
  return latinFold(String(value || ''))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value: unknown) {
  return normalizeText(value).split(' ').filter((word) => word.length > 1);
}

function similarity(a: unknown, b: unknown) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 88;
  const aw = new Set(words(aa));
  const bw = new Set(words(bb));
  if (!aw.size || !bw.size) return 0;
  const hits = Array.from(aw).filter((word) => bw.has(word)).length;
  return Math.round((hits / Math.max(aw.size, bw.size)) * 75);
}

function playerMatchScore(eventName: string, assetName: string) {
  const base = similarity(eventName, assetName);
  const eventWords = words(eventName);
  const assetWords = words(assetName);
  if (!eventWords.length || !assetWords.length) return base;

  const eventSet = new Set(eventWords);
  const assetSet = new Set(assetWords);
  const eventInsideAsset = eventWords.every((word) => assetSet.has(word));
  const assetInsideEvent = assetWords.every((word) => eventSet.has(word));
  if (eventInsideAsset || assetInsideEvent) return Math.max(base, 88);

  const eventLast = eventWords[eventWords.length - 1];
  const assetLast = assetWords[assetWords.length - 1];
  if (eventLast && assetLast && eventLast === assetLast) return Math.max(base, 70);

  return base;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deterministicFixtureId(match: any) {
  const direct = Number(String(match?.statsSnapshots?.[0]?.providerMatchId || match?.externalId || '').replace(/\D/g, ''));
  if (Number.isFinite(direct) && direct > 0) return direct;
  const text = String(match?.id || 'match');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 31) + text.charCodeAt(i)) % 1_900_000_000;
  return hash || 1;
}

function teamNameFor(match: any, teamId?: string | null) {
  if (teamId && match.homeTeamId === teamId) return match.homeTeam?.name || null;
  if (teamId && match.awayTeamId === teamId) return match.awayTeam?.name || null;
  return null;
}

function opponentNameFor(match: any, teamId?: string | null) {
  if (teamId && match.homeTeamId === teamId) return match.awayTeam?.name || null;
  if (teamId && match.awayTeamId === teamId) return match.homeTeam?.name || null;
  return null;
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const startedAt = Date.now();
  const dryRun = boolParam(url, 'dryRun', true);
  const createMissingAssets = boolParam(url, 'createMissingAssets', false);
  const limit = intParam(url, 'limit', 200, 1, 1000);

  const events = await prisma.matchEvent.findMany({
    where: { type: 'goal', playerName: { not: null } },
    select: { matchId: true, minute: true, type: true, playerName: true, teamId: true, sourceName: true },
    orderBy: [{ matchId: 'asc' }, { minute: 'asc' }],
    take: limit,
  });

  const shotmapGoalMatches = new Set(events
    .filter((event) => event.sourceName === 'THE_STATS_API_FINAL_SHOTMAP')
    .map((event) => event.matchId));

  const eventGroups = new Map<string, { matchId: string; teamId: string | null; playerName: string; goals: number }>();
  const seenGoalEvents = new Set<string>();

  for (const event of events) {
    if (!event.playerName) continue;
    if (shotmapGoalMatches.has(event.matchId) && event.sourceName !== 'THE_STATS_API_FINAL_SHOTMAP') continue;
    const eventKey = `${event.matchId}:${event.teamId || 'team'}:${normalizeText(event.playerName)}:${event.minute ?? 'na'}`;
    if (seenGoalEvents.has(eventKey)) continue;
    seenGoalEvents.add(eventKey);
    const groupKey = `${event.matchId}:${event.teamId || 'team'}:${normalizeText(event.playerName)}`;
    const current = eventGroups.get(groupKey) || { matchId: event.matchId, teamId: event.teamId || null, playerName: event.playerName, goals: 0 };
    current.goals += 1;
    eventGroups.set(groupKey, current);
  }

  const matchIds = [...new Set([...eventGroups.values()].map((group) => group.matchId))];
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: { where: { provider: { startsWith: 'THE_STATS_API' } }, orderBy: { capturedAt: 'desc' }, take: 1, select: { providerMatchId: true } },
    },
  });
  const matchById = new Map(matches.map((match) => [match.id, match]));

  const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))];
  const playerAssets = await prisma.asset.findMany({
    where: { type: 'PLAYER', teamId: { in: teamIds } },
    select: { id: true, name: true, teamId: true, code: true, image: true },
  });

  let repaired = 0;
  let alreadyOk = 0;
  let unmatched = 0;
  let createdAssets = 0;
  const details: any[] = [];

  for (const group of eventGroups.values()) {
    const match = matchById.get(group.matchId);
    if (!match) continue;
    const candidates = playerAssets
      .filter((asset) => !group.teamId || asset.teamId === group.teamId)
      .map((asset) => ({ asset, score: playerMatchScore(group.playerName, asset.name) }))
      .sort((a, b) => b.score - a.score);
    let selected = candidates[0]?.score >= 65 ? candidates[0].asset : null;

    if (!selected && createMissingAssets && group.teamId && !dryRun) {
      const id = `event-player-${group.teamId}-${normalizeText(group.playerName).replace(/\s+/g, '-').slice(0, 80)}`;
      selected = await prisma.asset.upsert({
        where: { id },
        create: {
          id,
          type: 'PLAYER',
          name: group.playerName,
          code: '',
          image: '',
          current_price: 0,
          high_price: 0,
          low_price: 0,
          market_cap: '0',
          volume: '0',
          change: 0,
          teamId: group.teamId,
          isAvailable: false,
        },
        update: { name: group.playerName, teamId: group.teamId },
        select: { id: true, name: true, teamId: true, code: true, image: true },
      });
      createdAssets += 1;
      playerAssets.push(selected);
    }

    if (!selected) {
      unmatched += 1;
      details.push({ status: 'unmatched', playerName: group.playerName, teamName: teamNameFor(match, group.teamId), eventGoals: group.goals, bestScore: candidates[0]?.score || 0, bestCandidate: candidates[0]?.asset?.name || null });
      continue;
    }

    const fixtureId = deterministicFixtureId(match);
    const existing = await prisma.playerPerformance.findUnique({
      where: { assetId_providerFixtureId: { assetId: selected.id, providerFixtureId: fixtureId } },
      select: { id: true, goals: true },
    }).catch(() => null);

    const currentGoals = safeNumber(existing?.goals, 0);
    if (currentGoals >= group.goals) {
      alreadyOk += 1;
      continue;
    }

    repaired += 1;
    details.push({ status: dryRun ? 'would_repair' : 'repaired', playerName: selected.name, teamName: teamNameFor(match, selected.teamId), fromGoals: currentGoals, toGoals: group.goals, matchScore: candidates[0]?.score || 0 });
    if (dryRun) continue;

    const rating = Math.max(50, Math.min(100, 50 + group.goals * 12));
    await prisma.playerPerformance.upsert({
      where: { assetId_providerFixtureId: { assetId: selected.id, providerFixtureId: fixtureId } },
      create: {
        assetId: selected.id,
        provider: 'MATCH_EVENT_GOAL_REPAIR',
        providerFixtureId: fixtureId,
        competition: 'FIFA World Cup',
        teamName: teamNameFor(match, selected.teamId),
        opponentName: opponentNameFor(match, selected.teamId),
        goals: group.goals,
        internalRating: rating,
        momentumImpact: Math.round((rating - 50) * 10) / 10,
        marketImpact: Math.round((rating - 50) * 6) / 10,
        rawData: { source: 'MatchEvent goal repair', eventGoals: group.goals, playerName: group.playerName, teamId: group.teamId, matchScore: candidates[0]?.score || 0 },
        matchDate: match.matchDate,
      },
      update: {
        goals: group.goals,
        provider: 'MATCH_EVENT_GOAL_REPAIR',
        rawData: { source: 'MatchEvent goal repair', eventGoals: group.goals, previousGoals: currentGoals, playerName: group.playerName, teamId: group.teamId, matchScore: candidates[0]?.score || 0 },
      },
    });
  }

  const revalidation = repaired > 0 && !dryRun ? revalidateStatsViews('statistics-event-goals-repair') : null;

  return json({
    ok: true,
    mode: 'statistics_event_goals_repair_v2_better_name_matching',
    durationMs: Date.now() - startedAt,
    dryRun,
    createMissingAssets,
    scannedEvents: events.length,
    goalGroups: eventGroups.size,
    repaired,
    alreadyOk,
    unmatched,
    createdAssets,
    details: details.slice(0, 40),
    cache: { revalidated: Boolean(revalidation), revalidation },
    note: 'This repair only raises PlayerPerformance.goals when MatchEvent has more goals for the same player/match. It never lowers goals.',
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
