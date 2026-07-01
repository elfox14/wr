// ============================================================
// lib/analytics/match-analytics.types.ts
// Core types for the match insights analytics engine
// ============================================================

export type TeamSide = 'home' | 'away' | 'neutral';

export interface MomentumPoint {
  minute: number;
  home: number;
  away: number;
}

export interface MatchEvent {
  minute: number;
  team: 'home' | 'away';
  type: 'goal' | 'yellow' | 'red' | 'substitution';
  label: string;
}

export interface XgFlowPoint {
  minute: number;
  homeXg: number;
  awayXg: number;
  label?: string;
}

export interface ShotPoint {
  id: string;
  minute: number;
  team: 'home' | 'away';
  x: number;
  y: number;
  xg: number;
  outcome: 'goal' | 'onTarget' | 'offTarget' | 'blocked';
  insideBox: boolean;
  player?: string;
}

export interface ComparisonStat {
  key: string;
  label: string;
  home: number;
  away: number;
  suffix?: string;
  decimals?: number;
}

export interface NarrativeChip {
  id: string;
  label: string;
  minute?: number;
  tone?: 'info' | 'positive' | 'warning';
  description: string;
}

export interface MatchNarrativeSummary {
  title: string;
  subtitle: string;
  chips: NarrativeChip[];
}

export interface RankedMoment {
  minute: number;
  score: number;
  title: string;
  description: string;
  type: 'turning-point' | 'pressure' | 'goal' | 'chance' | 'late-drama';
  team: TeamSide;
}

export interface NarrativeSummary {
  minute: number;
  nearestEventLabel: string | null;
  nearbyShotsCount: number;
  nearbyEventsCount: number;
  homeXg: number;
  awayXg: number;
  nearbyEvents: MatchEvent[];
  narrative: string;
}

export interface FairnessInsight {
  label: string;
  text: string;
  tone: 'positive' | 'info' | 'warning';
}

export interface MatchInsightsInput {
  stats: ComparisonStat[];
  momentum: MomentumPoint[];
  xgFlow: XgFlowPoint[];
  shots: ShotPoint[];
  events: MatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
}

export interface MatchInsightsOutput {
  summary: MatchNarrativeSummary;
  topMoments: RankedMoment[];
  fairness: FairnessInsight | null;
  getMinuteContext: (minute: number | null) => NarrativeSummary | null;
}

export type SelectedRange = {
  centerMinute: number | null;
  startMinute: number | null;
  endMinute: number | null;
  source: 'top-moments' | 'momentum' | 'timeline' | null;
};
