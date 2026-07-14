export type CanonicalTournamentMatch = {
  id: string;
  externalId?: string | null;
  syncSource?: string | null;
  stage?: string | null;
  groupPhase?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: { id?: string | null } | null;
  awayTeam?: { id?: string | null } | null;
  lastSyncedAt?: Date | string | null;
};

function upper(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

export function canonicalStageKey(match: CanonicalTournamentMatch) {
  const raw = `${match.stage || ''} ${match.groupPhase || ''}`.trim().toLowerCase();
  if (raw.includes('third') || raw.includes('bronze')) return 'third_place';
  if (raw.includes('semi')) return 'semi_finals';
  if (raw.includes('quarter')) return 'quarter_finals';
  if (raw.includes('round_of_16') || raw.includes('last_16') || raw.includes('r16') || raw.includes('round of 16')) return 'round_of_16';
  if (raw.includes('round_of_32') || raw.includes('last_32') || raw.includes('r32') || raw.includes('round of 32')) return 'round_of_32';
  if (raw === 'final' || raw.includes(' final')) return 'final';
  const group = raw.match(/group[_\s-]*([a-l])/i)?.[1] || 'group';
  return `group_${group.toUpperCase()}`;
}

export function canonicalFixtureKey(match: CanonicalTournamentMatch) {
  const homeId = String(match.homeTeamId || match.homeTeam?.id || '').trim();
  const awayId = String(match.awayTeamId || match.awayTeam?.id || '').trim();
  return `${canonicalStageKey(match)}:${[homeId, awayId].sort().join('|')}`;
}

export function canonicalMatchPriority(match: CanonicalTournamentMatch) {
  const fifa = upper(match.syncSource).includes('FIFA') || String(match.externalId || '').toLowerCase().startsWith('fifa-');
  const syncedAt = match.lastSyncedAt ? new Date(match.lastSyncedAt).getTime() : 0;
  return (fifa ? 1_000_000_000_000_000 : 0) + (Number.isFinite(syncedAt) ? syncedAt : 0);
}

export function canonicalizeTournamentMatches<T extends CanonicalTournamentMatch>(matches: T[]) {
  const byFixture = new Map<string, T>();
  for (const match of matches) {
    const key = canonicalFixtureKey(match);
    const current = byFixture.get(key);
    if (!current || canonicalMatchPriority(match) > canonicalMatchPriority(current)) byFixture.set(key, match);
  }
  return [...byFixture.values()];
}
