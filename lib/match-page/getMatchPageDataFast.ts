import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type {
  MatchAdvancedData,
  MatchEventView,
  MatchPageData,
  MatchPlayerLite,
  MatchSourceView,
  MatchStatMetric,
  MatchStatusView,
  MatchTeamLite,
  RelatedArticle,
  SourceChecklistItem,
} from './types';
import { buildBestThirdsTable, buildGroupStandings, buildMatchImpact } from './standings';
import {
  buildEventView,
  buildSourceList,
  buildStatMetric,
  buildStatusView,
  metricDefinitions,
  normalizeGroupKey,
  providerPriority,
  rawData,
  scoreForDisplay,
  stageLabel,
  toNumber,
} from './normalizers';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const BAD_GROUP_KEYS = ['STAGE', 'GROUP', 'GROUPS', 'GROUP STAGE', 'GROUP_STAGE', 'NULL', 'UNKNOWN', 'N/A'];

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
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = cleanVenue(item);
      if (text) return text;
    }
  }
  if (value && typeof value === 'object') {
    return cleanText(value.name || value.stadium || value.venue || value.ground || value.title || value.fullName || value.full_name || value.displayName || value.display_name);
  }
  return null;
}

function teamLite(team: any): MatchTeamLite {
  return {
    id: team.id,
    name: team.name || team.code || 'منتخب غير معروف',
    code: team.code || null,
    image: getTeamFlagUrl({ code: team.code, name: team.name, image: team.image }, 160) || team.image || null,
    coach: team.coach || null,
    fifaRank: team.fifaRank ?? null,
    group: team.group || null,
  };
}

function playerLite(player: any): MatchPlayerLite {
  return {
    id: player.id,
    name: player.name || player.code || 'لاعب غير معروف',
    code: player.code || null,
    image: player.image || null,
    position: player.position || null,
    teamId: player.teamId || null,
  };
}

function normalizeGoodGroup(value: any) {
  const key = normalizeGroupKey(cleanText(value) || String(value || ''));
  return key && !BAD_GROUP_KEYS.includes(String(key).toUpperCase()) ? key : null;
}

function findDeep(value: any, keys: string[], depth = 0): any {
  if (!value || depth > 5 || typeof value !== 'object') return null;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key];
  }
  for (const item of Object.values(value)) {
    if (item && typeof item === 'object') {
      const found = findDeep(item, keys, depth + 1);
      if (found !== null && found !== undefined && found !== '') return found;
    }
  }
  return null;
}

function extractBasicInfo(match: any, snapshots: any[]) {
  const directVenue = cleanVenue(match.venue) || cleanVenue(match.stadium) || cleanVenue(match.location);
  const directCity = cleanText(match.city);
  const directReferee = cleanText(match.referee);
  let venue = directVenue;
  let city = directCity;
  let referee = directReferee;

  for (const snapshot of snapshots.slice(0, 6)) {
    const data = rawData(snapshot);
    const normalized = data.normalized || {};
    const info = data.matchInfo || normalized.matchInfo || data;
    venue ||= cleanVenue(info.venue || findDeep(data, ['venue', 'stadium', 'ground', 'arena', 'venue_name', 'stadium_name']));
    city ||= cleanText(info.city || findDeep(data, ['city', 'venue_city', 'location_city', 'town']));
    referee ||= cleanText(info.referee || findDeep(data, ['referee', 'main_referee', 'referee_name']));
    if (venue && city && referee) break;
  }

  return { venue, city, referee };
}

function extractAdvancedData(snapshots: any[]): MatchAdvancedData {
  const extras = snapshots.find((snapshot) => String(snapshot.provider || '').toUpperCase() === 'THE_STATS_API_EXTRAS');
  const normalized = extras?.rawData && typeof extras.rawData === 'object' ? (extras.rawData as any).normalized || {} : {};
  const matchInfo = normalized.matchInfo || {};
  const npxgRaw = matchInfo.npxgSummary?.live || matchInfo.npxgSummary?.stored || null;

  return {
    venue: cleanVenue(matchInfo.venue),
    city: cleanText(matchInfo.city),
    referee: cleanText(matchInfo.referee),
    finalScore: matchInfo.finalScore || null,
    xg: null,
    npxg: npxgRaw ? { home: toNumber(npxgRaw.home_team ?? npxgRaw.home), away: toNumber(npxgRaw.away_team ?? npxgRaw.away) } : null,
    events: [],
    shotmap: [],
    playerStats: [],
  };
}

function forceFinishedStatus(match: any, current: MatchStatusView): MatchStatusView {
  const raw = String(match.status || '').toUpperCase();
  if (FINISHED.includes(raw)) {
    return { raw: raw || 'FINISHED', kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false };
  }
  return current;
}

