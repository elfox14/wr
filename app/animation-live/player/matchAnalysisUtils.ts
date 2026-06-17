import type { DataQuality, LiveStatsResponse, MatchEvent, MomentumSegment, PressureModel, Snapshot } from './types';
import { ar, formatUpdatedAt } from './formatters';
import { cleanEventDetail, eventCategory, eventLabel, eventMinute, eventSide, sortEventsByMinute } from './eventUtils';
import { sideName } from './pressureUtils';

export const DATA_QUALITY_STAT_KEYS = [
  'homePossession',
  'awayPossession',
  'homeAttacks',
  'awayAttacks',
  'homeDangerousAttacks',
  'awayDangerousAttacks',
  'homeShots',
  'awayShots',
  'homeShotsOnTarget',
  'awayShotsOnTarget',
  'homeShotsOffTarget',
  'awayShotsOffTarget',
  'homeCorners',
  'awayCorners',
  'homeYellowCards',
  'awayYellowCards',
  'homeRedCards',
  'awayRedCards',
];

export function n(snapshot: Snapshot, key: string) {
  const value = Number(snapshot?.[key]);
  return Number.isFinite(value) ? value : null;
}

export function hasAnyStat(snapshot: Snapshot) {
  if (!snapshot) return false;
  return [
    'homePossession',
    'awayPossession',
    'homeAttacks',
    'awayAttacks',
    'homeDangerousAttacks',
    'awayDangerousAttacks',
    'homeShots',
    'awayShots',
    'homeShotsOnTarget',
    'awayShotsOnTarget',
    'homeShotsOffTarget',
    'awayShotsOffTarget',
    'homeCorners',
    'awayCorners',
  ].some((key) => n(snapshot, key) !== null);
}

export function resolvedSnapshot(data: LiveStatsResponse | null): Snapshot {
  if (hasAnyStat(data?.latest || null)) return data?.latest || null;
  return (data?.history || []).slice().reverse().find(hasAnyStat) || data?.latest || null;
}

function statEdge(snapshot: Snapshot, homeKey: string, awayKey: string, label: string, homeName: string, awayName: string) {
  const home = n(snapshot, homeKey);
  const away = n(snapshot, awayKey);
  if (home === null || away === null || home === away) return null;
  const leader = home > away ? homeName : awayName;
  return `${leader} يتفوق في ${label} بفارق ${ar(Math.abs(home - away))}.`;
}

export function matchStoryLines(match: LiveStatsResponse['match'] | undefined, snapshot: Snapshot, strongestSegment: MomentumSegment | null) {
  const homeName = match?.homeTeam?.name || 'الفريق الأول';
  const awayName = match?.awayTeam?.name || 'الفريق الثاني';
  const homeScore = n(snapshot, 'homeScore') ?? match?.homeScore ?? 0;
  const awayScore = n(snapshot, 'awayScore') ?? match?.awayScore ?? 0;
  const scoreLine = homeScore === awayScore
    ? `النتيجة متعادلة ${ar(homeScore)} - ${ar(awayScore)}.`
    : `${homeScore > awayScore ? homeName : awayName} متقدم ${ar(homeScore)} - ${ar(awayScore)}.`;
  const statLine = statEdge(snapshot, 'homeDangerousAttacks', 'awayDangerousAttacks', 'الهجمات الخطيرة', homeName, awayName)
    || statEdge(snapshot, 'homeShotsOnTarget', 'awayShotsOnTarget', 'التسديدات على المرمى', homeName, awayName)
    || statEdge(snapshot, 'homeShots', 'awayShots', 'إجمالي التسديدات', homeName, awayName)
    || statEdge(snapshot, 'homePossession', 'awayPossession', 'الاستحواذ', homeName, awayName)
    || 'الأرقام المتاحة لا تظهر أفضلية إحصائية حاسمة.';
  const momentumLine = strongestSegment
    ? `أقوى فترة كانت د ${strongestSegment.label} لصالح ${sideName(strongestSegment.leader, match?.homeTeam, match?.awayTeam)} بمؤشر ${ar(strongestSegment.home + strongestSegment.away)}.`
    : 'أقوى فترة غير متوفرة لأن الأحداث المحفوظة غير كافية.';
  return [scoreLine, statLine, momentumLine];
}

