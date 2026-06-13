export type TeamPlayer = {
  id: string;
  name: string;
  image?: string | null;
  position?: string | null;
  age?: number | null;
  score?: number | null;
  marketPrice?: number | null;
  current_price?: number | null;
  lastPerformanceRating?: number | null;
};

export type TeamOpponent = {
  id: string;
  name: string;
  image?: string | null;
  code?: string | null;
  group?: string | null;
};

export type TeamMatch = {
  id: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: TeamOpponent | null;
  awayTeam?: TeamOpponent | null;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  stage?: string | null;
  groupPhase?: string | null;
  matchDate: Date | string;
};

export type TeamReport = {
  id: string;
  title: string;
  summary: string;
  body?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  sourceCategory?: string | null;
  provider?: string | null;
  confidence?: string | null;
  publishedAt?: Date | string | null;
  tacticalTags?: string[] | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  metrics?: unknown;
};

export type TeamNewsItem = {
  id?: string | null;
  title?: string | null;
  titleAr?: string | null;
  summary?: string | null;
  bodyAr?: string | null;
  publishedAt?: Date | string | null;
};

export type TeamAsset = {
  id: string;
  type: string;
  name: string;
  code?: string | null;
  image?: string | null;
  fifaRank?: number | null;
  group?: string | null;
  continent?: string | null;
  current_price?: number | null;
  marketPrice?: number | null;
  fairValue?: number | null;
  change?: number | null;
  score?: number | null;
  players?: TeamPlayer[] | null;
  intelligenceReports?: TeamReport[] | null;
  homeMatches?: TeamMatch[] | null;
  awayMatches?: TeamMatch[] | null;
  marketNews?: TeamNewsItem[] | null;
  groupTeams?: TeamAsset[] | null;
};

export type TeamPerformanceStats = {
  sampleSize: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
};

export type FbrefMetrics = {
  source?: string | null;
  extractionMethod?: string | null;
  exportedAt?: string | null;
  pageUrl?: string | null;
  tableCount?: number | null;
  tableAvailability?: Record<string, boolean> | null;
  standing?: {
    group?: string | null;
    rank?: string | null;
    mp?: number | null;
    wins?: number | null;
    draws?: number | null;
    losses?: number | null;
    gf?: number | null;
    ga?: number | null;
    gd?: string | null;
    pts?: number | null;
    last5?: string | null;
  } | null;
  league?: {
    rank?: string | null;
    mp?: number | null;
    wins?: number | null;
    draws?: number | null;
    losses?: number | null;
    gf?: number | null;
    ga?: number | null;
    gd?: string | null;
    pts?: number | null;
    topTeamScorer?: string | null;
    goalkeeper?: string | null;
  } | null;
  roster?: {
    count?: number | null;
    averageAge?: number | null;
    topClubs?: string[] | null;
    playerNames?: string[] | null;
  } | null;
  standard?: {
    usedPlayers?: number | null;
    scorers?: string[] | null;
    assisters?: string[] | null;
    minutesLeaders?: string[] | null;
  } | null;
  shooting?: {
    goals?: number | null;
    shots?: number | null;
    shotsOnTarget?: number | null;
    shotAccuracy?: number | null;
    activeShooters?: string[] | null;
  } | null;
  goalkeeping?: {
    goalkeeper?: string | null;
    saves?: number | null;
    shotsOnTargetAgainst?: number | null;
    goalsAgainst?: number | null;
    savePercentage?: string | null;
  } | null;
  misc?: {
    yellowCards?: number | null;
    redCards?: number | null;
    fouls?: number | null;
    fouled?: number | null;
    crosses?: number | null;
    interceptions?: number | null;
    tacklesWon?: number | null;
  } | null;
  matchContext?: {
    completedCount?: number | null;
    upcomingCount?: number | null;
    latest?: Record<string, unknown> | null;
    next?: Record<string, unknown> | null;
    formations?: string[] | null;
    averagePossession?: number | null;
  } | null;
  missing?: string[] | null;
};