function sourceChecklist(match: any, statsAvailable: boolean, eventsCount: number): SourceChecklistItem[] {
  return [
    { label: 'بيانات المباراة والمنتخبين', status: match ? 'ready' : 'missing', note: 'الفرق، الموعد، الحالة والنتيجة الأساسية.' },
    { label: 'الإحصائيات الحية والنهائية', status: statsAvailable ? 'ready' : 'missing', note: statsAvailable ? 'تم حفظ Snapshot إحصائي من مزود البيانات.' : 'سيتم تحديثها تلقائيًا عند وصول Snapshot جديد.' },
    { label: 'أحداث المباراة', status: eventsCount > 0 ? 'ready' : 'missing', note: eventsCount > 0 ? 'الأحداث محفوظة في قاعدة البيانات.' : 'تظهر الأحداث عند توفر مصدر موثق.' },
  ];
}

function maxDateIso(values: Array<Date | string | null | undefined>) {
  const times = values.map((value) => (value ? new Date(value).getTime() : 0)).filter((value) => Number.isFinite(value));
  return new Date(times.length ? Math.max(...times) : Date.now()).toISOString();
}

function relatedArticlesFrom(news: any[], digest: any | null, matchId: string): RelatedArticle[] {
  const articles = news.map((item) => ({
    id: item.id,
    title: item.title,
    summary: String(item.body || '').slice(0, 160),
    href: `/news/${item.id}`,
    label: item.category || 'خبر',
  }));
  if (digest) {
    articles.unshift({
      id: `digest-${matchId}`,
      title: digest.scoreLine || 'ملخص المباراة',
      summary: digest.summary || 'ملخص وتحليل المباراة.',
      href: `/match-digests/${matchId}`,
      label: 'ملخص المباراة',
    });
  }
  return articles.slice(0, 5);
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
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 80 },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 12 },
    },
  });

  if (!match) return null;

  const [players, allMatches, digest, relatedNews] = await Promise.all([
    prisma.asset.findMany({
      where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } },
      select: { id: true, name: true, code: true, image: true, position: true, teamId: true },
      take: 60,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    }),
    prisma.match.findMany({
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        status: true,
        matchDate: true,
        groupPhase: true,
        stage: true,
        homeTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
        awayTeam: { select: { id: true, name: true, code: true, image: true, group: true } },
      },
      orderBy: { matchDate: 'asc' },
    }),
    prisma.matchDigest.findUnique({ where: { matchId: match.id } }).catch(() => null),
    prisma.pressNews.findMany({
      where: {
        status: 'published',
        OR: [
          { relatedMatchId: match.id },
          { relatedTeamId: { in: [match.homeTeamId, match.awayTeamId] } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
    }).catch(() => []),
  ]);

  const snapshots = [...(match.statsSnapshots || [])].sort((a, b) => providerPriority(a) - providerPriority(b) || new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  const homeTeam = teamLite(match.homeTeam);
  const awayTeam = teamLite(match.awayTeam);
  const advanced = extractAdvancedData(snapshots);
  const score = scoreForDisplay(match, snapshots);
  const status = forceFinishedStatus(match, buildStatusView(match, snapshots));
  const stats = metricDefinitions().map(([key, label, homeKey, awayKey, suffix]) => buildStatMetric(snapshots, key, label, homeKey, awayKey, suffix));
  const statsAvailable = stats.some((metric: MatchStatMetric) => metric.available);
  const groupKey = normalizeGoodGroup(match.groupPhase) || normalizeGoodGroup(match.group) || normalizeGoodGroup(homeTeam.group) || normalizeGoodGroup(awayTeam.group);
  const groupStandings = groupKey ? buildGroupStandings(allMatches as any[], groupKey) : [];
  const thirdPlaceTable = buildBestThirdsTable(allMatches as any[]);
  const dbEvents: MatchEventView[] = (match.events || []).map(buildEventView);
  const basicInfo = extractBasicInfo(match, snapshots);
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
    events: dbEvents,
    homePlayers: players.filter((player) => player.teamId === match.homeTeamId).map(playerLite),
    awayPlayers: players.filter((player) => player.teamId === match.awayTeamId).map(playerLite),
    officialLineup: null,
    advanced,
    voteEndpoint: `/api/matches/${match.id}/votes`,
    groupStandings,
    thirdPlaceTable,
    tacticalKeys: buildTacticalKeys(homeTeam.name, awayTeam.name, statsAvailable, digest),
    matchImpact: buildMatchImpact(match.homeTeamId, match.awayTeamId, groupStandings, thirdPlaceTable),
    digest: digest ? { summary: digest.summary, turningPoint: digest.turningPoint, scoreLine: digest.scoreLine, href: `/match-digests/${match.id}` } : null,
    relatedArticles: relatedArticlesFrom(relatedNews, digest, match.id),
    sources,
    sourceChecklist: sourceChecklist(match, statsAvailable, dbEvents.length),
    lastUpdatedAt: maxDateIso([...(match.statsSnapshots || []).map((snapshot) => snapshot.capturedAt), ...(match.events || []).map((event) => event.updatedAt), match.matchDate]),
  };
}
