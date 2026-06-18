import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];
const LIVE = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET'];

function secrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((v) => String(v || '').trim()).filter(Boolean);
}

function authorized(req: Request, params: URLSearchParams) {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const candidates = [bearer, req.headers.get('x-admin-secret') || '', req.headers.get('x-cron-secret') || '', params.get('key') || '', params.get('adminSecret') || '', params.get('cronSecret') || ''];
  const valid = secrets();
  return candidates.some((value) => value && valid.includes(String(value).trim()));
}

function boolParam(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
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

function str(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}

function key(value: any) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractList(payload: any) {
  if (Array.isArray(payload)) return payload;
  for (const field of ['data', 'matches', 'fixtures', 'response', 'results', 'items']) if (Array.isArray(payload?.[field])) return payload[field];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  return [];
}

function extractTimeline(payload: any) {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data || payload?.response || payload?.result || payload;
  for (const field of ['timeline', 'events', 'incidents', 'commentary', 'data', 'items', 'results']) if (Array.isArray(data?.[field])) return data[field];
  return [];
}

function providerMatch(row: any) {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    id: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    home: str(home?.name, row?.homeName, row?.home_team_name),
    away: str(away?.name, row?.awayName, row?.away_team_name),
    date: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}

function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 999;
  return Math.abs(aa - bb) / 36e5;
}

function teamMatch(providerName: any, localTeam: any) {
  const p = key(providerName).replace('czechia', 'czech republic').replace('usa', 'united states');
  const l = key(localTeam?.name || localTeam?.code).replace('czechia', 'czech republic').replace('usa', 'united states');
  return Boolean(p && l && (p === l || p.includes(l) || l.includes(p)));
}

async function resolveProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_')) return { id: external, by: 'local_external_id' };
  const list = extractList(await theStatsApiFetch('/api/football/matches', query, { timeoutMs: 15000 })).map(providerMatch).filter((row) => row.id);
  const found = list.find((row) => teamMatch(row.home, match.homeTeam) && teamMatch(row.away, match.awayTeam) && hoursApart(row.date, match.matchDate) <= 4);
  return { id: found?.id || null, by: found ? 'provider_match_list' : null, searched: list.length };
}

function eventMinute(row: any) {
  const base = first(row?.minute, row?.time?.minute, row?.elapsed, row?.match_minute, row?.matchMinute, row?.event_minute, row?.time);
  if (typeof base === 'string') {
    const stoppage = base.match(/(45|90|105)\s*\+\s*(\d+)/);
    if (stoppage) return { minute: Number(stoppage[1]) + Number(stoppage[2]), label: `${stoppage[1]}+${stoppage[2]}` };
  }
  const minute = n(base);
  const extra = n(first(row?.extra_time, row?.extra_minute, row?.added_time, row?.stoppage_time, row?.time?.extra, row?.extra));
  if (minute !== null && extra !== null && extra > 0) return { minute: Math.round(minute + extra), label: `${Math.round(minute)}+${Math.round(extra)}` };
  return { minute: minute === null ? null : Math.round(minute), label: minute === null ? null : String(Math.round(minute)) };
}

function eventType(row: any) {
  const raw = key(first(row?.type, row?.event_type, row?.incident_type, row?.name, row?.detail));
  if (raw.includes('penalty scored')) return { type: 'penalty_goal', label: 'هدف من ركلة جزاء' };
  if (raw.includes('penalty awarded')) return { type: 'penalty_awarded', label: 'ركلة جزاء' };
  if (raw.includes('goal')) return { type: 'goal', label: 'هدف' };
  if (raw.includes('sub')) return { type: 'substitution', label: 'تبديل' };
  if (raw.includes('yellow')) return { type: 'yellow_card', label: 'بطاقة صفراء' };
  if (raw.includes('red')) return { type: 'red_card', label: 'بطاقة حمراء' };
  if (raw.includes('corner')) return { type: 'corner', label: 'ركنية' };
  if (raw.includes('var')) return { type: 'var', label: 'VAR' };
  if (raw.includes('shot')) return { type: 'shot', label: 'تسديدة' };
  if (raw.includes('offside')) return { type: 'offside', label: 'تسلل' };
  if (raw.includes('foul')) return { type: 'foul', label: 'خطأ' };
  if (raw.includes('period start')) return { type: 'period_start', label: 'بداية الشوط' };
  if (raw.includes('period end')) return { type: 'period_end', label: 'نهاية الشوط' };
  return { type: str(row?.type, row?.event_type, row?.incident_type) || 'note', label: str(row?.type, row?.event_type, row?.incident_type) || 'حدث' };
}

