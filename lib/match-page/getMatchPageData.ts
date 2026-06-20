import { unstable_noStore as noStore } from 'next/cache';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchAdvancedData, MatchEventView, MatchPageData, MatchPlayerLite, MatchShotMapItem, MatchStatusView, MatchTeamLite, OfficialLineupPlayer, OfficialLineupTeam, OfficialLineupView, RelatedArticle, SourceChecklistItem } from './types';
import { buildBestThirdsTable, buildGroupStandings, buildMatchImpact } from './standings';
import { buildEventView, buildSourceList, buildStatMetric, buildStatusView, groupLabel, metricDefinitions, normalizeGroupKey, providerName, providerPriority, rawData, scoreForDisplay, stageLabel, toNumber } from './normalizers';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const BAD_GROUP_KEYS = ['STAGE', 'GROUP', 'GROUPS', 'GROUP STAGE', 'GROUP_STAGE', 'NULL', 'UNKNOWN'];

function teamLite(team: any): MatchTeamLite {
  return { id: team.id, name: team.name || team.code || 'منتخب غير معروف', code: team.code || null, image: getTeamFlagUrl({ code: team.code, name: team.name, image: team.image }, 160) || team.image || null, coach: team.coach || null, fifaRank: team.fifaRank ?? null, group: team.group || null };
}
function playerLite(player: any): MatchPlayerLite {
  return { id: player.id, name: player.name || player.code || 'لاعب غير معروف', code: player.code || null, image: player.image || null, position: player.position || null, teamId: player.teamId || null };
}
function lineupPlayer(row: any): OfficialLineupPlayer | null {
  const name = String(row?.name || row?.playerName || row?.player?.name || '').trim();
  if (!name) return null;
  return { id: row?.id || row?.playerId || row?.player_id || null, name, number: row?.number ?? row?.shirt_number ?? row?.jersey_number ?? null, image: row?.image || row?.photo || row?.player?.image || null, position: row?.position || row?.role || null, rating: typeof row?.rating === 'number' ? row.rating : row?.rating ? Number(row.rating) : null, isCaptain: Boolean(row?.isCaptain || row?.captain) };
}
function lineupTeam(raw: any): OfficialLineupTeam | null {
  if (!raw || typeof raw !== 'object') return null;
  const startingRows = raw.startingXi || raw.starting_xi || raw.lineup || raw.players || [];
  const subRows = raw.substitutes || raw.bench || [];
  const startingXi = Array.isArray(startingRows) ? startingRows.map(lineupPlayer).filter(Boolean) as OfficialLineupPlayer[] : [];
  const substitutes = Array.isArray(subRows) ? subRows.map(lineupPlayer).filter(Boolean) as OfficialLineupPlayer[] : [];
  if (!startingXi.length && !substitutes.length) return null;
  return { teamName: raw.name || raw.teamName || null, formation: raw.formation || null, startingXi, substitutes };
}
function extractOfficialLineup(snapshots: any[]): OfficialLineupView {
  for (const snapshot of snapshots) {
    const data = rawData(snapshot);
    const normalized = data.normalized || null;
    const lineup = data.lineup || data.theStatsApi?.lineup || data.lineups || normalized?.lineups || null;
    if (!lineup || lineup.error) continue;
    const home = lineupTeam(lineup.home || lineup.homeTeam);
    const away = lineupTeam(lineup.away || lineup.awayTeam);
    if (home || away) return { confirmed: Boolean(lineup.confirmed), source: providerName(snapshot), home, away };
  }
  return null;
}
function cleanVenue(value: any): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (text && !/^unknown|n\/a|null|undefined$/i.test(text)) return text;
  }
  if (value && typeof value === 'object') return cleanVenue(value.name || value.stadium || value.venue || value.title || value.fullName || value.full_name);
  return null;
}
function findVenueDeep(value: any, depth = 0): string | null {
  if (!value || depth > 6) return null;
  const direct = cleanVenue(value?.venue) || cleanVenue(value?.stadium) || cleanVenue(value?.ground) || cleanVenue(value?.arena);
  if (direct) return direct;
  if (typeof value !== 'object') return null;
  for (const item of [value.fixture, value.match, value.game, value.event, value.meta, value.info, value.location, value.data, value.response, value.result, value.liveStats, value.theStatsApi, value.raw, value.normalized, value.matchInfo]) {
    const found = findVenueDeep(item, depth + 1);
    if (found) return found;
  }
  return null;
}
function extractVenue(match: any, snapshots: any[]) {
  const direct = cleanVenue(match.venue) || cleanVenue(match.stadium) || cleanVenue(match.location);
  if (direct) return direct;
  for (const snapshot of snapshots) {
    const found = findVenueDeep(rawData(snapshot));
    if (found) return found;
  }
  return null;
}
function textKey(value: any) { return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function sameTeam(value: any, team: MatchTeamLite) { const a = textKey(value); const b = textKey(team.name); const c = textKey(team.code); return Boolean(a && ((b && (a === b || a.includes(b) || b.includes(a))) || (c && a === c))); }
function teamIdFromName(value: any, homeTeam: MatchTeamLite, awayTeam: MatchTeamLite) { if (sameTeam(value, homeTeam)) return homeTeam.id; if (sameTeam(value, awayTeam)) return awayTeam.id; return null; }
function eventIcon(type: string) { const value = textKey(type); if (value.includes('goal')) return '⚽'; if (value.includes('yellow')) return '🟨'; if (value.includes('red')) return '🟥'; if (value.includes('sub')) return '🔁'; if (value.includes('corner')) return '🚩'; if (value.includes('var')) return '📺'; if (value.includes('shot')) return '🎯'; if (value.includes('offside')) return '🚫'; if (value.includes('foul')) return '✋'; return '•'; }
function minuteLabel(minute: number | null | undefined, extra?: number | null) { if (minute === null || minute === undefined) return '—'; return extra ? `${minute}+${extra}د` : `${minute}د`; }
function eventLabel(type: string) {
  const map: Record<string, string> = { goal: 'هدف', shot_on_target: 'تسديدة على المرمى', shot_off_target: 'تسديدة خارج المرمى', shot_blocked: 'تسديدة محجوبة', corner_kick: 'ركنية', foul: 'خطأ', yellow_card: 'بطاقة صفراء', red_card: 'بطاقة حمراء', substitution: 'تبديل', var: 'VAR', offside: 'تسلل', added_time: 'وقت بدل ضائع', period_start: 'بداية شوط', period_end: 'نهاية شوط' };
  return map[type] || type;
}
function list(value: any): any[] { return Array.isArray(value) ? value : []; }
function sumShots(shots: MatchShotMapItem[], teamId: string, field: 'xg' | 'npxg') {
  const values = shots.filter((shot) => shot.teamId === teamId).map((shot) => toNumber(shot[field])).filter((value) => value !== null) as number[];
  if (!values.length) return null;
  return Number(values.reduce((sum, value) => sum + value, 0).toFixed(3));
}
function applyAdvancedMetric(metric: any, key: string, pair: { home: number | null; away: number | null } | null) {
  if (metric.key !== key || metric.available || !pair) return metric;
  return { ...metric, home: pair.home, away: pair.away, available: pair.home !== null || pair.away !== null, source: 'TheStats' };
}
function extractAdvancedData(snapshots: any[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite): MatchAdvancedData {
  const extras = snapshots.find((snapshot) => String(snapshot.provider || '').toUpperCase() === 'THE_STATS_API_EXTRAS');
  const normalized = extras?.rawData && typeof extras.rawData === 'object' ? (extras.rawData as any).normalized || {} : {};
  const matchInfo = normalized.matchInfo || {};
  const npxgRaw = matchInfo.npxgSummary?.live || matchInfo.npxgSummary?.stored || null;
  const shotmap: MatchShotMapItem[] = list(normalized.shotmap).map((shot) => ({ ...shot, teamId: teamIdFromName(shot.teamName, homeTeam, awayTeam) || shot.teamId || null }));
  const events: MatchEventView[] = list(normalized.eventsDetailed?.all).map((event, index) => {
    const type = String(event.type || 'event');
    const minute = toNumber(event.minute);
    const extra = toNumber(event.extraTime ?? event.extra_time);
    const teamId = teamIdFromName(event.teamName, homeTeam, awayTeam);
    return { id: `thestats-${event.sequence || index}-${type}-${minute ?? 'na'}`, minute, minuteLabel: minuteLabel(minute, extra), type: eventLabel(type), icon: eventIcon(type), teamId, playerName: event.playerName || null, detail: event.detail || `${eventLabel(type)}${event.playerName ? ` - ${event.playerName}` : ''}${event.teamName ? ` (${event.teamName})` : ''}`, sourceName: 'TheStats' };
  });
  const playerStats = list(normalized.playerStats).map((player) => ({ ...player, teamId: teamIdFromName(player.teamName, homeTeam, awayTeam) || player.teamId || null }));
  const xg = shotmap.length ? { home: sumShots(shotmap, homeTeam.id, 'xg'), away: sumShots(shotmap, awayTeam.id, 'xg') } : null;
  return { venue: matchInfo.venue || null, city: matchInfo.city || null, referee: matchInfo.referee || null, finalScore: matchInfo.finalScore || null, xg, npxg: npxgRaw ? { home: toNumber(npxgRaw.home_team ?? npxgRaw.home), away: toNumber(npxgRaw.away_team ?? npxgRaw.away) } : null, events, shotmap, playerStats };
}
function reliableGroupKey(match: any, homeTeam: MatchTeamLite, awayTeam: MatchTeamLite) {
  const sameTeamGroup = homeTeam.group && awayTeam.group && String(homeTeam.group).toUpperCase() === String(awayTeam.group).toUpperCase() ? homeTeam.group : null;
  const key = normalizeGroupKey(match.groupPhase || sameTeamGroup || null);
  if (!key || BAD_GROUP_KEYS.includes(key.toUpperCase())) return null;
  return key;
}
function safeStage(stage?: string | null, group?: string | null) {
  if (group) return `المجموعة ${group}`;
  const raw = String(stage || '').trim().toUpperCase();
  if (!raw || BAD_GROUP_KEYS.includes(raw)) return 'مرحلة المجموعات';
  return stageLabel(stage, null);
}
function forceFinishedStatus(match: any, advanced: MatchAdvancedData, current: MatchStatusView): MatchStatusView {
  const raw = String(match.status || '').toUpperCase();
  const hasPostmatchData = advanced.playerStats.length > 0 || (advanced.shotmap.length > 0 && advanced.events.some((event) => event.type.includes('نهاية') && Number(event.minute || 0) >= 90));
  if (FINISHED.includes(raw) || hasPostmatchData) return { raw: raw || 'FINISHED', kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false };
  return current;
}
function sourceChecklist(match: any, statsAvailable: boolean, eventsCount: number, _providers: string[], lineup: OfficialLineupView): SourceChecklistItem[] {
  return [
    { label: 'بيانات المباراة والمنتخبين', status: match ? 'ready' : 'missing', note: 'الفرق، الموعد، الحالة والنتيجة الأساسية.' },
    { label: 'الإحصائيات الحية والنهائية', status: statsAvailable ? 'ready' : 'missing', note: statsAvailable ? 'تم حفظ Snapshot إحصائي من مزود البيانات.' : 'سيتم تحديثها تلقائيًا عند وصول Snapshot جديد.' },
    { label: 'أحداث المباراة', status: eventsCount > 0 ? 'ready' : 'missing', note: eventsCount > 0 ? 'الأحداث محفوظة في قاعدة البيانات.' : 'يتم فحص الأحداث تلقائيًا أثناء وبعد المباراة.' },
    { label: 'التشكيل الرسمي', status: lineup ? 'ready' : 'optional', note: lineup ? 'تم العثور على تشكيل رسمي.' : 'سيتم جلب التشكيل الرسمي تلقائيًا عند توفره.' },
  ];
}
function relatedArticlesFrom(news: any[], digest: any | null, matchId: string): RelatedArticle[] {
  const articles: RelatedArticle[] = [];
  if (digest) articles.push({ id: `digest-${matchId}`, title: digest.matchTitle || 'تقرير المباراة', summary: digest.summary || digest.turningPoint || 'ملخص وتحليل المباراة بعد التحديث.', href: `/match-digests/${matchId}`, label: 'تقرير المباراة' });
  for (const item of news) articles.push({ id: item.id, title: item.title, summary: item.body ? String(item.body).slice(0, 150) : 'خبر مرتبط بالمباراة.', href: `/news/${item.id}`, label: item.category || 'خبر مرتبط' });
  return articles.slice(0, 6);
}
function buildTacticalKeys(homeName: string, awayName: string, statsAvailable: boolean, digest?: any | null) {
  const keys: string[] = [];
  if (digest?.turningPoint) keys.push(`نقطة التحول: ${digest.turningPoint}`);
  keys.push(`مفتاح المتابعة: تعامل ${homeName} مع ضغط ${awayName} أثناء بناء اللعب والتحولات.`);
  keys.push('راقب جودة الخروج من الخلف والكرات الثانية والمساحات خلف الظهيرين.');
  keys.push(statsAvailable ? 'كل رقم ظاهر في الصفحة مأخوذ من Snapshot موثق.' : 'الإحصائيات التفصيلية ستظهر بعد وصول Snapshot موثق أو إدخال يدوي.');
  return keys.slice(0, 4);
}
function maxDateIso(values: Array<Date | string | null | undefined>) {
  const times = values.map((value) => (value ? new Date(value).getTime() : 0)).filter((value) => Number.isFinite(value));
  return new Date(times.length ? Math.max(...times) : Date.now()).toISOString();
}

export async function getMatchPageData(matchId: string): Promise<MatchPageData | null> {
  noStore();
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true, events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] }, statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 40 } } });
  if (!match) return null;
  const players = await prisma.asset.findMany({ where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } }, select: { id: true, name: true, code: true, image: true, position: true, teamId: true }, take: 100, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  const allMatches = await prisma.match.findMany({ include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' } });
  const digest = await prisma.matchDigest.findUnique({ where: { matchId: match.id } }).catch(() => null);
  const relatedNews = await prisma.pressNews.findMany({ where: { status: 'published', OR: [{ relatedMatchId: match.id }, { relatedTeamId: { in: [match.homeTeamId, match.awayTeamId] } }] }, orderBy: { publishedAt: 'desc' }, take: 5 }).catch(() => []);
  const snapshots = [...(match.statsSnapshots || [])].sort((a, b) => providerPriority(a) - providerPriority(b) || new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  const homeTeam = teamLite(match.homeTeam);
  const awayTeam = teamLite(match.awayTeam);
  const advanced = extractAdvancedData(snapshots, homeTeam, awayTeam);
  const score = scoreForDisplay(match, snapshots);
  const status = forceFinishedStatus(match, advanced, buildStatusView(match, snapshots));
  const statsBase = metricDefinitions().map(([key, label, homeKey, awayKey, suffix]) => buildStatMetric(snapshots, key, label, homeKey, awayKey, suffix));
  const stats = statsBase.map((metric) => applyAdvancedMetric(applyAdvancedMetric(metric, 'xg', advanced.xg || null), 'npxg', advanced.npxg || null));
  const statsAvailable = stats.some((metric) => metric.available);
  const providers = snapshots.map((snapshot) => String(snapshot.provider || '').toUpperCase());
  const officialLineup = extractOfficialLineup(snapshots);
  const groupKey = reliableGroupKey(match, homeTeam, awayTeam);
  const groupStandings = groupKey ? buildGroupStandings(allMatches as any[], groupKey) : [];
  const thirdPlaceTable = groupKey ? buildBestThirdsTable(allMatches as any[]) : [];
  const dbEvents = (match.events || []).map(buildEventView);
  const events = dbEvents.length ? dbEvents : advanced.events;
  const groupLabelValue = groupKey ? `المجموعة ${groupKey}` : null;
  const stageLabelValue = safeStage(match.stage, groupKey);

  return {
    id: match.id,
    title: `${homeTeam.name} ضد ${awayTeam.name}`,
    matchDate: match.matchDate.toISOString(),
    venue: advanced.venue || extractVenue(match, snapshots),
    city: advanced.city || null,
    referee: advanced.referee || null,
    competition: process.env.NEXT_PUBLIC_COMPETITION_NAME || 'كأس العالم 2026',
    groupLabel: groupLabelValue,
    stageLabel: stageLabelValue,
    homeTeam,
    awayTeam,
    score,
    status,
    stats,
    events,
    homePlayers: players.filter((player) => player.teamId === match.homeTeamId).map(playerLite),
    awayPlayers: players.filter((player) => player.teamId === match.awayTeamId).map(playerLite),
    officialLineup,
    advanced,
    voteEndpoint: `/api/matches/${match.id}/votes`,
    groupStandings,
    thirdPlaceTable,
    tacticalKeys: buildTacticalKeys(homeTeam.name, awayTeam.name, statsAvailable, digest),
    matchImpact: groupKey ? buildMatchImpact(match.homeTeamId, match.awayTeamId, groupStandings, thirdPlaceTable) : [],
    digest: digest ? { summary: digest.summary, turningPoint: digest.turningPoint, scoreLine: digest.scoreLine, href: `/match-digests/${match.id}` } : null,
    relatedArticles: relatedArticlesFrom(relatedNews, digest, match.id),
    sources: [{ key: 'db-match', name: 'بيانات المباراة', status: 'active', priority: 0, lastCheckedAt: maxDateIso([match.matchDate]), details: 'الفرق، الموعد، الحالة، النتيجة الأساسية' }, ...buildSourceList(snapshots)],
    sourceChecklist: sourceChecklist(match, statsAvailable, events.length, providers, officialLineup),
    lastUpdatedAt: maxDateIso([...(match.statsSnapshots || []).map((snapshot) => snapshot.capturedAt), ...(match.events || []).map((event) => event.updatedAt), match.matchDate]),
  };
}
