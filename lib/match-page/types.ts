export type MatchStatusKind = 'scheduled' | 'live' | 'halftime' | 'finished' | 'delayed';

export type MatchTeamLite = { id: string; name: string; code?: string | null; image?: string | null; coach?: string | null; fifaRank?: number | null; group?: string | null; participations?: number | null; worldCupLegacy?: number | null; };
export type MatchPlayerLite = { id: string; name: string; code?: string | null; image?: string | null; position?: string | null; teamId?: string | null; number?: string | number | null; };
export type OfficialLineupPlayer = { id?: string | null; name: string; number?: string | number | null; image?: string | null; position?: string | null; rating?: number | null; isCaptain?: boolean | null; };
export type OfficialLineupTeam = { teamName?: string | null; formation?: string | null; startingXi: OfficialLineupPlayer[]; substitutes: OfficialLineupPlayer[]; };
export type OfficialLineupView = { confirmed: boolean; source: string; home: OfficialLineupTeam | null; away: OfficialLineupTeam | null; } | null;
export type MatchScore = { home: number | null; away: number | null; source: string; };
export type MatchStatusView = { raw: string; kind: MatchStatusKind; label: string; shortLabel: string; minute: number | null; isLive: boolean; isFinished: boolean; isScheduled: boolean; };
export type MatchSourceView = { key: string; name: string; status: 'active' | 'fallback' | 'missing'; priority: number; lastCheckedAt?: string | null; details?: string | null; };
export type MatchStatMetric = { key: string; label: string; home: number | null; away: number | null; suffix?: string; source: string; available: boolean; };

export type MatchShotMapItem = {
  id?: string | null; minute?: number | null; playerName?: string | null; teamName?: string | null; teamId?: string | null; x?: number | null; y?: number | null; xg?: number | null; npxg?: number | null; outcome?: string | null; situation?: string | null; bodyPart?: string | null; isGoal?: boolean | null; isOnTarget?: boolean | null; isBlocked?: boolean | null; isPenalty?: boolean | null;
};

export type MatchEventView = { id: string; minute: number | null; extraTime?: number | null; minuteLabel: string; type: string; icon: string; teamId?: string | null; playerName?: string | null; detail: string; sourceName?: string | null; sourceUrl?: string | null; x?: number | null; y?: number | null; shot?: MatchShotMapItem | null; playerImage?: string | null; playerNumber?: string | number | null; };

export type MatchPlayerStatItem = {
  playerId?: string | null; playerName?: string | null; teamId?: string | null; teamName?: string | null; position?: string | null; rating?: number | null; started?: boolean | null; played?: boolean | null; minutes?: number | null;
  image?: string | null; number?: string | number | null; isCaptain?: boolean | null;
  goals?: number | null; assists?: number | null; shots?: number | null; shotsOnTarget?: number | null; shotsOffTarget?: number | null; blockedShots?: number | null; bigChancesCreated?: number | null; expectedGoals?: number | null; expectedAssists?: number | null; npExpectedGoals?: number | null;
  passes?: number | null; accuratePasses?: number | null; keyPasses?: number | null; crosses?: number | null; accurateCrosses?: number | null; longBalls?: number | null; accurateLongBalls?: number | null;
  tackles?: number | null; interceptions?: number | null; clearances?: number | null; saves?: number | null;
  duelWon?: number | null; duelLost?: number | null; aerialWon?: number | null; challengeLost?: number | null; wonContest?: number | null; dispossessed?: number | null;
  touches?: number | null; foulsCommitted?: number | null; foulsWon?: number | null; offsides?: number | null; yellowCards?: number | null; redCards?: number | null; possessionLost?: number | null; playerSubbedOn?: string | null; playerSubbedOff?: string | null;
};

export type HeatmapPoint = { x: number; y: number; count?: number; };
export type PlayerHeatmap = { playerId: string; playerName?: string; teamId?: string; side?: 'home' | 'away'; points: HeatmapPoint[]; };
export type TeamHeatmapData = { teamId: string; points: HeatmapPoint[]; };
export type MatchMomentumPoint = { minute: number; home: number; away: number; source: 'PROVIDER' | 'DERIVED_FROM_VERIFIED_SHOTS'; sampleSize: number; };

export type MatchAdvancedData = {
  venue?: string | null; city?: string | null; referee?: string | null; finalScore?: { home: number | null; away: number | null } | null; xg?: { home: number | null; away: number | null } | null; npxg?: { home: number | null; away: number | null } | null; events: MatchEventView[]; shotmap: MatchShotMapItem[]; playerStats: MatchPlayerStatItem[]; playerHeatmaps?: PlayerHeatmap[]; teamHeatmaps?: { home?: TeamHeatmapData; away?: TeamHeatmapData }; momentum?: MatchMomentumPoint[];
};

export type StandingRow = { rank: number; teamId: string; teamName: string; code?: string | null; image?: string | null; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; qualifies?: boolean; };
export type RelatedArticle = { id: string; title: string; summary: string; href: string; label: string; };
export type MatchPostMatchContent = {
  article: { id: string; title: string; excerpt: string; slug: string; publishedAt: string | null } | null;
  infographic: { href: string; approvedAt: string; sourceSnapshotId: string } | null;
};
export type SourceChecklistItem = { label: string; status: 'ready' | 'missing' | 'optional'; note: string; };
export type MatchFormItem = { id: string; date: string; opponentName: string; opponentCode?: string | null; homeAway: 'home' | 'away'; teamScore: number | null; opponentScore: number | null; result: 'W' | 'D' | 'L' | 'N'; status: string; stage?: string | null; };
export type HeadToHeadItem = { id: string; date: string; homeTeamName: string; awayTeamName: string; homeScore: number | null; awayScore: number | null; status: string; stage?: string | null; };
export type MatchHistoryContext = { homeRecentForm: MatchFormItem[]; awayRecentForm: MatchFormItem[]; headToHead: HeadToHeadItem[]; homeWorldCupHistory?: string | null; awayWorldCupHistory?: string | null; };

export type MatchPageData = {
  id: string; title: string; matchDate: string; venue: string | null; city?: string | null; referee?: string | null; competition: string; groupLabel: string | null; stageLabel: string; homeTeam: MatchTeamLite; awayTeam: MatchTeamLite; score: MatchScore; status: MatchStatusView; stats: MatchStatMetric[]; events: MatchEventView[]; homePlayers: MatchPlayerLite[]; awayPlayers: MatchPlayerLite[]; officialLineup: OfficialLineupView; advanced: MatchAdvancedData; voteEndpoint: string; groupStandings: StandingRow[]; thirdPlaceTable: StandingRow[]; tacticalKeys: string[]; matchImpact: string[]; digest: { summary?: string | null; turningPoint?: string | null; scoreLine?: string | null; href?: string | null; } | null; relatedArticles: RelatedArticle[]; postMatchContent: MatchPostMatchContent; sources: MatchSourceView[]; sourceChecklist: SourceChecklistItem[]; lastUpdatedAt: string; history?: MatchHistoryContext;
};
