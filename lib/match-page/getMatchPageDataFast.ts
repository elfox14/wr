import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type {
  HeadToHeadItem,
  MatchAdvancedData,
  MatchEventView,
  MatchFormItem,
  MatchPageData,
  MatchPlayerLite,
  MatchPlayerStatItem,
  MatchSourceView,
  MatchStatMetric,
  MatchStatusView,
  MatchTeamLite,
  OfficialLineupPlayer,
  OfficialLineupView,
  RelatedArticle,
  SourceChecklistItem,
} from './types';
import { buildBestThirdsTable, buildGroupStandings, buildMatchImpact } from './standings';
import {
  buildEventView,
  buildSourceList,
  buildStatMetric,
  buildStatusView,
  eventIcon,
  eventMinuteLabel,
  metricDefinitions,
  normalizeGroupKey,
  providerPriority,
  rawData,
  scoreForDisplay,
  stageLabel,
  toNumber,
} from './normalizers';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const BAD_GROUP_KEYS = ['STAGE', 'GROUP', 'GROUPS', 'GROUP STAGE', 'GROUP_STAGE', 'NULL', 'UNKNOWN', 'N/A'];

function usableImage(value: any) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/') ? text : null;
}

function cleanText(value: any): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text && text !== '[object Object]' && !/^unknown|n\/a|null|undefined|-$/i.test(text)) return text;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = cleanText(item);
      if (text) return text;
    }
  }
  if (value && typeof value === 'object') {
    return cleanText(value.name || value.fullName || value.full_name || value.displayName || value.display_name || value.title || value.label);
  }
  return null;
}

function cleanVenue(value: any): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return cleanText(value);
  if (value && typeof value === 'object') return cleanText(value.name || value.stadium || value.venue || value.ground || value.title || value.fullName || value.full_name);
  return null;
}

function teamLite(team: any): MatchTeamLite {
  const flag = getTeamFlagUrl({ code: team.code, name: team.name, image: team.image }, 160);
  return {
    id: team.id,
    name: team.name || team.code || 'منتخب غير معروف',
    code: team.code || null,
    image: usableImage(flag) || usableImage(team.image),
    coach: team.coach || null,
    fifaRank: team.fifaRank ?? null,
    group: team.group || null,
    participations: team.participations ?? null,
    worldCupLegacy: team.worldCupLegacy ?? null,
  };
}

function playerLite(player: any): MatchPlayerLite {
  return {
    id: player.id,
    name: player.name || player.code || 'لاعب غير معروف',
    code: player.code || null,
    image: usableImage(player.image),
    position: player.position || null,
    teamId: player.teamId || null,
    number: player.number || null,
  };
}

function normalizeGoodGroup(value: any) {
  const key = normalizeGroupKey(cleanText(value) || String(value || ''));
  return key && !BAD_GROUP_KEYS.includes(String(key).toUpperCase()) ? key : null;
}

