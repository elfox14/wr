export type MatchStatusKind = 'scheduled' | 'live' | 'halftime' | 'finished' | 'delayed';

export type MatchTeamLite = {
  id: string;
  name: string;
  code?: string | null;
  image?: string | null;
  coach?: string | null;
  fifaRank?: number | null;
  group?: string | null;
};

export type MatchPlayerLite = {
  id: string;
  name: string;
  code?: string | null;
  image?: string | null;
  position?: string | null;
  teamId?: string | null;
};

export type MatchScore = {
  home: number | null;
  away: number | null;
  source: string;
};

export type MatchStatusView = {
  raw: string;
  kind: MatchStatusKind;
  label: string;
  shortLabel: string;
  minute: number | null;
  isLive: boolean;
  isFinished: boolean;
  isScheduled: boolean;
};

export type MatchSourceView = {
  key: string;
  name: string;
  status: 'active' | 'fallback' | 'missing';
  priority: number;
  lastCheckedAt?: string | null;
  details?: string | null;
};

export type MatchStatMetric = {
  key: string;
  label: string;
  home: number | null;
  away: number | null;
  suffix?: string;
  source: string;
  available: boolean;
};

export type MatchEventView = {
  id: string;
  minute: number | null;
  minuteLabel: string;
  type: string;
  icon: string;
  teamId?: string | null;
  playerName?: string | null;
  detail: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

export type StandingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  code?: string | null;
  image?: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  qualifies?: boolean;
};

export type RelatedArticle = {
  id: string;
  title: string;
  summary: string;
  href: string;
  label: string;
};

export type SourceChecklistItem = {
  label: string;
  status: 'ready' | 'missing' | 'optional';
  note: string;
};

export type MatchPageData = {
  id: string;
  title: string;
  matchDate: string;
  venue: string | null;
  competition: string;
  groupLabel: string | null;
  stageLabel: string;
  homeTeam: MatchTeamLite;
  awayTeam: MatchTeamLite;
  score: MatchScore;
  status: MatchStatusView;
  stats: MatchStatMetric[];
  events: MatchEventView[];
  homePlayers: MatchPlayerLite[];
  awayPlayers: MatchPlayerLite[];
  groupStandings: StandingRow[];
  thirdPlaceTable: StandingRow[];
  tacticalKeys: string[];
  matchImpact: string[];
  digest: {
    summary?: string | null;
    turningPoint?: string | null;
    scoreLine?: string | null;
    href?: string | null;
  } | null;
  relatedArticles: RelatedArticle[];
  sources: MatchSourceView[];
  sourceChecklist: SourceChecklistItem[];
  lastUpdatedAt: string;
};