function compactEvent(row: any, sourcePath: string) {
  const minute = eventMinute(row);
  const kind = eventType(row);
  const teamName = str(row?.team?.name, row?.team_name, row?.teamName);
  const playerName = str(row?.player?.name, row?.player_name, row?.playerName, row?.scorer?.name, row?.athlete?.name);
  const detail = str(row?.detail, row?.description, row?.comment, row?.text, row?.message) || [teamName, minute.label ? `د${minute.label}'` : null, kind.label, playerName].filter(Boolean).join(' - ');
  return { ...kind, minute: minute.minute, displayMinute: minute.label, teamName, playerName, detail, sourcePath };
}

function typeFamily(value: any) {
  const raw = key(value);
  if (raw.includes('goal')) return 'goal';
  if (raw.includes('penalty')) return 'penalty';
  if (raw.includes('sub')) return 'substitution';
  if (raw.includes('corner')) return 'corner';
  if (raw.includes('shot')) return 'shot';
  if (raw.includes('card') || raw.includes('yellow') || raw.includes('red')) return 'card';
  if (raw.includes('var')) return 'var';
  if (raw.includes('offside')) return 'offside';
  if (raw.includes('foul')) return 'foul';
  return raw || 'note';
}

function eventTeamId(event: any, match: any) {
  if (teamMatch(event.teamName, match.homeTeam)) return match.homeTeamId;
  if (teamMatch(event.teamName, match.awayTeam)) return match.awayTeamId;
  return null;
}

function similar(event: any, existing: any, match: any) {
  if ((event.minute ?? null) !== (existing.minute ?? null)) return false;
  if (typeFamily(event.type) !== typeFamily(existing.type)) return false;
  const teamId = eventTeamId(event, match);
  if (teamId && existing.teamId && teamId !== existing.teamId) return false;
  const p = key(event.playerName);
  const e = key(existing.playerName);
  return !p || !e || p === e || p.includes(e) || e.includes(p);
}

function pair(value: any, sourcePath: string) {
  if (!value || typeof value !== 'object') return null;
  const source = value.all && typeof value.all === 'object' ? value.all : value;
  const home = n(source.home);
  const away = n(source.away);
  if (home === null && away === null) return null;
  return { home, away, sourcePath };
}

function parseLiveStats(payload: any) {
  const data = payload?.data || payload;
  const overview = data?.overview || {};
  const shots = data?.shots || {};
  const attack = data?.attack || {};
  const stats: Record<string, any> = {};
  const entries: Array<[string, any]> = [
    ['possession', pair(overview.ball_possession || data?.ball_possession, 'live-stats.ball_possession')],
    ['shots', pair(overview.total_shots || shots.total_shots || data?.total_shots, 'live-stats.total_shots')],
    ['shotsOnTarget', pair(overview.shots_on_target || shots.shots_on_target || data?.shots_on_target, 'live-stats.shots_on_target')],
    ['shotsOffTarget', pair(shots.shots_off_target || data?.shots_off_target, 'live-stats.shots_off_target')],
    ['corners', pair(overview.corner_kicks || data?.corner_kicks || data?.corners, 'live-stats.corner_kicks')],
    ['yellowCards', pair(overview.yellow_cards || data?.yellow_cards, 'live-stats.yellow_cards')],
    ['redCards', pair(overview.red_cards || data?.red_cards, 'live-stats.red_cards')],
    ['attacks', pair(attack.attacks || data?.attacks, 'live-stats.attacks')],
    ['dangerousAttacks', pair(attack.dangerous_attacks || data?.dangerous_attacks, 'live-stats.dangerous_attacks')],
  ];
  for (const [name, value] of entries) if (value) stats[name] = value;
  return stats;
}

