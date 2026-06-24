import type { MatchSourceView } from './types';

function normalizeProvider(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

export function publicSourceLabel(source: Pick<MatchSourceView, 'key' | 'name' | 'details'>) {
  const provider = normalizeProvider(`${source.key} ${source.name} ${source.details}`);

  if (provider.includes('THE_STATS')) return 'TheStats';
  if (provider.includes('HSPORT')) return 'HSport Animation';
  if (provider.includes('FOOTBALL_DATA')) return 'Football Data backup';

  if (provider.includes('ISPORT')) {
    if (provider.includes('TIMELINE')) return 'Timeline Snapshot محفوظ';
    if (provider.includes('FLASH') || provider.includes('REMOTE') || provider.includes('ANIMATION')) return 'Animation Snapshot محفوظ';
    return 'Snapshot محفوظ';
  }

  if (provider.includes('SNAPSHOT')) return 'Snapshot محفوظ';
  if (provider.includes('DB-MATCH')) return 'بيانات المباراة';

  return source.name || 'مصدر محفوظ';
}

export function publicSourceKey(source: Pick<MatchSourceView, 'key' | 'name' | 'details'>) {
  const provider = normalizeProvider(`${source.key} ${source.name} ${source.details}`);

  if (provider.includes('THE_STATS') || provider.includes('THE-STATS')) return 'the-stats';
  if (provider.includes('HSPORT')) return 'hsport-animation';
  if (provider.includes('FOOTBALL_DATA')) return 'football-data-backup';
  if (provider.includes('ISPORT')) return 'archived-animation-snapshot';
  if (provider.includes('SNAPSHOT')) return 'db-snapshot';
  if (provider.includes('DB-MATCH')) return 'db-match';

  return source.key || 'saved-source';
}

export function publicSourceView(source: MatchSourceView): MatchSourceView {
  return {
    ...source,
    key: publicSourceKey(source),
    name: publicSourceLabel(source),
    details: source.details ? publicSourceLabel(source) : source.details,
  };
}

export function publicSourceViews(sources: MatchSourceView[]) {
  const rows = new Map<string, MatchSourceView>();

  for (const source of sources || []) {
    const clean = publicSourceView(source);
    const existing = rows.get(clean.key);
    if (!existing || (source.priority ?? 99) < (existing.priority ?? 99)) {
      rows.set(clean.key, clean);
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.priority - b.priority);
}
