export type TeamIntelligenceSourceTier = 'official' | 'stats' | 'market' | 'editorial' | 'live' | 'video';
export type TeamIntelligenceDataRights = 'licensed' | 'public-summary' | 'manual-citation' | 'not-transferable';

export type TeamIntelligenceSourcePolicy = {
  name: string;
  tier: TeamIntelligenceSourceTier;
  preferredUse: string[];
  defaultRights: TeamIntelligenceDataRights;
  notes: string;
};

export const teamIntelligenceSourcePolicy: TeamIntelligenceSourcePolicy[] = [
  {
    name: 'Overlyzer',
    tier: 'live',
    preferredUse: ['live momentum', 'attack pressure', 'match state context'],
    defaultRights: 'manual-citation',
    notes: 'Use only public/manual observations until a direct data licence is available. Do not copy proprietary live feeds in bulk.',
  },
  {
    name: 'StatsBomb',
    tier: 'stats',
    preferredUse: ['xG', 'shot quality', 'pressure', 'possession value', 'team and player advanced metrics'],
    defaultRights: 'licensed',
    notes: 'Use licensed exports when available. Without a licence, use only publicly available articles or manually cited summaries.',
  },
  {
    name: 'Wyscout',
    tier: 'video',
    preferredUse: ['video scouting', 'player role notes', 'team shape notes', 'set-piece clips'],
    defaultRights: 'licensed',
    notes: 'Use as a scouting/video workflow source when access is licensed. Do not redistribute protected clips or tables.',
  },
  {
    name: 'Transfermarkt',
    tier: 'market',
    preferredUse: ['market value', 'age', 'club', 'position', 'contract context when public'],
    defaultRights: 'manual-citation',
    notes: 'Use as a cited market context source. Avoid scraping or copying large tables.',
  },
  {
    name: 'Opta',
    tier: 'stats',
    preferredUse: ['event data', 'team stats', 'player stats', 'historical performance context'],
    defaultRights: 'licensed',
    notes: 'Use licensed data or public Opta/Stats Perform summaries. Do not treat protected Opta feeds as free data.',
  },
  {
    name: 'Soccer Association',
    tier: 'official',
    preferredUse: ['official squad', 'coach', 'captain', 'injuries', 'fixtures', 'disciplinary notes', 'press releases'],
    defaultRights: 'public-summary',
    notes: 'Prefer official federation/association sources for facts that must be authoritative.',
  },
  {
    name: 'CIES Football Observatory',
    tier: 'market',
    preferredUse: ['player valuation studies', 'squad profile studies', 'age and transfer-value context'],
    defaultRights: 'manual-citation',
    notes: 'Use as research/valuation context with citation. Avoid reproducing proprietary rankings in full.',
  },
  {
    name: 'WhoScored',
    tier: 'stats',
    preferredUse: ['player ratings', 'team style notes', 'strengths and weaknesses', 'match stats'],
    defaultRights: 'manual-citation',
    notes: 'Use public pages manually and cite. Do not copy large tables or automate scraping.',
  },
  {
    name: 'Sofascore',
    tier: 'stats',
    preferredUse: ['match ratings', 'lineups', 'form notes', 'player profiles', 'live match context'],
    defaultRights: 'manual-citation',
    notes: 'Use public/manual observations and cite. Treat live and rating data as source-dependent, not final truth.',
  },
  {
    name: 'Understat',
    tier: 'stats',
    preferredUse: ['xG context for club-level player form', 'shot quality context'],
    defaultRights: 'manual-citation',
    notes: 'Useful for club form context more than national-team-only reporting. Cite source and avoid bulk copying.',
  },
  {
    name: 'FBref',
    tier: 'stats',
    preferredUse: ['player advanced stats', 'team standard stats', 'passing', 'shooting', 'defensive actions'],
    defaultRights: 'manual-citation',
    notes: 'Use public pages as manually cited reference. Do not copy full tables into reports.',
  },
  {
    name: 'The Athletic',
    tier: 'editorial',
    preferredUse: ['tactical context', 'injury context', 'coach quotes', 'squad narrative', 'expert analysis'],
    defaultRights: 'manual-citation',
    notes: 'Use short cited summaries only. Do not reproduce paywalled text or long excerpts.',
  },
  {
    name: 'Opta Analyst',
    tier: 'editorial',
    preferredUse: ['Opta-based explainers', 'tactical previews', 'probability context when public', 'team trend summaries'],
    defaultRights: 'manual-citation',
    notes: 'Use public analysis with citation. Keep football analysis separate from platform trading notes.',
  },
];

export const teamIntelligenceSourceRules = {
  noUnsourcedNumbers: 'If a number is not documented by one of the accepted sources, write: غير متوفر في المصادر.',
  noUnsourcedStar: 'Do not name النجم الأبرز unless a source explicitly identifies that player as the standout/star/key player.',
  limitedStatsTitle: 'If individual stats are insufficient, use the section title: أسماء بارزة في القائمة.',
  ratingsPolicy: 'Any /10 rating must be isolated in a separate section titled: تقييم مبدئي مبني على البيانات المتاحة. Do not create a rating when the source data is insufficient.',
  separationPolicy: 'Separate football analysis from trading, valuation, or buy/sell commentary.',
  rightsPolicy: 'Until licences are active, use these sources as citation and verification layers only, not as bulk data feeds.',
} as const;

export function getSourcePolicyByName(name: string) {
  return teamIntelligenceSourcePolicy.find((source) => source.name.toLowerCase() === name.toLowerCase()) || null;
}
