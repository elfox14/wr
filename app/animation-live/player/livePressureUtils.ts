import type { MatchEvent, PressureModel, PressureWindow, Team, Snapshot } from './types';
import { eventMinute, eventSide } from './eventUtils';
import { n } from './matchAnalysisUtils';
import { pressureEventWeight } from './momentumUtils';
import { pressureLeader, sideName } from './pressureUtils';

export function pressureWindow(events: MatchEvent[], currentMinute: number | null, span: number, home: Team, away: Team): PressureWindow {
  const eventMinutes = events.map(eventMinute).filter((value): value is number => value !== null);
  const anchor = currentMinute ?? (eventMinutes.length ? Math.max(...eventMinutes) : null);

  if (anchor === null) {
    return {
      available: false,
      home: 0,
      away: 0,
      homeEvents: 0,
      awayEvents: 0,
      leader: 'unknown',
    };
  }

  const initial: PressureWindow = {
    available: false,
    home: 0,
    away: 0,
    homeEvents: 0,
    awayEvents: 0,
    leader: 'unknown',
  };

  return events.reduce<PressureWindow>((acc, event) => {
    const minuteValue = eventMinute(event);
    if (minuteValue === null || minuteValue < anchor - span || minuteValue > anchor) return acc;

    const side = eventSide(event, home, away);
    const weight = pressureEventWeight(event.type);

    if (side === 'home') {
      acc.home += weight;
      acc.homeEvents += 1;
    }

    if (side === 'away') {
      acc.away += weight;
      acc.awayEvents += 1;
    }

    acc.available = true;
    acc.leader = pressureLeader(acc.home, acc.away);
    return acc;
  }, initial);
}

export function liveReadout(
  leader: PressureModel['leader'],
  rhythm: string,
  danger: string,
  window5: PressureWindow,
  window15: PressureWindow,
  homeTeam: Team,
  awayTeam: Team,
) {
  const leaderName = sideName(leader, homeTeam, awayTeam);

  if (leader === 'unknown') {
    return 'لا توجد أحداث كافية لاستخراج قراءة مباشرة موثوقة.';
  }

  if (window5.available && (window5.home + window5.away) >= 12) {
    return `${sideName(window5.leader, homeTeam, awayTeam)} يملك الزخم الأقرب في آخر ٥ دقائق، والرتم الحالي ${rhythm}.`;
  }

  if (window15.available && (window15.home + window15.away) >= 14) {
    return `${sideName(window15.leader, homeTeam, awayTeam)} أكثر نشاطًا في آخر ١٥ دقيقة، والخطورة اللحظية ${danger}.`;
  }

  if (leader === 'balanced') {
    return `المؤشر العام متوازن، والرتم اللحظي ${rhythm} بدون أفضلية ضغط واضحة.`;
  }

  return `${leaderName} يتفوق في مؤشر الضغط العام، لكن الرتم اللحظي ${rhythm} والخطورة ${danger}.`;
}

export function calculatePressureModel(snapshot: Snapshot, events: MatchEvent[], currentMinute: number | null, homeTeam: Team, awayTeam: Team): PressureModel {
  const homeBase = (n(snapshot, 'homeAttacks') ?? 0)
    + ((n(snapshot, 'homeDangerousAttacks') ?? 0) * 3)
    + ((n(snapshot, 'homeShots') ?? 0) * 4)
    + ((n(snapshot, 'homeShotsOnTarget') ?? 0) * 6)
    + ((n(snapshot, 'homeCorners') ?? 0) * 2);

  const awayBase = (n(snapshot, 'awayAttacks') ?? 0)
    + ((n(snapshot, 'awayDangerousAttacks') ?? 0) * 3)
    + ((n(snapshot, 'awayShots') ?? 0) * 4)
    + ((n(snapshot, 'awayShotsOnTarget') ?? 0) * 6)
    + ((n(snapshot, 'awayCorners') ?? 0) * 2);

  const window5 = pressureWindow(events, currentMinute, 5, homeTeam, awayTeam);
  const window15 = pressureWindow(events, currentMinute, 15, homeTeam, awayTeam);

  const homePressure = homeBase + (window15.home * 2) + (window5.home * 2);
  const awayPressure = awayBase + (window15.away * 2) + (window5.away * 2);
  const leader = pressureLeader(homePressure, awayPressure);

  const hasRecentEvents = window5.available || window15.available;
  const recentIntensity = hasRecentEvents
    ? ((window5.home + window5.away) * 2) + (window15.home + window15.away)
    : ((homeBase + awayBase) / Math.max(1, currentMinute ?? 90)) * 15;

  const rhythm = recentIntensity >= 35 ? 'عالي' : recentIntensity >= 14 ? 'متوسط' : 'هادئ';
  const danger = recentIntensity >= 35 ? 'مرتفعة' : recentIntensity >= 14 ? 'متوسطة' : 'منخفضة';
  const readout = liveReadout(leader, rhythm, danger, window5, window15, homeTeam, awayTeam);

  return {
    home: Math.round(homePressure),
    away: Math.round(awayPressure),
    leader,
    rhythm,
    danger,
    readout,
    window5,
    window15,
  };
}

export function windowLabel(window: PressureWindow) {
  if (!window.available) return 'غير متوفر';
  return `${window.home.toLocaleString('ar-EG')} - ${window.away.toLocaleString('ar-EG')}`;
}
