export function normalizeISportsName(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fc|sc|cf|club|national|team|u\d+|women|woman|w)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapISportsPosition(position?: number | string | null) {
  const raw = Number(position);
  if (raw === 0) return 'GK';
  if (raw === 1) return 'DEF';
  if (raw === 2) return 'MID';
  if (raw === 3) return 'MID';
  if (raw === 4) return 'FWD';
  return undefined;
}

export function bestNameMatch<T extends { name: string }>(name: string, candidates: T[]) {
  const normalized = normalizeISportsName(name);
  if (!normalized) return null;

  return candidates.find((candidate) => normalizeISportsName(candidate.name) === normalized) ||
    candidates.find((candidate) => {
      const candidateName = normalizeISportsName(candidate.name);
      return candidateName.includes(normalized) || normalized.includes(candidateName);
    }) ||
    null;
}

export function flattenLineupPlayers(lineupPayload: any) {
  const blocks = Array.isArray(lineupPayload?.data) ? lineupPayload.data : [];
  const players: Array<any & { side: 'home' | 'away'; squadRole: 'lineup' | 'backup' }> = [];

  for (const block of blocks) {
    for (const player of block.homeLineup || []) players.push({ ...player, side: 'home', squadRole: 'lineup' });
    for (const player of block.awayLineup || []) players.push({ ...player, side: 'away', squadRole: 'lineup' });
    for (const player of block.homeBackup || []) players.push({ ...player, side: 'home', squadRole: 'backup' });
    for (const player of block.awayBackup || []) players.push({ ...player, side: 'away', squadRole: 'backup' });
  }

  return players;
}