function teamNames(match: LiveStatsResponse['match'] | undefined) {
  return {
    home: match?.homeTeam?.name || 'الفريق الأول',
    away: match?.awayTeam?.name || 'الفريق الثاني',
  };
}

function statPair(snapshot: Snapshot, homeKey: string, awayKey: string) {
  return { home: n(snapshot, homeKey), away: n(snapshot, awayKey) };
}

function leaderClause(home: number | null, away: number | null, label: string, homeName: string, awayName: string) {
  if (home === null || away === null) return null;
  if (home === away) return `${label} متقاربة بين الطرفين عند ${ar(home)} - ${ar(away)}.`;
  const leader = home > away ? homeName : awayName;
  return `${leader} أفضل في ${label} ${ar(home)} - ${ar(away)}.`;
}

function scoreArticleLine(match: LiveStatsResponse['match'] | undefined, snapshot: Snapshot) {
  const { home, away } = teamNames(match);
  const homeScore = n(snapshot, 'homeScore') ?? match?.homeScore ?? 0;
  const awayScore = n(snapshot, 'awayScore') ?? match?.awayScore ?? 0;
  if (homeScore === awayScore) return `حتى الآن، المباراة متعادلة ${ar(homeScore)} - ${ar(awayScore)} بين ${home} و${away}.`;
  return `${homeScore > awayScore ? home : away} يدير المباراة من موقع الأفضلية في النتيجة، متقدمًا ${ar(homeScore)} - ${ar(awayScore)}.`;
}

function latestEventLine(events: MatchEvent[], match: LiveStatsResponse['match'] | undefined) {
  const latest = [...events].sort(sortEventsByMinute).filter((event) => eventMinute(event) !== null).pop();
  if (!latest) return 'لم تصل أحداث كافية بعد لصياغة تسلسل تفصيلي للمباراة.';
  const side = sideName(eventSide(latest, match?.homeTeam, match?.awayTeam), match?.homeTeam, match?.awayTeam);
  const detail = cleanEventDetail(latest.detail);
  return `آخر حدث مؤثر وصل عند د${ar(eventMinute(latest) || 0)}: ${eventLabel(latest.type)} لصالح ${side}${detail ? ` — ${detail}` : ''}.`;
}

function eventBalanceLine(events: MatchEvent[], match: LiveStatsResponse['match'] | undefined) {
  const { home, away } = teamNames(match);
  const counts = {
    homeDanger: 0,
    awayDanger: 0,
    homeShots: 0,
    awayShots: 0,
    homeCorners: 0,
    awayCorners: 0,
  };

  for (const event of events) {
    const category = eventCategory(event.type);
    const side = eventSide(event, match?.homeTeam, match?.awayTeam);
    if (side === 'home' && category === 'danger') counts.homeDanger += 1;
    if (side === 'away' && category === 'danger') counts.awayDanger += 1;
    if (side === 'home' && category === 'shots') counts.homeShots += 1;
    if (side === 'away' && category === 'shots') counts.awayShots += 1;
    if (side === 'home' && category === 'corners') counts.homeCorners += 1;
    if (side === 'away' && category === 'corners') counts.awayCorners += 1;
  }

  const totalTracked = counts.homeDanger + counts.awayDanger + counts.homeShots + counts.awayShots + counts.homeCorners + counts.awayCorners;
  if (!totalTracked) return 'الأحداث التفصيلية لم تعطِ بعد نمطًا كافيًا للهجمات والركنيات والتسديدات.';
  const dangerLine = leaderClause(counts.homeDanger, counts.awayDanger, 'الأحداث الخطيرة المحفوظة', home, away);
  const shotLine = leaderClause(counts.homeShots, counts.awayShots, 'أحداث التسديد', home, away);
  return [dangerLine, shotLine].filter(Boolean).join(' ');
}

