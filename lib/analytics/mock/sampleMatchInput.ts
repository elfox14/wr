// ============================================================
// lib/analytics/mock/sampleMatchInput.ts
// Realistic mock MatchInsightsInput — used for development,
// Storybook, and as a fallback when extraction fails.
// Scenario: Brazil 2 – 1 Argentina (WC 2026, Group Stage)
// ============================================================

import type { MatchInsightsInput } from '../match-analytics.types';

export const sampleMatchInput: MatchInsightsInput = {
  homeTeamName: 'Brazil',
  awayTeamName: 'Argentina',

  // ── Stats ──────────────────────────────────────────────
  stats: [
    { key: 'possession', label: 'Ball Possession', home: 54, away: 46, suffix: '%' },
    { key: 'shots', label: 'Total Shots', home: 14, away: 11 },
    { key: 'shotsOnTarget', label: 'Shots on Target', home: 6, away: 4 },
    { key: 'corners', label: 'Corners', home: 7, away: 4 },
    { key: 'fouls', label: 'Fouls', home: 12, away: 15 },
    { key: 'yellowCards', label: 'Yellow Cards', home: 2, away: 3 },
    { key: 'offsides', label: 'Offsides', home: 3, away: 2 },
    { key: 'passes', label: 'Passes', home: 487, away: 412 },
    { key: 'passesCompleted', label: 'Passes Completed', home: 421, away: 351 },
  ],

  // ── Momentum (every 5 min, 0-90) ──────────────────────
  momentum: [
    { minute: 0,  home: 50, away: 50 },
    { minute: 5,  home: 55, away: 45 },
    { minute: 10, home: 60, away: 40 },
    { minute: 15, home: 52, away: 48 },
    { minute: 20, home: 45, away: 55 },
    { minute: 25, home: 42, away: 58 },
    { minute: 30, home: 48, away: 52 },
    { minute: 35, home: 65, away: 35 },  // Brazil goal surge
    { minute: 40, home: 58, away: 42 },
    { minute: 45, home: 50, away: 50 },
    { minute: 50, home: 45, away: 55 },
    { minute: 55, home: 40, away: 60 },  // Argentina equaliser
    { minute: 60, home: 55, away: 45 },
    { minute: 65, home: 60, away: 40 },
    { minute: 70, home: 58, away: 42 },
    { minute: 75, home: 52, away: 48 },
    { minute: 80, home: 48, away: 52 },
    { minute: 85, home: 70, away: 30 },  // Brazil late winner
    { minute: 90, home: 65, away: 35 },
  ],

  // ── xG Flow (cumulative) ───────────────────────────────
  xgFlow: [
    { minute: 0,  homeXg: 0.00, awayXg: 0.00 },
    { minute: 10, homeXg: 0.08, awayXg: 0.03 },
    { minute: 20, homeXg: 0.12, awayXg: 0.11 },
    { minute: 30, homeXg: 0.18, awayXg: 0.20 },
    { minute: 35, homeXg: 0.52, awayXg: 0.22, label: 'Vinicius goal' },
    { minute: 40, homeXg: 0.65, awayXg: 0.28 },
    { minute: 45, homeXg: 0.70, awayXg: 0.35 },
    { minute: 52, homeXg: 0.74, awayXg: 0.62, label: 'Messi chance' },
    { minute: 55, homeXg: 0.76, awayXg: 0.95, label: 'Martinez goal' },
    { minute: 60, homeXg: 0.84, awayXg: 1.02 },
    { minute: 70, homeXg: 1.10, awayXg: 1.08 },
    { minute: 80, homeXg: 1.25, awayXg: 1.15 },
    { minute: 87, homeXg: 1.68, awayXg: 1.18, label: 'Rodrygo winner' },
    { minute: 90, homeXg: 1.72, awayXg: 1.20 },
  ],

  // ── Shots ──────────────────────────────────────────────
  shots: [
    {
      id: 's1', minute: 12, team: 'home', x: 88, y: 50,
      xg: 0.08, outcome: 'onTarget', insideBox: false, player: 'Vinicius Jr',
    },
    {
      id: 's2', minute: 24, team: 'away', x: 85, y: 45,
      xg: 0.11, outcome: 'offTarget', insideBox: false, player: 'Di María',
    },
    {
      id: 's3', minute: 35, team: 'home', x: 96, y: 48,
      xg: 0.34, outcome: 'goal', insideBox: true, player: 'Vinicius Jr',
    },
    {
      id: 's4', minute: 38, team: 'home', x: 90, y: 52,
      xg: 0.13, outcome: 'blocked', insideBox: false, player: 'Rodrygo',
    },
    {
      id: 's5', minute: 42, team: 'away', x: 92, y: 44,
      xg: 0.07, outcome: 'offTarget', insideBox: false, player: 'Messi',
    },
    {
      id: 's6', minute: 52, team: 'away', x: 97, y: 50,
      xg: 0.27, outcome: 'onTarget', insideBox: true, player: 'Messi',
    },
    {
      id: 's7', minute: 55, team: 'away', x: 95, y: 51,
      xg: 0.33, outcome: 'goal', insideBox: true, player: 'L. Martinez',
    },
    {
      id: 's8', minute: 63, team: 'home', x: 89, y: 49,
      xg: 0.14, outcome: 'onTarget', insideBox: false, player: 'Raphinha',
    },
    {
      id: 's9', minute: 71, team: 'home', x: 93, y: 53,
      xg: 0.15, outcome: 'blocked', insideBox: false, player: 'Paquetá',
    },
    {
      id: 's10', minute: 78, team: 'away', x: 91, y: 47,
      xg: 0.10, outcome: 'offTarget', insideBox: false, player: 'Álvarez',
    },
    {
      id: 's11', minute: 87, team: 'home', x: 98, y: 50,
      xg: 0.43, outcome: 'goal', insideBox: true, player: 'Rodrygo',
    },
    {
      id: 's12', minute: 89, team: 'away', x: 94, y: 48,
      xg: 0.09, outcome: 'offTarget', insideBox: false, player: 'Messi',
    },
  ],

  // ── Events ─────────────────────────────────────────────
  events: [
    { minute: 22, team: 'away', type: 'yellow', label: 'Di María' },
    { minute: 35, team: 'home', type: 'goal',   label: 'Vinicius Jr (ast. Rodrygo)' },
    { minute: 44, team: 'home', type: 'yellow', label: 'Casemiro' },
    { minute: 55, team: 'away', type: 'goal',   label: 'L. Martinez (ast. Messi)' },
    { minute: 58, team: 'away', type: 'yellow', label: 'Otamendi' },
    { minute: 67, team: 'away', type: 'substitution', label: 'Di María → Mac Allister' },
    { minute: 72, team: 'home', type: 'substitution', label: 'Vinicius Jr → Endrick' },
    { minute: 75, team: 'away', type: 'yellow', label: 'Almada' },
    { minute: 80, team: 'away', type: 'red',    label: 'Almada (2nd yellow)' },
    { minute: 87, team: 'home', type: 'goal',   label: 'Rodrygo (ast. Endrick)' },
  ],
};

/** Convenience export — pre-computed team names for display */
export const sampleTeams = {
  home: sampleMatchInput.homeTeamName,
  away: sampleMatchInput.awayTeamName,
} as const;