function statInt(stats: Record<string, any>, keyName: string, side: 'home' | 'away') {
  const value = n(stats[keyName]?.[side]);
  return value === null ? null : Math.round(value);
}

function snapshotMinute(match: any, livePayload: any, timelineMinute: number | null) {
  const raw = livePayload?.data || livePayload || {};
  const direct = n(first(raw.minute, raw.elapsed, raw.matchMinute, raw.currentMinute, raw?.time?.minute, raw?.fixture?.status?.elapsed));
  if (direct !== null) return Math.round(direct);
  if (timelineMinute) return timelineMinute;
  const elapsed = Math.floor((Date.now() - new Date(match.matchDate).getTime()) / 60_000) + 1;
  return Number.isFinite(elapsed) ? Math.max(1, Math.min(130, elapsed)) : null;
}

async function syncMatch(match: any, dryRun: boolean, skipSimilarExisting: boolean, query: Record<string, string | number>) {
  const resolved = await resolveProviderId(match, query);
  if (!resolved.id) return { ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, error: 'Could not resolve provider match id', resolved };

  const timelinePath = `/api/football/matches/${encodeURIComponent(resolved.id)}/timeline`;
  const liveStatsPath = `/api/football/matches/${encodeURIComponent(resolved.id)}/live-stats`;
  const [timelineResult, liveStatsResult] = await Promise.all([
    theStatsApiFetch(timelinePath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) })),
    theStatsApiFetch(liveStatsPath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) })),
  ]);

  const rows = timelineResult.ok ? extractTimeline((timelineResult as any).payload) : [];
  const providerEvents = rows.map((row) => compactEvent(row, timelinePath)).filter((event) => event.detail);
  let eventsToImport = providerEvents;
  let skippedSimilarExisting = 0;

  if (skipSimilarExisting) {
    const existing = await prisma.matchEvent.findMany({ where: { matchId: match.id, OR: [{ sourceName: null }, { sourceName: { not: 'THE_STATS_API' } }] }, select: { minute: true, type: true, teamId: true, playerName: true } });
    eventsToImport = providerEvents.filter((event) => {
      const duplicated = existing.some((row) => similar(event, row, match));
      if (duplicated) skippedSimilarExisting += 1;
      return !duplicated;
    });
  }

  const latestTimelineMinute = providerEvents.reduce((max, event) => Math.max(max, Number(event.minute || 0)), 0) || null;
  const liveStatsPayload = liveStatsResult.ok ? (liveStatsResult as any).payload : null;
  const stats = liveStatsPayload ? parseLiveStats(liveStatsPayload) : {};
  const minute = snapshotMinute(match, liveStatsPayload, latestTimelineMinute);
  const shouldMarkLive = Boolean((providerEvents.length || liveStatsResult.ok) && !FINISHED.includes(String(match.status || '').toUpperCase()) && !LIVE.includes(String(match.status || '').toUpperCase()));
  let importedMatchEvents = 0;
  let createdSnapshot = null;
  let statusUpdated = false;

  if (!dryRun) {
    if (Object.keys(stats).length || liveStatsResult.ok) {
      createdSnapshot = await prisma.matchStatsSnapshot.create({ data: {
        id: randomUUID(),
        matchId: match.id,
        provider: 'THE_STATS_API_LIVE',
        providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0,
        minute,
        homePossession: statInt(stats, 'possession', 'home'),
        awayPossession: statInt(stats, 'possession', 'away'),
        homeAttacks: statInt(stats, 'attacks', 'home'),
        awayAttacks: statInt(stats, 'attacks', 'away'),
        homeDangerousAttacks: statInt(stats, 'dangerousAttacks', 'home'),
        awayDangerousAttacks: statInt(stats, 'dangerousAttacks', 'away'),
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
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        rawData: { status: 'IN_PLAY', minute, liveStats: liveStatsPayload, stats, source: { provider: 'THE_STATS_API', liveStatsPath, timelinePath }, importedAt: new Date().toISOString() },
      } });
    }
    await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: 'THE_STATS_API' } });
    if (eventsToImport.length) {
      const result = await prisma.matchEvent.createMany({ data: eventsToImport.map((event) => ({ matchId: match.id, minute: event.minute, type: event.type, teamId: eventTeamId(event, match), playerName: event.playerName || null, detail: event.detail, sourceName: 'THE_STATS_API', sourceUrl: event.sourcePath })) });
      importedMatchEvents = result.count;
    }
    if (shouldMarkLive) {
      await prisma.match.update({ where: { id: match.id }, data: { status: 'IN_PLAY' } });
      statusUpdated = true;
    }
  }

  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, previousStatus: match.status, statusAfterSync: statusUpdated ? 'IN_PLAY' : match.status, statusUpdated, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, timelineOk: timelineResult.ok, liveStatsOk: liveStatsResult.ok, liveStatsError: liveStatsResult.ok ? null : (liveStatsResult as any).error, providerEventsFound: providerEvents.length, eventsToImport: eventsToImport.length, skippedSimilarExisting, liveStatsFound: Object.keys(stats).length, latestMinute: minute, snapshotSaved: Boolean(createdSnapshot), importedMatchEvents, preview: providerEvents.slice(-8) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authorized(req, url.searchParams)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const matchId = url.searchParams.get('matchId') || '';
  const dryRun = boolParam(url.searchParams.get('dryRun'), true);
  const skipSimilarExisting = boolParam(url.searchParams.get('skipSimilarExisting'), true);
  const limit = intParam(url.searchParams.get('limit'), 8, 1, 20);
  const minutesBack = intParam(url.searchParams.get('minutesBack'), 180, 15, 360);
  const minutesForward = intParam(url.searchParams.get('minutesForward'), 30, 0, 180);
  const now = new Date();
  const query = { competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107', season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868', per_page: intParam(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100) };

  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { matchDate: { gte: new Date(now.getTime() - minutesBack * 60_000), lte: new Date(now.getTime() + minutesForward * 60_000) }, status: { notIn: FINISHED } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' }, take: limit });

    const results = [];
    for (const match of matches) {
      try { results.push(await syncMatch(match, dryRun, skipSimilarExisting, query)); }
      catch (error: any) { results.push({ ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, error: safeTheStatsApiError(error) }); }
    }
    const successful = results.filter((result: any) => result.ok);
    return NextResponse.json({ ok: true, provider: 'THE_STATS_API', mode: 'the_stats_live_catchup', dryRun, saved: !dryRun, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, skipSimilarExisting, totalProviderEventsFound: successful.reduce((sum: number, item: any) => sum + Number(item.providerEventsFound || 0), 0), totalEventsToImport: successful.reduce((sum: number, item: any) => sum + Number(item.eventsToImport || 0), 0), totalLiveStatsFound: successful.reduce((sum: number, item: any) => sum + Number(item.liveStatsFound || 0), 0), totalImportedMatchEvents: successful.reduce((sum: number, item: any) => sum + Number(item.importedMatchEvents || 0), 0), snapshotsSaved: successful.filter((item: any) => item.snapshotSaved).length, statusUpdated: successful.filter((item: any) => item.statusUpdated).length, results, config: getTheStatsApiConfigStatus() }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, provider: 'THE_STATS_API', mode: 'the_stats_live_catchup', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
