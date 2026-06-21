import { unstable_noStore as noStore, unstable_cache } from 'next/cache';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchAdvancedData, MatchEventView, MatchPageData, MatchPlayerLite, MatchShotMapItem, MatchStatusView, MatchTeamLite, OfficialLineupPlayer, OfficialLineupTeam, OfficialLineupView, RelatedArticle, SourceChecklistItem } from './types';
import { buildBestThirdsTable, buildGroupStandings, buildMatchImpact } from './standings';
import { buildEventView, buildSourceList, buildStatMetric, buildStatusView, metricDefinitions, normalizeGroupKey, providerName, providerPriority, rawData, scoreForDisplay, stageLabel, toNumber } from './normalizers';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const BAD_GROUP_KEYS = ['STAGE', 'GROUP', 'GROUPS', 'GROUP STAGE', 'GROUP_STAGE', 'NULL', 'UNKNOWN', 'N/A'];

function teamLite(team: any): MatchTeamLite { return { id: team.id, name: team.name || team.code || 'منتخب غير معروف', code: team.code || null, image: getTeamFlagUrl({ code: team.code, name: team.name, image: team.image }, 160) || team.image || null, coach: team.coach || null, fifaRank: team.fifaRank ?? null, group: team.group || null }; }
function playerLite(player: any): MatchPlayerLite { return { id: player.id, name: player.name || player.code || 'لاعب غير معروف', code: player.code || null, image: player.image || null, position: player.position || null, teamId: player.teamId || null }; }
function cleanText(value: any): string | null { if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { const text = String(value).trim(); if (text && text !== '[object Object]' && !/^unknown|n\/a|null|undefined|-$/i.test(text)) return text; } if (Array.isArray(value)) { for (const item of value) { const text = cleanText(item); if (text) return text; } } if (value && typeof value === 'object') return cleanText(value.name || value.fullName || value.full_name || value.displayName || value.display_name || value.title || value.label); return null; }
function cleanVenue(value: any): string | null { if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return cleanText(value); if (Array.isArray(value)) { for (const item of value) { const text = cleanVenue(item); if (text) return text; } } if (value && typeof value === 'object') return cleanText(value.name || value.stadium || value.venue || value.ground || value.title || value.fullName || value.full_name || value.displayName || value.display_name); return null; }
function textKey(value: any) { return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function list(value: any): any[] { return Array.isArray(value) ? value : []; }
function isGoodGroupKey(key: string | null | undefined) { return Boolean(key && !BAD_GROUP_KEYS.includes(String(key).toUpperCase())); }
function normalizeGoodGroup(value: any) { const key = normalizeGroupKey(cleanText(value) || String(value || '')); return isGoodGroupKey(key) ? key : null; }
function sameTeam(value: any, team: MatchTeamLite) { const a = textKey(value); const b = textKey(team.name); const c = textKey(team.code); return Boolean(a && ((b && (a === b || a.includes(b) || b.includes(a))) || (c && a === c))); }
function teamIdFromName(value: any, homeTeam: MatchTeamLite, awayTeam: MatchTeamLite) { if (sameTeam(value, homeTeam)) return homeTeam.id; if (sameTeam(value, awayTeam)) return awayTeam.id; return null; }
function findDeep(value: any, keys: string[], depth = 0): any { if (!value || depth > 7) return null; if (typeof value !== 'object') return null; for (const key of keys) { if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key]; } for (const item of Object.values(value)) { if (item && typeof item === 'object') { const found = findDeep(item, keys, depth + 1); if (found !== null && found !== undefined && found !== '') return found; } } return null; }
function findVenueDeep(value: any): string | null { const direct = findDeep(value, ['venue', 'stadium', 'ground', 'arena', 'venue_name', 'stadium_name']); return cleanVenue(direct); }
function findCityDeep(value: any): string | null { return cleanText(findDeep(value, ['city', 'venue_city', 'location_city', 'town'])); }
function findRefereeDeep(value: any): string | null { return cleanText(findDeep(value, ['referee', 'main_referee', 'referee_name', 'official', 'officials'])); }
function findGroupDeep(value: any): string | null { return normalizeGoodGroup(findDeep(value, ['group', 'groupPhase', 'group_phase', 'group_name', 'groupName', 'round_name', 'roundName'])); }
function extractStandaloneMatchInfo(snapshots: any[]) { for (const snapshot of snapshots) { if (String(snapshot.provider || '').toUpperCase() !== 'THE_STATS_API_MATCH_INFO') continue; const data = rawData(snapshot); const info = data.matchInfo || data.normalized?.matchInfo || data; const venue = cleanVenue(info.venue || data.venue); const city = cleanText(info.city || data.city); const referee = cleanText(info.referee || data.referee); if (venue || city || referee) return { venue, city, referee }; } return { venue: null, city: null, referee: null }; }
function extractVenue(match: any, snapshots: any[]) { const direct = cleanVenue(match.venue) || cleanVenue(match.stadium) || cleanVenue(match.location); if (direct) return direct; for (const snapshot of snapshots) { const found = findVenueDeep(rawData(snapshot)); if (found) return found; } return null; }
function extractCity(match: any, snapshots: any[]) { const direct = cleanText(match.city); if (direct) return direct; for (const snapshot of snapshots) { const found = findCityDeep(rawData(snapshot)); if (found) return found; } return null; }
function extractReferee(match: any, snapshots: any[]) { const direct = cleanText(match.referee); if (direct) return direct; for (const snapshot of snapshots) { const found = findRefereeDeep(rawData(snapshot)); if (found) return found; } return null; }
function eventIcon(type: string) { const value = textKey(type); if (value.includes('goal')) return '⚽'; if (value.includes('yellow')) return '🟨'; if (value.includes('red')) return '🟥'; if (value.includes('sub')) return '🔁'; if (value.includes('corner')) return '🚩'; if (value.includes('var')) return '📺'; if (value.includes('shot')) return '🎯'; if (value.includes('offside')) return '🚫'; if (value.includes('foul')) return '✋'; return '•'; }
function minuteLabel(minute: number | null | undefined, extra?: number | null) { if (minute === null || minute === undefined) return '—'; return extra ? `${minute}+${extra}د` : `${minute}د`; }
function eventLabel(type: string) { const map: Record<string, string> = { goal: 'هدف', shot_on_target: 'تسديدة على المرمى', shot_off_target: 'تسديدة خارج المرمى', shot_blocked: 'تسديدة محجوبة', corner_kick: 'ركنية', foul: 'خطأ', yellow_card: 'بطاقة صفراء', red_card: 'بطاقة حمراء', substitution: 'تبديل', var: 'VAR', offside: 'تسلل', added_time: 'وقت بدل ضائع', period_start: 'بداية شوط', period_end: 'نهاية شوط' }; return map[type] || type; }
function lineupPlayer(row: any): OfficialLineupPlayer | null { const name = String(row?.name || row?.playerName || row?.player?.name || '').trim(); if (!name) return null; return { id: row?.id || row?.playerId || row?.player_id || null, name, number: row?.number ?? row?.shirt_number ?? row?.jersey_number ?? null, image: row?.image || row?.photo || row?.player?.image || null, position: row?.position || row?.role || null, rating: typeof row?.rating === 'number' ? row.rating : row?.rating ? Number(row.rating) : null, isCaptain: Boolean(row?.isCaptain || row?.captain) }; }
function lineupTeam(raw: any): OfficialLineupTeam | null { if (!raw || typeof raw !== 'object') return null; const startingRows = raw.startingXi || raw.starting_xi || raw.lineup || raw.players || []; const subRows = raw.substitutes || raw.bench || []; const startingXi = Array.isArray(startingRows) ? rowsToLineup(startingRows) : []; const substitutes = Array.isArray(subRows) ? rowsToLineup(subRows) : []; if (!startingXi.length && !substitutes.length) return null; return { teamName: raw.name || raw.teamName || null, formation: raw.formation || null, startingXi, substitutes }; }
function rowsToLineup(rows: any[]) { return rows.map(lineupPlayer).filter(Boolean) as OfficialLineupPlayer[]; }
function extractOfficialLineup(snapshots: any[]): OfficialLineupView { for (const snapshot of snapshots) { const data = rawData(snapshot); const normalized = data.normalized || null; const lineup = data.lineup || data.theStatsApi?.lineup || data.lineups || normalized?.lineups || null; if (!lineup || lineup.error) continue; const home = lineupTeam(lineup.home || lineup.homeTeam); const away = lineupTeam(lineup.away || lineup.awayTeam); if (home || away) return { confirmed: Boolean(lineup.confirmed), source: providerName(snapshot), home, away }; } return null; }
function sumShots(shots: MatchShotMapItem[], teamId: string, field: 'xg' | 'npxg') { const values = shots.filter((shot) => shot.teamId === teamId).map((shot) => toNumber(shot[field])).filter((value) => value !== null) as number[]; if (!values.length) return null; return Number(values.reduce((sum, value) => sum + value, 0).toFixed(3)); }
function applyAdvancedMetric(metric: any, key: string, pair: { home: number | null; away: number | null } | null) { if (metric.key !== key || metric.available || !pair) return metric; return { ...metric, home: pair.home, away: pair.away, available: pair.home !== null || pair.away !== null, source: 'TheStats' }; }
function extractAdvancedData(snapshots: any[], homeTeam: MatchTeamLite, awayTeam: MatchTeamLite): MatchAdvancedData { const extras = snapshots.find((snapshot) => String(snapshot.provider || '').toUpperCase() === 'THE_STATS_API_EXTRAS'); const normalized = extras?.rawData && typeof extras.rawData === 'object' ? (extras.rawData as any).normalized || {} : {}; const matchInfo = normalized.matchInfo || {}; const npxgRaw = matchInfo.npxgSummary?.live || matchInfo.npxgSummary?.stored || null; const shotmap: MatchShotMapItem[] = list(normalized.shotmap).map((shot) => ({ ...shot, teamId: teamIdFromName(shot.teamName, homeTeam, awayTeam) || shot.teamId || null })); const events: MatchEventView[] = list(normalized.eventsDetailed?.all).map((event, index) => { const type = String(event.type || 'event'); const minute = toNumber(event.minute); const extra = toNumber(event.extraTime ?? event.extra_time); const teamId = teamIdFromName(event.teamName, homeTeam, awayTeam); return { id: `thestats-${event.sequence || index}-${type}-${minute ?? 'na'}`, minute, minuteLabel: minuteLabel(minute, extra), type: eventLabel(type), icon: eventIcon(type), teamId, playerName: event.playerName || null, detail: event.detail || `${eventLabel(type)}${event.playerName ? ` - ${event.playerName}` : ''}${event.teamName ? ` (${event.teamName})` : ''}`, sourceName: 'TheStats' }; }); const playerStats = list(normalized.playerStats).map((player) => ({ ...player, teamId: teamIdFromName(player.teamName, homeTeam, awayTeam) || player.teamId || null })); const xg = shotmap.length ? { home: sumShots(shotmap, homeTeam.id, 'xg'), away: sumShots(shotmap, awayTeam.id, 'xg') } : null; return { venue: cleanVenue(matchInfo.venue), city: cleanText(matchInfo.city), referee: cleanText(matchInfo.referee), finalScore: matchInfo.finalScore || null, xg, npxg: npxgRaw ? { home: toNumber(npxgRaw.home_team ?? npxgRaw.home), away: toNumber(npxgRaw.away_team ?? npxgRaw.away) } : null, events, shotmap, playerStats }; }
function inferGroupKey(match: any, homeTeam: MatchTeamLite, awayTeam: MatchTeamLite, allMatches: any[], snapshots: any[]) { const direct = normalizeGoodGroup(match.groupPhase) || normalizeGoodGroup(match.group) || findGroupDeep(rawData(snapshots[0] || {})); if (direct) return direct; const homeGroup = normalizeGoodGroup(homeTeam.group); const awayGroup = normalizeGoodGroup(awayTeam.group); if (homeGroup && (!awayGroup || homeGroup === awayGroup)) return homeGroup; if (awayGroup && !homeGroup) return awayGroup; const counts = new Map<string, number>(); for (const row of allMatches) { const involved = row.homeTeamId === match.homeTeamId || row.awayTeamId === match.homeTeamId || row.homeTeamId === match.awayTeamId || row.awayTeamId === match.awayTeamId; if (!involved) continue; const key = normalizeGoodGroup(row.groupPhase) || normalizeGoodGroup(row.homeTeam?.group) || normalizeGoodGroup(row.awayTeam?.group); if (key) counts.set(key, (counts.get(key) || 0) + 1); } return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null; }
function forceFinishedStatus(match: any, advanced: MatchAdvancedData, current: MatchStatusView): MatchStatusView { const raw = String(match.status || '').toUpperCase(); const hasPostmatchData = advanced.playerStats.length > 0 || (advanced.shotmap.length > 0 && advanced.events.some((event) => event.type.includes('نهاية') && Number(event.minute || 0) >= 90)); if (FINISHED.includes(raw) || hasPostmatchData) return { raw: raw || 'FINISHED', kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false }; return current; }
function sourceChecklist(match: any, statsAvailable: boolean, eventsCount: number, _providers: string[], lineup: OfficialLineupView): SourceChecklistItem[] { return [ { label: 'بيانات المباراة والمنتخبين', status: match ? 'ready' : 'missing', note: 'الفرق، الموعد، الحالة والنتيجة الأساسية.' }, { label: 'الإحصائيات الحية والنهائية', status: statsAvailable ? 'ready' : 'missing', note: statsAvailable ? 'تم حفظ Snapshot إحصائي من مزود البيانات.' : 'سيتم تحديثها تلقائيًا عند وصول Snapshot جديد.' }, { label: 'أحداث المباراة', status: eventsCount > 0 ? 'ready' : 'missing', note: eventsCount > 0 ? 'الأحداث محفوظة في قاعدة البيانات.' : 'يتم فحص الأحداث تلقائيًا أثناء وبعد المباراة.' }, { label: 'التشكيل الرسمي', status: lineup ? 'ready' : 'optional', note: lineup ? 'تم العثور على تشكيل رسمي.' : 'سيتم جلب التشكيل الرسمي تلقائيًا عند توفره.' } ]; }
function relatedArticlesFrom(news: any[], digest: any | null, matchId: string): RelatedArticle[] { const articles: RelatedArticle[] = []; if (digest) articles.push({ id: `digest-${matchId}`, title: digest.matchTitle || 'تقرير المباراة', summary: digest.summary || digest.turningPoint || 'ملخص وتحليل المباراة بعد التحديث.', href: `/match-digests/${matchId}`, label: 'تقرير المباراة' }); for (const item of news) articles.push({ id: item.id, title: item.title, summary: item.body ? String(item.body).slice(0, 150) : 'خبر مرتبط بالمباراة.', href: `/news/${item.id}`, label: item.category || 'خبر مرتبط' }); return articles.slice(0, 6); }
function buildTacticalKeys(homeName: string, awayName: string, statsAvailable: boolean, digest?: any | null) { const keys: string[] = []; if (digest?.turningPoint) keys.push(`نقطة التحول: ${digest.turningPoint}`); keys.push(`مفتاح المتابعة: تعامل ${homeName} مع ضغط ${awayName} أثناء بناء اللعب والتحولات.`); keys.push('راقب جودة الخروج من الخلف والكرات الثانية والمساحات خلف الظهيرين.'); keys.push(statsAvailable ? 'كل رقم ظاهر في الصفحة مأخوذ من Snapshot موثق.' : 'الإحصائيات التفصيلية ستظهر بعد وصول Snapshot موثق أو إدخال يدوي.'); return keys.slice(0, 4); }
function maxDateIso(values: Array<Date | string | null | undefined>) { const times = values.map((value) => (value ? new Date(value).getTime() : 0)).filter((value) => Number.isFinite(value)); return new Date(times.length ? Math.max(...times) : Date.now()).toISOString(); }

