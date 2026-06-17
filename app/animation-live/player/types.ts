export type Team = { id?: string; name?: string; code?: string; image?: string } | null;

export type Snapshot = Record<string, unknown> | null;

export type EventSide = 'home' | 'away' | 'neutral';
export type PressureSide = 'home' | 'away' | 'balanced' | 'unknown';
export type EventFilterKey = 'all' | 'goals' | 'corners' | 'shots' | 'cards' | 'danger';
export type EventCategory = Exclude<EventFilterKey, 'all'> | 'other';

export type MatchEvent = {
  id: string;
  minute?: number | null;
  type: string;
  detail: string;
  playerName?: string | null;
  sourceName?: string | null;
  createdAt?: string | null;
};

export type LiveStatsResponse = {
  ok: boolean;
  updatedAt?: string;
  hasStats?: boolean;
  sourceStatus?: { primary?: string; statsProvider?: string; mode?: string };
  match?: {
    id: string;
    animationMatchId?: number;
    status: string;
    matchDate?: string | null;
    homeScore: number;
    awayScore: number;
    homeTeam: Team;
    awayTeam: Team;
  };
  latest?: Snapshot;
  history?: Snapshot[];
  error?: string;
};

export type LiveEventsResponse = {
  ok: boolean;
  updatedAt?: string;
  events?: MatchEvent[];
  error?: string;
};

export type PressureWindow = {
  available: boolean;
  home: number;
  away: number;
  homeEvents: number;
  awayEvents: number;
  leader: PressureSide;
};

export type PressureModel = {
  home: number;
  away: number;
  leader: PressureSide;
  rhythm: string;
  danger: string;
  readout: string;
  window5: PressureWindow;
  window15: PressureWindow;
};

export type MomentumDefinition = {
  key: string;
  label: string;
  start: number;
  end: number;
};

export type MomentumSegment = MomentumDefinition & {
  available: boolean;
  home: number;
  away: number;
  homeEvents: number;
  awayEvents: number;
  homeDangerEvents: number;
  awayDangerEvents: number;
  leader: PressureSide;
  rating: string;
  topEvent: MatchEvent | null;
};

export type MomentumAccum = {
  home: number;
  away: number;
  homeEvents: number;
  awayEvents: number;
  homeDangerEvents: number;
  awayDangerEvents: number;
  topEvent: MatchEvent | null;
};

export type DataQuality = {
  score: number;
  label: string;
  hint: string;
  availableStats: number;
  totalStats: number;
  eventsCount: number;
  lastUpdated: string;
};
