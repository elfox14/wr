import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTheStatsApiConfigStatus, safeTheStatsApiError, theStatsApiFetch } from '@/lib/theStatsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProviderMatch = {
  providerId: string | null;
  homeName: string | null;
  awayName: string | null;
  matchDate: string | null;
};

type ProviderEvent = {
  minute: number | null;
  displayMinute: string | null;
  type: string;
  label: string;
  teamName: string | null;
  playerName: string | null;
  detail: string;
  raw: any;
  sourcePath: string;
};

type ImportOptions = {
  dryRun: boolean;
  importantOnly: boolean;
  skipSimilarExisting: boolean;
  replaceAllSources: boolean;
  explicitProviderMatchId?: string | null;
  providerMatchesQuery: Record<string, string | number>;
};

const TEAM_NAME_ALIASES = new Map([
  ['usa', 'united states'],
  ['us', 'united states'],
  ['u s a', 'united states'],
  ['united states of america', 'united states'],
  ['czechia', 'czech republic'],
  ['bosnia herzegovina', 'bosnia and herzegovina'],
  ['cote d ivoire', 'ivory coast'],
  ['côte d ivoire', 'ivory coast'],
]);

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED'];

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

function boolParam(value: string | null, fallback = true) {
  if (value === null) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

function toInteger(value: any): number | null {
  const number = toNumber(value);
  return number === null ? null : Math.round(number);
}

function first(...values: any[]) {
  for (const value of values) if (value !== undefined && value !== null && value !== '') return value;
  return null;
}

function str(...values: any[]) {
  const value = first(...values);
  return value === null ? null : String(value).trim();
}

function text(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeamName(value?: string | null) {
  const normalized = text(value);
  return TEAM_NAME_ALIASES.get(normalized) || normalized;
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ['matches', 'fixtures', 'data', 'response', 'results', 'items']) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
  if (Array.isArray(payload?.data?.fixtures)) return payload.data.fixtures;
  return [];
}

function extractEventRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data || payload?.response || payload?.result || payload;
  for (const key of ['events', 'incidents', 'timeline', 'commentary', 'data', 'items', 'results']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeProviderMatch(row: any): ProviderMatch {
  const fixture = row?.fixture || row?.match || row;
  const teams = row?.teams || row?.participants || {};
  const home = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
  const away = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
  return {
    providerId: str(fixture?.id, fixture?.matchId, fixture?.match_id, row?.id, row?.matchId, row?.match_id, row?.fixtureId, row?.fixture_id),
    homeName: str(home?.name, row?.homeName, row?.home_team_name),
    awayName: str(away?.name, row?.awayName, row?.away_team_name),
    matchDate: str(fixture?.utc_date, fixture?.date, row?.utc_date, row?.date, row?.matchDate, row?.kickoff),
  };
}

function sameDay(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
}

function hoursApart(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / 36e5;
}

function providerMatchesLocal(provider: ProviderMatch, localMatch: any) {
  const providerHome = normalizeTeamName(provider.homeName);
  const providerAway = normalizeTeamName(provider.awayName);
  const localHome = normalizeTeamName(localMatch.homeTeam?.name || localMatch.homeTeam?.code);
  const localAway = normalizeTeamName(localMatch.awayTeam?.name || localMatch.awayTeam?.code);
  const homeMatches = providerHome && localHome && (providerHome === localHome || providerHome.includes(localHome) || localHome.includes(providerHome));
  const awayMatches = providerAway && localAway && (providerAway === localAway || providerAway.includes(localAway) || localAway.includes(providerAway));
  return Boolean(homeMatches && awayMatches && (sameDay(provider.matchDate, localMatch.matchDate) || hoursApart(provider.matchDate, localMatch.matchDate) <= 4));
}

async function resolveProviderMatchId(match: any, providerMatchesQuery: Record<string, string | number>, explicitProviderMatchId?: string | null) {
  const explicit = String(explicitProviderMatchId || '').trim() || null;
  if (explicit) return { sourceProviderMatchId: explicit, resolvedProviderMatchId: explicit, resolvedBy: 'explicit_provider_match_id' };
  const sourceProviderMatchId = String(match.externalId || '').trim() || null;
  if (sourceProviderMatchId?.startsWith('mt_')) return { sourceProviderMatchId, resolvedProviderMatchId: sourceProviderMatchId, resolvedBy: 'local_external_id' };
  const payload = await theStatsApiFetch('/api/football/matches', providerMatchesQuery, { timeoutMs: 15000 });
  const providerMatches = extractArray(payload).map(normalizeProviderMatch).filter((row) => row.providerId);
  const matched = providerMatches.find((candidate) => providerMatchesLocal(candidate, match));
  return { sourceProviderMatchId, resolvedProviderMatchId: matched?.providerId || null, resolvedBy: matched ? 'provider_match_list' : null, providerMatches: providerMatches.length };
}

function eventMinute(row: any) {
  const rawMinute = first(row?.minute, row?.time?.minute, row?.elapsed, row?.match_minute, row?.matchMinute, row?.event_minute, row?.period_elapsed, row?.time);
  if (typeof rawMinute === 'string') {
    const stoppage = rawMinute.match(/(45|90|105)\s*\+\s*(\d+)/);
    if (stoppage) return { minute: Number(stoppage[1]) + Number(stoppage[2]), displayMinute: `${stoppage[1]}+${stoppage[2]}` };
  }
  const base = toInteger(rawMinute);
  const extra = toInteger(first(row?.extra_time, row?.extra_minute, row?.stoppage_time, row?.added_time, row?.minute_extra, row?.time?.extra, row?.extra));
  if (base !== null && extra !== null && extra > 0) return { minute: base + extra, displayMinute: `${base}+${extra}` };
  return { minute: base, displayMinute: base === null ? null : String(base) };
}

function eventTeamName(row: any) {
  return str(row?.team?.name, row?.team_name, row?.teamName, row?.club?.name, row?.side?.name, row?.participant?.name);
}

function eventPlayerName(row: any) {
  return str(row?.player?.name, row?.player_name, row?.playerName, row?.scorer?.name, row?.goal_scorer?.name, row?.athlete?.name, row?.person?.name);
}

function eventPlayerInName(row: any) {
  return str(row?.player_in?.name, row?.playerIn?.name, row?.player_on?.name, row?.substitution?.player_in?.name, row?.incoming_player?.name, row?.player_in_name, row?.playerInName);
}

function eventPlayerOutName(row: any) {
  return str(row?.player_out?.name, row?.playerOut?.name, row?.player_off?.name, row?.substitution?.player_out?.name, row?.outgoing_player?.name, row?.player_out_name, row?.playerOutName);
}

function normalizeEventType(row: any) {
  const raw = text(first(row?.type, row?.event_type, row?.incident_type, row?.name, row?.detail));
  if (raw.includes('period start')) return { type: 'period_start', label: 'بداية الشوط', important: false };
  if (raw.includes('period end')) return { type: 'period_end', label: 'نهاية الشوط', important: false };
  if (raw.includes('added time')) return { type: 'added_time', label: 'وقت بدل ضائع', important: false };
  if (raw.includes('penalty awarded')) return { type: 'penalty_awarded', label: 'ركلة جزاء', important: true };
  if (raw.includes('penalty scored')) return { type: 'penalty_goal', label: 'هدف من ركلة جزاء', important: true };
  if (raw.includes('own') || raw.includes('عكسي')) return { type: 'own_goal', label: 'هدف عكسي', important: true };
  if (raw.includes('penalty missed') || raw.includes('missed penalty') || raw.includes('ركلة جزاء مهدرة')) return { type: 'penalty_missed', label: 'ركلة جزاء مهدرة', important: true };
  if (raw.includes('goal') || raw.includes('هدف')) return { type: 'goal', label: 'هدف', important: true };
  if (raw.includes('sub') || raw.includes('تبديل') || raw.includes('تغيير')) return { type: 'substitution', label: 'تبديل', important: true };
  if (raw.includes('red') || raw.includes('حمراء')) return { type: 'red_card', label: 'بطاقة حمراء', important: true };
  if (raw.includes('yellow') || raw.includes('card') || raw.includes('صفراء') || raw.includes('بطاقة')) return { type: 'yellow_card', label: 'بطاقة صفراء', important: true };
  if (raw.includes('corner') || raw.includes('ركنية')) return { type: 'corner', label: 'ركنية', important: true };
  if (raw.includes('var')) return { type: 'var', label: 'VAR', important: true };
  if (raw.includes('injury') || raw.includes('إصابة') || raw.includes('اصابة')) return { type: 'injury', label: 'إصابة', important: true };
  if (raw.includes('shot') || raw.includes('attempt') || raw.includes('تسديدة')) return { type: 'shot', label: 'تسديدة', important: true };
  if (raw.includes('offside')) return { type: 'offside', label: 'تسلل', important: true };
  if (raw.includes('foul')) return { type: 'foul', label: 'خطأ', important: false };
  return { type: str(row?.type, row?.event_type, row?.incident_type) || 'note', label: str(row?.type, row?.event_type, row?.incident_type) || 'حدث', important: false };
}

function compactProviderEvent(row: any, sourcePath: string): (ProviderEvent & { important: boolean }) | null {
  const minute = eventMinute(row);
  const normalized = normalizeEventType(row);
  const teamName = eventTeamName(row);
  const playerName = eventPlayerName(row);
  const playerInName = eventPlayerInName(row);
  const playerOutName = eventPlayerOutName(row);
  const existingDetail = str(row?.detail, row?.description, row?.comment, row?.text, row?.message);
  const parts = [
    teamName,
    minute.displayMinute ? `د${minute.displayMinute}'` : null,
    normalized.label,
    playerName,
    playerInName || playerOutName ? `دخول ${playerInName || 'غير متوفر'} / خروج ${playerOutName || 'غير متوفر'}` : null,
  ].filter(Boolean);
  const detail = existingDetail || parts.join(' - ');
  if (!detail && !normalized.label) return null;
  return {
    minute: minute.minute,
    displayMinute: minute.displayMinute,
    type: normalized.type,
    label: normalized.label,
    teamName,
    playerName,
    detail: detail || normalized.label,
    raw: row,
    sourcePath,
    important: normalized.important,
  };
}

function eventTypeFamily(type: any) {
  const value = text(type);
  if (value.includes('goal') || value.includes('هدف')) return 'goal';
  if (value.includes('penalty')) return 'penalty';
  if (value.includes('sub')) return 'substitution';
  if (value.includes('corner')) return 'corner';
  if (value.includes('shot')) return 'shot';
  if (value.includes('card') || value.includes('yellow') || value.includes('red')) return 'card';
  if (value.includes('var')) return 'var';
  if (value.includes('offside')) return 'offside';
  if (value.includes('foul')) return 'foul';
  return value || 'note';
}

function teamIdForEvent(event: ProviderEvent, match: any) {
  const team = normalizeTeamName(event.teamName);
  const home = normalizeTeamName(match.homeTeam?.name || match.homeTeam?.code);
  const away = normalizeTeamName(match.awayTeam?.name || match.awayTeam?.code);
  if (team && home && (team === home || team.includes(home) || home.includes(team))) return match.homeTeamId;
  if (team && away && (team === away || team.includes(away) || away.includes(team))) return match.awayTeamId;
  const detail = normalizeTeamName(event.detail);
  if (home && detail.includes(home)) return match.homeTeamId;
  if (away && detail.includes(away)) return match.awayTeamId;
  return null;
}

function eventsLookSimilar(providerEvent: ProviderEvent, localEvent: any, match: any) {
  const providerMinute = providerEvent.minute ?? null;
  const localMinute = localEvent.minute ?? null;
  if (providerMinute !== localMinute) return false;

  const providerType = eventTypeFamily(providerEvent.type);
  const localType = eventTypeFamily(localEvent.type);
  if (providerType !== localType) return false;

  const providerTeamId = teamIdForEvent(providerEvent, match);
  if (providerTeamId && localEvent.teamId && providerTeamId !== localEvent.teamId) return false;

  const providerPlayer = text(providerEvent.playerName);
  const localPlayer = text(localEvent.playerName);
  if (providerPlayer && localPlayer) {
    return providerPlayer === localPlayer || providerPlayer.includes(localPlayer) || localPlayer.includes(providerPlayer);
  }

  const providerDetail = text(providerEvent.detail);
  const localDetail = text(localEvent.detail);
  if (!providerDetail || !localDetail) return true;
  const providerWords = providerDetail.split(' ').filter((word) => word.length > 3);
  return providerWords.some((word) => localDetail.includes(word));
}

function parseProviderEvents(payload: any, sourcePath: string, importantOnly: boolean) {
  const seen = new Set<string>();
  return extractEventRows(payload)
    .map((row) => compactProviderEvent(row, sourcePath))
    .filter(Boolean)
    .filter((event: any) => !importantOnly || event.important)
    .filter((event: any) => {
      const key = [event.minute, event.type, event.teamName, event.playerName, event.detail].map((value) => text(value)).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a: any, b: any) => (a.minute ?? 999) - (b.minute ?? 999));
}

async function importMatchEvents(match: any, options: ImportOptions) {
  const resolved = await resolveProviderMatchId(match, options.providerMatchesQuery, options.explicitProviderMatchId);
  if (!resolved.resolvedProviderMatchId) {
    return {
      ok: false,
      matchId: match.id,
      localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
      error: 'Could not resolve TheStatsAPI match id',
      resolved,
    };
  }

  const timelinePath = `/api/football/matches/${encodeURIComponent(resolved.resolvedProviderMatchId)}/timeline`;
  const timelinePayload = await theStatsApiFetch(timelinePath, {}, { timeoutMs: 15000 });
  const providerEvents = parseProviderEvents(timelinePayload, timelinePath, options.importantOnly);
  let eventsToImport = providerEvents;
  let skippedSimilarExisting = 0;

  if (options.skipSimilarExisting && !options.replaceAllSources) {
    const existingOtherEvents = await prisma.matchEvent.findMany({
      where: {
        matchId: match.id,
        OR: [{ sourceName: null }, { sourceName: { not: 'THE_STATS_API' } }],
      },
      select: { id: true, minute: true, type: true, teamId: true, playerName: true, detail: true, sourceName: true },
    });
    eventsToImport = providerEvents.filter((event) => {
      const duplicated = existingOtherEvents.some((existing) => eventsLookSimilar(event, existing, match));
      if (duplicated) skippedSimilarExisting += 1;
      return !duplicated;
    });
  }

  let importedMatchEvents = 0;
  if (!options.dryRun) {
    if (options.replaceAllSources) {
      await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });
    } else {
      await prisma.matchEvent.deleteMany({ where: { matchId: match.id, sourceName: 'THE_STATS_API' } });
    }
    if (eventsToImport.length) {
      const result = await prisma.matchEvent.createMany({
        data: eventsToImport.map((event: ProviderEvent) => ({
          matchId: match.id,
          minute: event.minute,
          type: event.type,
          teamId: teamIdForEvent(event, match),
          playerName: event.playerName || null,
          detail: event.detail,
          sourceName: 'THE_STATS_API',
          sourceUrl: event.sourcePath,
        })),
      });
      importedMatchEvents = result.count;
    }
  }

  return {
    ok: true,
    matchId: match.id,
    localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
    resolvedProviderMatchId: resolved.resolvedProviderMatchId,
    resolvedBy: resolved.resolvedBy,
    providerEventsFound: providerEvents.length,
    eventsToImport: eventsToImport.length,
    skippedSimilarExisting,
    importedMatchEvents,
    preview: providerEvents.slice(0, 20),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isAuthorized(req, url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const matchId = url.searchParams.get('matchId') || '';
  const dryRun = boolParam(url.searchParams.get('dryRun'), true);
  const importantOnly = boolParam(url.searchParams.get('importantOnly'), false);
  const allPrevious = boolParam(url.searchParams.get('allPrevious'), false) || boolParam(url.searchParams.get('bulk'), false);
  const skipSimilarExisting = boolParam(url.searchParams.get('skipSimilarExisting'), true);
  const replaceAllSources = boolParam(url.searchParams.get('replaceAllSources'), false);
  const explicitProviderMatchId = url.searchParams.get('providerMatchId');
  const limit = clampInt(url.searchParams.get('limit'), 20, 1, 80);
  const providerMatchesPerPage = clampInt(url.searchParams.get('providerMatchesPerPage'), 100, 1, 100);
  const providerMatchesQuery = {
    competition_id: url.searchParams.get('competition_id') || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107',
    season_id: url.searchParams.get('season_id') || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868',
    per_page: providerMatchesPerPage,
  };

  const options: ImportOptions = {
    dryRun,
    importantOnly,
    skipSimilarExisting,
    replaceAllSources,
    explicitProviderMatchId,
    providerMatchesQuery,
  };

  try {
    if (allPrevious) {
      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { matchDate: { lt: new Date() } },
            { status: { in: FINISHED_STATUSES } },
          ],
        },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { matchDate: 'asc' },
        take: limit,
      });

      const results = [];
      for (const match of matches) {
        try {
          results.push(await importMatchEvents(match, options));
        } catch (error: any) {
          results.push({
            ok: false,
            matchId: match.id,
            localTeams: `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`,
            error: safeTheStatsApiError(error),
          });
        }
      }

      const successful = results.filter((result: any) => result.ok);
      const failed = results.filter((result: any) => !result.ok);
      return NextResponse.json({
        ok: true,
        provider: 'THE_STATS_API',
        mode: 'the_stats_import_previous_match_events',
        dryRun,
        saved: !dryRun,
        allPrevious: true,
        limit,
        matchesFound: matches.length,
        successful: successful.length,
        failed: failed.length,
        importantOnly,
        skipSimilarExisting,
        replaceAllSources,
        totalProviderEventsFound: successful.reduce((sum: number, item: any) => sum + Number(item.providerEventsFound || 0), 0),
        totalEventsToImport: successful.reduce((sum: number, item: any) => sum + Number(item.eventsToImport || 0), 0),
        totalSkippedSimilarExisting: successful.reduce((sum: number, item: any) => sum + Number(item.skippedSimilarExisting || 0), 0),
        totalImportedMatchEvents: successful.reduce((sum: number, item: any) => sum + Number(item.importedMatchEvents || 0), 0),
        results,
        safety: {
          dryRunDefault: true,
          importsEventsFromTheStatsApiOnly: true,
          replacesPreviousTheStatsApiEventsOnly: !replaceAllSources,
          canReplaceAllSourcesWhenExplicitlyRequested: true,
          skipsSimilarExistingEventsByDefault: true,
          prohibitedOddsStillBlocked: true,
        },
      }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    if (!matchId) {
      return NextResponse.json({ ok: false, error: 'matchId is required unless allPrevious=true' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const result = await importMatchEvents(match, options);
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        provider: 'THE_STATS_API',
        mode: 'the_stats_import_match_events',
        ...result,
        config: getTheStatsApiConfigStatus(),
      }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({
      ok: true,
      provider: 'THE_STATS_API',
      mode: 'the_stats_import_match_events',
      dryRun,
      saved: !dryRun,
      importantOnly,
      skipSimilarExisting,
      replaceAllSources,
      ...result,
      safety: {
        dryRunDefault: true,
        importsEventsFromTheStatsApiOnly: true,
        replacesPreviousTheStatsApiEventsOnly: !replaceAllSources,
        canReplaceAllSourcesWhenExplicitlyRequested: true,
        skipsSimilarExistingEventsByDefault: true,
        prohibitedOddsStillBlocked: true,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      provider: 'THE_STATS_API',
      mode: allPrevious ? 'the_stats_import_previous_match_events' : 'the_stats_import_match_events',
      error: safeTheStatsApiError(error),
      config: getTheStatsApiConfigStatus(),
    }, { status: Number(error?.status) || 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
