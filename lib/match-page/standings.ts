import type { StandingRow } from './types';
import { FINISHED_STATUSES, HALF_TIME_STATUSES, LIVE_STATUSES, normalizeGroupKey, normalizeStatusValue, toNumber } from './normalizers';

type TeamLike = { id: string; name: string; code?: string | null; image?: string | null };
type MatchLike = { id: string; status?: string | null; groupPhase?: string | null; stage?: string | null; homeScore?: number | null; awayScore?: number | null; homeTeam?: TeamLike | null; awayTeam?: TeamLike | null; homeTeamId?: string | null; awayTeamId?: string | null };
type StandingAccumulator = Omit<StandingRow, 'rank'>;

function emptyRow(team: TeamLike): StandingAccumulator {
  return { teamId: team.id, teamName: team.name, code: team.code, image: team.image, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

function isCountableResult(match: MatchLike) {
  const status = normalizeStatusValue(match.status);
  if (![...FINISHED_STATUSES, ...LIVE_STATUSES, ...HALF_TIME_STATUSES].includes(status)) return false;
  return toNumber(match.homeScore) !== null && toNumber(match.awayScore) !== null;
}

function ensureTeam(map: Map<string, StandingAccumulator>, team?: TeamLike | null) {
  if (!team?.id) return null;
  if (!map.has(team.id)) map.set(team.id, emptyRow(team));
  return map.get(team.id) || null;
}

function applyResult(row: StandingAccumulator, goalsFor: number, goalsAgainst: number) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}

export function sortStandingRows(rows: StandingAccumulator[]): StandingRow[] {
  return rows
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamName.localeCompare(b.teamName, 'ar'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildStandings(matches: MatchLike[]) {
  const table = new Map<string, StandingAccumulator>();
  for (const match of matches) {
    const home = ensureTeam(table, match.homeTeam || (match.homeTeamId ? { id: match.homeTeamId, name: 'الفريق المضيف' } : null));
    const away = ensureTeam(table, match.awayTeam || (match.awayTeamId ? { id: match.awayTeamId, name: 'الفريق الضيف' } : null));
    if (!home || !away || !isCountableResult(match)) continue;
    const homeScore = Number(toNumber(match.homeScore) || 0);
    const awayScore = Number(toNumber(match.awayScore) || 0);
    applyResult(home, homeScore, awayScore);
    applyResult(away, awayScore, homeScore);
  }
  return sortStandingRows(Array.from(table.values()));
}

export function buildGroupStandings(allMatches: MatchLike[], groupKey: string | null) {
  if (!groupKey) return [];
  return buildStandings(allMatches.filter((match) => normalizeGroupKey(match.groupPhase || match.stage) === groupKey));
}

export function buildBestThirdsTable(allMatches: MatchLike[]) {
  const groupKeys = Array.from(new Set(allMatches.map((match) => normalizeGroupKey(match.groupPhase || match.stage)).filter(Boolean))) as string[];
  return groupKeys
    .flatMap((groupKey) => buildGroupStandings(allMatches, groupKey).filter((row) => row.rank === 3))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamName.localeCompare(b.teamName, 'ar'))
    .map((row, index) => ({ ...row, rank: index + 1, qualifies: index < 8 }));
}

export function buildMatchImpact(homeTeamId: string, awayTeamId: string, standings: StandingRow[], thirds: StandingRow[]) {
  const messages: string[] = [];
  const home = standings.find((row) => row.teamId === homeTeamId);
  const away = standings.find((row) => row.teamId === awayTeamId);
  if (home) messages.push(`${home.teamName} الآن في المركز ${home.rank.toLocaleString('ar-EG')} برصيد ${home.points.toLocaleString('ar-EG')} نقطة وفارق أهداف ${home.goalDifference.toLocaleString('ar-EG')}.`);
  if (away) messages.push(`${away.teamName} الآن في المركز ${away.rank.toLocaleString('ar-EG')} برصيد ${away.points.toLocaleString('ar-EG')} نقطة وفارق أهداف ${away.goalDifference.toLocaleString('ar-EG')}.`);
  const homeThird = thirds.find((row) => row.teamId === homeTeamId);
  const awayThird = thirds.find((row) => row.teamId === awayTeamId);
  if (homeThird) messages.push(`${homeThird.teamName} في ترتيب أفضل الثوالث بالمركز ${homeThird.rank.toLocaleString('ar-EG')} ${homeThird.qualifies ? 'داخل منطقة التأهل حاليًا' : 'خارج منطقة التأهل حاليًا'}.`);
  if (awayThird) messages.push(`${awayThird.teamName} في ترتيب أفضل الثوالث بالمركز ${awayThird.rank.toLocaleString('ar-EG')} ${awayThird.qualifies ? 'داخل منطقة التأهل حاليًا' : 'خارج منطقة التأهل حاليًا'}.`);
  if (!messages.length) messages.push('تأثير النتيجة على الترتيب سيظهر فور توفر بيانات المجموعة والنتيجة في قاعدة البيانات.');
  return messages;
}