function asList(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['all', 'events', 'timeline', 'incidents', 'commentary', 'items', 'data', 'results', 'shotmap', 'shots', 'players', 'playerStats', 'player_stats', 'startingXi', 'substitutes', 'lineups']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function teamKey(value: any) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function playerKey(value: any) {
  return teamKey(value).replace(/\b(jr|sr|ii|iii)\b/g, '').trim();
}

function looksLikeTeam(row: any, team: MatchTeamLite) {
  const text = teamKey(`${cleanText(row?.teamName || row?.team_name || row?.team?.name || row?.team || row?.country || row?.side)} ${row?.teamId || row?.team_id || ''}`);
  const name = teamKey(team.name);
  const code = teamKey(team.code);
  if (row?.teamId && row.teamId === team.id) return true;
  if (text && name && (text.includes(name) || name.includes(text))) return true;
  if (text && code && text.includes(code)) return true;
  return false;
}

function isTheStatsSnapshot(snapshot: any) {
  const provider = String(snapshot?.provider || '').toUpperCase();
  const raw = rawData(snapshot);
  return provider.includes('THE_STATS') || String(raw?.provider || '').toUpperCase().includes('THE_STATS');
}

function coord(value: any) {
  const n = toNumber(value);
  if (n === null) return null;
  if (n >= 0 && n <= 1) return n * 100;
  if (n >= 0 && n <= 100) return n;
  return null;
}

function eventCoordinate(row: any, axis: 'x' | 'y') {
  const direct = coord(row?.[axis] ?? row?.[`start${axis.toUpperCase()}`] ?? row?.location?.[axis] ?? row?.coordinates?.[axis] ?? row?.position?.[axis]);
  if (direct !== null) return direct;
  const shot = row?.shot || row?.shotmap || row?.event || {};
  return coord(shot?.[axis] ?? shot?.location?.[axis] ?? shot?.coordinates?.[axis] ?? shot?.position?.[axis]);
}

function normalizeSnapshotEvent(row: any, index: number, homeTeam: MatchTeamLite, awayTeam: MatchTeamLite): MatchEventView | null {
  const type = cleanText(row?.type || row?.eventType || row?.event_type || row?.incident_type || row?.name) || 'event';
  const minute = toNumber(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute);
  const player = row?.player || row?.athlete || row?.scorer || {};
  const playerName = cleanText(row?.playerName || row?.player_name || player?.name || row?.scorer?.name);
  const detail = cleanText(row?.detail || row?.description || row?.comment || row?.text || row?.message) || type;
  const teamName = cleanText(row?.teamName || row?.team_name || row?.team?.name || row?.side);
  const teamId = row?.teamId === homeTeam.id || looksLikeTeam({ ...row, teamName }, homeTeam) ? homeTeam.id : row?.teamId === awayTeam.id || looksLikeTeam({ ...row, teamName }, awayTeam) ? awayTeam.id : cleanText(row?.teamId || row?.team_id);
  return {
    id: cleanText(row?.id) || `thestats-event-${index}-${minute ?? 'na'}-${type}`,
    minute,
    minuteLabel: eventMinuteLabel({ minute, detail }),
    type,
    icon: eventIcon(type),
    teamId,
    playerName,
    detail,
    sourceName: 'THE_STATS_API_FINAL',
    sourceUrl: null,
    x: eventCoordinate(row, 'x'),
    y: eventCoordinate(row, 'y'),
    shot: null,
    playerImage: usableImage(player?.image || player?.photo || row?.playerImage || row?.player_image || row?.photo),
    playerNumber: cleanText(player?.number || player?.shirtNumber || row?.number || row?.shirtNumber || row?.shirt_number || row?.jerseyNumber || row?.jersey_number),
  };
}

function finalTheStatsEvents(snapshots: any[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite): MatchEventView[] {
  const rows: MatchEventView[] = [];
  const seen = new Set<string>();
  for (const snapshot of snapshots.filter(isTheStatsSnapshot)) {
    const data = rawData(snapshot);
    const normalized = data.normalized || {};
    const eventList = [
      ...asList(normalized.eventsDetailed?.all),
      ...asList(normalized.eventsDetailed),
      ...asList(normalized.events),
      ...asList(data.eventsDetailed?.all),
      ...asList(data.eventsDetailed),
      ...asList(data.events),
    ];
    for (const row of eventList) {
      const event = normalizeSnapshotEvent(row, rows.length, homeTeam, awayTeam);
      if (!event) continue;
      const key = `${event.minute ?? ''}|${String(event.type || '').toLowerCase()}|${event.teamId || ''}|${teamKey(event.playerName)}|${teamKey(event.detail).slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(event);
    }
    if (rows.length) break;
  }
  return rows.sort((a, b) => Number(a.minute ?? 999) - Number(b.minute ?? 999)).slice(0, 120);
}

function normalizePlayerStat(row: any, homeTeam: MatchTeamLite, awayTeam: MatchTeamLite): MatchPlayerStatItem | null {
  const player = row?.player || row?.athlete || row;
  const stats = row?.stats || row?.statistics || row;
  const playerName = cleanText(player?.name || row?.playerName || row?.player_name || row?.name);
  if (!playerName) return null;
  const teamId = row?.teamId === homeTeam.id || looksLikeTeam(row, homeTeam)
    ? homeTeam.id
    : row?.teamId === awayTeam.id || looksLikeTeam(row, awayTeam)
      ? awayTeam.id
      : cleanText(row?.teamId || row?.team_id);
  const minutes = toNumber(stats?.minutes ?? stats?.minutesPlayed ?? stats?.minutes_played ?? row?.minutesPlayed ?? row?.minutes_played);
  const started = typeof row?.started === 'boolean'
    ? row.started
    : typeof stats?.started === 'boolean'
      ? stats.started
      : row?.starting === true || row?.isStarter === true || row?.starter === true || row?.lineup === 'start'
        ? true
        : null;
  const playerSubbedOn = cleanText(row?.playerSubbedOn || row?.subbedOn || row?.subbed_on);
  const playerSubbedOff = cleanText(row?.playerSubbedOff || row?.subbedOff || row?.subbed_off);
  const explicitPlayed = typeof row?.played === 'boolean' ? row.played : typeof stats?.played === 'boolean' ? stats.played : null;
  const played = explicitPlayed ?? (started === true || Number(minutes || 0) > 0 || Boolean(playerSubbedOn || playerSubbedOff) ? true : null);
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const parsed = toNumber(stats?.[key] ?? row?.[key]);
      if (parsed !== null) return parsed;
    }
    return null;
  };
  return {
    playerId: cleanText(player?.id || row?.playerId || row?.player_id || row?.id),
    playerName,
    teamId,
    teamName: teamId === homeTeam.id ? homeTeam.name : teamId === awayTeam.id ? awayTeam.name : cleanText(row?.teamName || row?.team_name || row?.team?.name),
    position: cleanText(player?.position || row?.position),
    rating: value('rating', 'score'),
    started,
    played,
    minutes,
    image: usableImage(player?.image || player?.photo || row?.image || row?.photo || row?.playerImage || row?.player_image),
    number: cleanText(player?.number || player?.shirtNumber || row?.number || row?.shirtNumber || row?.shirt_number || row?.jerseyNumber || row?.jersey_number),
    isCaptain: row?.captain === true || row?.isCaptain === true || player?.captain === true,
    goals: value('goals'),
    assists: value('assists'),
    shots: value('shots', 'totalShots', 'total_shots'),
    shotsOnTarget: value('shotsOnTarget', 'shots_on_target'),
    shotsOffTarget: value('shotsOffTarget', 'shots_off_target'),
    blockedShots: value('blockedShots', 'blocked_shots'),
    bigChancesCreated: value('bigChancesCreated', 'big_chances_created'),
    expectedGoals: value('expectedGoals', 'expected_goals', 'xg'),
    expectedAssists: value('expectedAssists', 'expected_assists', 'xa'),
    npExpectedGoals: value('npExpectedGoals', 'np_expected_goals', 'npxg'),
    passes: value('passes', 'totalPasses', 'total_passes'),
    accuratePasses: value('accuratePasses', 'accurate_passes'),
    keyPasses: value('keyPasses', 'key_passes'),
    crosses: value('crosses'),
    accurateCrosses: value('accurateCrosses', 'accurate_crosses'),
    longBalls: value('longBalls', 'long_balls'),
    accurateLongBalls: value('accurateLongBalls', 'accurate_long_balls'),
    tackles: value('tackles'),
    interceptions: value('interceptions'),
    clearances: value('clearances'),
    saves: value('saves'),
    duelWon: value('duelWon', 'duelsWon', 'duels_won'),
    duelLost: value('duelLost', 'duelsLost', 'duels_lost'),
    aerialWon: value('aerialWon', 'aerialsWon', 'aerials_won'),
    challengeLost: value('challengeLost', 'challenge_lost'),
    wonContest: value('wonContest', 'successfulDribbles', 'successful_dribbles'),
    dispossessed: value('dispossessed'),
    touches: value('touches'),
    foulsCommitted: value('foulsCommitted', 'fouls_committed'),
    foulsWon: value('foulsWon', 'fouls_won'),
    offsides: value('offsides'),
    yellowCards: value('yellowCards', 'yellow_cards'),
    redCards: value('redCards', 'red_cards'),
    possessionLost: value('possessionLost', 'possession_lost'),
    playerSubbedOn,
    playerSubbedOff,
  };
}

function extractPlayerStats(snapshots: any[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite): MatchPlayerStatItem[] {
  const rows: MatchPlayerStatItem[] = [];
  const seen = new Set<string>();
  const starterIds = new Set<string>();
  const subIds = new Set<string>();
  
  for (const snapshot of snapshots.filter(isTheStatsSnapshot)) {
    const data = rawData(snapshot);
    const normalized = data.normalized || {};
    if (normalized.lineups) {
      const hs = asList(normalized.lineups.home?.starting_xi || normalized.lineups.home?.startingXi);
      const as = asList(normalized.lineups.away?.starting_xi || normalized.lineups.away?.startingXi);
      const hsub = asList(normalized.lineups.home?.substitutes);
      const asub = asList(normalized.lineups.away?.substitutes);
      hs.concat(as).forEach((p: any) => { if(p.id) starterIds.add(String(p.id)); if(p.name) starterIds.add(String(p.name)); });
      hsub.concat(asub).forEach((p: any) => { if(p.id) subIds.add(String(p.id)); if(p.name) subIds.add(String(p.name)); });
    }
  }

  for (const snapshot of snapshots.filter(isTheStatsSnapshot)) {
    const data = rawData(snapshot);
    const normalized = data.normalized || {};
    const list = [...asList(normalized.playerStats), ...asList(data.playerStats), ...asList(data.players)];
    for (const item of list) {
      const parsed = normalizePlayerStat(item, homeTeam, awayTeam);
      if (!parsed?.playerName) continue;
      
      if (starterIds.has(String(parsed.playerId)) || starterIds.has(String(parsed.playerName))) parsed.started = true;
      else if (subIds.has(String(parsed.playerId)) || subIds.has(String(parsed.playerName))) parsed.started = false;

      const key = `${parsed.playerId || ''}:${parsed.playerName}:${parsed.teamId || parsed.teamName || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(parsed);
    }
    
    // Add missing players from lineups
    if (normalized.lineups) {
      const addMissing = (lineupsList: any[], teamId: string, teamName: string, isStarter: boolean) => {
        for (const p of lineupsList) {
          if (!p.name) continue;
          const key = `${p.id || ''}:${p.name}:${teamId}`;
          if (!seen.has(key)) {
            seen.add(key);
            rows.push({
              playerId: p.id ? String(p.id) : null,
              playerName: String(p.name),
              teamId, teamName, position: p.position || null, number: p.number || null,
              started: isStarter, played: isStarter ? true : null, minutes: isStarter ? 0 : null,
              image: p.image || null, isCaptain: p.is_captain || p.captain || false,
            });
          }
        }
      };
      addMissing(asList(normalized.lineups.home?.starting_xi || normalized.lineups.home?.startingXi), homeTeam.id, homeTeam.name, true);
      addMissing(asList(normalized.lineups.home?.substitutes), homeTeam.id, homeTeam.name, false);
      addMissing(asList(normalized.lineups.away?.starting_xi || normalized.lineups.away?.startingXi), awayTeam.id, awayTeam.name, true);
      addMissing(asList(normalized.lineups.away?.substitutes), awayTeam.id, awayTeam.name, false);
    }

    if (rows.length >= 70) break;
  }
  return rows.sort((a, b) => {
    const aStarted = a.started === true ? 0 : 1;
    const bStarted = b.started === true ? 0 : 1;
    return aStarted - bStarted || (Number(b.minutes || 0) - Number(a.minutes || 0)) || (Number(b.rating || 0) - Number(a.rating || 0));
  }).slice(0, 70);
}

function extractLineupFromPlayers(players: MatchPlayerStatItem[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite, snapshots: any[] = []): OfficialLineupView {
  const snapshotLineups = snapshots
    .filter(isTheStatsSnapshot)
    .map((snapshot) => rawData(snapshot)?.normalized?.lineups || rawData(snapshot)?.lineups)
    .find(Boolean);
  const formationFor = (side: 'home' | 'away') => cleanText(snapshotLineups?.[side]?.formation || snapshotLineups?.[side]?.formation_name);
  const toLineupPlayer = (player: MatchPlayerStatItem): OfficialLineupPlayer => ({
    id: player.playerId || null,
    name: player.playerName || 'لاعب غير معروف',
    number: player.number || null,
    image: player.image || null,
    position: player.position || null,
    rating: player.rating ?? null,
    isCaptain: player.isCaptain || null,
  });
  const byTeam = (team: MatchTeamLite, side: 'home' | 'away') => {
    const rows = players.filter((player) => player.teamId === team.id || teamKey(player.teamName).includes(teamKey(team.name)));
    const starting = rows.filter((player) => player.started === true).map(toLineupPlayer);
    const substitutes = rows.filter((player) => player.started !== true && (Number(player.minutes || 0) > 0 || player.playerSubbedOn || player.playerSubbedOff || player.played)).map(toLineupPlayer);
    return { teamName: team.name, formation: formationFor(side), startingXi: starting.slice(0, 11), substitutes: substitutes.slice(0, 12) };
  };
  const home = byTeam(homeTeam, 'home');
  const away = byTeam(awayTeam, 'away');
  if (!home.startingXi.length && !away.startingXi.length && !home.substitutes.length && !away.substitutes.length) return null;
  return { confirmed: true, source: 'THE_STATS_API_EXTRAS', home, away };
}

function enrichPlayersFromDb(stats: MatchPlayerStatItem[], dbPlayers: any[]) {
  const byName = new Map<string, any>();
  for (const p of dbPlayers) byName.set(playerKey(p.name), p);
  return stats.map((player) => {
    const asset = byName.get(playerKey(player.playerName));
    return asset ? { ...player, playerId: player.playerId || asset.id, image: player.image || usableImage(asset.image), position: player.position || asset.position || null, number: player.number || asset.code || null } : player;
  });
}

function enrichEventsWithPlayers(events: MatchEventView[], players: MatchPlayerStatItem[]) {
  const byName = new Map<string, MatchPlayerStatItem>();
  for (const player of players) if (player.playerName) byName.set(playerKey(player.playerName), player);
  return events.map((event) => {
    const player = byName.get(playerKey(event.playerName));
    return player ? { ...event, playerImage: event.playerImage || player.image || null, playerNumber: event.playerNumber || player.number || null } : event;
  });
}

function normalizePlayerHeatmaps(value: any, players: MatchPlayerStatItem[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite) {
  const rows = asList(value);
  return rows.map((row: any) => {
    const playerId = cleanText(row?.playerId || row?.player_id || row?.player?.id);
    const playerName = cleanText(row?.playerName || row?.player_name || row?.player?.name);
    const player = players.find((item) =>
      (playerId && item.playerId === playerId) ||
      (playerName && playerKey(item.playerName) === playerKey(playerName))
    );
    const points = asList(row?.points || row?.heatmap).map((point: any) => ({
      x: coord(point?.x ?? point?.pitchX ?? point?.location?.x),
      y: coord(point?.y ?? point?.pitchY ?? point?.location?.y),
      count: toNumber(point?.count ?? point?.value ?? point?.weight) || undefined,
    })).filter((point: any) => point.x !== null && point.y !== null);
    const side = player?.teamId === homeTeam.id ? 'home' : player?.teamId === awayTeam.id ? 'away' : row?.side === 'home' || row?.side === 'away' ? row.side : undefined;
    return playerId && points.length ? {
      playerId,
      playerName: playerName || player?.playerName || undefined,
      teamId: player?.teamId || cleanText(row?.teamId || row?.team_id) || undefined,
      side,
      points,
    } : null;
  }).filter(Boolean);
}

function buildVerifiedMomentum(normalized: any, shotmap: MatchShotMapItem[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite) {
  const provider = asList(normalized?.momentum || normalized?.matchMomentum || normalized?.pressure).map((row: any) => ({
    minute: toNumber(row?.minute),
    home: toNumber(row?.home ?? row?.homeValue ?? row?.home_value),
    away: toNumber(row?.away ?? row?.awayValue ?? row?.away_value),
  })).filter((row: any) => row.minute !== null && row.home !== null && row.away !== null);
  if (provider.length >= 2) {
    return provider.map((row: any) => ({ minute: row.minute, home: row.home, away: row.away, source: 'PROVIDER' as const, sampleSize: 1 }));
  }

  const verifiedShots = shotmap.map((shot) => {
    const team = shot.teamId === homeTeam.id || teamKey(shot.teamName).includes(teamKey(homeTeam.name))
      ? 'home'
      : shot.teamId === awayTeam.id || teamKey(shot.teamName).includes(teamKey(awayTeam.name))
        ? 'away'
        : null;
    return { shot, team };
  }).filter((row): row is { shot: MatchShotMapItem; team: 'home' | 'away' } => Boolean(row.team && row.shot.minute !== null && row.shot.minute !== undefined));

  if (verifiedShots.length < 2) return [];
  const lastMinute = Math.max(90, ...verifiedShots.map((row) => Number(row.shot.minute || 0)));
  const points = [];
  for (let minute = 5; minute <= Math.ceil(lastMinute / 5) * 5; minute += 5) {
    const window = verifiedShots.filter((row) => Number(row.shot.minute) > minute - 5 && Number(row.shot.minute) <= minute);
    if (!window.length) {
      points.push({ minute, home: 0, away: 0, source: 'DERIVED_FROM_VERIFIED_SHOTS' as const, sampleSize: 0 });
      continue;
    }
    const score = (side: 'home' | 'away') => window.filter((row) => row.team === side).reduce((sum, row) => {
      const xg = Number(row.shot.xg || 0);
      return sum + 0.2 + Math.min(1, xg) * 4 + (row.shot.isOnTarget ? 0.7 : 0) + (row.shot.isGoal ? 2 : 0);
    }, 0);
    points.push({ minute, home: Number(score('home').toFixed(2)), away: Number(score('away').toFixed(2)), source: 'DERIVED_FROM_VERIFIED_SHOTS' as const, sampleSize: window.length });
  }
  return points;
}

function extractAdvancedData(snapshots: any[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite, dbPlayers: any[] = []): MatchAdvancedData {
  const theStats = snapshots.find(isTheStatsSnapshot);
  const normalized = theStats?.rawData && typeof theStats.rawData === 'object' ? (theStats.rawData as any).normalized || {} : {};
  const matchInfo = normalized.matchInfo || {};
  const npxgRaw = matchInfo.npxgSummary?.live || matchInfo.npxgSummary?.stored || null;
  const xgRaw = normalized.liveStats?.stats?.xg || normalized.liveStats?.xg || null;
  const shotmap = asList(normalized.shotmap)
    .map((row: any) => ({ ...row, x: coord(row?.x), y: coord(row?.y) }))
    .filter((row: any) => row.x !== null && row.y !== null);
  const playerStats = enrichPlayersFromDb(extractPlayerStats(snapshots, homeTeam, awayTeam), dbPlayers);
  const playerHeatmaps = normalizePlayerHeatmaps(normalized.playerHeatmaps, playerStats, homeTeam, awayTeam);
  const homeHeatmapPoints = playerHeatmaps.filter((heatmap: any) => heatmap.side === 'home').flatMap((heatmap: any) => heatmap.points);
  const awayHeatmapPoints = playerHeatmaps.filter((heatmap: any) => heatmap.side === 'away').flatMap((heatmap: any) => heatmap.points);
  return {
    venue: cleanVenue(matchInfo.venue),
    city: cleanText(matchInfo.city),
    referee: cleanText(matchInfo.referee),
    finalScore: matchInfo.finalScore || null,
    xg: xgRaw ? { home: toNumber(xgRaw.home), away: toNumber(xgRaw.away) } : null,
    npxg: npxgRaw ? { home: toNumber(npxgRaw.home_team ?? npxgRaw.home), away: toNumber(npxgRaw.away_team ?? npxgRaw.away) } : null,
    events: enrichEventsWithPlayers(finalTheStatsEvents(snapshots, homeTeam, awayTeam), playerStats),
    shotmap,
    playerStats,
    playerHeatmaps,
    teamHeatmaps: {
      home: homeHeatmapPoints.length ? { teamId: homeTeam.id, points: homeHeatmapPoints } : undefined,
      away: awayHeatmapPoints.length ? { teamId: awayTeam.id, points: awayHeatmapPoints } : undefined,
    },
    momentum: buildVerifiedMomentum(normalized, shotmap, homeTeam, awayTeam),
  };
}

function extractBasicInfo(snapshots: any[]) {
  let venue: string | null = null;
  let city: string | null = null;
  let referee: string | null = null;
  for (const snapshot of snapshots.filter(isTheStatsSnapshot).slice(0, 4)) {
    const data = rawData(snapshot);
    const info = data.matchInfo || data.normalized?.matchInfo || data;
    venue ||= cleanVenue(info.venue || info.stadium || info.ground);
    city ||= cleanText(info.city || info.venue_city);
    referee ||= cleanText(info.referee || info.main_referee || info.referee_name);
    if (venue && city && referee) break;
  }
  return { venue, city, referee };
}

function forceFinishedStatus(match: any, current: MatchStatusView): MatchStatusView {
  const raw = String(match.status || '').toUpperCase();
  if (FINISHED.includes(raw)) return { raw: raw || 'FINISHED', kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false };
  return current;
}

function mergeEventViews(dbEvents: MatchEventView[], theStatsEvents: MatchEventView[], status: MatchStatusView) {
  if (status.isFinished) return theStatsEvents;
  const rows: MatchEventView[] = [];
  const seen = new Set<string>();
  for (const event of [...theStatsEvents, ...dbEvents]) {
    const key = `${event.minute ?? ''}|${String(event.type || '').toLowerCase()}|${event.teamId || ''}|${teamKey(event.playerName)}|${teamKey(event.detail).slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(event);
  }
  return rows.sort((a, b) => Number(a.minute ?? 999) - Number(b.minute ?? 999)).slice(0, 120);
}

function sourceChecklist(match: any, statsAvailable: boolean, eventsCount: number, lineupAvailable: boolean, playerStatsCount: number): SourceChecklistItem[] {
  return [
    { label: 'بيانات المباراة والمنتخبين', status: match ? 'ready' : 'missing', note: 'الفرق، الموعد، الحالة والنتيجة الأساسية.' },
    { label: 'الإحصائيات الحية والنهائية', status: statsAvailable ? 'ready' : 'missing', note: statsAvailable ? 'تم حفظ Snapshot إحصائي من مزود البيانات.' : 'سيتم تحديثها تلقائيًا عند وصول Snapshot جديد.' },
    { label: 'أحداث المباراة النهائية', status: eventsCount > 0 ? 'ready' : 'missing', note: eventsCount > 0 ? 'بعد نهاية المباراة يتم عرض أحداث TheStats فقط بدون دمج iSport.' : 'لم تصل أحداث TheStats النهائية بعد.' },
    { label: 'التشكيلات', status: lineupAvailable ? 'ready' : 'optional', note: lineupAvailable ? 'تم بناء قائمة المشاركين والأساسيين من بيانات اللاعبين النهائية.' : 'ستظهر التشكيلات عند حفظها من مزود موثق أو إدخالها يدويًا.' },
    { label: 'تقييمات اللاعبين', status: playerStatsCount > 0 ? 'ready' : 'optional', note: playerStatsCount > 0 ? 'تقييمات وإحصائيات اللاعبين محفوظة.' : 'تظهر تقييمات اللاعبين بعد توفر player stats محفوظة.' },
  ];
}

function maxDateIso(values: Array<Date | string | null | undefined>) {
  const times = values.map((value) => (value ? new Date(value).getTime() : 0)).filter((value) => Number.isFinite(value));
  return new Date(times.length ? Math.max(...times) : Date.now()).toISOString();
}

function relatedArticlesFrom(news: any[], digest: any | null, matchId: string): RelatedArticle[] {
  const articles = news.map((item) => ({ id: item.id, title: item.title, summary: String(item.body || '').slice(0, 160), href: `/news/${item.id}`, label: item.category || 'خبر' }));
  if (digest) articles.unshift({ id: `digest-${matchId}`, title: digest.scoreLine || 'ملخص المباراة', summary: digest.summary || 'ملخص وتحليل المباراة.', href: `/match-digests/${matchId}`, label: 'ملخص المباراة' });
  return articles.slice(0, 5);
}

function resultFor(teamScore: number | null, opponentScore: number | null): MatchFormItem['result'] {
  if (teamScore === null || opponentScore === null) return 'N';
  if (teamScore > opponentScore) return 'W';
  if (teamScore < opponentScore) return 'L';
  return 'D';
}

function recentForm(allMatches: any[], teamId: string, currentMatchId: string, currentDate: Date): MatchFormItem[] {
  return allMatches
    .filter((m) => m.id !== currentMatchId && new Date(m.matchDate).getTime() <= currentDate.getTime() && (m.homeTeamId === teamId || m.awayTeamId === teamId))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 5)
    .map((m) => {
      const isHome = m.homeTeamId === teamId;
      const teamScore = isHome ? m.homeScore : m.awayScore;
      const opponentScore = isHome ? m.awayScore : m.homeScore;
      const opponent = isHome ? m.awayTeam : m.homeTeam;
      return { id: m.id, date: m.matchDate.toISOString(), opponentName: opponent?.name || 'غير معروف', opponentCode: opponent?.code || null, homeAway: isHome ? 'home' : 'away', teamScore, opponentScore, result: resultFor(teamScore, opponentScore), status: m.status, stage: m.stage || m.groupPhase || null };
    });
}

function headToHead(allMatches: any[], homeTeamId: string, awayTeamId: string, currentMatchId: string, currentDate: Date): HeadToHeadItem[] {
  return allMatches
    .filter((m) => m.id !== currentMatchId && new Date(m.matchDate).getTime() <= currentDate.getTime() && ((m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId) || (m.homeTeamId === awayTeamId && m.awayTeamId === homeTeamId)))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 6)
    .map((m) => ({ id: m.id, date: m.matchDate.toISOString(), homeTeamName: m.homeTeam?.name || 'غير معروف', awayTeamName: m.awayTeam?.name || 'غير معروف', homeScore: m.homeScore, awayScore: m.awayScore, status: m.status, stage: m.stage || m.groupPhase || null }));
}

function worldCupHistory(team: MatchTeamLite) {
  if (team.participations !== null && team.participations !== undefined) return `${team.name} شارك في كأس العالم ${team.participations} مرة حسب قاعدة البيانات.`;
  if (team.worldCupLegacy !== null && team.worldCupLegacy !== undefined) return `${team.name} لديه مؤشر إرث عالمي محفوظ بقيمة ${team.worldCupLegacy}.`;
  return `تاريخ مشاركات ${team.name} في كأس العالم غير متوفر في قاعدة البيانات الحالية.`;
}

function buildTacticalKeys(homeName: string, awayName: string, statsAvailable: boolean, digest?: any | null) {
  const keys: string[] = [];
  if (digest?.turningPoint) keys.push(`نقطة التحول: ${digest.turningPoint}`);
  keys.push(`مفتاح المتابعة: تعامل ${homeName} مع ضغط ${awayName} أثناء بناء اللعب والتحولات.`);
  keys.push('راقب جودة الخروج من الخلف والكرات الثانية والمساحات خلف الظهيرين.');
  keys.push(statsAvailable ? 'كل رقم ظاهر في الصفحة مأخوذ من Snapshot موثق.' : 'الإحصائيات التفصيلية ستظهر بعد وصول Snapshot موثق أو إدخال يدوي.');
  return keys.slice(0, 4);
}

export async function getMatchPageDataFast(matchId: string): Promise<MatchPageData | null> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true, events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 80 }, statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 24 } } });
  if (!match) return null;

  const [players, allMatches] = await Promise.all([
    prisma.asset.findMany({ where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } }, select: { id: true, name: true, code: true, image: true, position: true, teamId: true }, take: 80, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    prisma.match.findMany({ select: { id: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, status: true, matchDate: true, groupPhase: true, stage: true, homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } }, awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } } }, orderBy: { matchDate: 'asc' } }),
  ]);

  const snapshots = [...(match.statsSnapshots || [])].sort((a, b) => providerPriority(a) - providerPriority(b) || new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  const homeTeam = teamLite(match.homeTeam);
  const awayTeam = teamLite(match.awayTeam);
  const advanced = extractAdvancedData(snapshots, homeTeam, awayTeam, players);
  const score = scoreForDisplay(match, snapshots);
  const status = forceFinishedStatus(match, buildStatusView(match, snapshots));
  const stats = metricDefinitions().map(([key, label, homeKey, awayKey, suffix]) => buildStatMetric(snapshots, key, label, homeKey, awayKey, suffix));
  const statsAvailable = stats.some((metric: MatchStatMetric) => metric.available);
  const groupKey = normalizeGoodGroup(match.groupPhase) || normalizeGoodGroup(homeTeam.group) || normalizeGoodGroup(awayTeam.group);
  const currentDate = match.matchDate;
  const matchesUntilKickoff = (allMatches as any[]).filter((m) => new Date(m.matchDate).getTime() <= currentDate.getTime());
  const groupStandings = groupKey ? buildGroupStandings(matchesUntilKickoff as any[], groupKey) : [];
  const thirdPlaceTable = buildBestThirdsTable(matchesUntilKickoff as any[]);
  const dbEvents: MatchEventView[] = (match.events || []).map(buildEventView);
  const pageEvents = enrichEventsWithPlayers(mergeEventViews(dbEvents, advanced.events || [], status), advanced.playerStats);
  const officialLineup = extractLineupFromPlayers(advanced.playerStats, homeTeam, awayTeam, snapshots);
  const basicInfo = extractBasicInfo(snapshots);
  const groupLabelValue = groupKey ? `المجموعة ${groupKey}` : null;
  const stageLabelValue = groupKey ? `المجموعة ${groupKey}` : stageLabel(match.stage, null);
  const sources: MatchSourceView[] = [
    { key: 'db-match', name: 'بيانات المباراة', status: 'active', priority: 0, lastCheckedAt: maxDateIso([match.matchDate]), details: 'الفرق، الموعد، الحالة، النتيجة الأساسية' },
    ...buildSourceList(snapshots),
  ];

  return {
    id: match.id,
    title: `${homeTeam.name} ضد ${awayTeam.name}`,
    matchDate: match.matchDate.toISOString(),
    venue: basicInfo.venue || cleanVenue(advanced.venue),
    city: basicInfo.city || cleanText(advanced.city),
    referee: basicInfo.referee || cleanText(advanced.referee),
    competition: process.env.NEXT_PUBLIC_COMPETITION_NAME || 'كأس العالم 2026',
    groupLabel: groupLabelValue,
    stageLabel: stageLabelValue,
    homeTeam,
    awayTeam,
    score,
    status,
    stats,
    events: pageEvents,
    homePlayers: players.filter((player) => player.teamId === match.homeTeamId).map(playerLite),
    awayPlayers: players.filter((player) => player.teamId === match.awayTeamId).map(playerLite),
    officialLineup,
    advanced,
    voteEndpoint: `/api/matches/${match.id}/votes`,
    groupStandings,
    thirdPlaceTable,
    tacticalKeys: buildTacticalKeys(homeTeam.name, awayTeam.name, statsAvailable, null),
    matchImpact: buildMatchImpact(match.homeTeamId, match.awayTeamId, groupStandings, thirdPlaceTable),
    digest: null,
    relatedArticles: [],
    sources,
    sourceChecklist: sourceChecklist(match, statsAvailable, pageEvents.length, Boolean(officialLineup?.home?.startingXi?.length || officialLineup?.away?.startingXi?.length), advanced.playerStats.length),
    lastUpdatedAt: maxDateIso([...(match.statsSnapshots || []).map((snapshot) => snapshot.capturedAt), ...(match.events || []).map((event) => event.updatedAt), match.matchDate]),
    history: {
      homeRecentForm: recentForm(allMatches as any[], match.homeTeamId, match.id, currentDate),
      awayRecentForm: recentForm(allMatches as any[], match.awayTeamId, match.id, currentDate),
      headToHead: headToHead(allMatches as any[], match.homeTeamId, match.awayTeamId, match.id, currentDate),
      homeWorldCupHistory: worldCupHistory(homeTeam),
      awayWorldCupHistory: worldCupHistory(awayTeam),
    },
  };
}

