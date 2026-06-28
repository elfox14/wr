export type MatchAnalysisArticleType = 'match_analysis';

export type MatchAnalysisStatus =
  | 'draft'
  | 'final_verified'
  | 'published'
  | 'DRAFT_READY'
  | 'PUBLISHED'
  | 'REVIEW_REQUIRED'
  | 'ARCHIVED';

export type MatchAnalysisEventType =
  | 'goal'
  | 'chance'
  | 'save'
  | 'card'
  | 'substitution'
  | 'other';

export type NullableNumber = number | null;

export type TeamPair<T> = {
  home: T;
  away: T;
};

export type MatchAnalysisTeam = {
  id?: string | null;
  name: string;
  code?: string | null;
};

export type MatchAnalysisMetadata = {
  slug: string;
  title: string;
  seoTitle: string;
  seoScore: number | null;
  summaryLine: string;
  stageLabel: string;
  dataSource: 'Final DB Snapshot';
  lastUpdatedUtc: string;
  canonicalUrl?: string | null;
  heroImageUrl?: string | null;
};

export type MatchAnalysisMatch = {
  id: string;
  homeTeam: MatchAnalysisTeam;
  awayTeam: MatchAnalysisTeam;
  competition: string;
  matchDate: string;
  groupName: string | null;
  stage: string | null;
  score: TeamPair<NullableNumber>;
  resultLabel: string;
  matchCenterUrl: string;
};

export type MatchAnalysisStats = {
  possession?: TeamPair<NullableNumber>;
  shots?: TeamPair<NullableNumber>;
  shotsOnTarget?: TeamPair<NullableNumber>;
  passes?: TeamPair<NullableNumber>;
  passAccuracy?: TeamPair<NullableNumber>;
  corners?: TeamPair<NullableNumber>;
  fouls?: TeamPair<NullableNumber>;
  yellowCards?: TeamPair<NullableNumber>;
  redCards?: TeamPair<NullableNumber>;
  attacks?: TeamPair<NullableNumber>;
  dangerousAttacks?: TeamPair<NullableNumber>;
};

export type MatchAnalysisMoment = {
  minute: number | null;
  team: string | null;
  eventType: MatchAnalysisEventType;
  impact: string;
};

export type MatchAnalysisGroupImpact = {
  summary: string;
  homeTeamEffect: string;
  awayTeamEffect: string;
};

export type MatchAnalysisGeneratedSections = {
  matchSummary: string;
  tacticalReading: string;
  statsAnalysis: string;
  turningPoints: string;
  groupImpactAnalysis: string;
  twitterThreadTitle: string;
  twitterThread: string[];
  rawSections?: unknown;
};

export type MatchAnalysisAssets = {
  infographicUrl: string | null;
  matchCenterUrl: string;
};

export type MatchAnalysisDisclaimers = {
  articleIntegrityNote: string;
  fantasyNote: string;
};

export type MatchAnalysisApiResponse = {
  templateVersion: '1.0';
  articleType: MatchAnalysisArticleType;
  status: MatchAnalysisStatus;
  metadata: MatchAnalysisMetadata;
  match: MatchAnalysisMatch;
  stats: MatchAnalysisStats;
  keyMoments: MatchAnalysisMoment[];
  groupImpact: MatchAnalysisGroupImpact;
  generatedSections: MatchAnalysisGeneratedSections;
  assets: MatchAnalysisAssets;
  disclaimers: MatchAnalysisDisclaimers;
};

export type MatchAnalysisPromptInput = {
  title: string;
  summaryLine: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  matchDate: string;
  groupName?: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  possessionHome?: number | null;
  possessionAway?: number | null;
  shotsHome?: number | null;
  shotsAway?: number | null;
  shotsOnTargetHome?: number | null;
  shotsOnTargetAway?: number | null;
  passesHome?: number | null;
  passesAway?: number | null;
  passAccuracyHome?: number | null;
  passAccuracyAway?: number | null;
  cornersHome?: number | null;
  cornersAway?: number | null;
  foulsHome?: number | null;
  foulsAway?: number | null;
  keyMoments?: MatchAnalysisMoment[];
  groupImpactHome?: string | null;
  groupImpactAway?: string | null;
  infographicUrl?: string | null;
  matchCenterUrl?: string | null;
  lastUpdatedUtc: string;
};
