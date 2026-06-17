import type { DataQuality, LiveStatsResponse, MatchEvent, MomentumSegment, Snapshot } from './types';
import { ar, formatUpdatedAt } from './formatters';
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
