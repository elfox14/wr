import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];
const LIVE = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET'];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
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
function text(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const out = String(value).trim();
      if (out && out !== '[object Object]' && !/^null|undefined|-$/i.test(out)) return out;
    } else if (typeof value === 'object') {
      const out = text(value.name, value.fullName, value.full_name, value.displayName, value.display_name, value.title, value.label);
      if (out) return out;
    }
  }
  return null;
}
function key(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace('czechia', 'czech republic')
    .replace('turkiye', 'turkey')
    .replace('türkiye', 'turkey')
    .replace('u s a', 'united states')
    .replace('usa', 'united states')
    .replace('united states of america', 'united states');
}
function similarity(a: any, b: any) {
  const aa = key(a);
  const bb = key(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 90;
  const aw = new Set(aa.split(' ').filter((word) => word.length > 1));
  const bw = new Set(bb.split(' ').filter((word) => word.length > 1));
  if (!aw.size || !bw.size) return 0;
  const hits = Array.from(aw).filter((word) => bw.has(word)).length;
  return Math.round((hits / Math.max(aw.size, bw.size)) * 80);
}
function teamScore(providerName: any, localTeam: any) {
  return Math.max(similarity(providerName, localTeam?.name), similarity(providerName, localTeam?.code));
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
  const fixture = row?.fixture || row?.match || row?.game || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    id: text(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    home: text(home?.name, row?.homeName, row?.home_team_name, home),
    away: text(away?.name, row?.awayName, row?.away_team_name, away),
    date: text(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff, row?.start_time),
  };
}
function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return null;
  return Math.abs(aa - bb) / 36e5;
}
function scoreCandidate(candidate: any, match: any) {
  const direct = (teamScore(candidate.home, match.homeTeam) + teamScore(candidate.away, match.awayTeam)) / 2;
  const reversedScore = (teamScore(candidate.home, match.awayTeam) + teamScore(candidate.away, match.homeTeam)) / 2;
  const reversed = reversedScore > direct;
  const team = Math.max(direct, reversedScore);
  const hours = hoursApart(candidate.date, match.matchDate);
  const timeBoost = hours === null ? 0 : hours <= 4 ? 25 : hours <= 12 ? 15 : hours <= 30 ? 8 : -15;
  return { ...candidate, score: Math.round(team + timeBoost), teamScore: Math.round(team), timeHours: hours === null ? null : Number(hours.toFixed(2)), reversed };
}
function providerIdParam(params: URLSearchParams) {
  const value = params.get('providerMatchId') || params.get('theStatsMatchId') || params.get('providerId') || '';
  if (!value.trim()) return '';
  const trimmed = value.trim();
  return trimmed.startsWith('mt_') ? trimmed : `mt_${trimmed.replace(/^mt_/i, '')}`;
}
async function cachedProviderId(matchId: string) {
  const snapshot = await prisma.matchStatsSnapshot.findFirst({
    where: { matchId, provider: { in: ['THE_STATS_API_LIVE', 'THE_STATS_API_EXTRAS'] } },
    orderBy: { capturedAt: 'desc' },
    select: { providerMatchId: true, rawData: true },
  }).catch(() => null);
  const raw = snapshot?.rawData as any;
  const id = text(raw?.resolvedProviderMatchId, raw?.providerMatchId, raw?.matchId, snapshot?.providerMatchId ? `mt_${snapshot.providerMatchId}` : null);
  return id && id !== 'mt_12345' ? id : null;
}
async function resolveProviderId(match: any, query: Record<string, string | number>, forcedId = '') {
  if (forcedId) return { id: forcedId, by: 'forced_provider_match_id' };
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_') && external !== 'mt_12345') return { id: external, by: 'local_external_id' };
  const cached = await cachedProviderId(match.id);
  if (cached) return { id: cached, by: 'cached_the_stats_snapshot' };
  const payload = await theStatsApiFetch('/api/football/matches', { ...query, page: 1, per_page: Math.max(50, Math.min(100, Number(query.per_page || 100) || 100)) }, { timeoutMs: 15000 });
  const list = extractList(payload).map(providerMatch).filter((row) => row.id);
  const candidates = list.map((row) => scoreCandidate(row, match)).sort((a, b) => b.score - a.score).slice(0, 10);
  const found = candidates.find((row) => row.score >= 82 && row.teamScore >= 70 && (row.timeHours === null || row.timeHours <= 30));
  return { id: found?.id ? (String(found.id).startsWith('mt_') ? String(found.id) : `mt_${found.id}`) : null, by: found ? (found.reversed ? 'provider_match_list_fuzzy_reversed' : 'provider_match_list_fuzzy') : null, searched: list.length, confidence: found?.score || 0, candidates };
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
  if (raw.includes('goal')) return { type: raw.includes('penalty') ? 'penalty_goal' : 'goal', label: raw.includes('penalty') ? 'هدف من ركلة جزاء' : 'هدف' };
  if (raw.includes('sub')) return { type: 'substitution', label: 'تبديل' };
  if (raw.includes('yellow')) return { type: 'yellow_card', label: 'بطاقة صفراء' };
  if (raw.includes('red')) return { type: 'red_card', label: 'بطاقة حمراء' };
  if (raw.includes('corner')) return { type: 'corner', label: 'ركنية' };
  if (raw.includes('shot')) return { type: 'shot', label: 'تسديدة' };
  if (raw.includes('offside')) return { type: 'offside', label: 'تسلل' };
  if (raw.includes('foul')) return { type: 'foul', label: 'خطأ' };
  if (raw.includes('period end')) return { type: 'period_end', label: 'نهاية الشوط' };
  if (raw.includes('period start')) return { type: 'period_start', label: 'بداية الشوط' };
  return { type: text(row?.type, row?.event_type, row?.incident_type) || 'note', label: text(row?.type, row?.event_type, row?.incident_type) || 'حدث' };
}
function compactEvent(row: any, sourcePath: string) {
  const minute = eventMinute(row);
  const kind = eventType(row);
  const teamName = text(row?.team?.name, row?.team_name, row?.teamName);
  const playerName = text(row?.player?.name, row?.player_name, row?.playerName, row?.scorer?.name, row?.athlete?.name);
  const detail = text(row?.detail, row?.description, row?.comment, row?.text, row?.message) || [teamName, minute.label ? `د${minute.label}'` : null, kind.label, playerName].filter(Boolean).join(' - ');
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
  if (raw.includes('offside')) return 'offside';
  if (raw.includes('foul')) return 'foul';
  return raw || 'note';
}
function eventTeamId(event: any, match: any) {
  if (teamScore(event.teamName, match.homeTeam) >= 70) return match.homeTeamId;
  if (teamScore(event.teamName, match.awayTeam) >= 70) return match.awayTeamId;
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
    ['corners', pair(providerStats.corner_kicks || overview.corner_kicks || data?.corner_kicks || data?.corners, 'live-stats.stats.corner_kicks')],
    ['yellowCards', pair(providerStats.yellow_cards || overview.yellow_cards || data?.yellow_cards, 'live-stats.stats.yellow_cards')],
    ['redCards', pair(providerStats.red_cards || data?.red_cards, 'live-stats.stats.red_cards')],
    ['attacks', pair(providerStats.attacks || attack.attacks || data?.attacks, 'live-stats.stats.attacks')],
    ['dangerousAttacks', pair(providerStats.dangerous_attacks || attack.dangerous_attacks || data?.dangerous_attacks, 'live-stats.stats.dangerous_attacks')],
  ];
  for (const [name, value] of entries) if (value) stats[name] = value;
  return { stats, meta };
}
function statInt(stats: Record<string, any>, keyName: string, side: 'home' | 'away') {
  const value = n(stats[keyName]?.[side]);
  return value === null ? null : Math.round(value);
}
function snapshotMinute(match: any, livePayload: any, timelineMinute: number | null) {
  const raw = livePayload?.data || livePayload || {};
  const meta = raw.meta || {};
  const direct = n(first(meta.elapsed_minutes, raw.minute, raw.elapsed, raw.matchMinute, raw.currentMinute, raw?.time?.minute, raw?.fixture?.status?.elapsed));
  if (direct !== null) return Math.round(direct);
  if (timelineMinute) return timelineMinute;
  const elapsed = Math.floor((Date.now() - new Date(match.matchDate).getTime()) / 60_000) + 1;
  return Number.isFinite(elapsed) ? Math.max(1, Math.min(130, elapsed)) : null;
}
function liveScore(match: any, livePayload: any) {
  const meta = (livePayload?.data || livePayload || {}).meta || {};
  return { home: n(first(meta.home_goals, meta.homeGoals, meta.home_score)) ?? match.homeScore, away: n(first(meta.away_goals, meta.awayGoals, meta.away_score)) ?? match.awayScore };
}
async function syncMatch(match: any, dryRun: boolean, skipSimilarExisting: boolean, query: Record<string, string | number>, forcedId = '') {
  const resolved = await resolveProviderId(match, query, forcedId);
  if (!resolved.id) return { ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, error: 'Could not resolve provider match id', resolved };
  const timelinePath = `/api/football/matches/${encodeURIComponent(resolved.id)}/timeline`;
  const liveStatsPath = `/api/football/matches/${encodeURIComponent(resolved.id)}/live-stats`;
  const timelineResult: any = await theStatsApiFetch(timelinePath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) }));
  const liveStatsResult: any = await theStatsApiFetch(liveStatsPath, {}, { timeoutMs: 15000 }).then((payload) => ({ ok: true, payload })).catch((error) => ({ ok: false, error: safeTheStatsApiError(error) }));
  const rows = timelineResult.ok ? extractTimeline(timelineResult.payload) : [];
  const providerEvents = rows.map((row) => compactEvent(row, timelinePath)).filter((event) => event.detail);
  let eventsToImport = providerEvents;
  let skippedSimilarExisting = 0;
  if (skipSimilarExisting) {
    const existing = await prisma.matchEvent.findMany({ where: { matchId: match.id, OR: [{ sourceName: null }, { sourceName: { not: 'THE_STATS_API' } }] }, select: { minute: true, type: true, teamId: true, playerName: true } });
    eventsToImport = providerEvents.filter((event) => { const duplicated = existing.some((row) => similar(event, row, match)); if (duplicated) skippedSimilarExisting += 1; return !duplicated; });
  }
  const latestTimelineMinute = providerEvents.reduce((max, event) => Math.max(max, Number(event.minute || 0)), 0) || null;
  const liveStatsPayload = liveStatsResult.ok ? liveStatsResult.payload : null;
  const parsedLive = liveStatsPayload ? parseLiveStats(liveStatsPayload) : { stats: {}, meta: {} };
  const stats = parsedLive.stats;
  const score = liveScore(match, liveStatsPayload);
  const minute = snapshotMinute(match, liveStatsPayload, latestTimelineMinute);
  const shouldMarkLive = Boolean((providerEvents.length || liveStatsResult.ok) && !FINISHED.includes(String(match.status || '').toUpperCase()) && !LIVE.includes(String(match.status || '').toUpperCase()));
  let importedMatchEvents = 0;
  let createdSnapshot = null;
  let statusUpdated = false;
  let scoreUpdated = false;
  if (!dryRun) {
    if (Object.keys(stats).length || liveStatsResult.ok) {
      createdSnapshot = await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId: match.id, provider: 'THE_STATS_API_LIVE', providerMatchId: Number(String(resolved.id).replace(/\D/g, '')) || 0, minute, homePossession: statInt(stats, 'possession', 'home'), awayPossession: statInt(stats, 'possession', 'away'), homeAttacks: statInt(stats, 'attacks', 'home'), awayAttacks: statInt(stats, 'attacks', 'away'), homeDangerousAttacks: statInt(stats, 'dangerousAttacks', 'home'), awayDangerousAttacks: statInt(stats, 'dangerousAttacks', 'away'), homeShots: statInt(stats, 'shots', 'home'), awayShots: statInt(stats, 'shots', 'away'), homeShotsOnTarget: statInt(stats, 'shotsOnTarget', 'home'), awayShotsOnTarget: statInt(stats, 'shotsOnTarget', 'away'), homeCorners: statInt(stats, 'corners', 'home'), awayCorners: statInt(stats, 'corners', 'away'), homeYellowCards: statInt(stats, 'yellowCards', 'home'), awayYellowCards: statInt(stats, 'yellowCards', 'away'), homeRedCards: statInt(stats, 'redCards', 'home'), awayRedCards: statInt(stats, 'redCards', 'away'), homeScore: score.home, awayScore: score.away, rawData: { status: 'IN_PLAY', minute, liveStats: liveStatsPayload, stats, meta: parsedLive.meta, source: { provider: 'THE_STATS_API', liveStatsPath, timelinePath }, importedAt: new Date().toISOString() } } });
    }
    if (providerEvents.length) await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: 'THE_STATS_API' } });
    if (eventsToImport.length) {
      const result = await prisma.matchEvent.createMany({ data: eventsToImport.map((event) => ({ matchId: match.id, minute: event.minute, type: event.type, teamId: eventTeamId(event, match), playerName: event.playerName || null, detail: event.detail, sourceName: 'THE_STATS_API', sourceUrl: event.sourcePath })) });
      importedMatchEvents = result.count;
    }
    const matchUpdate: Record<string, any> = {};
    if (shouldMarkLive) matchUpdate.status = 'IN_PLAY';
    if (score.home !== match.homeScore) matchUpdate.homeScore = score.home;
    if (score.away !== match.awayScore) matchUpdate.awayScore = score.away;
    if (Object.keys(matchUpdate).length) {
      await prisma.match.update({ where: { id: match.id }, data: matchUpdate });
      statusUpdated = matchUpdate.status === 'IN_PLAY';
      scoreUpdated = matchUpdate.homeScore !== undefined || matchUpdate.awayScore !== undefined;
    }
  }
  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, previousStatus: match.status, statusAfterSync: statusUpdated ? 'IN_PLAY' : match.status, statusUpdated, scoreUpdated, score, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, resolvedConfidence: resolved.confidence || null, timelineOk: timelineResult.ok, timelineError: timelineResult.ok ? null : timelineResult.error, liveStatsOk: liveStatsResult.ok, liveStatsError: liveStatsResult.ok ? null : liveStatsResult.error, providerEventsFound: providerEvents.length, eventsToImport: eventsToImport.length, skippedSimilarExisting, liveStatsFound: Object.keys(stats).length, liveStatsKeys: Object.keys(stats), latestMinute: minute, snapshotSaved: Boolean(createdSnapshot), importedMatchEvents, preview: providerEvents.slice(-8) };
}
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const url = new URL(req.url);
  const matchId = url.searchParams.get('matchId') || '';
  const forcedId = providerIdParam(url.searchParams);
  const dryRun = boolParam(url.searchParams.get('dryRun'), true);
  const skipSimilarExisting = boolParam(url.searchParams.get('skipSimilarExisting'), true);
  const limit = intParam(url.searchParams.get('limit'), 8, 1, 20);
  const minutesBack = intParam(url.searchParams.get('minutesBack'), 180, 15, 360);
  const minutesForward = intParam(url.searchParams.get('minutesForward'), 30, 0, 180);
  const now = new Date();
  const query = { competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107', season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868', per_page: intParam(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100) };
  try {
    const matches = matchId ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 }) : await prisma.match.findMany({ where: { matchDate: { gte: new Date(now.getTime() - minutesBack * 60_000), lte: new Date(now.getTime() + minutesForward * 60_000) }, status: { notIn: FINISHED } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' }, take: limit });
    const results = [];
    for (const match of matches) {
      try { results.push(await syncMatch(match, dryRun, skipSimilarExisting, query, forcedId)); }
      catch (error: any) { results.push({ ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, error: safeTheStatsApiError(error) }); }
    }
    const successful = results.filter((result: any) => result.ok);
    return json({ ok: true, provider: 'THE_STATS_API', mode: 'the_stats_live_catchup_v2', dryRun, saved: !dryRun, forcedProviderMatchId: forcedId || null, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, skipSimilarExisting, totalProviderEventsFound: successful.reduce((sum: number, item: any) => sum + Number(item.providerEventsFound || 0), 0), totalEventsToImport: successful.reduce((sum: number, item: any) => sum + Number(item.eventsToImport || 0), 0), totalLiveStatsFound: successful.reduce((sum: number, item: any) => sum + Number(item.liveStatsFound || 0), 0), totalImportedMatchEvents: successful.reduce((sum: number, item: any) => sum + Number(item.importedMatchEvents || 0), 0), snapshotsSaved: successful.filter((item: any) => item.snapshotSaved).length, statusUpdated: successful.filter((item: any) => item.statusUpdated).length, scoreUpdated: successful.filter((item: any) => item.scoreUpdated).length, results, config: getTheStatsApiConfigStatus() });
  } catch (error: any) {
    return json({ ok: false, provider: 'THE_STATS_API', mode: 'the_stats_live_catchup_v2', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, Number(error?.status) || 500);
  }
}
export async function POST(req: Request) { return GET(req); }
