export type AnimationTeamSide = 'home' | 'away' | 'unknown';
export type CoordinateSource = 'EXACT_PROVIDER' | 'INFERRED_ZONE' | 'HEURISTIC';
export type CoordinateConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type EventSide = 'HOME_ATTACK' | 'AWAY_ATTACK' | 'NEUTRAL';

export type SpatialInput = {
  id: string;
  type?: string | null;
  detail?: string | null;
  minute?: number | null;
  teamSide: AnimationTeamSide;
  index: number;
  explicitX?: number | null;
  explicitY?: number | null;
  explicitEndX?: number | null;
  explicitEndY?: number | null;
};

export type SpatialResult = {
  x: number;
  y: number;
  endX: number | null;
  endY: number | null;
  zone: string;
  coordinateSource: CoordinateSource;
  coordinateConfidence: CoordinateConfidence;
  eventSide: EventSide;
  isInferred: boolean;
  anchorZone: string;
  displayPriority: number;
};

export function clampPitch(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function normalizeAnimationEventType(type?: string | null, detail?: string | null) {
  const text = `${type || ''} ${detail || ''}`.toLowerCase();
  if (/goal|هدف/.test(text)) return 'goal';
  if (/yellow|صفراء|انذار|إنذار/.test(text)) return 'yellow_card';
  if (/red|حمراء|طرد/.test(text)) return 'red_card';
  if (/sub|تبديل/.test(text)) return 'substitution';
  if (/shot|تسديدة|save|blocked|on target/.test(text)) return 'shot';
  if (/corner|ركنية/.test(text)) return 'corner';
  if (/penalty|جزاء/.test(text)) return 'penalty';
  if (/var/.test(text)) return 'var';
  if (/foul|خطأ/.test(text)) return 'foul';
  if (/offside|تسلل/.test(text)) return 'offside';
  if (/kick.?off|بداية/.test(text)) return 'kickoff';
  if (/half.?time|استراحة/.test(text)) return 'half_time';
  if (/full.?time|نهاية/.test(text)) return 'full_time';
  return type || 'note';
}

export function animationEventLabel(eventType: string) {
  const key = eventType.toLowerCase();
  if (key.includes('goal')) return 'هدف';
  if (key.includes('yellow')) return 'بطاقة صفراء';
  if (key.includes('red')) return 'بطاقة حمراء';
  if (key.includes('sub')) return 'تبديل';
  if (key.includes('shot')) return 'تسديدة';
  if (key.includes('corner')) return 'ركنية';
  if (key.includes('penalty')) return 'ركلة جزاء';
  if (key.includes('var')) return 'VAR';
  if (key.includes('foul')) return 'خطأ';
  if (key.includes('offside')) return 'تسلل';
  if (key.includes('kickoff')) return 'بداية اللعب';
  if (key.includes('half_time')) return 'نهاية الشوط';
  if (key.includes('full_time')) return 'نهاية المباراة';
  return 'حدث';
}

function deterministicHash(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function jitter(seed: string, amount = 10) {
  return (deterministicHash(seed) % (amount * 2 + 1)) - amount;
}

function attackingDirection(teamSide: AnimationTeamSide) {
  if (teamSide === 'home') return 'right';
  if (teamSide === 'away') return 'left';
  return 'neutral';
}

function eventSide(teamSide: AnimationTeamSide): EventSide {
  if (teamSide === 'home') return 'HOME_ATTACK';
  if (teamSide === 'away') return 'AWAY_ATTACK';
  return 'NEUTRAL';
}

function goalMouth(teamSide: AnimationTeamSide) {
  if (teamSide === 'home') return { x: 96, y: 50 };
  if (teamSide === 'away') return { x: 4, y: 50 };
  return { x: 50, y: 50 };
}

function attackingBox(teamSide: AnimationTeamSide, seed: string) {
  const direction = attackingDirection(teamSide);
  const y = clampPitch(50 + jitter(seed, 12));
  if (direction === 'right') return { x: clampPitch(82 + jitter(`${seed}:x`, 5)), y };
  if (direction === 'left') return { x: clampPitch(18 + jitter(`${seed}:x`, 5)), y };
  return { x: clampPitch(50 + jitter(`${seed}:x`, 15)), y };
}

function halfSpace(teamSide: AnimationTeamSide, seed: string) {
  const direction = attackingDirection(teamSide);
  const y = 26 + (deterministicHash(seed) % 49);
  if (direction === 'right') return { x: clampPitch(68 + jitter(`${seed}:x`, 8)), y };
  if (direction === 'left') return { x: clampPitch(32 + jitter(`${seed}:x`, 8)), y };
  return { x: clampPitch(50 + jitter(`${seed}:x`, 18)), y };
}

function midfield(teamSide: AnimationTeamSide, seed: string) {
  const y = 22 + (deterministicHash(seed) % 56);
  if (teamSide === 'home') return { x: clampPitch(40 + jitter(`${seed}:x`, 9)), y };
  if (teamSide === 'away') return { x: clampPitch(60 + jitter(`${seed}:x`, 9)), y };
  return { x: clampPitch(50 + jitter(`${seed}:x`, 10)), y };
}

function cornerPoint(teamSide: AnimationTeamSide, index: number) {
  const top = index % 2 === 0;
  if (teamSide === 'home') return { x: 94, y: top ? 7 : 93, endX: 82, endY: 50 };
  if (teamSide === 'away') return { x: 6, y: top ? 7 : 93, endX: 18, endY: 50 };
  return { x: 50, y: top ? 7 : 93, endX: 50, endY: 50 };
}

export function inferLiveAnimationSpatial(input: SpatialInput): SpatialResult {
  const eventType = normalizeAnimationEventType(input.type, input.detail);
  const seed = `${input.id}:${input.minute ?? 'na'}:${input.type || ''}:${input.detail || ''}`;

  if (input.explicitX !== null && input.explicitX !== undefined && input.explicitY !== null && input.explicitY !== undefined) {
    return {
      x: clampPitch(Number(input.explicitX)),
      y: clampPitch(Number(input.explicitY)),
      endX: input.explicitEndX === null || input.explicitEndX === undefined ? null : clampPitch(Number(input.explicitEndX)),
      endY: input.explicitEndY === null || input.explicitEndY === undefined ? null : clampPitch(Number(input.explicitEndY)),
      zone: 'exact_provider',
      coordinateSource: 'EXACT_PROVIDER',
      coordinateConfidence: 'HIGH',
      eventSide: eventSide(input.teamSide),
      isInferred: false,
      anchorZone: 'EXACT_PROVIDER',
      displayPriority: eventType === 'goal' ? 100 : eventType === 'shot' ? 85 : 70,
    };
  }

  if (eventType === 'goal') {
    const start = attackingBox(input.teamSide, seed);
    const end = goalMouth(input.teamSide);
    return {
      ...start,
      endX: end.x,
      endY: end.y,
      zone: 'penalty_box',
      coordinateSource: 'INFERRED_ZONE',
      coordinateConfidence: 'MEDIUM',
      eventSide: eventSide(input.teamSide),
      isInferred: true,
      anchorZone: 'CENTER_BOX',
      displayPriority: 100,
    };
  }

  if (eventType === 'shot') {
    const start = halfSpace(input.teamSide, seed);
    const end = goalMouth(input.teamSide);
    return {
      ...start,
      endX: end.x,
      endY: end.y,
      zone: 'attacking_third',
      coordinateSource: 'INFERRED_ZONE',
      coordinateConfidence: 'MEDIUM',
      eventSide: eventSide(input.teamSide),
      isInferred: true,
      anchorZone: 'HALF_SPACE',
      displayPriority: 85,
    };
  }

  if (eventType === 'penalty') {
    const x = input.teamSide === 'home' ? 88 : input.teamSide === 'away' ? 12 : 50;
    const end = goalMouth(input.teamSide);
    return {
      x,
      y: 50,
      endX: end.x,
      endY: end.y,
      zone: 'penalty_spot',
      coordinateSource: 'INFERRED_ZONE',
      coordinateConfidence: 'MEDIUM',
      eventSide: eventSide(input.teamSide),
      isInferred: true,
      anchorZone: 'PENALTY_SPOT',
      displayPriority: 95,
    };
  }

  if (eventType === 'corner') {
    const point = cornerPoint(input.teamSide, input.index);
    return {
      x: point.x,
      y: point.y,
      endX: point.endX,
      endY: point.endY,
      zone: 'corner',
      coordinateSource: 'INFERRED_ZONE',
      coordinateConfidence: 'MEDIUM',
      eventSide: eventSide(input.teamSide),
      isInferred: true,
      anchorZone: point.y < 50 ? 'TOP_CORNER' : 'BOTTOM_CORNER',
      displayPriority: 70,
    };
  }

  if (eventType === 'substitution') {
    return {
      x: 50,
      y: input.teamSide === 'home' ? 94 : input.teamSide === 'away' ? 6 : 50,
      endX: null,
      endY: null,
      zone: 'touchline',
      coordinateSource: 'INFERRED_ZONE',
      coordinateConfidence: 'MEDIUM',
      eventSide: 'NEUTRAL',
      isInferred: true,
      anchorZone: 'TOUCHLINE_CENTER',
      displayPriority: 60,
    };
  }

  if (eventType === 'yellow_card' || eventType === 'red_card' || eventType === 'foul') {
    const point = midfield(input.teamSide, seed);
    return {
      ...point,
      endX: null,
      endY: null,
      zone: 'middle_third',
      coordinateSource: 'HEURISTIC',
      coordinateConfidence: 'LOW',
      eventSide: eventSide(input.teamSide),
      isInferred: true,
      anchorZone: 'MIDFIELD_PRESSURE_ZONE',
      displayPriority: eventType === 'red_card' ? 90 : 65,
    };
  }

  if (eventType === 'offside') {
    const point = halfSpace(input.teamSide, seed);
    return {
      ...point,
      endX: null,
      endY: null,
      zone: 'offside_line',
      coordinateSource: 'INFERRED_ZONE',
      coordinateConfidence: 'MEDIUM',
      eventSide: eventSide(input.teamSide),
      isInferred: true,
      anchorZone: 'DEFENSIVE_LINE',
      displayPriority: 58,
    };
  }

  if (eventType === 'kickoff' || eventType === 'half_time' || eventType === 'full_time') {
    return {
      x: 50,
      y: 50,
      endX: null,
      endY: null,
      zone: 'center_circle',
      coordinateSource: 'INFERRED_ZONE',
      coordinateConfidence: 'MEDIUM',
      eventSide: 'NEUTRAL',
      isInferred: true,
      anchorZone: 'CENTER_CIRCLE',
      displayPriority: 75,
    };
  }

  const point = midfield(input.teamSide, seed);
  return {
    ...point,
    endX: null,
    endY: null,
    zone: 'general',
    coordinateSource: 'HEURISTIC',
    coordinateConfidence: 'LOW',
    eventSide: eventSide(input.teamSide),
    isInferred: true,
    anchorZone: 'GENERAL_PLAY_ZONE',
    displayPriority: 50,
  };
}
