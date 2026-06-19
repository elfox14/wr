import { unstable_noStore as noStore } from 'next/cache';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { MatchPageData, MatchPlayerLite, MatchTeamLite, OfficialLineupPlayer, OfficialLineupTeam, OfficialLineupView, RelatedArticle, SourceChecklistItem } from './types';
import { buildBestThirdsTable, buildGroupStandings, buildMatchImpact } from './standings';
import { buildEventView, buildSourceList, buildStatMetric, buildStatusView, groupLabel, metricDefinitions, normalizeGroupKey, providerName, providerPriority, rawData, scoreForDisplay, stageLabel } from './normalizers';

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
  return { id: player.id, name: player.name || player.code || 'لاعب غير معروف', code: player.code || null, image: player.image || null, position: player.position || null, teamId: player.teamId || null };
}

function lineupPlayer(row: any): OfficialLineupPlayer | null {
  const name = String(row?.name || row?.playerName || row?.player?.name || '').trim();
  if (!name) return null;
  return {
    id: row?.id || row?.playerId || row?.player_id || null,
    name,
    number: row?.number ?? row?.shirt_number ?? row?.jersey_number ?? null,
    image: row?.image || row?.photo || row?.player?.image || null,
    position: row?.position || row?.role || null,
    rating: typeof row?.rating === 'number' ? row.rating : row?.rating ? Number(row.rating) : null,
    isCaptain: Boolean(row?.isCaptain || row?.captain),
  };
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
    const lineup = data.lineup || data.theStatsApi?.lineup || data.lineups || null;
    if (!lineup || lineup.error) continue;
    const home = lineupTeam(lineup.home || lineup.homeTeam);
    const away = lineupTeam(lineup.away || lineup.awayTeam);
    if (home || away) return { confirmed: Boolean(lineup.confirmed), source: providerName(snapshot), home, away };
  }
  return null;
}

function extractVenue(match: any, snapshots: any[]) {
  const direct = match.venue || match.stadium || match.location;
  if (direct) return String(direct);
  for (const snapshot of snapshots) {
    const data = rawData(snapshot);
    const venue = data.venue || data.stadium || data.location || data.meta?.venue || data.meta?.stadium || data.fixture?.venue?.name;
    if (venue) return String(venue);
  }
  return null;
}