export function matchAnalysisArticle(
  match: LiveStatsResponse['match'] | undefined,
  snapshot: Snapshot,
  events: MatchEvent[],
  pressure: PressureModel,
  strongestSegment: MomentumSegment | null,
  currentMinute: number | null,
) {
  const { home, away } = teamNames(match);
  const minuteLabel = currentMinute ? `مع الوصول إلى د${ar(currentMinute)}` : 'مع البيانات المتاحة حتى الآن';
  const possession = leaderClause(statPair(snapshot, 'homePossession', 'awayPossession').home, statPair(snapshot, 'homePossession', 'awayPossession').away, 'الاستحواذ', home, away);
  const attacks = leaderClause(statPair(snapshot, 'homeAttacks', 'awayAttacks').home, statPair(snapshot, 'homeAttacks', 'awayAttacks').away, 'الهجمات', home, away);
  const dangerous = leaderClause(statPair(snapshot, 'homeDangerousAttacks', 'awayDangerousAttacks').home, statPair(snapshot, 'homeDangerousAttacks', 'awayDangerousAttacks').away, 'الهجمات الخطيرة', home, away);
  const shots = leaderClause(statPair(snapshot, 'homeShotsOnTarget', 'awayShotsOnTarget').home, statPair(snapshot, 'homeShotsOnTarget', 'awayShotsOnTarget').away, 'التسديدات على المرمى', home, away)
    || leaderClause(statPair(snapshot, 'homeShots', 'awayShots').home, statPair(snapshot, 'homeShots', 'awayShots').away, 'إجمالي التسديدات', home, away);
  const pressureLeader = sideName(pressure.leader, match?.homeTeam, match?.awayTeam);
  const totalPressure = pressure.home + pressure.away;
  const momentumLine = strongestSegment
    ? `أبرز موجة ضغط جاءت في الفترة ${strongestSegment.label} لصالح ${sideName(strongestSegment.leader, match?.homeTeam, match?.awayTeam)}، وهو ما يشرح اتجاه الزخم خلال تلك المرحلة.`
    : 'لا توجد بعد فترة ضغط واضحة يمكن اعتمادها كأقوى موجة في المباراة.';

  return [
    `${minuteLabel}، تبدو قراءة المباراة أن ${pressureLeader} يملك المؤشر العام الأعلى للضغط بإجمالي ${ar(totalPressure)}، مع رتم ${pressure.rhythm} وخطورة ${pressure.danger}.`,
    scoreArticleLine(match, snapshot),
    [possession, attacks, dangerous, shots].filter(Boolean).join(' '),
    eventBalanceLine(events, match),
    momentumLine,
    latestEventLine(events, match),
  ].filter((line) => line && line.trim());
}

export function dataQuality(snapshot: Snapshot, events: MatchEvent[], updatedAt?: string): DataQuality {
  const availableStats = DATA_QUALITY_STAT_KEYS.filter((key) => n(snapshot, key) !== null).length;
  const eventsScore = Math.min(events.length, 20) / 20;
  const statsScore = availableStats / DATA_QUALITY_STAT_KEYS.length;
  const freshnessScore = updatedAt ? 1 : 0;
  const score = Math.round((statsScore * 65) + (eventsScore * 25) + (freshnessScore * 10));
  const label = score >= 75 ? 'قوية' : score >= 45 ? 'متوسطة' : 'محدودة';
  const hint = label === 'قوية'
    ? 'القراءة مدعومة بإحصائيات وأحداث كافية.'
    : label === 'متوسطة'
      ? 'القراءة جيدة لكنها قد تتحسن مع وصول أحداث أو إحصائيات أكثر.'
      : 'القراءة تقديرية جدًا بسبب نقص الإحصائيات أو الأحداث.';
  return {
    score,
    label,
    hint,
    availableStats,
    totalStats: DATA_QUALITY_STAT_KEYS.length,
    eventsCount: events.length,
    lastUpdated: formatUpdatedAt(updatedAt),
  };
}
