import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];

function validSecrets() {
  return [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET].map((v) => String(v || '').trim()).filter(Boolean);
}
function authorized(req: Request, params: URLSearchParams) {
  const bearer = String(req.headers.get('authorization') || '').startsWith('Bearer ')
    ? String(req.headers.get('authorization') || '').slice(7).trim()
    : '';
  const candidates = [bearer, req.headers.get('x-admin-secret') || '', req.headers.get('x-cron-secret') || '', params.get('key') || '', params.get('adminSecret') || '', params.get('cronSecret') || ''];
  const valid = validSecrets();
  return candidates.some((value) => value && valid.includes(String(value).trim()));
}
function bool(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}
function int(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function clean(value: any) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function first(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return null;
}
function text(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}
function number(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function extractArray(payload: any) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'matches', 'fixtures', 'response', 'results', 'items']) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  return [];
}
function extractEvents(payload: any) {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data || payload?.response || payload?.result || payload;
  for (const key of ['timeline', 'events', 'incidents', 'commentary', 'data', 'items', 'results']) if (Array.isArray(data?.[key])) return data[key];
  return [];
}
function providerMatch(row: any) {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    id: text(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    home: text(home?.name, row?.homeName, row?.home_team_name),
    away: text(away?.name, row?.awayName, row?.away_team_name),
    date: text(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}
function hoursApart(a: any, b: any) {
  const aa = a ? new Date(a).getTime() : NaN;
  const bb = b ? new Date(b).getTime() : NaN;
  return Number.isFinite(aa) && Number.isFinite(bb) ? Math.abs(aa - bb) / 36e5 : 999;
}
function normalizeTeam(value: any) {
  return clean(value)
    .replace('czechia', 'czech republic')
    .replace('usa', 'united states')
    .replace('u s a', 'united states')
    .replace('turkiye', 'turkey')
    .replace('turkiye national team', 'turkey')
    .replace('bosnia h', 'bosnia and herzegovina')
    .replace('bosnia herzegovina', 'bosnia and herzegovina')
    .replace('bosnia and h', 'bosnia and herzegovina')
    .replace('cote d ivoire', 'ivory coast')
    .replace('curacao', 'curaçao');
}
function teamMatch(providerName: any, localTeam: any) {
  const p = normalizeTeam(providerName);
  const l = normalizeTeam(localTeam?.name || localTeam?.code);
  return Boolean(p && l && (p === l || p.includes(l) || l.includes(p)));
}
async function resolveProviderId(match: any, query: Record<string, string | number>) {
  const external = String(match.externalId || '').trim();
  if (external.startsWith('mt_')) return { id: external, by: 'local_external_id' };
  const rows = extractArray(await theStatsApiFetch('/api/football/matches', query, { timeoutMs: 15000 })).map(providerMatch).filter((row) => row.id);
  const found = rows.find((row) => teamMatch(row.home, match.homeTeam) && teamMatch(row.away, match.awayTeam) && hoursApart(row.date, match.matchDate) <= 4);
  return { id: found?.id || null, by: found ? 'provider_match_list' : null, searched: rows.length };
}
function minuteOf(row: any) {
  const raw = first(row?.minute, row?.time?.minute, row?.elapsed, row?.match_minute, row?.matchMinute, row?.event_minute, row?.time);
  if (typeof raw === 'string') {
    const stoppage = raw.match(/(45|90|105)\s*\+\s*(\d+)/);
    if (stoppage) return { minute: Number(stoppage[1]) + Number(stoppage[2]), label: `${stoppage[1]}+${stoppage[2]}` };
  }
  const base = number(raw);
  const extra = number(first(row?.extra_time, row?.extra_minute, row?.stoppage_time, row?.added_time, row?.time?.extra, row?.extra));
  if (base !== null && extra !== null && extra > 0) return { minute: base + extra, label: `${base}+${extra}` };
  return { minute: base, label: base === null ? null : String(base) };
}
function eventRawText(row: any) {
  return clean(first(row?.type, row?.event_type, row?.incident_type, row?.name, row?.detail, row?.description, row?.comment, row?.text, row?.message));
}
function isRealGoal(raw: string) {
  if (!raw) return false;
  if (/(goal kick|goal attempt|shot on goal|saved goal|goalkeeper|goalkeeper save|disallowed goal|no goal|goal line)/.test(raw)) return false;
  return raw === 'goal' || raw.includes('goal scored') || raw.includes('scored goal') || raw.includes('penalty scored') || raw.includes('own goal') || raw.includes('هدف');
}
function eventType(row: any) {
  const raw = eventRawText(row);
  if (raw.includes('period start')) return { type: 'period_start', label: 'بداية الشوط' };
  if (raw.includes('period end')) return { type: 'period_end', label: 'نهاية الشوط' };
  if (raw.includes('penalty scored')) return { type: 'penalty_goal', label: 'هدف من ركلة جزاء' };
  if (raw.includes('penalty awarded')) return { type: 'penalty_awarded', label: 'ركلة جزاء' };
  if (raw.includes('penalty missed') || raw.includes('missed penalty')) return { type: 'penalty_missed', label: 'ركلة جزاء مهدرة' };
  if (raw.includes('own goal')) return { type: 'own_goal', label: 'هدف عكسي' };
  if (isRealGoal(raw)) return { type: 'goal', label: 'هدف' };
  if (raw.includes('goal kick')) return { type: 'goal_kick', label: 'ضربة مرمى' };
  if (raw.includes('sub')) return { type: 'substitution', label: 'تبديل' };
  if (raw.includes('red')) return { type: 'red_card', label: 'بطاقة حمراء' };
  if (raw.includes('yellow') || raw.includes('card')) return { type: 'yellow_card', label: 'بطاقة صفراء' };
  if (raw.includes('corner')) return { type: 'corner', label: 'ركنية' };
  if (raw.includes('var')) return { type: 'var', label: 'VAR' };
  if (raw.includes('shot') || raw.includes('attempt')) return { type: 'shot', label: 'تسديدة' };
  if (raw.includes('offside')) return { type: 'offside', label: 'تسلل' };
  if (raw.includes('foul')) return { type: 'foul', label: 'خطأ' };
  return { type: text(row?.type, row?.event_type, row?.incident_type) || 'note', label: text(row?.type, row?.event_type, row?.incident_type) || 'حدث' };
}
function compactEvent(row: any, sourcePath: string) {
  const minute = minuteOf(row);
  const kind = eventType(row);
  const teamName = text(row?.team?.name, row?.team_name, row?.teamName, row?.club?.name, row?.side?.name, row?.participant?.name);
  const playerName = text(row?.player?.name, row?.player_name, row?.playerName, row?.scorer?.name, row?.goal_scorer?.name, row?.athlete?.name, row?.person?.name);
  const detail = text(row?.detail, row?.description, row?.comment, row?.text, row?.message) || [teamName, minute.label ? `د${minute.label}'` : null, kind.label, playerName].filter(Boolean).join(' - ');
  return { minute: minute.minute, displayMinute: minute.label, ...kind, teamName, playerName, detail, sourcePath };
}
function eventTeamId(event: any, match: any) {
  if (teamMatch(event.teamName, match.homeTeam)) return match.homeTeamId;
  if (teamMatch(event.teamName, match.awayTeam)) return match.awayTeamId;
  return null;
}
async function importEvents(match: any, dryRun: boolean, query: Record<string, string | number>) {
  const resolved = await resolveProviderId(match, query);
  if (!resolved.id) return { ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, error: 'Could not resolve TheStatsAPI match id', resolved };
  const timelinePath = `/api/football/matches/${encodeURIComponent(resolved.id)}/timeline`;
  const payload = await theStatsApiFetch(timelinePath, {}, { timeoutMs: 15000 });
  const events = extractEvents(payload).map((row) => compactEvent(row, timelinePath)).filter((event) => event.detail).sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  const strictGoals = events.filter((event) => ['goal', 'penalty_goal', 'own_goal'].includes(event.type));
  let imported = 0;
  if (!dryRun) {
    await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: 'THE_STATS_API' } });
    if (events.length) {
      const result = await prisma.matchEvent.createMany({ data: events.map((event) => ({ matchId: match.id, minute: event.minute, type: event.type, teamId: eventTeamId(event, match), playerName: event.playerName || null, detail: event.detail, sourceName: 'THE_STATS_API', sourceUrl: event.sourcePath })) });
      imported = result.count;
    }
    if (!FINISHED.includes(String(match.status || '').toUpperCase())) await prisma.match.update({ where: { id: match.id }, data: { status: 'FINISHED' } });
  }
  return { ok: true, matchId: match.id, localTeams: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, resolvedProviderMatchId: resolved.id, resolvedBy: resolved.by, previousScore: { home: match.homeScore, away: match.awayScore }, providerEventsFound: events.length, strictGoalEvents: strictGoals.length, importedMatchEvents: imported, preview: events.slice(0, 10) };
}
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authorized(req, url.searchParams)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const matchId = url.searchParams.get('matchId') || '';
  const dryRun = bool(url.searchParams.get('dryRun'), true);
  const limit = int(url.searchParams.get('limit'), 3, 1, 20);
  const offset = int(url.searchParams.get('offset'), 0, 0, 10000);
  const delayMs = int(url.searchParams.get('delayMs'), 1500, 0, 10000);
  const daysBack = int(url.searchParams.get('daysBack'), 14, 1, 90);
  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const query = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: int(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100),
  };
  try {
    const matches = matchId
      ? await prisma.match.findMany({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true }, take: 1 })
      : await prisma.match.findMany({ where: { matchDate: { gte: from, lt: new Date() } }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' }, skip: offset, take: limit });
    const results = [];
    for (const [index, match] of matches.entries()) {
      if (index > 0 && delayMs > 0) await sleep(delayMs);
      try { results.push(await importEvents(match, dryRun, query)); }
      catch (error: any) { results.push({ ok: false, matchId: match.id, localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`, error: safeTheStatsApiError(error) }); }
    }
    const successful = results.filter((result: any) => result.ok);
    return NextResponse.json({ ok: true, provider: 'THE_STATS_API', mode: 'the_stats_backfill_events_safe', dryRun, saved: !dryRun, limit, offset, nextOffset: offset + matches.length, delayMs, daysBack, matchesFound: matches.length, successful: successful.length, failed: results.length - successful.length, totalProviderEventsFound: successful.reduce((sum: number, item: any) => sum + Number(item.providerEventsFound || 0), 0), totalStrictGoalEvents: successful.reduce((sum: number, item: any) => sum + Number(item.strictGoalEvents || 0), 0), totalImportedMatchEvents: successful.reduce((sum: number, item: any) => sum + Number(item.importedMatchEvents || 0), 0), results, safety: { doesNotUpdateScore: true, replacesTheStatsApiEventsOnly: true, keepsISportAndManualEvents: true, strictGoalClassifier: 'goal_kick/goal_attempt/shot_on_goal are not counted as goals', prohibitedOddsStillBlocked: true }, config: getTheStatsApiConfigStatus() }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, provider: 'THE_STATS_API', mode: 'the_stats_backfill_events_safe', error: safeTheStatsApiError(error), config: getTheStatsApiConfigStatus() }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
