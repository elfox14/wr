import type { FbrefMetrics, TeamAsset, TeamMatch, TeamPerformanceStats, TeamReport } from './teamPageTypes';

const HIDDEN_MARKERS = ['غير متوفر في المصادر', 'غير متوفر', 'لا يتوفر في المصادر'];
const SNAPSHOT_PROVIDERS = new Set(['FBREF_STATHEAD_IMPORT', 'FBREF_STATHEAD_SNAPSHOT']);

export function cleanText(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function isBlank(value?: string | null) {
  const text = cleanText(value);
  return !text || HIDDEN_MARKERS.some((marker) => text.includes(marker));
}

export function normalize(value?: string | null) {
  return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function formatDate(value?: Date | string | null, withTime = false) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatNumber(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ar-EG');
}

export function decimal(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function percent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}%`;
}

export function list(items?: string[] | null) {
  return (items || []).map((item) => item.trim()).filter((item) => !isBlank(item)).join(' — ');
}

export function matches(team: TeamAsset) {
  return [...(team.homeMatches || []), ...(team.awayMatches || [])];
}

export function isFinished(match: TeamMatch) {
  return match.status === 'FINISHED' && typeof match.homeScore === 'number' && typeof match.awayScore === 'number';
}

export function isLive(match: TeamMatch) {
  return ['IN_PLAY', 'LIVE'].includes(match.status);
}

export function teamScore(match: TeamMatch, teamId: string) {
  const home = match.homeTeamId === teamId || match.homeTeam?.id === teamId;
  return { gf: home ? Number(match.homeScore) : Number(match.awayScore), ga: home ? Number(match.awayScore) : Number(match.homeScore) };
}

export function performance(team: TeamAsset): TeamPerformanceStats | null {
  const finished = matches(team).filter(isFinished).sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()).slice(0, 5);
  if (!finished.length) return null;
  const totals = finished.reduce((acc, match) => {
    const s = teamScore(match, team.id);
    acc.goalsFor += s.gf;
    acc.goalsAgainst += s.ga;
    if (s.gf > s.ga) acc.wins += 1;
    else if (s.gf === s.ga) acc.draws += 1;
    else acc.losses += 1;
    if (s.ga === 0) acc.cleanSheets += 1;
    return acc;
  }, { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 });
  return { sampleSize: finished.length, ...totals, avgGoalsFor: totals.goalsFor / finished.length, avgGoalsAgainst: totals.goalsAgainst / finished.length };
}

export function isSnapshot(report: TeamReport) {
  const text = normalize(`${report.provider || ''} ${report.sourceName || ''} ${report.title || ''}`);
  return Boolean(report.provider && SNAPSHOT_PROVIDERS.has(report.provider)) || text.includes('fbref') || text.includes('stathead');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function getFbrefReport(reports?: TeamReport[] | null) {
  return (reports || []).find(isSnapshot) || null;
}

export function getFbrefMetrics(reports?: TeamReport[] | null): FbrefMetrics | null {
  const metrics = getFbrefReport(reports)?.metrics;
  return isRecord(metrics) ? (metrics as FbrefMetrics) : null;
}

export function sourceLabel(report?: TeamReport | null) {
  if (!report) return 'غير متوفر في المصادر';
  return `${report.sourceName || 'FBref / Stathead'}${report.publishedAt ? ` — ${formatDate(report.publishedAt)}` : ''}`;
}