const getCachedMatches = unstable_cache(
  async () => {
    return prisma.match.findMany({
      select: {
        id: true,
        status: true,
        groupPhase: true,
        stage: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
            group: true,
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
            group: true,
          }
        }
      },
      orderBy: { matchDate: 'asc' }
    });
  },
  ['all-matches-summary'],
  { revalidate: 30, tags: ['matches'] }
);

export async function getMatchPageData(matchId: string): Promise<MatchPageData | null> {
  noStore();
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true, events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] }, statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 40 } } });
  if (!match) return null;

  const [players, allMatches, digest, relatedNews] = await Promise.all([
    prisma.asset.findMany({ where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } }, select: { id: true, name: true, code: true, image: true, position: true, teamId: true }, take: 100, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    getCachedMatches(),
    prisma.matchDigest.findUnique({ where: { matchId: match.id } }).catch(() => null),
    prisma.pressNews.findMany({ where: { status: 'published', OR: [{ relatedMatchId: match.id }, { relatedTeamId: { in: [match.homeTeamId, match.awayTeamId] } }] }, orderBy: { publishedAt: 'desc' }, take: 5 }).catch(() => [])
  ]);
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
  const groupKey = inferGroupKey(match, homeTeam, awayTeam, allMatches, snapshots);
  const groupStandings = groupKey ? buildGroupStandings(allMatches as any[], groupKey) : [];
  const thirdPlaceTable = buildBestThirdsTable(allMatches as any[]);
  const dbEvents = (match.events || []).map(buildEventView);
  const events = dbEvents.length ? dbEvents : advanced.events;
  const groupLabelValue = groupKey ? `المجموعة ${groupKey}` : null;
  const stageLabelValue = groupKey ? `المجموعة ${groupKey}` : stageLabel(match.stage, null);
  const standaloneInfo = extractStandaloneMatchInfo(snapshots);
  const venue = standaloneInfo.venue || cleanVenue(advanced.venue) || extractVenue(match, snapshots);
  const city = standaloneInfo.city || cleanText(advanced.city) || extractCity(match, snapshots);
  const referee = standaloneInfo.referee || cleanText(advanced.referee) || extractReferee(match, snapshots);
  return { id: match.id, title: `${homeTeam.name} ضد ${awayTeam.name}`, matchDate: match.matchDate.toISOString(), venue, city, referee, competition: process.env.NEXT_PUBLIC_COMPETITION_NAME || 'كأس العالم 2026', groupLabel: groupLabelValue, stageLabel: stageLabelValue, homeTeam, awayTeam, score, status, stats, events, homePlayers: players.filter((player) => player.teamId === match.homeTeamId).map(playerLite), awayPlayers: players.filter((player) => player.teamId === match.awayTeamId).map(playerLite), officialLineup, advanced, voteEndpoint: `/api/matches/${match.id}/votes`, groupStandings, thirdPlaceTable, tacticalKeys: buildTacticalKeys(homeTeam.name, awayTeam.name, statsAvailable, digest), matchImpact: buildMatchImpact(match.homeTeamId, match.awayTeamId, groupStandings, thirdPlaceTable), digest: digest ? { summary: digest.summary, turningPoint: digest.turningPoint, scoreLine: digest.scoreLine, href: `/match-digests/${match.id}` } : null, relatedArticles: relatedArticlesFrom(relatedNews, digest, match.id), sources: [{ key: 'db-match', name: 'بيانات المباراة', status: 'active', priority: 0, lastCheckedAt: maxDateIso([match.matchDate]), details: 'الفرق، الموعد، الحالة، النتيجة الأساسية' }, ...buildSourceList(snapshots)], sourceChecklist: sourceChecklist(match, statsAvailable, events.length, providers, officialLineup), lastUpdatedAt: maxDateIso([...(match.statsSnapshots || []).map((snapshot) => snapshot.capturedAt), ...(match.events || []).map((event) => event.updatedAt), match.matchDate]) };
}
