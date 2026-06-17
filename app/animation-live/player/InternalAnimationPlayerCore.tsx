'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventFilterKey, LiveEventsResponse, LiveStatsResponse, MatchEvent, Snapshot } from './types';
import { sortEventsByMinute } from './eventUtils';
import { calculatePressureModel } from './livePressureUtils';
import { calculateMomentumSegments, strongestMomentumSegment } from './momentumUtils';
import { dataQuality, matchStoryLines, n, resolvedSnapshot } from './matchAnalysisUtils';
import { isFinishedStatus, isHalfTimeStatus, normalizeStatus } from './statusUtils';
import MatchHeaderPanel from './components/MatchHeaderPanel';
import LivePitchTimelinePanel from './components/LivePitchTimelinePanel';
import LiveStatsPanel from './components/LiveStatsPanel';
import MatchIntelligencePanel from './components/MatchIntelligencePanel';
import MatchMomentumPanel from './components/MatchMomentumPanel';

type InternalAnimationPlayerCoreProps = {
  matchId?: string;
  dbMatchId?: string;
};

type MatchClockSource = 'kickoff_time' | 'live_stats' | 'cached' | 'final_elapsed' | 'final_event' | 'unavailable';
type MatchClock = { minute: number | null; source: MatchClockSource };

const STATS_POLL_MS = 60_000;
const EVENTS_POLL_MS = 30_000;
const CLOCK_TICK_MS = 15_000;
const GROUP_STAGE_MAX_LIVE_MINUTES = 115;

function buildQuery(matchId?: string, dbMatchId?: string) {
  const params = new URLSearchParams();
  if (dbMatchId) params.set('dbMatchId', dbMatchId);
  else if (matchId) params.set('matchId', matchId);
  return params.toString();
}

function latestEvent(events: MatchEvent[]) {
  const sortedEvents = [...events].sort(sortEventsByMinute);
  return sortedEvents.length ? sortedEvents[sortedEvents.length - 1] : null;
}

function isLiveLike(status?: string | null) {
  const value = normalizeStatus(status);
  return ['IN_PLAY', 'LIVE', '1H', '2H', 'ET'].includes(value) || isHalfTimeStatus(value);
}

function kickoffMinute(matchDate?: string | null, nowMs = Date.now()) {
  if (!matchDate) return null;
  const start = new Date(matchDate).getTime();
  if (!Number.isFinite(start)) return null;
  const minute = Math.floor((nowMs - start) / 60_000) + 1;
  if (minute < 1) return null;
  return Math.max(1, Math.min(GROUP_STAGE_MAX_LIVE_MINUTES, minute));
}

function matchClockMinute(snapshot: Snapshot, events: MatchEvent[], status?: string | null, matchDate?: string | null, nowMs = Date.now()): MatchClock {
  if (isLiveLike(status) && !isFinishedStatus(status)) {
    const localMinute = kickoffMinute(matchDate, nowMs);
    if (localMinute !== null) return { minute: localMinute, source: 'kickoff_time' };

    const liveMinute = n(snapshot, 'minute');
    if (liveMinute !== null) return { minute: liveMinute, source: 'live_stats' };

    return { minute: null, source: 'unavailable' };
  }

  const liveMinute = n(snapshot, 'minute');
  if (liveMinute !== null) return { minute: liveMinute, source: 'live_stats' };

  if (!isFinishedStatus(status)) return { minute: null, source: 'unavailable' };

  const elapsedMinute = n(snapshot, 'elapsed');
  if (elapsedMinute !== null) return { minute: elapsedMinute, source: 'final_elapsed' };

  const finalEventMinute = latestEvent(events)?.minute ?? null;
  return { minute: finalEventMinute, source: finalEventMinute !== null ? 'final_event' : 'unavailable' };
}

export default function InternalAnimationPlayerCore({ matchId = '', dbMatchId = '' }: InternalAnimationPlayerCoreProps) {
  const [statsData, setStatsData] = useState<LiveStatsResponse | null>(null);
  const [eventsData, setEventsData] = useState<LiveEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilterKey>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [stableMatchClock, setStableMatchClock] = useState<MatchClock>({ minute: null, source: 'unavailable' });
  const [clockNow, setClockNow] = useState(() => Date.now());

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
    setStableMatchClock({ minute: null, source: 'unavailable' });
  }, [query]);

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

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClockNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(clockTimer);
  }, []);

  const match = statsData?.match;
  const snapshot = useMemo(() => resolvedSnapshot(statsData), [statsData]);
  const events = useMemo(() => eventsData?.events || [], [eventsData]);
  const homeTeam = match?.homeTeam || null;
  const awayTeam = match?.awayTeam || null;
  const rawClock = matchClockMinute(snapshot, events, match?.status, match?.matchDate, clockNow);
  const currentMinute = rawClock.minute ?? stableMatchClock.minute;
  const clockSource = rawClock.minute !== null ? rawClock.source : stableMatchClock.minute !== null ? 'cached' : 'unavailable';
  const provider = statsData?.sourceStatus?.statsProvider || statsData?.sourceStatus?.primary;
  const updatedAt = statsData?.updatedAt || eventsData?.updatedAt;

  useEffect(() => {
    if (rawClock.minute !== null) setStableMatchClock(rawClock);
  }, [rawClock.minute, rawClock.source]);

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
        currentMinute={currentMinute}
        clockSource={clockSource}
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
        currentMinute={currentMinute}
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
