export type MatchStatusKind = 'scheduled' | 'live' | 'halftime' | 'finished' | 'delayed';

export type MatchTeamLite = { id: string; name: string; code?: string | null; image?: string | null; coach?: string | null; fifaRank?: number | null; group?: string | null; };
export type MatchPlayerLite = { id: string; name: string; code?: string | null; image?: string | null; position?: string | null; teamId?: string | null; };
export type OfficialLineupPlayer = { id?: string | null; name: string; number?: string | number | null; image?: string | null; position?: string | null; rating?: number | null; isCaptain?: boolean | null; };
export type OfficialLineupTeam = { teamName?: string | null; formation?: string | null; startingXi: OfficialLineupPlayer[]; substitutes: OfficialLineupPlayer[]; };
export type OfficialLineupView = { confirmed: boolean; source: string; home: OfficialLineupTeam | null; away: OfficialLineupTeam | null; } | null;
export type MatchScore = { home: number | null; away: number | null; source: string; };
export type MatchStatusView = { raw: string; kind: MatchStatusKind; label: string; shortLabel: string; minute: number | null; isLive: boolean; isFinished: boolean; isScheduled: boolean; };
export type MatchClockView = { status: string; period: string; displayLabel: string; minute: number | null; source: string; confidence: string; lastConfirmedAt: string | null; note: string | null; };
export type MatchSourceView = { key: string; name: string; status: 'active' | 'fallback' | 'missing'; priority: number; lastCheckedAt?: string | null; details?: string | null; };
export type MatchStatMetric = { key: string; label: string; home: number | null; away: number | null; suffix?: string; source: string; available: boolean; };
export type TeamRecentMatchView = { id: string; date: string; opponentName: string; opponentImage?: string | null; side: 'home' | 'away'; score: MatchScore; result: 'win' | 'draw' | 'loss' | 'pending'; status: string; };
export type HeadToHeadMatchView = { id: string; date: string; homeName: string; awayName: string; homeImage?: string | null; awayImage?: string | null; score: MatchScore; status: string; };

export type MatchShotMapItem = {
  id?: string | null; minute?: number | null; playerName?: string | null; teamName?: string | null; teamId?: string | null; x?: number | null; y?: number | null; xg?: number | null; npxg?: number | null; outcome?: string | null; situation?: string | null; bodyPart?: string | null; isGoal?: boolean | null; isOnTarget?: boolean | null; isBlocked?: boolean | null; isPenalty?: boolean | null;
};

export type MatchEventView = { id: string; minute: number | null; minuteLabel: string; type: string; icon: string; teamId?: string | null; playerName?: string | null; detail: string; sourceName?: string | null; sourceUrl?: string | null; x?: number | null; y?: number | null; shot?: MatchShotMapItem | null; };

export type MatchPlayerStatItem = {
  playerId?: string | null; playerName?: string | null; teamId?: string | null; teamName?: string | null; position?: string | null; rating?: number | null; started?: boolean | null; played?: boolean | null; minutes?: number | null; goals?: number | null; assists?: number | null; shots?: number | null; shotsOnTarget?: number | null; passes?: number | null; accuratePasses?: number | null; keyPasses?: number | null; crosses?: number | null; tackles?: number | null; interceptions?: number | null; clearances?: number | null; foulsCommitted?: number | null; foulsWon?: number | null; saves?: number | null;
};

export type MatchAdvancedData = {
  venue?: string | null; city?: string | null; referee?: string | null; finalScore?: { home: number | null; away: number | null } | null; xg?: { home: number | null; away: number | null } | null; npxg?: { home: number | null; away: number | null } | null; events: MatchEventView[]; shotmap: MatchShotMapItem[]; playerStats: MatchPlayerStatItem[];
};

export type StandingRow = { rank: number; teamId: string; teamName: string; code?: string | null; image?: string | null; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; qualifies?: boolean; };
export type RelatedArticle = { id: string; title: string; summary: string; href: string; label: string; };
export type SourceChecklistItem = { label: string; status: 'ready' | 'missing' | 'optional'; note: string; };

export type MatchPageData = {
  id: string; title: string; matchDate: string; venue: string | null; city?: string | null; referee?: string | null; competition: string; groupLabel: string | null; stageLabel: string; homeTeam: MatchTeamLite; awayTeam: MatchTeamLite; score: MatchScore; status: MatchStatusView; clock: MatchClockView; stats: MatchStatMetric[]; events: MatchEventView[]; homePlayers: MatchPlayerLite[]; awayPlayers: MatchPlayerLite[]; officialLineup: OfficialLineupView; advanced: MatchAdvancedData; voteEndpoint: string; groupStandings: StandingRow[]; thirdPlaceTable: StandingRow[]; homeForm: TeamRecentMatchView[]; awayForm: TeamRecentMatchView[]; headToHead: HeadToHeadMatchView[]; tacticalKeys: string[]; matchImpact: string[]; digest: { summary?: string | null; turningPoint?: string | null; scoreLine?: string | null; href?: string | null; } | null; relatedArticles: RelatedArticle[]; sources: MatchSourceView[]; sourceChecklist: SourceChecklistItem[]; lastUpdatedAt: string;
};
