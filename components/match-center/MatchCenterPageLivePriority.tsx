import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfessionalMatchTabsPage from '@/components/match-page/ProfessionalMatchTabsPageRich';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';
import type { MatchEventView } from '@/lib/match-page/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Match center',
  description: 'Match center page.',
};

function normalizeEventText(value?: string | number | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function eventKindKey(event: MatchEventView) {
  const raw = normalizeEventText(`${event.type || ''} ${event.detail || ''}`);
  if (raw.includes('goal') || raw.includes('هدف')) return 'goal';
  if (raw.includes('red') || raw.includes('حمراء') || raw.includes('طرد')) return 'red';
  if (raw.includes('yellow') || raw.includes('صفراء')) return 'yellow';
  if (raw.includes('sub') || raw.includes('تبديل')) return 'substitution';
  if (raw.includes('penalty') || raw.includes('ركلة')) return 'penalty';
  if (raw.includes('var')) return 'var';
  return 'event';
}

function eventDedupeKey(event: MatchEventView) {
  const minute = event.minute !== null && event.minute !== undefined ? String(event.minute) : normalizeEventText(event.minuteLabel);
  const kind = eventKindKey(event);
  const team = String(event.teamId || 'neutral');
  const player = normalizeEventText(event.playerName);
  const detail = normalizeEventText(event.detail);
  if (['goal', 'red', 'yellow', 'penalty', 'var'].includes(kind)) return [minute, kind, team, player || detail].join('|');
  if (kind === 'substitution') return [minute, kind, team, detail || player].join('|');
  return [minute, kind, team, player, detail].join('|');
}

function dedupeMatchEvents(events: MatchEventView[]) {
  const seen = new Set<string>();
  const rows: MatchEventView[] = [];
  for (const event of events || []) {
    const key = eventDedupeKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(event);
  }
  return rows.sort((a, b) => Number(a.minute ?? 999) - Number(b.minute ?? 999));
}

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  const data = await getMatchPageDataFast(matchId);
  if (!data) notFound();
  return <ProfessionalMatchTabsPage data={{ ...data, events: dedupeMatchEvents(data.events || []) }} />;
}
