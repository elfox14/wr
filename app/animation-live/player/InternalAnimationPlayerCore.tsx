'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventFilterKey, LiveEventsResponse, LiveStatsResponse, MatchEvent } from './types';
import { sortEventsByMinute } from './eventUtils';
import { calculatePressureModel } from './livePressureUtils';
import { calculateMomentumSegments, strongestMomentumSegment } from './momentumUtils';
import { dataQuality, matchStoryLines, n, resolvedSnapshot } from './matchAnalysisUtils';
import MatchHeaderPanel from './components/MatchHeaderPanel';
import LivePitchTimelinePanel from './components/LivePitchTimelinePanel';
import LiveStatsPanel from './components/LiveStatsPanel';
import MatchIntelligencePanel from './components/MatchIntelligencePanel';
import MatchMomentumPanel from './components/MatchMomentumPanel';

type InternalAnimationPlayerCoreProps = {
  matchId?: string;
  dbMatchId?: string;
};

const STATS_POLL_MS = 60_000;
const EVENTS_POLL_MS = 30_000;

function buildQuery(matchId?: string, dbMatchId?: string) {
  const params = new URLSearchParams();
  if (dbMatchId) params.set('dbMatchId', dbMatchId);
  else if (matchId) params.set('matchId', matchId);
  return params.toString();
}

function latestEvent(events: MatchEvent[]) {
  return [...events].sort(sortEventsByMinute).at(-1) || null;
}

export default function InternalAnimationPlayerCore({ matchId = '', dbMatchId = '' }: InternalAnimationPlayerCoreProps) {
  const [statsData, setStatsData] = useState<LiveStatsResponse | null>(null);
  const [eventsData, setEventsData] = useState<LiveEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilterKey>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const query = useMemo(() => buildQuery(matchId, dbMatchId), [matchId, dbMatchId]);

  const fetchStats = useCallback(async () => {
    if (!query) {
      setError('معرّف المباراة غير متوفر.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/matches/live-stats?${query}&t=${Date.now()}`, { cache: 'no-store' });
      const payload = (await response.json()) as LiveStatsResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'تعذر تحميل إحصائيات المباراة.');
      setStatsData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل إحصائيات المباراة.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const fetchEvents = useCallback(async () => {
    if (!query) return;

    try {
      const response = await fetch(`/api/matches/live-events?${query}&t=${Date.now()}`, { cache: 'no-store' });
      const payload = (await response.json()) as LiveEventsResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'تعذر تحميل أحداث المباراة.');
      setEventsData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل أحداث المباراة.');
    }
  }, [query]);

  const refreshAll = useCallback(() => {
    setLoading(true);
    void Promise.all([fetchStats(), fetchEvents()]).finally(() => setLoading(false));
  }, [fetchStats, fetchEvents]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const statsTimer = window.setInterval(fetchStats, STATS_POLL_MS);
    const eventsTimer = window.setInterval(fetchEvents, EVENTS_POLL_MS);
    return () => {
      window.clearInterval(statsTimer);
      window.clearInterval(eventsTimer);
    };
  }, [fetchStats, fetchEvents]);

  const match = statsData?.match;
  const snapshot = useMemo(() => resolvedSnapshot(statsData), [statsData]);
  const events = useMemo(() => eventsData?.events || [], [eventsData]);
  const homeTeam = match?.homeTeam || null;
  const awayTeam = match?.awayTeam || null;
  const currentMinute = n(snapshot, 'minute') ?? n(snapshot, 'elapsed') ?? latestEvent(events)?.minute ?? null;
  const provider = statsData?.sourceStatus?.statsProvider || statsData?.sourceStatus?.primary;
  const updatedAt = statsData?.updatedAt || eventsData?.updatedAt;

  const activeEvent = useMemo(() => latestEvent(events), [events]);
  const pressure = useMemo(
    () => calculatePressureModel(snapshot, events, currentMinute, homeTeam, awayTeam),
    [snapshot, events, currentMinute, homeTeam, awayTeam],
  );
  const momentumSegments = useMemo(
    () => calculateMomentumSegments(events, homeTeam, awayTeam),
    [events, homeTeam, awayTeam],
  );
  const strongestSegment = useMemo(() => strongestMomentumSegment(momentumSegments), [momentumSegments]);
  const quality = useMemo(() => dataQuality(snapshot, events, updatedAt), [snapshot, events, updatedAt]);
  const storyLines = useMemo(() => matchStoryLines(match, snapshot, strongestSegment), [match, snapshot, strongestSegment]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 text-right md:px-6" dir="rtl">
      <MatchHeaderPanel
        match={match}
        provider={provider}
        updatedAt={updatedAt}
        loading={loading}
        error={error}
        onRefresh={refreshAll}
      />

      <LivePitchTimelinePanel
        events={events}
        home={homeTeam}
        away={awayTeam}
        activeEvent={activeEvent}
        selectedEventId={selectedEventId}
        eventFilter={eventFilter}
        onFilterChange={setEventFilter}
        onSelectEvent={setSelectedEventId}
      />

      <LiveStatsPanel snapshot={snapshot} provider={provider} updatedAt={updatedAt} />

      <MatchIntelligencePanel
        pressure={pressure}
        quality={quality}
        storyLines={storyLines}
        home={homeTeam}
        away={awayTeam}
      />

      <MatchMomentumPanel
        segments={momentumSegments}
        strongestSegment={strongestSegment}
        home={homeTeam}
        away={awayTeam}
        onSelectEvent={setSelectedEventId}
      />
    </div>
  );
}