function sourceChecklist(match: any, statsAvailable: boolean, eventsCount: number, providers: string[], lineup: OfficialLineupView): SourceChecklistItem[] {
  const hasTheStats = providers.some((provider) => provider.includes('THE_STATS'));
  const hasISport = providers.some((provider) => provider.includes('ISPORT'));
  return [
    { label: 'بيانات المباراة والمنتخبين', status: match ? 'ready' : 'missing', note: 'من جدول Match المرتبط بمنتخبي المباراة.' },
    { label: 'الإحصائيات الحية', status: statsAvailable ? 'ready' : 'missing', note: statsAvailable ? 'تقرأ من MatchStatsSnapshot بأولوية TheStatsAPI ثم iSport.' : 'تظهر تلقائيًا بعد وصول Snapshot من مزودي البيانات.' },
    { label: 'أحداث المباراة', status: eventsCount > 0 ? 'ready' : 'missing', note: eventsCount > 0 ? 'موجودة في MatchEvent.' : 'تصل تلقائيًا من TheStatsAPI وiSport أثناء وبعد المباراة.' },
    { label: 'TheStatsAPI Live', status: hasTheStats ? 'ready' : 'optional', note: hasTheStats ? 'موجود في اللقطات الحالية.' : 'سيتم فحصه تلقائيًا عبر الكرون.' },
    { label: 'iSport / Animation', status: hasISport ? 'ready' : 'optional', note: hasISport ? 'مستخدم كدعم للبث والإحصائيات.' : 'سيتم فحصه تلقائيًا عبر الكرون.' },
    { label: 'التشكيل الرسمي', status: lineup ? 'ready' : 'optional', note: lineup ? `تم العثور على تشكيل من ${lineup.source}.` : 'سيتم جلب التشكيل الرسمي تلقائيًا عند ظهوره في TheStatsAPI أو iSport Lineups.' },
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
  keys.push(statsAvailable ? 'كل رقم ظاهر في الصفحة مأخوذ من Snapshot موثق، وأي رقم غائب يظهر كغير متوفر.' : 'الإحصائيات التفصيلية ستظهر بعد وصول Snapshot موثق أو إدخال يدوي.');
  return keys.slice(0, 4);
}

function maxDateIso(values: Array<Date | string | null | undefined>) {
  const times = values.map((value) => (value ? new Date(value).getTime() : 0)).filter((value) => Number.isFinite(value));
  return new Date(times.length ? Math.max(...times) : Date.now()).toISOString();
}

export async function getMatchPageData(matchId: string): Promise<MatchPageData | null> {
  noStore();
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true, events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] }, statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 40 } },
  });
  if (!match) return null;

  const players = await prisma.asset.findMany({ where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } }, select: { id: true, name: true, code: true, image: true, position: true, teamId: true }, take: 100, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  const allMatches = await prisma.match.findMany({ include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'asc' } });
  const digest = await prisma.matchDigest.findUnique({ where: { matchId: match.id } }).catch(() => null);
  const relatedNews = await prisma.pressNews.findMany({ where: { status: 'published', OR: [{ relatedMatchId: match.id }, { relatedTeamId: { in: [match.homeTeamId, match.awayTeamId] } }] }, orderBy: { publishedAt: 'desc' }, take: 5 }).catch(() => []);

  const snapshots = [...(match.statsSnapshots || [])].sort((a, b) => providerPriority(a) - providerPriority(b) || new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  const score = scoreForDisplay(match, snapshots);
  const status = buildStatusView(match, snapshots);
  const stats = metricDefinitions().map(([key, label, homeKey, awayKey, suffix]) => buildStatMetric(snapshots, key, label, homeKey, awayKey, suffix));
  const statsAvailable = stats.some((metric) => metric.available);
  const providers = snapshots.map((snapshot) => String(snapshot.provider || '').toUpperCase());
  const officialLineup = extractOfficialLineup(snapshots);
  const groupKey = normalizeGroupKey(match.groupPhase || match.stage);
  const standings = buildGroupStandings(allMatches as any[], groupKey);
  const thirdPlaceTable = buildBestThirdsTable(allMatches as any[]);
  const homeTeam = teamLite(match.homeTeam);
  const awayTeam = teamLite(match.awayTeam);
  const events = (match.events || []).map(buildEventView);

  return {
    id: match.id,
    title: `${homeTeam.name} ضد ${awayTeam.name}`,
    matchDate: match.matchDate.toISOString(),
    venue: extractVenue(match, snapshots),
    competition: process.env.NEXT_PUBLIC_COMPETITION_NAME || 'كأس العالم 2026',
    groupLabel: groupLabel(match.groupPhase || match.stage),
    stageLabel: stageLabel(match.stage, match.groupPhase),
    homeTeam,
    awayTeam,
    score,
    status,
    stats,
    events,
    homePlayers: players.filter((player) => player.teamId === match.homeTeamId).map(playerLite),
    awayPlayers: players.filter((player) => player.teamId === match.awayTeamId).map(playerLite),
    officialLineup,
    voteEndpoint: `/api/matches/${match.id}/votes`,
    groupStandings: standings,
    thirdPlaceTable,
    tacticalKeys: buildTacticalKeys(homeTeam.name, awayTeam.name, statsAvailable, digest),
    matchImpact: buildMatchImpact(match.homeTeamId, match.awayTeamId, standings, thirdPlaceTable),
    digest: digest ? { summary: digest.summary, turningPoint: digest.turningPoint, scoreLine: digest.scoreLine, href: `/match-digests/${match.id}` } : null,
    relatedArticles: relatedArticlesFrom(relatedNews, digest, match.id),
    sources: [{ key: 'db-match', name: 'قاعدة المباراة', status: 'active', priority: 0, lastCheckedAt: maxDateIso([match.matchDate]), details: 'الفرق، الموعد، الحالة، النتيجة الأساسية' }, ...buildSourceList(snapshots)],
    sourceChecklist: sourceChecklist(match, statsAvailable, events.length, providers, officialLineup),
    lastUpdatedAt: maxDateIso([...(match.statsSnapshots || []).map((snapshot) => snapshot.capturedAt), ...(match.events || []).map((event) => event.updatedAt), match.matchDate]),
  };
}
