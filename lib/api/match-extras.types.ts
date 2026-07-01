// ============================================================
// lib/api/match-extras.types.ts
// Raw API response shape from /api/admin/matches/[id]/extras-snapshot
// All fields are optional to handle partial payloads gracefully.
// ============================================================

export interface RawMatchExtrasSnapshot {
  match?: {
    id?: string;
    status?: string;
    lastUpdatedAt?: string;
    kickoffAt?: string;
    venue?: string | null;
    referee?: string | null;
    groupName?: string | null;
    homeTeam?: { name?: string; code?: string; score?: number };
    awayTeam?: { name?: string; code?: string; score?: number };
  };
  momentum?: Array<{
    minute?: number;
    home?: number;
    away?: number;
  }>;
  events?: Array<{
    id?: string;
    minute?: number;
    team?: 'home' | 'away';
    teamId?: string;
    type?: string;
    label?: string;
    playerName?: string;
    detail?: string;
  }>;
  xgFlow?: Array<{
    minute?: number;
    homeXg?: number;
    awayXg?: number;
    label?: string;
  }>;
  shots?: Array<{
    id?: string;
    minute?: number;
    team?: 'home' | 'away';
    x?: number;
    y?: number;
    xg?: number;
    outcome?: 'goal' | 'onTarget' | 'offTarget' | 'blocked';
    insideBox?: boolean;
    player?: string;
  }>;
  stats?: Record<string, { home?: number; away?: number } | undefined>;
  heatmaps?: {
    homeDescription?: string;
    awayDescription?: string;
  };
}
