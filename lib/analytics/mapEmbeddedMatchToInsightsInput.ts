// ============================================================
// lib/analytics/mapEmbeddedMatchToInsightsInput.ts
// Maps raw embedded match data (from Flight payload / API)
// to the MatchInsightsInput shape consumed by match-insights.ts
// ============================================================

import type {
  MatchInsightsInput,
  ComparisonStat,
  MomentumPoint,
  XgFlowPoint,
  ShotPoint,
  MatchEvent,
} from './match-analytics.types';

// ─── raw embedded types ──────────────────────────────────────
// These represent the shape of data that comes from the
// embedded Flight payload or a match API response.

export interface RawEmbeddedStat {
  name: string;
  home: number | string;
  away: number | string;
}

export interface RawEmbeddedMomentumPoint {
  minute: number;
  home: number;
  away: number;
}

export interface RawEmbeddedXgPoint {
  minute: number;
  home_xg: number;
  away_xg: number;
  label?: string;
}

export interface RawEmbeddedShot {
  id?: string;
  minute: number;
  team: 'home' | 'away' | string;
  x: number;
  y: number;
  xg?: number;
  result: 'Goal' | 'SavedShot' | 'MissedShots' | 'BlockedShot' | string;
  is_inside_box?: boolean;
  player_name?: string;
}

export interface RawEmbeddedEvent {
  minute: number;
  team: 'home' | 'away' | string;
  type: 'goal' | 'yellowcard' | 'redcard' | 'substitution' | string;
  player?: string;
  assist?: string;
}

export interface RawEmbeddedMatchData {
  home_team: string;
  away_team: string;
  stats?: RawEmbeddedStat[];
  momentum?: RawEmbeddedMomentumPoint[];
  xg_flow?: RawEmbeddedXgPoint[];
  shots?: RawEmbeddedShot[];
  events?: RawEmbeddedEvent[];
}

// ─── stat key normalisation ──────────────────────────────────

const STAT_KEY_MAP: Record<string, string> = {
  'Ball Possession': 'possession',
  Possession: 'possession',
  'Total Shots': 'shots',
  Shots: 'shots',
  'Shots on Target': 'shotsOnTarget',
  'Shots on Goal': 'shotsOnTarget',
  Corners: 'corners',
  Fouls: 'fouls',
  'Yellow Cards': 'yellowCards',
  'Red Cards': 'redCards',
  Offsides: 'offsides',
  'Expected Goals': 'xg',
  xG: 'xg',
  'Passes Completed': 'passesCompleted',
  Passes: 'passes',
};

function normaliseStatKey(raw: string): string {
  return STAT_KEY_MAP[raw] ?? raw.toLowerCase().replace(/\s+/g, '_');
}

function parseNumber(v: number | string): number {
  if (typeof v === 'number') return v;
  // Strip percent signs, spaces, etc.
  return parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
}

// ─── shot outcome mapping ────────────────────────────────────

function mapShotOutcome(
  result: string,
): ShotPoint['outcome'] {
  switch (result) {
    case 'Goal':
      return 'goal';
    case 'SavedShot':
      return 'onTarget';
    case 'BlockedShot':
      return 'blocked';
    default:
      return 'offTarget';
  }
}

// ─── event type mapping ──────────────────────────────────────

function mapEventType(raw: string): MatchEvent['type'] {
  switch (raw.toLowerCase()) {
    case 'goal':
      return 'goal';
    case 'yellowcard':
    case 'yellow':
    case 'yellow_card':
      return 'yellow';
    case 'redcard':
    case 'red':
    case 'red_card':
      return 'red';
    default:
      return 'substitution';
  }
}

function normaliseTeam(raw: string): 'home' | 'away' {
  return raw === 'home' ? 'home' : 'away';
}

// ─── main mapper ─────────────────────────────────────────────

export function mapEmbeddedMatchToInsightsInput(
  raw: RawEmbeddedMatchData,
): MatchInsightsInput {
  // Stats
  const stats: ComparisonStat[] = (raw.stats ?? []).map((s) => ({
    key: normaliseStatKey(s.name),
    label: s.name,
    home: parseNumber(s.home),
    away: parseNumber(s.away),
    suffix: s.name.toLowerCase().includes('possession') ? '%' : undefined,
  }));

  // Momentum
  const momentum: MomentumPoint[] = (raw.momentum ?? []).map((p) => ({
    minute: p.minute,
    home: p.home,
    away: p.away,
  }));

  // xG flow — convert cumulative if needed
  const xgFlow: XgFlowPoint[] = (raw.xg_flow ?? []).map((p) => ({
    minute: p.minute,
    homeXg: p.home_xg,
    awayXg: p.away_xg,
    label: p.label,
  }));

  // Shots
  const shots: ShotPoint[] = (raw.shots ?? []).map((s, i) => ({
    id: s.id ?? `shot-${i}`,
    minute: s.minute,
    team: normaliseTeam(s.team),
    x: s.x,
    y: s.y,
    xg: s.xg ?? 0,
    outcome: mapShotOutcome(s.result),
    insideBox: s.is_inside_box ?? false,
    player: s.player_name,
  }));

  // Events
  const events: MatchEvent[] = (raw.events ?? []).map((e) => {
    const type = mapEventType(e.type);
    let label = e.player ?? 'Unknown';
    if (type === 'goal' && e.assist) label += ` (ast. ${e.assist})`;
    return {
      minute: e.minute,
      team: normaliseTeam(e.team),
      type,
      label,
    };
  });

  return {
    stats,
    momentum,
    xgFlow,
    shots,
    events,
    homeTeamName: raw.home_team,
    awayTeamName: raw.away_team,
  };
}
