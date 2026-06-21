import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];

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
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
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
  if (Array.isArray(data?.events)) return data.events;
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
function teamKey(team: any) {
  return key(team?.name || team?.code).replace('czechia', 'czech republic').replace('usa', 'united states').replace('bosnia h', 'bosnia and herzegovina');
}
function teamMatch(providerName: any, localTeam: any) {
  const p = key(providerName).replace('czechia', 'czech republic').replace('usa', 'united states').replace('bosnia h', 'bosnia and herzegovina');
  const l = teamKey(localTeam);
  return Boolean(p && l && (p === l || p.includes(l) || l.includes(p)));
}
async function resolveProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_')) return { id: external, by: 'local_external_id' };
  const list = extractList(await theStatsApiFetch('/api/football/matches', query, { timeoutMs: 15000 })).map(providerMatch).filter((row) => row.id);
  const found = list.find((row) => teamMatch(row.home, match.homeTeam) && teamMatch(row.away, match.awayTeam) && hoursApart(row.date, match.matchDate) <= 4);
  return { id: found?.id || null, by: found ? 'provider_match_list' : null, searched: list.length };
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
  const data = payload?.data || payload || {};
  const meta = data?.meta || {};
  const providerStats = data?.stats || {};
  const overview = data?.overview || {};
  const shots = data?.shots || {};
  const attack = data?.attack || {};
  const stats: Record<string, any> = {};
  const entries: Array<[string, any]> = [
    ['possession', pair(providerStats.ball_possession || overview.ball_possession || data?.ball_possession, 'live-stats.stats.ball_possession')],
    ['shots', pair(providerStats.total_shots || overview.total_shots || shots.total_shots || data?.total_shots, 'live-stats.stats.total_shots')],
    ['shotsOnTarget', pair(providerStats.shots_on_target || overview.shots_on_target || shots.shots_on_target || data?.shots_on_target, 'live-stats.stats.shots_on_target')],
    ['shotsOffTarget', pair(providerStats.shots_off_target || shots.shots_off_target || data?.shots_off_target, 'live-stats.stats.shots_off_target')],
    ['corners', pair(providerStats.corner_kicks || overview.corner_kicks || data?.corner_kicks || data?.corners, 'live-stats.stats.corner_kicks')],
    ['yellowCards', pair(providerStats.yellow_cards || overview.yellow_cards || data?.yellow_cards, 'live-stats.stats.yellow_cards')],
    ['redCards', pair(providerStats.red_cards || overview.red_cards || data?.red_cards, 'live-stats.stats.red_cards')],
    ['attacks', pair(providerStats.attacks || attack.attacks || data?.attacks, 'live-stats.stats.attacks')],
    ['dangerousAttacks', pair(providerStats.dangerous_attacks || attack.dangerous_attacks || data?.dangerous_attacks, 'live-stats.stats.dangerous_attacks')],
    ['xg', pair(providerStats.expected_goals || providerStats.xg || data?.expected_goals || data?.xg, 'live-stats.stats.expected_goals')],
    ['bigChances', pair(providerStats.big_chances || data?.big_chances, 'live-stats.stats.big_chances')],
    ['fouls', pair(providerStats.fouls || data?.fouls, 'live-stats.stats.fouls')],
    ['offsides', pair(providerStats.offsides || data?.offsides, 'live-stats.stats.offsides')],
  ];
  for (const [name, value] of entries) if (value) stats[name] = value;
  return { stats, meta };
}
function statInt(stats: Record<string, any>, keyName: string, side: 'home' | 'away') {
  const value = n(stats[keyName]?.[side]);
  return value === null ? null : Math.round(value);
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
function eventText(row: any) {
  return key(first(row?.type, row?.event_type, row?.incident_type, row?.name, row?.detail, row?.description, row?.comment, row?.text, row?.message));
}
function isRealGoalText(raw: string) {
  if (!raw) return false;
  if (/(goal kick|goal attempt|shot on goal|saved goal|goalkeeper|goalkeeper save|keeper|disallowed goal|no goal|goal line|own half)/.test(raw)) return false;
  return raw === 'goal' || raw.includes('goal scored') || raw.includes('scored goal') || raw.includes('scored a goal') || raw.includes('penalty scored') || raw.includes('own goal') || raw.includes('هدف');
}
function eventType(row: any) {
  const raw = eventText(row);
  if (raw.includes('period start')) return { type: 'period_start', label: 'بداية الشوط' };
  if (raw.includes('period end')) return { type: 'period_end', label: 'نهاية الشوط' };
  if (raw.includes('added time')) return { type: 'added_time', label: 'وقت بدل ضائع' };
  if (raw.includes('penalty scored')) return { type: 'penalty_goal', label: 'هدف من ركلة جزاء' };
  if (raw.includes('penalty awarded')) return { type: 'penalty_awarded', label: 'ركلة جزاء' };
  if (raw.includes('penalty missed') || raw.includes('missed penalty')) return { type: 'penalty_missed', label: 'ركلة جزاء مهدرة' };
  if (raw.includes('own goal')) return { type: 'own_goal', label: 'هدف عكسي' };
  if (isRealGoalText(raw)) return { type: 'goal', label: 'هدف' };
  if (raw.includes('goal kick')) return { type: 'goal_kick', label: 'ضربة مرمى' };
  if (raw.includes('sub')) return { type: 'substitution', label: 'تبديل' };
  if (raw.includes('red')) return { type: 'red_card', label: 'بطاقة حمراء' };
  if (raw.includes('yellow') || raw.includes('card')) return { type: 'yellow_card', label: 'بطاقة صفراء' };
  if (raw.includes('corner')) return { type: 'corner', label: 'ركنية' };
  if (raw.includes('var')) return { type: 'var', label: 'VAR' };
  if (raw.includes('shot') || raw.includes('attempt')) return { type: 'shot', label: 'تسديدة' };
  if (raw.includes('offside')) return { type: 'offside', label: 'تسلل' };
  if (raw.includes('foul')) return { type: 'foul', label: 'خطأ' };
  return { type: str(row?.type, row?.event_type, row?.incident_type) || 'note', label: str(row?.type, row?.event_type, row?.incident_type) || 'حدث' };
}
function compactEvent(row: any, sourcePath: string) {
  const minute = eventMinute(row);
  const kind = eventType(row);
  const teamName = str(row?.team?.name, row?.team_name, row?.teamName, row?.club?.name, row?.side?.name, row?.participant?.name);
  const playerName = str(row?.player?.name, row?.player_name, row?.playerName, row?.scorer?.name, row?.goal_scorer?.name, row?.athlete?.name, row?.person?.name);
  const detail = str(row?.detail, row?.description, row?.comment, row?.text, row?.message) || [teamName, minute.label ? `د${minute.label}'` : null, kind.label, playerName].filter(Boolean).join(' - ');
  return { ...kind, minute: minute.minute, displayMinute: minute.label, teamName, playerName, detail, sourcePath };
}
function eventTeamId(event: any, match: any) {
  if (teamMatch(event.teamName, match.homeTeam)) return match.homeTeamId;
  if (teamMatch(event.teamName, match.awayTeam)) return match.awayTeamId;
  return null;
}
function scoreFromLivePayload(match: any, livePayload: any, goalEvents: any[]) {
  const meta = (livePayload?.data || livePayload || {}).meta || {};
  const fromMeta = {
    home: n(first(meta.home_goals, meta.homeGoals, meta.home_score)),
    away: n(first(meta.away_goals, meta.awayGoals, meta.away_score)),
  };
  if (fromMeta.home !== null || fromMeta.away !== null) return { home: fromMeta.home ?? match.homeScore, away: fromMeta.away ?? match.awayScore, source: 'live_stats_meta' };
  const count = { home: 0, away: 0 };
  for (const event of goalEvents) {
    const teamId = eventTeamId(event, match);
    if (teamId === match.homeTeamId) count.home += 1;
    else if (teamId === match.awayTeamId) count.away += 1;
  }
  if (goalEvents.length && (count.home || count.away)) return { home: count.home, away: count.away, source: 'strict_timeline_goal_count' };
  return { home: match.homeScore, away: match.awayScore, source: 'existing_match_score' };
}
async function syncMatch(match: any, dryRun: boolean, query: Record<string, string | number>) {
  const resolved = await resolveProviderId(match, query);
  if (!resolved.id) return { ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, error: 'Could not resolve provider match id', resolved };

  const timelinePath = `/api/football/matches/${encodeURIComponent(resolved.id)}/timeline`;
  const liveStatsPath = `/api/football/matches/${encodeURIComponent(resolved.id)}/live-stats`;
  const [timelineResult, liveStatsResult] = await Promise.all([
    theStatsApiFetch(timelinePath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) })),
    theStatsApiFetch(liveStatsPath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) })),
  ]);

  const providerEvents = timelineResult.ok ? extractTimeline((timelineResult as any).payload).map((row) => compactEvent(row, timelinePath)).filter((event) => event.detail) : [];
  const strictGoalEvents = providerEvents.filter((event) => ['goal', 'penalty_goal', 'own_goal'].includes(event.type));
  const liveStatsPayload = liveStatsResult.ok ? (liveStatsResult as any).payload : null;
  const parsedLive = liveStatsPayload ? parseLiveStats(liveStatsPayload) : { stats: {}, meta: {} };
  const stats = parsedLive.stats;
  const score = scoreFromLivePayload(match, liveStatsPayload, strictGoalEvents);
  const latestMinute = providerEvents.reduce((max, event) => Math.max(max, Number(event.minute || 0)), 0) || null;

  let importedMatchEvents = 0;
  let snapshotSaved = false;
  let scoreUpdated = false;
  let statusUpdated = false;

  if (!dryRun) {
    if (Object.keys(stats).length || liveStatsResult.ok || score.source !== 'existing_match_score') {
      await prisma.matchStatsSnapshot.create({ data: {
        id: randomUUID(),
        matchId: match.id,
        provider: 'THE_STATS_API_LIVE',
        providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0,
        minute: latestMinute,
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
        homeScore: score.home,
        awayScore: score.away,
        rawData: { status: 'FINISHED', minute: latestMinute, liveStats: liveStatsPayload, stats, meta: parsedLive.meta, strictGoalEvents: strictGoalEvents.length, source: { provider: 'THE_STATS_API', liveStatsPath, timelinePath }, importedAt: new Date().toISOString() },
      } });
      snapshotSaved = true;
    }
    await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: 'THE_STATS_API' } });
    if (providerEvents.length) {
      const result = await prisma.matchEvent.createMany({ data: providerEvents.map((event) => ({ matchId: match.id, minute: event.minute, type: event.type, teamId: eventTeamId(event, match), playerName: event.playerName || null, detail: event.detail, sourceName: 'THE_STATS_API', sourceUrl: event.sourcePath })) });
      importedMatchEvents = result.count;
    }
    const updateData: Record<string, any> = {};
    if (score.home !== match.homeScore) updateData.homeScore = score.home;
    if (score.away !== match.awayScore) updateData.awayScore = score.away;
    if (!FINISHED.includes(String(match.status || '').toUpperCase())) updateData.status = 'FINISHED';
    if (Object.keys(updateData).length) {
      await prisma.match.update({ where: { id: match.id }, data: updateData });
      scoreUpdated = updateData.homeScore !== undefined || updateData.awayScore !== undefined;
      statusUpdated = updateData.status === 'FINISHED';
    }
  }

  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, previousStatus: match.status, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, timelineOk: timelineResult.ok, liveStatsOk: liveStatsResult.ok, liveStatsError: liveStatsResult.ok ? null : (liveStatsResult as any).error, providerEventsFound: providerEvents.length, strictGoalEvents: strictGoalEvents.length, score, liveStatsFound: Object.keys(stats).length, liveStatsKeys: Object.keys(stats), latestMinute, snapshotSaved, importedMatchEvents, scoreUpdated, statusUpdated, preview: providerEvents.slice(0, 8) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authorized(req, url.searchParams)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const matchId = url.searchParams.get('matchId') || '';
  const dryRun = boolParam(url.searchParams.get('dryRun'), true);
  const limit = intParam(url.searchParams.get('limit'), 3, 1, 12);
  const offset = intParam(url.searchParams.get('offset'), 0, 0, 10000);
  const delayMs = intParam(url.searchParams.get('delayMs'), 1500, 0, 10000);
  const daysBack = intParam(url.searchParams.get('daysBack'), 14, 1, 90);
  const providerMatchesPerPage = intParam(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100);
  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const query = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: providerMatchesPerPage,
  };

  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { matchDate: { gte: from, lt: new Date() }, OR: [{ status: { in: FINISHED } }, { matchDate: { lt: new Date() } }] }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' }, skip: offset, take: limit });

    const results = [];
    for (const [index, match] of matches.entries()) {
      if (index > 0 && delayMs > 0) await sleep(delayMs);
      try { results.push(await syncMatch(match, dryRun, query)); }
      catch (error: any) { results.push({ ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, error: safeTheStatsApiError(error) }); }
    }
    const successful = results.filter((result: any) => result.ok);
    return NextResponse.json({ ok: true, provider: 'THE_STATS_API', mode: 'the_stats_backfill_previous', dryRun, saved: !dryRun, limit, offset, nextOffset: offset + matches.length, delayMs, daysBack, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, totalProviderEventsFound: successful.reduce((sum: number, item: any) => sum + Number(item.providerEventsFound || 0), 0), totalStrictGoalEvents: successful.reduce((sum: number, item: any) => sum + Number(item.strictGoalEvents || 0), 0), totalImportedMatchEvents: successful.reduce((sum: number, item: any) => sum + Number(item.importedMatchEvents || 0), 0), snapshotsSaved: successful.filter((item: any) => item.snapshotSaved).length, scoreUpdated: successful.filter((item: any) => item.scoreUpdated).length, statusUpdated: successful.filter((item: any) => item.statusUpdated).length, results, safety: { dryRunDefault: true, replacesTheStatsApiEventsOnly: true, keepsISportAndManualEvents: true, strictGoalClassifier: 'goal_kick/goal_attempt/shot_on_goal are not counted as goals', useOffsetForNextBatch: true, prohibitedOddsStillBlocked: true }, config: getTheStatsApiConfigStatus() }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, provider: 'THE_STATS_API', mode: 'the_stats_backfill_previous', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
