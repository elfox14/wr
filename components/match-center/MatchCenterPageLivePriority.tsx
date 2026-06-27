import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfessionalMatchTabsPage from '@/components/match-page/ProfessionalMatchTabsPage';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';
import prisma from '@/lib/prisma';
import type { MatchEventView, MatchPageData } from '@/lib/match-page/types';

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

function cleanText(value: any): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text && text !== '[object Object]' && !/^unknown|n\/a|null|undefined|-$/i.test(text)) return text;
  }
  if (value && typeof value === 'object') {
    return cleanText(value.name || value.fullName || value.full_name || value.title || value.label || value.displayName || value.display_name);
  }
  return null;
}

function asObject(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asList(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['all', 'events', 'timeline', 'incidents', 'commentary', 'items', 'data', 'results']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function toMinute(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function eventIcon(type?: string | null) {
  const raw = String(type || '').toLowerCase();
  if (raw.includes('goal') || raw.includes('هدف')) return '⚽';
  if (raw.includes('yellow') || raw.includes('صفراء')) return '🟨';
  if (raw.includes('red') || raw.includes('حمراء')) return '🟥';
  if (raw.includes('sub') || raw.includes('تبديل')) return '🔁';
  if (raw.includes('penalty') || raw.includes('جزاء')) return '🥅';
  if (raw.includes('var')) return '📺';
  if (raw.includes('corner') || raw.includes('ركنية')) return '🚩';
  if (raw.includes('shot') || raw.includes('تسديد')) return '🎯';
  return '●';
}

function eventMinuteLabel(minute: number | null, detail?: string | null) {
  if (minute === null || minute === undefined) return '—';
  const text = String(detail || '').toLowerCase();
  const explicit = text.match(/45\s*\+\s*(\d{1,2})/);
  if (explicit) return `45+${Number(explicit[1])}`;
  if (minute > 45 && minute < 60 && /first half|1h|الشوط الأول/i.test(text)) return `45+${minute - 45}`;
  return String(minute);
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

function eventMinuteKey(event: MatchEventView) {
  if (event.minute !== null && event.minute !== undefined) return String(event.minute);
  return normalizeEventText(event.minuteLabel);
}

function eventDedupeKey(event: MatchEventView) {
  const kind = eventKindKey(event);
  const minute = eventMinuteKey(event);
  const team = String(event.teamId || 'neutral');
  const player = normalizeEventText(event.playerName);
  const detail = normalizeEventText(event.detail);

  if (['goal', 'red', 'yellow', 'penalty', 'var'].includes(kind)) {
    return [minute, kind, team, player || detail].join('|');
  }

  if (kind === 'substitution') {
    return [minute, kind, team, detail || player].join('|');
  }

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

function teamIdFromSnapshotEvent(row: any, data: MatchPageData) {
  const teamId = cleanText(row?.teamId || row?.team_id || row?.team?.id);
  if (teamId === data.homeTeam.id || teamId === data.awayTeam.id) return teamId;
  const teamName = normalizeEventText(cleanText(row?.teamName || row?.team_name || row?.team?.name || row?.side));
  const homeName = normalizeEventText(data.homeTeam.name);
  const awayName = normalizeEventText(data.awayTeam.name);
  const homeCode = normalizeEventText(data.homeTeam.code);
  const awayCode = normalizeEventText(data.awayTeam.code);
  if (teamName && (teamName.includes(homeName) || homeName.includes(teamName) || teamName === homeCode)) return data.homeTeam.id;
  if (teamName && (teamName.includes(awayName) || awayName.includes(teamName) || teamName === awayCode)) return data.awayTeam.id;
  return null;
}

function snapshotEventLists(raw: any) {
  const data = asObject(raw);
  const normalized = asObject(data.normalized);
  return [
    ...asList(asObject(normalized.eventsDetailed).all),
    ...asList(normalized.eventsDetailed),
    ...asList(normalized.events),
    ...asList(normalized.timeline),
    ...asList(normalized.incidents),
    ...asList(asObject(data.eventsDetailed).all),
    ...asList(data.eventsDetailed),
    ...asList(data.events),
    ...asList(data.timeline),
    ...asList(data.incidents),
    ...asList(data.commentary),
    ...asList(asObject(data.raw).events),
    ...asList(asObject(data.raw).timeline),
    ...asList(asObject(data.raw).incidents),
    ...asList(asObject(asObject(data.raw).data).events),
  ];
}

function normalizeSnapshotEvent(row: any, index: number, sourceName: string, data: MatchPageData): MatchEventView | null {
  const type = cleanText(row?.type || row?.eventType || row?.event_type || row?.incident_type || row?.name) || 'event';
  const minute = toMinute(row?.minute ?? row?.time?.minute ?? row?.elapsed ?? row?.match_minute ?? row?.event_minute);
  const player = row?.player || row?.athlete || row?.scorer || {};
  const playerName = cleanText(row?.playerName || row?.player_name || player?.name || row?.scorer?.name);
  const detail = cleanText(row?.detail || row?.description || row?.comment || row?.text || row?.message) || type;
  return {
    id: cleanText(row?.id) || `${sourceName}-${index}-${minute ?? 'na'}-${type}`,
    minute,
    minuteLabel: eventMinuteLabel(minute, detail),
    type,
    icon: eventIcon(type),
    teamId: teamIdFromSnapshotEvent(row, data),
    playerName,
    detail,
    sourceName,
    sourceUrl: null,
    x: null,
    y: null,
    shot: null,
  };
}

async function fallbackEventsFromDbAndSnapshots(matchId: string, data: MatchPageData) {
  const directEvents = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
    take: 120,
  }).catch(() => [] as any[]);

  const dbEvents: MatchEventView[] = directEvents.map((event: any) => ({
    id: event.id,
    minute: toMinute(event.minute),
    minuteLabel: eventMinuteLabel(toMinute(event.minute), event.detail),
    type: event.type || 'event',
    icon: eventIcon(event.type),
    teamId: event.teamId || null,
    playerName: event.playerName || null,
    detail: event.detail || event.type || 'حدث',
    sourceName: event.sourceName || 'MATCH_EVENT',
    sourceUrl: null,
    x: null,
    y: null,
    shot: null,
  }));

  const snapshots = await prisma.matchStatsSnapshot.findMany({
    where: { matchId },
    orderBy: { capturedAt: 'desc' },
    take: 8,
  }).catch(() => [] as any[]);

  const snapshotEvents: MatchEventView[] = [];
  for (const snapshot of snapshots) {
    const sourceName = cleanText(snapshot.provider) || 'SNAPSHOT';
    for (const row of snapshotEventLists(snapshot.rawData)) {
      const event = normalizeSnapshotEvent(row, snapshotEvents.length, sourceName, data);
      if (event) snapshotEvents.push(event);
    }
    if (snapshotEvents.length >= 120) break;
  }

  return dedupeMatchEvents([...dbEvents, ...snapshotEvents]).slice(0, 120);
}

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  const data = await getMatchPageDataFast(matchId);
  if (!data) notFound();

  const events = data.events?.length ? dedupeMatchEvents(data.events) : await fallbackEventsFromDbAndSnapshots(matchId, data);

  return <ProfessionalMatchTabsPage data={{ ...data, events }} />;
}
