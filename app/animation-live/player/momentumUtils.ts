import type { MatchEvent, MomentumAccum, MomentumDefinition, MomentumSegment, Team } from './types';
import { eventCategory, eventMinute, eventSide, sortEventsByMinute } from './eventUtils';
import { pressureLeader } from './pressureUtils';

export const MOMENTUM_SEGMENTS: MomentumDefinition[] = [
  { key: 'm0_15', label: '0–15', start: 0, end: 15 },
  { key: 'm15_30', label: '15–30', start: 15, end: 30 },
  { key: 'm30_ht', label: '30–HT', start: 30, end: 45 },
  { key: 'm45_60', label: '45–60', start: 45, end: 60 },
  { key: 'm60_75', label: '60–75', start: 60, end: 75 },
  { key: 'm75_90', label: '75–90+', start: 75, end: 130 },
];

export function pressureEventWeight(type: string) {
  const category = eventCategory(type);
  if (category === 'goals') return 10;
  if (category === 'danger') return 6;
  if (category === 'shots') return 4;
  if (category === 'corners') return 3;
  if (category === 'cards') return 1;
  return 1;
}

export function momentumRating(total: number) {
  if (total >= 18) return 'ضغط عالي';
  if (total >= 8) return 'ضغط متوسط';
  if (total > 0) return 'ضغط منخفض';
  return 'غير متوفر';
}

export function calculateMomentumSegments(events: MatchEvent[], homeTeam: Team, awayTeam: Team): MomentumSegment[] {
  return MOMENTUM_SEGMENTS.map((segment) => {
    const segmentEvents = events
      .filter((event) => {
        const minuteValue = eventMinute(event);
        if (minuteValue === null) return false;
        return minuteValue >= segment.start && minuteValue < segment.end;
      })
      .sort(sortEventsByMinute);

    const initial: MomentumAccum = {
      home: 0,
      away: 0,
      homeEvents: 0,
      awayEvents: 0,
      homeDangerEvents: 0,
      awayDangerEvents: 0,
      topEvent: null,
    };

    const result = segmentEvents.reduce<MomentumAccum>((acc, event) => {
      const side = eventSide(event, homeTeam, awayTeam);
      const weight = pressureEventWeight(event.type);
      if (side === 'home') {
        acc.home += weight;
        acc.homeEvents += 1;
        if (eventCategory(event.type) === 'danger') acc.homeDangerEvents += 1;
      }
      if (side === 'away') {
        acc.away += weight;
        acc.awayEvents += 1;
        if (eventCategory(event.type) === 'danger') acc.awayDangerEvents += 1;
      }
      if (!acc.topEvent || pressureEventWeight(event.type) > pressureEventWeight(acc.topEvent.type)) {
        acc.topEvent = event;
      }
      return acc;
    }, initial);

    const total = result.home + result.away;
    return {
      ...segment,
      ...result,
      available: segmentEvents.length > 0,
      leader: pressureLeader(result.home, result.away),
      rating: momentumRating(total),
    };
  });
}

export function strongestMomentumSegment(segments: MomentumSegment[]) {
  return segments
    .filter((segment) => segment.available)
    .sort((a, b) => ((b.home + b.away) - (a.home + a.away)) || ((b.homeEvents + b.awayEvents) - (a.homeEvents + a.awayEvents)))[0] || null;
}
