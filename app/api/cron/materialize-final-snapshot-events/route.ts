import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function boolParam(url: URL, name: string, fallback = false) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const n = Number(url.searchParams.get(name) ?? fallback);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

function cleanText(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    return text && text !== '[object Object]' ? text : null;
  }
  if (value && typeof value === 'object') return cleanText(value.name || value.fullName || value.displayName || value.title || value.label);
  return null;
}

function toMinute(value: any): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(130, Math.floor(n)));
}

function textKey(value: any) {
  return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sameTeam(value: any, team: any) {
  const a = textKey(value);
  const name = textKey(team?.name);
  const code = textKey(team?.code);
  return Boolean(a && ((name && (a === name || a.includes(name) || name.includes(a))) || (code && a === code)));
}

function teamIdFromEvent(event: any, homeTeam: any, awayTeam: any) {
  const raw = event?.teamName || event?.team_name || event?.team?.name || event?.team || event?.country || event?.side;
  if (sameTeam(raw, homeTeam)) return homeTeam.id;
  if (sameTeam(raw, awayTeam)) return awayTeam.id;
  return cleanText(event?.teamId || event?.team_id);
}

function eventType(event: any) {
  const raw = String(event?.type || event?.eventType || event?.event_type || event?.name || 'event').trim().toLowerCase();
  if (raw.includes('goal')) return 'goal';
  if (raw.includes('yellow')) return 'yellow_card';
  if (raw.includes('red')) return 'red_card';
  if (raw.includes('sub')) return 'substitution';
  if (raw.includes('corner')) return 'corner_kick';
  if (raw.includes('shot')) return 'shot';
  if (raw.includes('offside')) return 'offside';
  if (raw.includes('foul')) return 'foul';
  if (raw.includes('period') || raw.includes('half') || raw.includes('end')) return raw.includes('end') ? 'period_end' : 'period_start';
  return raw || 'event';
}

function eventDetail(event: any) {
  const detail = cleanText(event?.detail || event?.description || event?.comment || event?.text);
  if (detail) return detail;
  const player = cleanText(event?.playerName || event?.player_name || event?.player?.name);
  const team = cleanText(event?.teamName || event?.team?.name || event?.team);
  const type = eventType(event);
  return [type, player, team].filter(Boolean).join(' - ') || 'حدث محفوظ.';
}

function finalEventsFromSnapshot(snapshot: any) {
  const data = snapshot?.rawData && typeof snapshot.rawData === 'object' ? snapshot.rawData : {};
  const normalized = (data as any).normalized || (data as any).normalizedPreview || (data as any).debug?.normalizedPreview || {};
  const events = normalized?.eventsDetailed?.all || normalized?.events || (data as any).eventsDetailed?.all || (data as any).events || [];
  return Array.isArray(events) ? events : [];
}

async function run(req: Request) {
  if (!hasValidAdminSecret(req)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId');
  const limit = intParam(url, 'limit', 10, 1, 50);
  const dryRun = boolParam(url, 'dryRun', true) && !boolParam(url, 'apply', false);
  const replace = boolParam(url, 'replace', true);

  const matches = await prisma.match.findMany({
    where: matchId ? { id: matchId } : { status: { in: FINISHED } },
    orderBy: { matchDate: 'asc' },
    take: matchId ? 1 : limit,
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      events: { select: { id: true }, take: 500 },
      statsSnapshots: {
        where: { provider: { startsWith: 'THE_STATS_API' } },
        orderBy: { capturedAt: 'desc' },
        take: 5,
        select: { id: true, provider: true, rawData: true },
      },
    },
  });

  const processed = [];

  for (const match of matches) {
    const finalSnapshot = match.statsSnapshots.find((snapshot) => finalEventsFromSnapshot(snapshot).length > 0) || null;
    const rawEvents = finalSnapshot ? finalEventsFromSnapshot(finalSnapshot) : [];
    const teams = `${match.homeTeam?.name || match.homeTeamId} vs ${match.awayTeam?.name || match.awayTeamId}`;

    if (!finalSnapshot || rawEvents.length <= 0) {
      processed.push({ matchId: match.id, teams, status: 'skipped_no_final_snapshot_events', currentMatchEvents: match.events.length });
      continue;
    }

    if (!replace && match.events.length > 0) {
      processed.push({ matchId: match.id, teams, status: 'skipped_match_events_already_exist', finalSnapshotId: finalSnapshot.id, currentMatchEvents: match.events.length, snapshotEvents: rawEvents.length });
      continue;
    }

    const rows = rawEvents.slice(0, 250).map((event: any, index: number) => ({
      id: randomUUID(),
      matchId: match.id,
      minute: toMinute(event?.minute ?? event?.time ?? event?.matchMinute),
      type: eventType(event),
      teamId: teamIdFromEvent(event, match.homeTeam, match.awayTeam),
      playerName: cleanText(event?.playerName || event?.player_name || event?.player?.name),
      detail: eventDetail(event),
      sourceName: 'THE_STATS_API_FINAL_SNAPSHOT',
      sourceUrl: null,
    }));

    let deleted = 0;
    let inserted = 0;

    if (!dryRun) {
      if (replace) {
        const deletedResult = await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });
        deleted = deletedResult.count;
      }
      if (rows.length > 0) {
        const insertedResult = await prisma.matchEvent.createMany({ data: rows });
        inserted = insertedResult.count;
      }
    }

    processed.push({
      matchId: match.id,
      teams,
      status: dryRun ? 'dry_run_would_materialize_events' : 'materialized_final_snapshot_events',
      finalSnapshotId: finalSnapshot.id,
      beforeMatchEvents: match.events.length,
      snapshotEvents: rawEvents.length,
      deleted,
      inserted,
      replace,
    });
  }

  return json({
    ok: true,
    mode: 'materialize_final_snapshot_events_v1',
    dryRun,
    scope: { matchId, limit, selected: matches.length, replace },
    policy: 'For finished matches only: copy final TheStats snapshot events into MatchEvent so the fast match page can display them, replacing stale rows to avoid duplicates.',
    processed,
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
